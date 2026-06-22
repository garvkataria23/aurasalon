import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { onlineSlotEngineService } from "./online-slot-engine.service.js";
import { publicActionTokenService } from "./public-action-token.service.js";

function maskPhone(phone = "") {
  const digits = String(phone || "").replace(/\D/g, "");
  if (!digits) return "";
  return `${"*".repeat(Math.max(digits.length - 4, 0))}${digits.slice(-4)}`;
}

function maskEmail(email = "") {
  const [name, domain] = String(email || "").split("@");
  if (!name || !domain) return "";
  return `${name.slice(0, 2)}***@${domain}`;
}

function appointmentByToken(token, actionType = "") {
  const tokenRow = publicActionTokenService.verifyToken(token, actionType);
  const appointment = db.prepare("SELECT * FROM appointments WHERE id = ? AND tenantId = ?").get(tokenRow.appointmentId, tokenRow.tenantId);
  if (!appointment) throw notFound("Booking not found");
  const client = appointment.clientId
    ? db.prepare("SELECT id, name, phone, email, tier FROM clients WHERE id = ? AND tenantId = ?").get(appointment.clientId, tokenRow.tenantId)
    : null;
  const branch = appointment.branchId
    ? db.prepare("SELECT id, name, address, phone FROM branches WHERE id = ? AND tenantId = ?").get(appointment.branchId, tokenRow.tenantId)
    : null;
  const staff = appointment.staffId
    ? db.prepare("SELECT id, name FROM staff WHERE id = ? AND tenantId = ?").get(appointment.staffId, tokenRow.tenantId)
    : null;
  return { tokenRow, appointment, client, branch, staff };
}

function publicAppointment({ tokenRow, appointment, client, branch, staff }) {
  return {
    bookingRef: appointment.id,
    actionType: tokenRow.actionType,
    status: appointment.status,
    startAt: appointment.startAt,
    endAt: appointment.endAt,
    branch: branch ? { name: branch.name, address: branch.address, phone: branch.phone } : null,
    staff: staff ? { name: staff.name } : null,
    customer: client ? { name: client.name, phone: maskPhone(client.phone), email: maskEmail(client.email), tier: client.tier } : null,
    canCancel: !["completed", "paid", "cancelled", "no-show"].includes(String(appointment.status || "").toLowerCase()),
    canReschedule: !["completed", "paid", "cancelled", "no-show"].includes(String(appointment.status || "").toLowerCase())
  };
}

function parseServiceIds(appointment) {
  const value = appointment.serviceIds;
  if (Array.isArray(value)) return value;
  if (!value) return [];
  try {
    const parsed = JSON.parse(value);
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return String(value).split(",").map((item) => item.trim()).filter(Boolean);
  }
}

export const publicBookingActionService = {
  getBookingDetails(token) {
    return publicAppointment(appointmentByToken(token));
  },

  cancelBooking({ token, reason = "Customer self-cancelled" }) {
    const context = appointmentByToken(token, "cancel");
    if (!publicAppointment(context).canCancel) throw conflict("This booking cannot be cancelled");
    const notes = [context.appointment.notes, `Public cancellation: ${reason}`].filter(Boolean).join(" | ");
    db.prepare(
      `UPDATE appointments
       SET status = 'cancelled', notes = ?, updatedAt = CURRENT_TIMESTAMP, version = COALESCE(version, 1) + 1
       WHERE id = ? AND tenantId = ?`
    ).run(notes, context.appointment.id, context.tokenRow.tenantId);
    publicActionTokenService.consumeToken(token);
    return {
      cancelled: true,
      appointmentId: context.appointment.id,
      refund: { status: "manual_review", message: "Refund policy will be reviewed by the salon team." }
    };
  },

  getRescheduleOptions({ token, date = "" }) {
    const context = appointmentByToken(token, "reschedule");
    if (!publicAppointment(context).canReschedule) throw conflict("This booking cannot be rescheduled");
    const targetDate = date || new Date(context.appointment.startAt || Date.now()).toISOString().slice(0, 10);
    const access = {
      tenantId: context.tokenRow.tenantId,
      role: "owner",
      userId: "public-token",
      branchId: context.appointment.branchId,
      branchIds: context.appointment.branchId ? [context.appointment.branchId] : []
    };
    return onlineSlotEngineService.recommendSlots({
      branchId: context.appointment.branchId,
      serviceIds: parseServiceIds(context.appointment),
      preferredStaffId: context.appointment.staffId,
      customerId: context.appointment.clientId,
      date: targetDate,
      customerTier: context.client?.tier || "bronze",
      source: "public-reschedule"
    }, access);
  },

  confirmReschedule({ token, newSlot = {}, reason = "Customer self-rescheduled" }) {
    const context = appointmentByToken(token, "reschedule");
    if (!publicAppointment(context).canReschedule) throw conflict("This booking cannot be rescheduled");
    const startAt = newSlot.startAt || newSlot.startTime;
    if (!startAt) throw badRequest("newSlot.startAt is required");
    const previousDuration = new Date(context.appointment.endAt || Date.now()).getTime() - new Date(context.appointment.startAt || Date.now()).getTime();
    const durationMs = Number.isFinite(previousDuration) && previousDuration > 0 ? previousDuration : 45 * 60000;
    const endAt = newSlot.endAt || newSlot.endTime || new Date(new Date(startAt).getTime() + durationMs).toISOString();
    const notes = [context.appointment.notes, `Public reschedule: ${reason}`].filter(Boolean).join(" | ");
    db.prepare(
      `UPDATE appointments
       SET startAt = ?, endAt = ?, staffId = COALESCE(NULLIF(?, ''), staffId),
           chair = COALESCE(NULLIF(?, ''), chair), room = COALESCE(NULLIF(?, ''), room),
           status = 'rescheduled', notes = ?, updatedAt = CURRENT_TIMESTAMP,
           version = COALESCE(version, 1) + 1
       WHERE id = ? AND tenantId = ?`
    ).run(
      new Date(startAt).toISOString(),
      new Date(endAt).toISOString(),
      newSlot.staffId || "",
      newSlot.chair || newSlot.chairId || "",
      newSlot.room || newSlot.roomId || "",
      notes,
      context.appointment.id,
      context.tokenRow.tenantId
    );
    publicActionTokenService.consumeToken(token);
    return {
      rescheduled: true,
      appointmentId: context.appointment.id,
      startAt: new Date(startAt).toISOString(),
      endAt: new Date(endAt).toISOString()
    };
  }
};
