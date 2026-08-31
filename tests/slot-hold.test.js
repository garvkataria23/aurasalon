import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "../server/db.js";
import { ensureAppointmentSystemSchema } from "../server/services/appointment-schema.service.js";
import { slotReservationService } from "../server/services/slot-reservation.service.js";

ensureAppointmentSystemSchema();

function fixture() {
  const suffix = randomUUID();
  const tenantId = `hold_tenant_${suffix}`;
  const branchId = `hold_branch_${suffix}`;
  const stamp = new Date().toISOString();

  db.prepare(`INSERT INTO tenants (id,name,slug,createdAt,updatedAt) VALUES (@id,'Hold Test',@slug,@stamp,@stamp)`)
    .run({ id: tenantId, slug: `hold-test-${suffix}`, stamp });
  db.prepare(`INSERT INTO tenant_users (id, tenantId, email, name, role, branchIds, staffId, status, createdAt, updatedAt)
    VALUES (@id,@tenantId,@email,@name,@role,@branchIds,@staffId,'active',@stamp,@stamp)`)
    .run({ id: `hold_user_${suffix}`, tenantId, email: `hold_${suffix}@test.com`, name: "Staff", role: "staff", branchIds: JSON.stringify([branchId]), staffId: "", stamp });

  const staffAccess = { tenantId, branchId, branchIds: [branchId], role: "staff" };
  const staffNoBranch = { tenantId, branchId: "", branchIds: [], role: "staff" };
  const staffWrongBranch = { tenantId, branchId: `hold_other_${suffix}`, branchIds: [`hold_other_${suffix}`], role: "staff" };

  const startTime = new Date(Date.now() + 3600_000).toISOString();
  const endTime = new Date(Date.now() + 3900_000).toISOString();

  return {
    tenantId, branchId,
    staffAccess, staffNoBranch, staffWrongBranch,
    startTime, endTime
  };
}

test("create a slot hold with valid branch-scoped access", () => {
  const f = fixture();
  const result = slotReservationService.createHold({
    branchId: f.branchId,
    startTime: f.startTime,
    endTime: f.endTime,
    staffId: "",
    serviceIds: ["svc_attr"],
    sessionId: "sess_test"
  }, f.staffAccess);

  assert.ok(result.holdId);
  assert.ok(result.reservedUntil);
  assert.equal(result.hold.status, "holding");
  assert.equal(result.hold.branchId, f.branchId);
});

test("createHold with no branch scope is forbidden (403) - branch access required", () => {
  const f = fixture();
  assert.throws(
    () => slotReservationService.createHold({
      branchId: f.branchId,
      startTime: f.startTime,
      endTime: f.endTime
    }, f.staffNoBranch),
    (err) => err.status === 403 && /does not have access to the requested branch/.test(err.message)
  );
});

test("createHold with a different branch than allowed is forbidden (403)", () => {
  const f = fixture();
  assert.throws(
    () => slotReservationService.createHold({
      branchId: f.branchId,
      startTime: f.startTime,
      endTime: f.endTime
    }, f.staffWrongBranch),
    (err) => err.status === 403 && /does not have access to the requested branch/.test(err.message)
  );
});

test("createHold requires branchId, startTime and endTime (400)", () => {
  const f = fixture();
  assert.throws(
    () => slotReservationService.createHold({ startTime: f.startTime, endTime: f.endTime }, f.staffNoBranch),
    (err) => err.status === 400 && /branchId, startTime and endTime are required/.test(err.message)
  );
});

test("release a slot hold with valid access", () => {
  const f = fixture();
  const { holdId } = slotReservationService.createHold({
    branchId: f.branchId,
    startTime: f.startTime,
    endTime: f.endTime
  }, f.staffAccess);

  const result = slotReservationService.releaseHold(holdId, f.staffAccess);
  assert.deepEqual(result, { released: true });

  const again = slotReservationService.releaseHold(holdId, f.staffAccess);
  assert.equal(again.released, false);
});

test("a hold cannot be resolved/released from another tenant (404)", () => {
  const f = fixture();
  const other = fixture();
  const { holdId } = slotReservationService.createHold({
    branchId: f.branchId,
    startTime: f.startTime,
    endTime: f.endTime
  }, f.staffAccess);

  assert.throws(
    () => slotReservationService.releaseHold(holdId, other.staffAccess),
    (err) => err.status === 404 && /Slot hold not found/.test(err.message)
  );
});
