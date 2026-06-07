import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { appointmentActivityService, APPOINTMENT_ACTIVITY_ACTIONS } from "./appointment-activity.service.js";
import { resourceService } from "./resource.service.js";
import { salonOperationsService } from "./salon-operations.service.js";
import { tenantService } from "./tenant.service.js";
import { warrantyService } from "./warranty.service.js";

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {}, "appointments");
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function addMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + Number(minutes || 0) * 60000).toISOString();
}

function appointment(id, access) {
  const row = repositories.appointments.getById(id, scope(access));
  if (!row) throw notFound("Appointment not found");
  if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
  return row;
}

function updateStatus(id, status, access, extra = {}, meta = {}) {
  const current = appointment(id, access);
  const updated = repositories.appointments.update(id, { status, ...extra }, scope(access, current.branchId));
  appointmentActivityService.logActivity({
    action: meta.action || actionForStatus(status),
    appointment: updated,
    oldData: current,
    newData: updated,
    reason: meta.reason || "",
    source: meta.source || "appointment-lifecycle",
    access
  });
  return { appointment: updated };
}

const ALLOWED_STATUSES = new Set([
  "draft",
  "booked",
  "confirmed",
  "arrived",
  "waiting",
  "in-service",
  "completed",
  "billed",
  "paid",
  "cancelled",
  "no-show",
  "rescheduled"
]);

export const appointmentLifecycleService = {
  setStatus(id, payload = {}, access) {
    const status = String(payload.status || "").trim().toLowerCase();
    if (!ALLOWED_STATUSES.has(status)) throw badRequest("Unsupported appointment status");
    const extra = {};
    if (payload.reason) {
      const current = appointment(id, access);
      extra.notes = [current.notes, `Status ${status}: ${payload.reason}`].filter(Boolean).join(" | ");
    }
    return updateStatus(id, status, access, extra, {
      action: actionForStatus(status),
      reason: payload.reason || "",
      source: "status-board"
    });
  },

  checkIn(id, access) {
    return updateStatus(id, "arrived", access, {}, { action: APPOINTMENT_ACTIVITY_ACTIONS.ARRIVED, source: "check-in" });
  },

  startService(id, access) {
    return updateStatus(id, "in-service", access, {}, { action: APPOINTMENT_ACTIVITY_ACTIONS.STARTED, source: "service-start" });
  },

  complete(id, payload = {}, access) {
    const current = appointment(id, access);
    const result = salonOperationsService.completeAppointment(id, payload.notes, access);
    const warranty = warrantyService.applyWarrantyOnCompletion(id, access);
    appointmentActivityService.logActivity({
      action: APPOINTMENT_ACTIVITY_ACTIONS.COMPLETED,
      appointment: result.appointment,
      oldData: current,
      newData: result.appointment,
      reason: payload.notes || payload.reason || "",
      source: "service-complete",
      access
    });
    return { ...result, warranty };
  },

  noShow(id, payload = {}, access) {
    return updateStatus(id, "no-show", access, {
      notes: [appointment(id, access).notes, payload.reason ? `No-show reason: ${payload.reason}` : ""].filter(Boolean).join(" | ")
    }, {
      action: APPOINTMENT_ACTIVITY_ACTIONS.NO_SHOW,
      reason: payload.reason || "",
      source: "no-show"
    });
  },

  cancel(id, payload = {}, access) {
    const current = appointment(id, access);
    if (["completed", "paid"].includes(current.status)) {
      throw conflict("Completed or paid appointments cannot be cancelled");
    }
    return updateStatus(id, "cancelled", access, {
      notes: [current.notes, payload.reason ? `Cancellation reason: ${payload.reason}` : ""].filter(Boolean).join(" | ")
    }, {
      action: APPOINTMENT_ACTIVITY_ACTIONS.CANCELLED,
      reason: payload.reason || "",
      source: "cancellation"
    });
  },

  reschedule(id, payload = {}, access, req = null) {
    const current = appointment(id, access);
    if (["completed", "paid", "cancelled"].includes(current.status)) {
      throw conflict("This appointment cannot be rescheduled");
    }
    const slot = payload.slot || {};
    const nextStart = payload.startAt || slot.startAt || slot.startTime;
    if (!nextStart) throw badRequest("New start time is required");
    const durationMs = new Date(current.endAt || addMinutes(current.startAt, 45)).getTime() - new Date(current.startAt).getTime();
    const safeDurationMs = Number.isFinite(durationMs) && durationMs > 0 ? durationMs : 45 * 60000;
    const nextPayload = {
      branchId: payload.branchId || slot.branchId || current.branchId,
      staffId: payload.staffId || slot.staffId || current.staffId,
      chair: payload.chair || slot.chair || slot.chairId || current.chair || "",
      room: payload.room || slot.room || slot.roomId || current.room || "",
      startAt: new Date(nextStart).toISOString(),
      endAt: payload.endAt || slot.endAt || slot.endTime || new Date(new Date(nextStart).getTime() + safeDurationMs).toISOString(),
      status: "rescheduled",
      notes: [current.notes, payload.reason ? `Rescheduled: ${payload.reason}` : "Rescheduled"].filter(Boolean).join(" | ")
    };
    const updated = resourceService.update("appointments", id, nextPayload, access, {
      req,
      activityAction: APPOINTMENT_ACTIVITY_ACTIONS.RESCHEDULED
    });
    return { appointment: updated };
  },

  duplicate(id, payload = {}, access, req = null) {
    const current = appointment(id, access);
    const startAt = payload.startAt || addMinutes(current.startAt, 7 * 24 * 60);
    const duration = new Date(current.endAt || addMinutes(current.startAt, 45)).getTime() - new Date(current.startAt).getTime();
    if (Number.isNaN(duration) || duration <= 0) throw badRequest("Source appointment has invalid timing");
    const duplicatePayload = {
      clientId: payload.clientId || current.clientId,
      staffId: payload.staffId || current.staffId,
      branchId: payload.branchId || current.branchId,
      serviceIds: payload.serviceIds || current.serviceIds || [],
      startAt,
      endAt: payload.endAt || new Date(new Date(startAt).getTime() + duration).toISOString(),
      status: payload.status || "booked",
      source: "duplicate",
      sourceChannel: "front_desk",
      chair: payload.chair || current.chair || "",
      room: payload.room || current.room || "",
      notes: [payload.notes || "", `Duplicated from ${current.id}`].filter(Boolean).join(" | ")
    };
    const created = resourceService.create("appointments", duplicatePayload, access, {
      req,
      activityAction: APPOINTMENT_ACTIVITY_ACTIONS.DUPLICATED
    });
    return { sourceAppointmentId: current.id, appointment: created };
  },

  convertToSale(id, payload = {}, access) {
    const current = appointment(id, access);
    if (current.status !== "completed") throw conflict("Appointment must be completed before billing");
    const serviceIds = current.serviceIds || [];
    const items = serviceIds.map((serviceId) => ({ type: "service", id: serviceId, quantity: 1 }));
    if (!items.length) throw badRequest("Appointment has no billable services");
    const result = salonOperationsService.checkoutSale({
      clientId: current.clientId,
      appointmentId: current.id,
      branchId: current.branchId,
      staffId: current.staffId,
      items,
      payments: payload.payments || []
    }, access);
    const paid = Number(result.invoice?.balance || 0) <= 0;
    const updated = repositories.appointments.update(current.id, { status: paid ? "paid" : "billed", billable: 1 }, scope(access, current.branchId));
    appointmentActivityService.logActivity({
      action: APPOINTMENT_ACTIVITY_ACTIONS.BILLED,
      appointment: updated,
      oldData: current,
      newData: updated,
      reason: "Converted appointment to POS sale",
      source: "convert-to-sale",
      access
    });
    return { ...result, appointment: updated };
  }
};

function actionForStatus(status) {
  const normalized = String(status || "").toLowerCase();
  if (normalized === "cancelled") return APPOINTMENT_ACTIVITY_ACTIONS.CANCELLED;
  if (normalized === "no-show") return APPOINTMENT_ACTIVITY_ACTIONS.NO_SHOW;
  if (normalized === "completed") return APPOINTMENT_ACTIVITY_ACTIONS.COMPLETED;
  if (normalized === "arrived") return APPOINTMENT_ACTIVITY_ACTIONS.ARRIVED;
  if (normalized === "in-service") return APPOINTMENT_ACTIVITY_ACTIONS.STARTED;
  if (["billed", "paid"].includes(normalized)) return APPOINTMENT_ACTIVITY_ACTIONS.BILLED;
  if (normalized === "rescheduled") return APPOINTMENT_ACTIVITY_ACTIONS.RESCHEDULED;
  return APPOINTMENT_ACTIVITY_ACTIONS.STATUS_CHANGED;
}
