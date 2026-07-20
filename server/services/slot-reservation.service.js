import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { withRetry } from "../utils/db-retry.js";
import { smartBookingService } from "./smart-booking.service.js";
import { tenantService } from "./tenant.service.js";
import { availabilityAugmentService } from "./availability-augment.service.js";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function iso(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid slot time");
  return date.toISOString();
}

function addMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + Number(minutes || 0) * 60000).toISOString();
}

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

export const slotReservationService = {
  createHold(payload = {}, access) {
    const tenantId = access.tenantId;
    const branchId = payload.branchId || access.branchId;
    if (!branchId || !payload.startTime || !payload.endTime) throw badRequest("branchId, startTime and endTime are required");
    tenantService.assertBranchAccess(access, branchId);
    const startTime = iso(payload.startTime);
    const endTime = iso(payload.endTime);
    const staffId = payload.staffId || "";
    const chairId = payload.chairId || payload.chair || "";
    const roomId = payload.roomId || payload.room || "";
    if (staffId || chairId) {
      const conflicts = smartBookingService.findConflicts({ branchId, staffId, chair: chairId, startAt: startTime, endAt: endTime, access });
      if (conflicts.length) throw conflict("Selected slot is already booked", { conflicts });
    }
    const holds = availabilityAugmentService.activeHolds({ tenantId, branchId, staffId, chairId, roomId, startTime, endTime });
    if (holds.length) throw conflict("Selected slot is temporarily held by another booking session", { holds });
    const row = {
      id: payload.id || makeId("hold"),
      tenantId,
      branchId,
      staffId,
      chairId,
      roomId,
      serviceIdsJson: JSON.stringify(payload.serviceIds || payload.serviceIdsJson || []),
      startTime,
      endTime,
      customerId: payload.customerId || payload.clientId || "",
      sessionId: payload.sessionId || "",
      reservedUntil: addMinutes(new Date().toISOString(), 10),
      status: "holding",
      appointmentId: ""
    };
    withRetry(() => db.prepare(
      `INSERT INTO slot_reservations
       (id, tenantId, branchId, staffId, chairId, roomId, serviceIdsJson, startTime, endTime, customerId, sessionId, reservedUntil, status, appointmentId)
       VALUES (@id, @tenantId, @branchId, @staffId, @chairId, @roomId, @serviceIdsJson, @startTime, @endTime, @customerId, @sessionId, @reservedUntil, @status, @appointmentId)`
    ).run(row));
    return { holdId: row.id, reservedUntil: row.reservedUntil, expiresInSeconds: 600, hold: row };
  },

  extendHold(id, extraMinutes = 5, access) {
    const hold = this.getHold(id, access);
    if (hold.status !== "holding" || hold.reservedUntil <= new Date().toISOString()) throw conflict("Slot hold has expired");
    const createdAt = new Date(hold.createdAt).getTime();
    const maxUntil = new Date(createdAt + 30 * 60000).toISOString();
    const next = addMinutes(hold.reservedUntil, Math.min(Number(extraMinutes || 5), 10));
    const reservedUntil = next > maxUntil ? maxUntil : next;
    db.prepare("UPDATE slot_reservations SET reservedUntil = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ?").run(reservedUntil, id, access.tenantId);
    return { holdId: id, reservedUntil };
  },

  convertToBooking(id, appointmentId, access) {
    const hold = this.getHold(id, access);
    if (hold.status !== "holding" || hold.reservedUntil <= new Date().toISOString()) throw conflict("Slot hold has expired");
    if (appointmentId) {
      const appointment = repositories.appointments.getById(appointmentId, scope(access));
      if (!appointment) throw notFound("Appointment not found for slot hold conversion");
    }
    const txn = db.transaction(() => {
      db.prepare("UPDATE slot_reservations SET status = 'converted', appointmentId = ?, updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ?").run(appointmentId || "", id, access.tenantId);
      if (appointmentId) {
        repositories.appointments.update(appointmentId, { reservedFromSlotId: id }, scope(access));
      }
    });
    txn();
    return { holdId: id, appointmentId: appointmentId || "", status: "converted" };
  },

  releaseHold(id, access) {
    const hold = this.getHold(id, access);
    if (hold.status !== "holding") return { released: false, status: hold.status };
    db.prepare("UPDATE slot_reservations SET status = 'released', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ?").run(id, access.tenantId);
    return { released: true };
  },

  expireStaleHolds() {
    const result = db.prepare(
      "UPDATE slot_reservations SET status = 'expired', updatedAt = CURRENT_TIMESTAMP WHERE status = 'holding' AND reservedUntil < ?"
    ).run(new Date().toISOString());
    return { count: result.changes || 0 };
  },

  getHold(id, access) {
    const hold = db.prepare("SELECT * FROM slot_reservations WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!hold) throw notFound("Slot hold not found");
    tenantService.assertBranchAccess(access, hold.branchId);
    return hold;
  }
};
