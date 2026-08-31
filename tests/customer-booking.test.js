import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "../server/db.js";
import { ensureAppointmentSystemSchema } from "../server/services/appointment-schema.service.js";
import { customerAppService } from "../server/services/customer-app.service.js";

ensureAppointmentSystemSchema();

function fixture() {
  const suffix = randomUUID();
  const tenantId = `cust_tenant_${suffix}`;
  const branchId = `cust_branch_${suffix}`;
  const slug = `cust-saloon-${suffix}`;
  const serviceId = `cust_svc_${suffix}`;
  const staffId = `cust_staff_${suffix}`;
  const clientId = `cust_client_${suffix}`;
  const stamp = new Date().toISOString();

  db.prepare(`INSERT INTO tenants (id, name, slug, status, createdAt, updatedAt) VALUES (@id, 'Cust Saloon', @slug, 'active', @stamp, @stamp)`)
    .run({ id: tenantId, slug, stamp });
  db.prepare(`INSERT INTO branches (id, name, city, status, tenantId, onlineBookingEnabled, slug, createdAt, updatedAt) VALUES (@id, 'Cust Branch', 'Cust City', 'active', @tenantId, 1, @slug, @stamp, @stamp)`)
    .run({ id: branchId, tenantId, slug, stamp });
  db.prepare(`INSERT INTO services (id, name, category, price, durationMinutes, status, tenantId, branchId, onlineBookable, createdAt, updatedAt) VALUES (@id, 'Haircut', 'Hair', 500, 30, 'active', @tenantId, @branchId, 1, @stamp, @stamp)`)
    .run({ id: serviceId, tenantId, branchId, stamp });
  db.prepare(`INSERT INTO staff (id, name, role, branchId, status, tenantId, createdAt, updatedAt) VALUES (@id, 'Stylist', 'stylist', @branchId, 'active', @tenantId, @stamp, @stamp)`)
    .run({ id: staffId, branchId, tenantId, stamp });
  db.prepare(`INSERT INTO clients (id, name, phone, tenantId, createdAt, updatedAt) VALUES (@id, 'Cust', '9999999999', @tenantId, @stamp, @stamp)`)
    .run({ id: clientId, tenantId, stamp });

  const access = { tenantId, branchId, branchIds: [branchId], role: "customer", userId: clientId };
  const future = new Date(Date.now() + 2 * 3600_000);
  const iso = (min) => new Date(future.getTime() + min * 60_000).toISOString();

  return { tenantId, branchId, slug, serviceId, staffId, clientId, access, iso };
}

test("createBooking is idempotent for the same requestId", () => {
  const f = fixture();
  const payload = {
    businessSlug: f.slug,
    serviceId: f.serviceId,
    staffId: f.staffId,
    startAt: f.iso(0),
    requestId: `req_${randomUUID()}`,
    notes: "hi"
  };
  const first = customerAppService.createBooking(f.access, payload);
  const second = customerAppService.createBooking(f.access, payload);
  assert.equal(second.id, first.id);
  const rows = db.prepare("SELECT COUNT(*) AS c FROM appointments WHERE idempotencyKey = @k").get({ k: payload.requestId });
  assert.equal(rows.c, 1);
});

test("createBooking rejects an overlapping booking for the same staff (conflict 409)", () => {
  const f = fixture();
  customerAppService.createBooking(f.access, {
    businessSlug: f.slug, serviceId: f.serviceId, staffId: f.staffId, startAt: f.iso(0)
  });
  assert.throws(
    () => customerAppService.createBooking(f.access, {
      businessSlug: f.slug, serviceId: f.serviceId, staffId: f.staffId, startAt: f.iso(5)
    }),
    (err) => err.status === 409 && /no longer available/.test(err.message)
  );
});

test("createBooking with an expired hold is rejected (conflict 409)", () => {
  const f = fixture();
  const holdId = `hold_${randomUUID().slice(0, 10)}`;
  db.prepare(`INSERT INTO slot_reservations (id, tenantId, branchId, staffId, startTime, endTime, reservedUntil, status, createdAt, updatedAt)
    VALUES (@id, @tenantId, @branchId, @staffId, @start, @end, @until, 'holding', @now, @now)`)
    .run({
      id: holdId, tenantId: f.tenantId, branchId: f.branchId, staffId: f.staffId,
      start: f.iso(0), end: f.iso(30),
      until: new Date(Date.now() - 60_000).toISOString(), now: new Date().toISOString()
    });
  assert.throws(
    () => customerAppService.createBooking(f.access, {
      businessSlug: f.slug, serviceId: f.serviceId, staffId: f.staffId, startAt: f.iso(0), holdId
    }),
    (err) => err.status === 409 && /expired/.test(err.message)
  );
});

test("createBooking with a valid hold succeeds and records reservedFromSlotId", () => {
  const f = fixture();
  const holdId = `hold_${randomUUID().slice(0, 10)}`;
  db.prepare(`INSERT INTO slot_reservations (id, tenantId, branchId, staffId, startTime, endTime, reservedUntil, status, createdAt, updatedAt)
    VALUES (@id, @tenantId, @branchId, @staffId, @start, @end, @until, 'holding', @now, @now)`)
    .run({
      id: holdId, tenantId: f.tenantId, branchId: f.branchId, staffId: f.staffId,
      start: f.iso(0), end: f.iso(30),
      until: new Date(Date.now() + 60_000).toISOString(), now: new Date().toISOString()
    });
  const booking = customerAppService.createBooking(f.access, {
    businessSlug: f.slug, serviceId: f.serviceId, staffId: f.staffId, startAt: f.iso(0), holdId
  });
  assert.ok(booking.id);
  const row = db.prepare("SELECT reservedFromSlotId FROM appointments WHERE id = @id").get({ id: booking.id });
  assert.equal(row.reservedFromSlotId, holdId);
});
