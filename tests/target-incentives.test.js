import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "../server/db.js";
import { ensureStaffOsSchema } from "../server/services/staff-os-schema.service.js";
import { staffOsService } from "../server/services/staff-os.service.js";

ensureStaffOsSchema();

function fixture() {
  const suffix = randomUUID();
  const tenantId = `incent_tenant_${suffix}`;
  const branchId = `incent_branch_${suffix}`;
  const staffId = `incent_staff_${suffix}`;
  const userIdOwner = `incent_user_owner_${suffix}`;
  const stamp = new Date().toISOString();

  db.prepare(`INSERT INTO tenants (id,name,slug,createdAt,updatedAt) VALUES (@id,'Incentive Test',@slug,@stamp,@stamp)`)
    .run({ id: tenantId, slug: `incent-test-${suffix}`, stamp });
  db.prepare(`INSERT INTO staff_master (id, tenant_id, branch_id, employee_code, first_name, full_name, status)
    VALUES (@id, @tenantId, @branchId, @code, 'Test', 'Test Staff', 'active')`)
    .run({ id: staffId, tenantId, branchId, code: `EMP_${suffix.slice(0, 8)}` });
  db.prepare(`INSERT INTO tenant_users (id, tenantId, email, name, role, branchIds, staffId, status, createdAt, updatedAt)
    VALUES (@id,@tenantId,@email,@name,'owner',@branchIds,'','active',@stamp,@stamp)`)
    .run({ id: userIdOwner, tenantId, email: `${userIdOwner}@test.com`, name: "Owner", branchIds: JSON.stringify([branchId]), stamp });

  const ownerAccess = { tenantId, branchId, branchIds: [branchId], userId: userIdOwner, role: "owner" };
  return { tenantId, branchId, staffId, ownerAccess };
}

const sampleSlabs = [
  { from: 0, to: 50000, incentivePercent: 2 },
  { from: 50001, to: 100000, incentivePercent: 3 },
  { from: 100001, to: Infinity, incentivePercent: 5 }
];

test("create a target incentive master", () => {
  const f = fixture();
  const result = staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId,
    targetType: "service",
    assigneeType: "staff",
    assigneeId: f.staffId,
    assigneeName: "Test Staff",
    roleScope: "operator",
    slabs: sampleSlabs,
    notes: "Service target"
  }, f.ownerAccess);
  assert.ok(result.id);
  assert.equal(result.targetType, "service");
  assert.equal(result.assigneeId, f.staffId);
  assert.equal(result.slabs.length, 3);
  assert.equal(result.status, "active");
  assert.equal(result.version, 1);
});

test("list target incentive masters", () => {
  const f = fixture();
  staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  const list = staffOsService.listTargetIncentiveMasters({ branchId: f.branchId }, f.ownerAccess);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
  assert.equal(list[0].assigneeId, f.staffId);
});

test("get a target incentive by id", () => {
  const f = fixture();
  const created = staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "product", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  const got = staffOsService.getTargetIncentiveMaster(created.id, f.ownerAccess);
  assert.equal(got.id, created.id);
  assert.equal(got.targetType, "product");
});

test("update a target incentive master", () => {
  const f = fixture();
  const created = staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "membership", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  const updated = staffOsService.updateTargetIncentiveMaster(created.id, {
    slabs: [{ from: 0, to: 99999, incentivePercent: 10 }],
    notes: "Updated slabs",
    version: created.version
  }, f.ownerAccess);
  assert.equal(updated.slabs.length, 1);
  assert.equal(updated.slabs[0].incentivePercent, 10);
  assert.equal(updated.version, 2);
  assert.equal(updated.notes, "Updated slabs");
});

test("update with wrong version throws conflict", () => {
  const f = fixture();
  const created = staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  assert.throws(() => staffOsService.updateTargetIncentiveMaster(created.id, {
    notes: "Conflicted", version: 999
  }, f.ownerAccess), { message: /updated by another request/ });
});

test("update requires version", () => {
  const f = fixture();
  const created = staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  assert.throws(() => staffOsService.updateTargetIncentiveMaster(created.id, { notes: "No version" }, f.ownerAccess), { message: /version is required/ });
});

test("duplicate assignee for same type/scope throws conflict", () => {
  const f = fixture();
  staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  assert.throws(() => staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess), { message: /already exists/ });
});

test("status update via updateTargetIncentiveMasterStatus", () => {
  const f = fixture();
  const created = staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  const archived = staffOsService.updateTargetIncentiveMasterStatus(created.id, {
    status: "archived", hide: true, version: created.version
  }, f.ownerAccess);
  assert.equal(archived.status, "archived");
  assert.equal(archived.hide, true);
});

test("copy incentive to multiple targets", () => {
  const f = fixture();
  const staffD = `incent_staff_d_${randomUUID()}`;
  db.prepare(`INSERT INTO staff_master (id, tenant_id, branch_id, employee_code, first_name, full_name, status)
    VALUES (@id, @tenantId, @branchId, @code, 'D', 'Staff D', 'active')`)
    .run({ id: staffD, tenantId: f.tenantId, branchId: f.branchId, code: `EMP_D_${Date.now()}` });
  const created = staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Original", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  const copied = staffOsService.copyTargetIncentiveMaster(created.id, {
    targets: [{ assigneeId: staffD, assigneeName: "Staff D" }]
  }, f.ownerAccess);
  assert.ok(Array.isArray(copied));
  assert.equal(copied.length, 1);
  assert.equal(copied[0].assigneeId, staffD);
  assert.equal(copied[0].slabs.length, 3);
});

test("list with filters works", () => {
  const f = fixture();
  staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test Staff", roleScope: "operator", slabs: sampleSlabs
  }, f.ownerAccess);
  staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "product", assigneeType: "branch",
    assigneeId: f.branchId, assigneeName: "Branch Target", roleScope: "admin", slabs: sampleSlabs
  }, f.ownerAccess);

  const byType = staffOsService.listTargetIncentiveMasters({ branchId: f.branchId, targetType: "service" }, f.ownerAccess);
  assert.ok(byType.every((r) => r.targetType === "service"));

  const byAssignee = staffOsService.listTargetIncentiveMasters({ branchId: f.branchId, assigneeType: "branch" }, f.ownerAccess);
  assert.ok(byAssignee.every((r) => r.assigneeType === "branch"));

  const bySearch = staffOsService.listTargetIncentiveMasters({ branchId: f.branchId, q: "Branch" }, f.ownerAccess);
  assert.ok(bySearch.length >= 1);
});

test("non-owner cannot create incentive", () => {
  const f = fixture();
  const staffAccess = { ...f.ownerAccess, role: "staff", staffId: f.staffId };
  assert.throws(() => staffOsService.createTargetIncentiveMaster({
    branchId: f.branchId, targetType: "service", assigneeType: "staff",
    assigneeId: f.staffId, assigneeName: "Test", roleScope: "operator", slabs: sampleSlabs
  }, staffAccess), { message: /manager|Staff OS records/i });
});

test("get non-existent incentive throws not found", () => {
  const f = fixture();
  assert.throws(() => staffOsService.getTargetIncentiveMaster("nonexistent", f.ownerAccess), { message: /not found/ });
});
