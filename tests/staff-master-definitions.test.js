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

test("employee master definitions are persisted, versioned and exposed on api surfaces", async () => {
  ensureTenant("tenant_staff_master_defs_other", "staff-master-defs-other");
  const server = await listen(createApp());
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const baseUrlV1 = `http://127.0.0.1:${port}/api/v1`;
  const stamp = Date.now();

  try {
    const attendanceCode = `PR${stamp}`.slice(-10);
    const attendance = await api(baseUrl, "/staff-os/attendance-masters", {
      method: "POST",
      body: {
        code: attendanceCode,
        name: `Present QA ${stamp}`,
        dayCount: 1,
        paid: true,
        availableForAppointment: true,
        color: "#0f766e",
        sortOrder: 5,
        notes: "Flexi attendance master equivalent"
      }
    });
    assert.equal(attendance.response.status, 201);
    assert.equal(attendance.payload.code, attendanceCode);
    assert.equal(attendance.payload.dayCount, 1);
    assert.equal(attendance.payload.paid, true);
    assert.equal(attendance.payload.availableForAppointment, true);
    assert.equal(attendance.payload.version, 1);

    const staleAttendance = await api(baseUrl, `/staff-os/attendance-masters/${attendance.payload.id}`, {
      method: "PATCH",
      body: { version: 0, name: "Stale update" }
    });
    assert.equal(staleAttendance.response.status, 409);

    const updatedAttendance = await api(baseUrl, `/staff-os/attendance-masters/${attendance.payload.id}`, {
      method: "PATCH",
      body: {
        version: attendance.payload.version,
        code: "IGNORED",
        name: `Half Present QA ${stamp}`,
        dayCount: 0.5,
        paid: false,
        availableForAppointment: false,
        color: "#1f6172"
      }
    });
    assert.equal(updatedAttendance.response.status, 200);
    assert.equal(updatedAttendance.payload.code, attendanceCode);
    assert.equal(updatedAttendance.payload.dayCount, 0.5);
    assert.equal(updatedAttendance.payload.paid, false);
    assert.equal(updatedAttendance.payload.version, 2);

    const archivedAttendance = await api(baseUrl, `/staff-os/attendance-masters/${attendance.payload.id}/status`, {
      method: "PATCH",
      body: { version: updatedAttendance.payload.version, status: "archived", hide: true }
    });
    assert.equal(archivedAttendance.response.status, 200);
    assert.equal(archivedAttendance.payload.status, "archived");
    assert.equal(archivedAttendance.payload.hide, true);

    const shiftCode = `SH${stamp}`.slice(-10);
    const shift = await api(baseUrl, "/staff-os/shift-masters", {
      method: "POST",
      body: {
        shortCode: shiftCode,
        name: `10 To 8 QA ${stamp}`,
        description: "Standard salon floor shift",
        startTime: "10:00",
        endTime: "20:00",
        breakMinutes: 30,
        color: "#bbf7d0",
        shiftType: "regular"
      }
    });
    assert.equal(shift.response.status, 201);
    assert.equal(shift.payload.shortCode, shiftCode);
    assert.equal(shift.payload.shiftType, "regular");
    assert.equal(shift.payload.breakMinutes, 30);

    const updatedShift = await api(baseUrl, `/staff-os/shift-masters/${shift.payload.id}`, {
      method: "PATCH",
      body: {
        version: shift.payload.version,
        shortCode: "IGNORED",
        name: `Weekly Off QA ${stamp}`,
        description: "Weekly off marker",
        startTime: "00:00",
        endTime: "23:59",
        breakMinutes: 0,
        shiftType: "weekly_off",
        hide: false
      }
    });
    assert.equal(updatedShift.response.status, 200);
    assert.equal(updatedShift.payload.shortCode, shiftCode);
    assert.equal(updatedShift.payload.shiftType, "weekly_off");
    assert.equal(updatedShift.payload.version, 2);

    const leaveCode = `LV${stamp}`.slice(-10);
    const leave = await api(baseUrl, "/staff-os/leave-masters", {
      method: "POST",
      body: {
        code: leaveCode,
        name: `Paid Leave QA ${stamp}`,
        dayCount: 1,
        paid: true,
        availableForAppointment: false,
        leaveQuota: 12,
        quotaPeriod: "monthly",
        shiftTemplateId: shift.payload.id,
        shiftName: shift.payload.name,
        carryForwardAllowed: true,
        approvalRequired: true,
        notes: "Flexi leave master equivalent"
      }
    });
    assert.equal(leave.response.status, 201);
    assert.equal(leave.payload.code, leaveCode);
    assert.equal(leave.payload.leaveQuota, 12);
    assert.equal(leave.payload.quotaPeriod, "monthly");
    assert.equal(leave.payload.shiftTemplateId, shift.payload.id);
    assert.equal(leave.payload.carryForwardAllowed, true);

    const updatedLeave = await api(baseUrl, `/staff-os/leave-masters/${leave.payload.id}`, {
      method: "PATCH",
      body: {
        version: leave.payload.version,
        code: "IGNORED",
        name: `Privilege Leave QA ${stamp}`,
        dayCount: 1,
        paid: true,
        leaveQuota: 24,
        quotaPeriod: "yearly",
        shiftTemplateId: updatedShift.payload.id,
        shiftName: updatedShift.payload.name,
        carryForwardAllowed: false,
        approvalRequired: true
      }
    });
    assert.equal(updatedLeave.response.status, 200);
    assert.equal(updatedLeave.payload.code, leaveCode);
    assert.equal(updatedLeave.payload.leaveQuota, 24);
    assert.equal(updatedLeave.payload.quotaPeriod, "yearly");

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

    const v1Smoke = await api(baseUrlV1, "/staff-os/shift-masters", { authToken: loginBody.data.accessToken });
    assert.equal(v1Smoke.response.status, 200);
    assert.ok(Array.isArray(v1Smoke.payload.data));
    assert.ok(v1Smoke.payload.data.some((item) => item.id === shift.payload.id));

    const isolated = await api(baseUrl, "/staff-os/shift-masters", {
      tenantId: "tenant_staff_master_defs_other"
    });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.some((item) => item.id === shift.payload.id), false);
  } finally {
    await close(server);
  }
});
