import test from "node:test";
import assert from "node:assert/strict";
import { db } from "../server/db.js";
import { ownerAppointmentService } from "../server/services/owner-appointment.service.js";
import { ownerOperationsService } from "../server/services/owner-operations.service.js";

function fixture(prefix) {
  const suffix = `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const tenantId = `${prefix}_tenant_${suffix}`;
  const ownerUserId = `${prefix}_owner_${suffix}`;
  const branchA = `${prefix}_branch_a_${suffix}`;
  const branchB = `${prefix}_branch_b_${suffix}`;
  const createdAt = new Date().toISOString();
  db.prepare(`INSERT INTO tenants (id,name,slug,status,subscriptionStatus,createdAt,updatedAt)
    VALUES (@id,@name,@slug,'active','active',@createdAt,@createdAt)`).run({ id: tenantId, name: prefix, slug: `${prefix}-${suffix}`, createdAt });
  const insertBranch = db.prepare(`INSERT INTO branches (id,tenantId,name,city,address,phone,gstin,timezone,status,createdAt,updatedAt)
    VALUES (@id,@tenantId,@name,'','','','','Asia/Kolkata','active',@createdAt,@createdAt)`);
  insertBranch.run({ id: branchA, tenantId, name: "Branch A", createdAt });
  insertBranch.run({ id: branchB, tenantId, name: "Branch B", createdAt });
  db.prepare(`INSERT INTO tenant_users (id,tenantId,name,email,role,branchIds,staffId,status,permissionVersion,createdAt,updatedAt)
    VALUES (@id,@tenantId,@name,@email,'owner',@branchIds,'','active',1,@createdAt,@createdAt)`).run({
    id: ownerUserId, tenantId, name: "Owner", email: `${ownerUserId}@test.local`, branchIds: JSON.stringify([branchA, branchB]), createdAt
  });
  return { tenantId, ownerUserId, branchA, branchB, createdAt, access: { tenantId, userId: ownerUserId, role: "owner", branchIds: [branchA, branchB] } };
}

function cleanup({ tenantId }) {
  for (const table of ["ownerNotificationReceipts", "notifications", "appointment_activity_log", "appointments", "clients", "staff", "services", "tenant_users", "branches"]) {
    db.prepare(`DELETE FROM ${table} WHERE tenantId = @tenantId`).run({ tenantId });
  }
  db.prepare("DELETE FROM tenants WHERE id = @tenantId").run({ tenantId });
}

test("owner appointment create, update and reschedule reject cross-branch references", () => {
  const data = fixture("owner_appointment_scope");
  const clientA = `client_a_${data.createdAt}`;
  const clientB = `client_b_${data.createdAt}`;
  const staffA = `staff_a_${data.createdAt}`;
  const staffB = `staff_b_${data.createdAt}`;
  const serviceId = `service_${data.createdAt}`;
  const appointmentId = `appointment_${data.createdAt}`;
  try {
    const insertClient = db.prepare(`INSERT INTO clients (id,tenantId,branchId,name,phone,createdAt,updatedAt)
      VALUES (@id,@tenantId,@branchId,@name,@phone,@createdAt,@createdAt)`);
    insertClient.run({ id: clientA, tenantId: data.tenantId, branchId: data.branchA, name: "Client A", phone: "9000000001", createdAt: data.createdAt });
    insertClient.run({ id: clientB, tenantId: data.tenantId, branchId: data.branchB, name: "Client B", phone: "9000000002", createdAt: data.createdAt });
    const insertStaff = db.prepare(`INSERT INTO staff (id,tenantId,branchId,name,role,status,createdAt,updatedAt)
      VALUES (@id,@tenantId,@branchId,@name,'stylist','active',@createdAt,@createdAt)`);
    insertStaff.run({ id: staffA, tenantId: data.tenantId, branchId: data.branchA, name: "Staff A", createdAt: data.createdAt });
    insertStaff.run({ id: staffB, tenantId: data.tenantId, branchId: data.branchB, name: "Staff B", createdAt: data.createdAt });
    db.prepare(`INSERT INTO services (id,tenantId,name,category,price,durationMinutes,status,createdAt,updatedAt)
      VALUES (@id,@tenantId,'Haircut','Hair',100,30,'active',@createdAt,@createdAt)`).run({ id: serviceId, tenantId: data.tenantId, createdAt: data.createdAt });
    db.prepare(`INSERT INTO appointments (id,tenantId,branchId,clientId,staffId,serviceIds,startAt,endAt,status,version,createdAt,updatedAt)
      VALUES (@id,@tenantId,@branchId,@clientId,@staffId,@serviceIds,@startAt,@endAt,'booked',1,@createdAt,@createdAt)`).run({
      id: appointmentId, tenantId: data.tenantId, branchId: data.branchA, clientId: clientA, staffId: staffA,
      serviceIds: JSON.stringify([serviceId]), startAt: "2026-08-01T04:30:00.000Z", endAt: "2026-08-01T05:00:00.000Z", createdAt: data.createdAt
    });

    assert.ok(ownerAppointmentService.options(data.access, "services", { branchId: data.branchA }).some((service) => service.id === serviceId));
    assert.throws(() => ownerAppointmentService.create({ branchId: data.branchA, clientId: clientA, staffId: staffA, serviceIds: ["missing_service"] }, data.access), /services are not active for this tenant/);
    assert.throws(() => ownerAppointmentService.create({ branchId: data.branchA, clientId: clientB, staffId: staffA, serviceIds: [serviceId] }, data.access), /client is not available/);
    assert.throws(() => ownerAppointmentService.create({ branchId: data.branchA, clientId: clientA, staffId: staffB, serviceIds: [serviceId] }, data.access), /staff member is not active/);
    assert.throws(() => ownerAppointmentService.update(appointmentId, { clientId: clientB }, data.access, null, "1"), /client is not available/);
    assert.throws(() => ownerAppointmentService.update(appointmentId, { staffId: staffB }, data.access, null, "1"), /staff member is not active/);
    assert.throws(() => ownerAppointmentService.reschedule(appointmentId, { startAt: "2026-08-02T04:30:00.000Z", staffId: staffB }, data.access), /staff member is not active/);
    assert.throws(() => ownerAppointmentService.reschedule(appointmentId, { startAt: "2026-08-02T04:30:00.000Z", branchId: data.branchB, staffId: staffB }, data.access), /client is not available/);
  } finally {
    cleanup(data);
  }
});

test("owner notification category filtering precedes deterministic pagination and count", () => {
  const data = fixture("owner_notification_page");
  try {
    const insert = db.prepare(`INSERT INTO notifications (id,tenantId,type,channel,message,status,createdAt)
      VALUES (@id,@tenantId,@type,@channel,@message,@status,@createdAt)`);
    for (let index = 0; index < 15; index += 1) insert.run({ id: `business_${index}_${data.ownerUserId}`, tenantId: data.tenantId, type: "notice", channel: "app", message: "General update", status: "sent", createdAt: new Date(Date.UTC(2026, 6, 31, 23, index)).toISOString() });
    for (let index = 0; index < 25; index += 1) insert.run({ id: `inventory_${index}_${data.ownerUserId}`, tenantId: data.tenantId, type: "notice", channel: "app", message: `Stock update ${index}`, status: "sent", createdAt: new Date(Date.UTC(2026, 6, 30, 23, index)).toISOString() });

    const result = ownerOperationsService.notifications(data.access, { category: "inventory", page: "2", pageSize: "10" });

    assert.equal(result.items.length, 10);
    assert.ok(result.items.every((item) => item.category === "inventory"));
    assert.deepEqual(result.items.map((item) => item.message), Array.from({ length: 10 }, (_, index) => `Stock update ${14 - index}`));
    assert.deepEqual(result.page, { page: 2, pageSize: 10, total: 25, totalPages: 3, hasMore: true });
  } finally {
    cleanup(data);
  }
});
