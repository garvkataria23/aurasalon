import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { db } from "../server/db.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function headers(role = "owner", tenantId = "tenant_aura", authToken = "") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role,
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, role = "owner", tenantId = "tenant_aura", authToken = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(role, tenantId, authToken),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureTenant(id, slug) {
  const now = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, status, planId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, `Tenant ${slug}`, slug, "active", plan?.id || null, now, now);
}

test("attendance category and target incentive masters persist Flexi-style rules and slabs", async () => {
  ensureTenant("tenant_staff_master_next_other", "staff-master-next-other");
  const server = await listen(createApp());
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const baseUrlV1 = `http://127.0.0.1:${port}/api/v1`;
  const stamp = Date.now();

  try {
    const attendance = await api(baseUrl, "/staff-os/attendance-masters", {
      method: "POST",
      body: {
        code: `LC${stamp}`.slice(-10),
        name: `Late Coming QA ${stamp}`,
        dayCount: 0,
        paid: false,
        availableForAppointment: true
      }
    });
    assert.equal(attendance.response.status, 201);

    const shift = await api(baseUrl, "/staff-os/shift-masters", {
      method: "POST",
      body: {
        shortCode: `ATC${stamp}`.slice(-10),
        name: `11 To 08 QA ${stamp}`,
        startTime: "11:00",
        endTime: "20:00",
        shiftType: "regular"
      }
    });
    assert.equal(shift.response.status, 201);

    const category = await api(baseUrl, "/staff-os/attendance-categories", {
      method: "POST",
      body: {
        name: `11 To 08 Rule QA ${stamp}`,
        workingDurationMinutes: 540,
        inTime: "11:00",
        outTime: "20:00",
        overtimeApplicable: true,
        minimumOtDurationMinutes: 45,
        allowableLateMinutes: 15,
        lateMarkStatusId: attendance.payload.id,
        lateMarkAfterCount: 3,
        lateMarkMode: "all_after_x_late",
        severeLateStatusId: attendance.payload.id,
        severeLateAfterMinutes: 30,
        attendanceSlabs: [
          { sNo: 1, fromMinutes: 0, toMinutes: 15, statusId: attendance.payload.id, statusName: attendance.payload.name },
          { sNo: 2, fromMinutes: 16, toMinutes: 30, statusId: attendance.payload.id, statusName: attendance.payload.name }
        ],
        allowableShiftIds: [shift.payload.id],
        notes: "Flexi attendance category equivalent"
      }
    });
    assert.equal(category.response.status, 201);
    assert.equal(category.payload.workingDurationMinutes, 540);
    assert.equal(category.payload.overtimeApplicable, true);
    assert.equal(category.payload.lateMarkMode, "all_after_x_late");
    assert.equal(category.payload.attendanceSlabs.length, 2);
    assert.deepEqual(category.payload.allowableShiftIds, [shift.payload.id]);

    const staleCategory = await api(baseUrl, `/staff-os/attendance-categories/${category.payload.id}`, {
      method: "PATCH",
      body: { version: 0, name: "stale" }
    });
    assert.equal(staleCategory.response.status, 409);

    const updatedCategory = await api(baseUrl, `/staff-os/attendance-categories/${category.payload.id}`, {
      method: "PATCH",
      body: {
        version: category.payload.version,
        name: `10 To 08 Rule QA ${stamp}`,
        workingDurationMinutes: 600,
        inTime: "10:00",
        outTime: "20:00",
        overtimeApplicable: true,
        minimumOtDurationMinutes: 30,
        allowableLateMinutes: 10,
        lateMarkStatusId: attendance.payload.id,
        lateMarkAfterCount: 2,
        lateMarkMode: "every_x_late",
        severeLateStatusId: attendance.payload.id,
        severeLateAfterMinutes: 25,
        attendanceSlabs: category.payload.attendanceSlabs,
        allowableShiftIds: [shift.payload.id]
      }
    });
    assert.equal(updatedCategory.response.status, 200);
    assert.equal(updatedCategory.payload.version, 2);
    assert.equal(updatedCategory.payload.lateMarkMode, "every_x_late");

    const staffA = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      body: { branchId: `branch_target_${stamp}`, firstName: "Target", lastName: "One", employeeCode: `TGT-A-${stamp}` }
    });
    assert.equal(staffA.response.status, 201);
    const staffB = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      body: { branchId: staffA.payload.branchId, firstName: "Target", lastName: "Two", employeeCode: `TGT-B-${stamp}` }
    });
    assert.equal(staffB.response.status, 201);

    const target = await api(baseUrl, "/staff-os/target-incentives", {
      method: "POST",
      body: {
        branchId: "",
        targetType: "service",
        assigneeType: "staff",
        assigneeId: staffA.payload.id,
        assigneeName: staffA.payload.fullName,
        roleScope: "operator",
        slabs: [
          { sNo: 1, fromAmount: 0, toAmount: 10000, incentivePercent: 5, incentiveAmount: 0 },
          { sNo: 2, fromAmount: 10001, toAmount: 25000, incentivePercent: 8, incentiveAmount: 0 }
        ],
        notes: "Service target incentive slab"
      }
    });
    assert.equal(target.response.status, 201);
    assert.equal(target.payload.targetType, "service");
    assert.equal(target.payload.slabs.length, 2);
    assert.equal(target.payload.slabs[1].incentivePercent, 8);

    const copied = await api(baseUrl, `/staff-os/target-incentives/${target.payload.id}/copy`, {
      method: "POST",
      body: {
        targets: [
          { assigneeType: "staff", assigneeId: staffB.payload.id, assigneeName: staffB.payload.fullName, roleScope: "operator", branchId: "" }
        ]
      }
    });
    assert.equal(copied.response.status, 200);
    assert.equal(copied.payload.length, 1);
    assert.equal(copied.payload[0].assigneeId, staffB.payload.id);
    assert.equal(copied.payload[0].slabs[1].incentivePercent, 8);

    const branchTarget = await api(baseUrl, "/staff-os/target-incentives", {
      method: "POST",
      body: {
        targetType: "branch_admin",
        assigneeType: "branch",
        assigneeId: `HO-${stamp}`,
        assigneeName: `HO ${stamp}`,
        roleScope: "all",
        slabs: [{ sNo: 1, fromAmount: 0, toAmount: 50000, incentivePercent: 2, incentiveAmount: 0 }]
      }
    });
    assert.equal(branchTarget.response.status, 201);
    assert.equal(branchTarget.payload.assigneeType, "branch");

    const adminTarget = await api(baseUrl, "/staff-os/target-incentives", {
      method: "POST",
      body: {
        branchId: "",
        targetType: "admin",
        assigneeType: "staff",
        assigneeId: staffA.payload.id,
        assigneeName: staffA.payload.fullName,
        roleScope: "admin",
        slabs: [{ sNo: 1, employeeAmountPercent: 4, employeeAmount: 750 }]
      }
    });
    assert.equal(adminTarget.response.status, 201);
    assert.equal(adminTarget.payload.slabs[0].employeeAmountPercent, 4);
    assert.equal(adminTarget.payload.slabs[0].employeeAmount, 750);

    const login = await fetch(`${baseUrlV1}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "tenant_aura",
        email: "owner@aurasalon.example",
        password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026"
      })
    });
    assert.equal(login.status, 201);
    const loginBody = await login.json();
    const v1Smoke = await api(baseUrlV1, "/staff-os/target-incentives?targetType=service", { authToken: loginBody.data.accessToken });
    assert.equal(v1Smoke.response.status, 200);
    assert.ok(v1Smoke.payload.data.some((item) => item.id === target.payload.id));

    const isolated = await api(baseUrl, "/staff-os/target-incentives?targetType=service", {
      tenantId: "tenant_staff_master_next_other"
    });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.some((item) => item.id === target.payload.id), false);
  } finally {
    await close(server);
  }
});
