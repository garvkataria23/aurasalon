import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "../server/db.js";
import { ensureStaffOsSchema } from "../server/services/staff-os-schema.service.js";
import { staffShiftSwapService } from "../server/services/staff-shift-swap.service.js";

ensureStaffOsSchema();

function fixture() {
  const suffix = randomUUID();
  const tenantId = `swap_tenant_${suffix}`;
  const branchId = `swap_branch_${suffix}`;
  const staffA = `swap_staff_a_${suffix}`;
  const staffB = `swap_staff_b_${suffix}`;
  const staffC = `swap_staff_c_${suffix}`;
  const userIdA = `swap_user_a_${suffix}`;
  const userIdB = `swap_user_b_${suffix}`;
  const userIdOwner = `swap_user_owner_${suffix}`;
  const stamp = new Date().toISOString();

  db.prepare(`INSERT INTO tenants (id,name,slug,createdAt,updatedAt) VALUES (@id,'Swap Test',@slug,@stamp,@stamp)`)
    .run({ id: tenantId, slug: `swap-test-${suffix}`, stamp });
  const codes = { [staffA]: "SWA", [staffB]: "SWB", [staffC]: "SWC" };
  for (const id of [staffA, staffB, staffC]) {
    db.prepare(`INSERT INTO staff_master (id, tenant_id, branch_id, employee_code, first_name, full_name, status)
      VALUES (@id, @tenantId, @branchId, @code, 'Test', 'Test Staff', 'active')`)
      .run({ id, tenantId, branchId, code: `${codes[id]}_${suffix.slice(0, 8)}` });
  }
  for (const [userId, staffId, role] of [[userIdA, staffA, "staff"], [userIdB, staffB, "staff"], [userIdOwner, "", "owner"]]) {
    db.prepare(`INSERT INTO tenant_users (id, tenantId, email, name, role, branchIds, staffId, status, createdAt, updatedAt)
      VALUES (@id,@tenantId,@email,@name,@role,@branchIds,@staffId,'active',@stamp,@stamp)`)
      .run({ id: userId, tenantId, email: `${userId}@test.com`, name: `User ${userId.slice(-6)}`, role, branchIds: JSON.stringify([branchId]), staffId, stamp });
  }

  const staffAccessA = { tenantId, branchId, branchIds: [branchId], staffId: staffA, userId: userIdA, role: "staff" };
  const staffAccessB = { tenantId, branchId, branchIds: [branchId], staffId: staffB, userId: userIdB, role: "staff" };
  const ownerAccess = { tenantId, branchId, branchIds: [branchId], userId: userIdOwner, role: "owner" };

  const tomorrow = new Date(Date.now() + 86400000);
  const dateStr = tomorrow.toISOString().slice(0, 10);
  const scheduleId = `sch_${suffix}`;
  db.prepare(`INSERT INTO staff_schedules (id, tenant_id, branch_id, staff_id, schedule_date, start_time, end_time, shift_type, status, version)
    VALUES (@id, @tenantId, @branchId, @staffId, @date, '10:00', '18:00', 'general', 'active', 1)`)
    .run({ id: scheduleId, tenantId, branchId, staffId: staffA, date: dateStr });

  return { tenantId, branchId, staffA, staffB, staffC, userIdA, userIdB, userIdOwner, staffAccessA, staffAccessB, ownerAccess, scheduleId, dateStr };
}

function createSwap(fixture) {
  return staffShiftSwapService.request({ scheduleId: fixture.scheduleId, toStaffId: fixture.staffB, reason: "Need cover" }, fixture.staffAccessA);
}

test("staff can request a shift swap", () => {
  const f = fixture();
  const swap = createSwap(f);
  assert.ok(swap.id);
  assert.equal(swap.status, "pending_staff");
  assert.equal(swap.fromStaffId, f.staffA);
  assert.equal(swap.toStaffId, f.staffB);
  assert.equal(swap.scheduleId, f.scheduleId);
});

test("coworker can accept a swap request", () => {
  const f = fixture();
  const swap = createSwap(f);
  const updated = staffShiftSwapService.respond(swap.id, { decision: "accept" }, f.staffAccessB);
  assert.equal(updated.status, "pending_manager");
  assert.ok(updated.targetRespondedAt);
});

test("coworker can decline a swap request", () => {
  const f = fixture();
  const swap = createSwap(f);
  const updated = staffShiftSwapService.respond(swap.id, { decision: "decline" }, f.staffAccessB);
  assert.equal(updated.status, "declined");
});

test("owner can approve a coworker-accepted swap", () => {
  const f = fixture();
  const swap = createSwap(f);
  staffShiftSwapService.respond(swap.id, { decision: "accept" }, f.staffAccessB);
  const approved = staffShiftSwapService.approve(swap.id, {}, f.ownerAccess);
  assert.equal(approved.status, "approved");
  assert.ok(approved.approvedAt);
  const schedule = db.prepare("SELECT staff_id FROM staff_schedules WHERE id = ? AND tenant_id = ?").get(f.scheduleId, f.tenantId);
  assert.equal(schedule.staff_id, f.staffB);
});

test("owner can reject a coworker-accepted swap", () => {
  const f = fixture();
  const swap = createSwap(f);
  staffShiftSwapService.respond(swap.id, { decision: "accept" }, f.staffAccessB);
  const rejected = staffShiftSwapService.reject(swap.id, { reason: "Not a good time" }, f.ownerAccess);
  assert.equal(rejected.status, "rejected");
  assert.equal(rejected.rejectionReason, "Not a good time");
});

test("requester can cancel a swap", () => {
  const f = fixture();
  const swap = createSwap(f);
  const cancelled = staffShiftSwapService.cancel(swap.id, {}, f.staffAccessA);
  assert.equal(cancelled.status, "cancelled");
});

test("cannot approve a swap that is not in pending_manager status", () => {
  const f = fixture();
  const swap = createSwap(f);
  assert.throws(() => staffShiftSwapService.approve(swap.id, {}, f.ownerAccess), { message: /Coworker acceptance is required/ });
});

test("cannot create duplicate swap for same schedule", () => {
  const f = fixture();
  createSwap(f);
  assert.throws(() => createSwap(f), { message: /swap request is already active/ });
});

test("cannot swap with self", () => {
  const f = fixture();
  assert.throws(() => staffShiftSwapService.request({ scheduleId: f.scheduleId, toStaffId: f.staffA }, f.staffAccessA), { message: /Choose another staff/ });
});

test("non-target coworker cannot respond", () => {
  const f = fixture();
  const swap = createSwap(f);
  const staffAccessC = { ...f.staffAccessA, staffId: f.staffC, userId: f.userIdA + "_c" };
  assert.throws(() => staffShiftSwapService.respond(swap.id, { decision: "accept" }, staffAccessC), { message: /Only the requested coworker/ });
});

test("non-owner cannot approve", () => {
  const f = fixture();
  const swap = createSwap(f);
  staffShiftSwapService.respond(swap.id, { decision: "accept" }, f.staffAccessB);
  assert.throws(() => staffShiftSwapService.approve(swap.id, {}, f.staffAccessA), { message: /Owner, admin or super admin/ });
});

test("reject requires a reason", () => {
  const f = fixture();
  const swap = createSwap(f);
  staffShiftSwapService.respond(swap.id, { decision: "accept" }, f.staffAccessB);
  assert.throws(() => staffShiftSwapService.reject(swap.id, {}, f.ownerAccess), { message: /Rejection reason is required/ });
});

test("manager can create a swap on behalf of staff", () => {
  const f = fixture();
  const managerAccess = { ...f.ownerAccess, role: "manager" };
  const swap = staffShiftSwapService.createForManager({ scheduleId: f.scheduleId, toStaffId: f.staffB, reason: "Manager reassignment" }, managerAccess);
  assert.ok(swap.id);
  assert.equal(swap.status, "pending_staff");
  assert.equal(swap.fromStaffId, f.staffA);
});

test("manager can list swaps", () => {
  const f = fixture();
  createSwap(f);
  const managerAccess = { ...f.ownerAccess, role: "manager" };
  const list = staffShiftSwapService.listForManager({ branchId: f.branchId }, managerAccess);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
});

test("staff can list swaps for self", () => {
  const f = fixture();
  createSwap(f);
  const list = staffShiftSwapService.listForSelf({}, f.staffAccessA);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
  assert.equal(list[0].fromStaffId, f.staffA);
});

test("staff can list coworkers for swap", () => {
  const f = fixture();
  const coworkers = staffShiftSwapService.coworkers(f.staffAccessA);
  assert.ok(Array.isArray(coworkers));
  assert.ok(coworkers.length >= 1);
  assert.ok(coworkers.some((c) => c.id === f.staffB));
});

test("version conflict detected on cancel", () => {
  const f = fixture();
  const swap = createSwap(f);
  staffShiftSwapService.respond(swap.id, { decision: "accept" }, f.staffAccessB);
  staffShiftSwapService.cancel(swap.id, {}, f.staffAccessA);
  const f2 = fixture();
  const swap2 = staffShiftSwapService.request({ scheduleId: f2.scheduleId, toStaffId: f2.staffB, reason: "v2" }, f2.staffAccessA);
  const wrongVersion = 999;
  assert.throws(() => staffShiftSwapService.cancel(swap2.id, { version: wrongVersion }, f2.staffAccessA), { message: /updated by another request/ });
});

test("cancel only by requester", () => {
  const f = fixture();
  const swap = createSwap(f);
  assert.throws(() => staffShiftSwapService.cancel(swap.id, {}, f.staffAccessB), { message: /Only the requester/ });
});

test("cannot cancel an already terminal swap", () => {
  const f = fixture();
  const swap = createSwap(f);
  staffShiftSwapService.respond(swap.id, { decision: "accept" }, f.staffAccessB);
  staffShiftSwapService.approve(swap.id, {}, f.ownerAccess);
  assert.throws(() => staffShiftSwapService.cancel(swap.id, {}, f.staffAccessA), { message: /already closed/ });
});
