import test from "node:test";
import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
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

function headers(role = "owner", tenantId = "tenant_aura") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role
  };
}

async function api(baseUrl, path, body, { role = "owner", tenantId = "tenant_aura" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: headers(role, tenantId),
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureBranch() {
  const existing = db.prepare("SELECT * FROM branches ORDER BY createdAt LIMIT 1").get();
  if (existing) return existing;
  const stamp = new Date().toISOString();
  const branch = {
    id: `branch_phase4_${randomUUID().slice(0, 8)}`,
    name: "Phase 4 Test Branch",
    city: "Mumbai",
    address: "",
    phone: "",
    gstin: "",
    timezone: "Asia/Kolkata",
    status: "active",
    createdAt: stamp,
    updatedAt: stamp
  };
  db.prepare(`INSERT INTO branches
    (id, name, city, address, phone, gstin, timezone, status, createdAt, updatedAt)
    VALUES (@id, @name, @city, @address, @phone, @gstin, @timezone, @status, @createdAt, @updatedAt)`).run(branch);
  return branch;
}

function createStaffFixture(branchId) {
  const stamp = new Date().toISOString();
  const staff = {
    id: `staff_phase4_${randomUUID().slice(0, 8)}`,
    name: "Phase 4 Approval Staff",
    role: "stylist",
    phone: "",
    email: "",
    branchId,
    shift: "",
    status: "active",
    assignedServices: "[]",
    commissionRule: "{}",
    attendance: "[]",
    performance: "{}",
    createdAt: stamp,
    updatedAt: stamp
  };
  db.prepare(`INSERT INTO staff
    (id, name, role, phone, email, branchId, shift, status, assignedServices, commissionRule, attendance, performance, createdAt, updatedAt)
    VALUES (@id, @name, @role, @phone, @email, @branchId, @shift, @status, @assignedServices, @commissionRule, @attendance, @performance, @createdAt, @updatedAt)`).run(staff);
  return staff;
}

function createAttendanceFixture(tenantId, branchId, staffId) {
  const stamp = new Date().toISOString();
  const attendance = {
    id: `att_phase4_${randomUUID().slice(0, 8)}`,
    tenantId,
    branchId,
    staffId,
    date: "2026-05-29",
    status: "present",
    clockIn: "10:00",
    clockOut: "18:00",
    minutesWorked: 480,
    overtimeMinutes: 0,
    notes: "Original approved shift",
    createdAt: stamp,
    updatedAt: stamp
  };
  db.prepare(`INSERT INTO staff_attendance
    (id, tenantId, branchId, staffId, date, status, clockIn, clockOut, minutesWorked, overtimeMinutes, notes, createdAt, updatedAt)
    VALUES (@id, @tenantId, @branchId, @staffId, @date, @status, @clockIn, @clockOut, @minutesWorked, @overtimeMinutes, @notes, @createdAt, @updatedAt)`).run(attendance);
  return attendance;
}

function auditCount(tenantId = "tenant_aura") {
  return db.prepare("SELECT COUNT(*) AS count FROM staff_zero_trust_audit WHERE tenantId = ?").get(tenantId).count;
}

function attendanceById(id) {
  return db.prepare("SELECT * FROM staff_attendance WHERE id = ?").get(id);
}

test("staff enterprise action workflows require approval before sensitive data changes", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const savepoint = `staff_enterprise_actions_${randomUUID().replaceAll("-", "")}`;
  const tenantId = "tenant_aura";
  db.prepare(`SAVEPOINT ${savepoint}`).run();
  const branch = ensureBranch();
  const staff = createStaffFixture(branch.id);
  const attendance = createAttendanceFixture(tenantId, branch.id, staff.id);
  const beforeAudit = auditCount(tenantId);

  try {
    const training = await api(baseUrl, "/staff-enterprise/training/assign", {
      staffId: staff.id,
      branchId: branch.id,
      trainingTitle: "Premium consultation recovery",
      trainingType: "client_experience"
    }, { tenantId });
    assert.equal(training.response.status, 201);
    assert.equal(training.payload.staffId, staff.id);
    assert.equal(training.payload.status, "assigned");

    const rejectRequest = await api(baseUrl, "/staff-enterprise/approval-request", {
      staffId: staff.id,
      branchId: branch.id,
      entityType: "staff_attendance",
      entityId: attendance.id,
      actionRequested: "attendance_update",
      reason: "Reject path should not touch source attendance",
      afterJson: { status: "absent", notes: "Rejected change" }
    }, { tenantId });
    assert.equal(rejectRequest.response.status, 201);
    assert.equal(rejectRequest.payload.status, "pending");
    assert.equal(attendanceById(attendance.id).status, "present");

    const rejected = await api(baseUrl, "/staff-enterprise/reject", {
      approvalRequestId: rejectRequest.payload.id,
      rejectionReason: "Evidence does not match biometric log"
    }, { tenantId });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.payload.status, "rejected");
    assert.equal(attendanceById(attendance.id).status, "present");
    assert.equal(attendanceById(attendance.id).notes, "Original approved shift");

    const approveRequest = await api(baseUrl, "/staff-enterprise/approval-request", {
      staffId: staff.id,
      branchId: branch.id,
      entityType: "staff_attendance",
      entityId: attendance.id,
      actionRequested: "attendance_update",
      reason: "Manager verified late arrival correction",
      afterJson: { status: "late", notes: "Approved late correction" }
    }, { tenantId });
    assert.equal(approveRequest.response.status, 201);
    assert.equal(approveRequest.payload.status, "pending");
    assert.equal(attendanceById(attendance.id).status, "present");

    const staffRoleApprove = await api(baseUrl, "/staff-enterprise/approve", {
      approvalRequestId: approveRequest.payload.id
    }, { role: "staff", tenantId });
    assert.equal(staffRoleApprove.response.status, 403);
    assert.equal(attendanceById(attendance.id).status, "present");

    const approved = await api(baseUrl, "/staff-enterprise/approve", {
      approvalRequestId: approveRequest.payload.id
    }, { tenantId });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.payload.status, "approved");
    assert.equal(approved.payload.applied.status, "late");
    assert.equal(attendanceById(attendance.id).status, "late");
    assert.equal(attendanceById(attendance.id).notes, "Approved late correction");

    const manualAudit = await api(baseUrl, "/staff-enterprise/audit-event", {
      staffId: staff.id,
      branchId: branch.id,
      actionType: "manual_staff_review_note",
      entityType: "staff",
      entityId: staff.id,
      afterJson: { note: "Manager reviewed Phase 4 approval chain" }
    }, { tenantId });
    assert.equal(manualAudit.response.status, 201);
    assert.equal(manualAudit.payload.actionType, "manual_staff_review_note");
    assert.ok(manualAudit.payload.eventHash);

    assert.ok(auditCount(tenantId) >= beforeAudit + 6);
  } finally {
    await close(server);
    db.prepare(`ROLLBACK TO ${savepoint}`).run();
    db.prepare(`RELEASE ${savepoint}`).run();
  }
});
