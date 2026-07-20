import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { smartBookingService } from "./smart-booking.service.js";
import { tenantService } from "./tenant.service.js";
import { whiteLabelService } from "./white-label.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function parseDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid date");
  return date;
}

function addMinutes(value, minutes) {
  return new Date(parseDate(value).getTime() + Number(minutes || 0) * 60000).toISOString();
}

function overlap(startA, endA, startB, endB) {
  const a1 = parseDate(startA).getTime();
  const a2 = parseDate(endA).getTime();
  const b1 = parseDate(startB).getTime();
  const b2 = parseDate(endB).getTime();
  return a1 < b2 && b1 < a2;
}

export class BookingPortalService {
  context(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    const branchQuery = branchId ? { branchId, limit: 10000 } : { limit: 10000 };
    const queryScope = scope(access, branchId);
    return {
      tenant: repositories.tenants.getById(access.tenantId),
      branding: whiteLabelService.resolve({ branchId, domain: query.domain || "" }, access),
      branches: repositories.branches.list({ limit: 10000 }, scope(access)),
      services: repositories.services.list({ limit: 10000 }, scope(access)).filter((item) => item.status !== "inactive"),
      staff: repositories.staff.list(branchQuery, queryScope).filter((item) => item.status !== "inactive"),
      paymentReady: {
        onlinePayment: true,
        modes: ["upi", "card", "wallet"],
        captureMode: "ready-for-provider"
      }
    };
  }

  slots(payload = {}, access) {
    if (!payload.branchId || !payload.serviceId) throw badRequest("branchId and serviceId are required");
    tenantService.assertBranchAccess(access, payload.branchId);
    const result = smartBookingService.recommendSlots({
      branchId: payload.branchId,
      serviceIds: [payload.serviceId],
      staffId: payload.staffId || "",
      date: payload.date || now().slice(0, 10),
      days: payload.days || 7,
      limit: payload.limit || 8,
      source: "booking-portal"
    }, access);
    return result;
  }

  confirm(payload = {}, access) {
    if (!payload.branchId || !payload.serviceId || !payload.slot || !payload.client) {
      throw badRequest("branchId, serviceId, slot and client are required");
    }
    tenantService.assertBranchAccess(access, payload.branchId);
    const client = this.resolveClient(payload.client, payload.branchId, access);
    const request = repositories.onlineBookingRequests.create({
      id: makeId("obr"),
      branchId: payload.branchId,
      clientId: client.id,
      clientInfo: payload.client,
      serviceIds: [payload.serviceId],
      preferences: { staffId: payload.staffId || payload.slot.staffId || "", paymentMode: payload.paymentMode || "pay-at-salon" },
      recommendedSlots: [payload.slot],
      selectedSlotAt: payload.slot.startAt,
      status: "confirmed",
      source: "booking-portal"
    }, scope(access, payload.branchId));
    const booking = smartBookingService.createBooking({
      clientId: client.id,
      branchId: payload.branchId,
      serviceIds: [payload.serviceId],
      staffId: payload.slot.staffId || payload.staffId,
      startAt: payload.slot.startAt,
      endAt: payload.slot.endAt,
      chair: payload.slot.chair || "",
      source: "online-portal",
      onlineStatus: "confirmed",
      notes: payload.notes || "Customer-facing online booking"
    }, access);
    const event = this.event("booking-confirmed", {
      branchId: payload.branchId,
      clientId: client.id,
      appointmentId: booking.appointment.id,
      payload: { requestId: request.id, paymentMode: payload.paymentMode || "pay-at-salon" }
    }, access);
    return { client, request, appointment: booking.appointment, event, paymentReady: true };
  }

  cancel(appointmentId, payload = {}, access) {
    const appointment = repositories.appointments.getById(appointmentId, scope(access));
    if (!appointment) throw notFound("Appointment not found");
    tenantService.assertBranchAccess(access, appointment.branchId);
    if (appointment.status === "completed") throw conflict("Completed appointments cannot be cancelled from the portal");
    const updated = repositories.appointments.update(appointment.id, {
      status: "cancelled",
      onlineStatus: "cancelled",
      notes: [appointment.notes, payload.reason ? `Portal cancel: ${payload.reason}` : "Portal cancellation"].filter(Boolean).join(" | ")
    }, scope(access));
    const event = this.event("booking-cancelled", {
      branchId: appointment.branchId,
      clientId: appointment.clientId,
      appointmentId: appointment.id,
      payload: { reason: payload.reason || "" }
    }, access);
    return { appointment: updated, event };
  }

  reschedule(appointmentId, payload = {}, access) {
    const appointment = repositories.appointments.getById(appointmentId, scope(access));
    if (!appointment) throw notFound("Appointment not found");
    tenantService.assertBranchAccess(access, appointment.branchId);
    if (["completed", "cancelled"].includes(appointment.status)) throw conflict("This appointment cannot be rescheduled");
    if (!payload.slot?.startAt) throw badRequest("slot.startAt is required");
    const endAt = payload.slot.endAt || addMinutes(payload.slot.startAt, this.durationForAppointment(appointment, access));
    const staffId = payload.slot.staffId || appointment.staffId;
    const conflicts = repositories.appointments
      .list({ branchId: appointment.branchId, limit: 10000 }, scope(access, appointment.branchId))
      .filter((item) => item.id !== appointment.id && !["cancelled", "no-show"].includes(item.status))
      .filter((item) => item.staffId === staffId && overlap(payload.slot.startAt, endAt, item.startAt, item.endAt || addMinutes(item.startAt, 45)));
    if (conflicts.length) throw conflict("Selected slot is no longer available", { conflicts });
    const updated = repositories.appointments.update(appointment.id, {
      staffId,
      startAt: parseDate(payload.slot.startAt).toISOString(),
      endAt,
      chair: payload.slot.chair || appointment.chair,
      onlineStatus: "rescheduled",
      notes: [appointment.notes, "Portal reschedule"].filter(Boolean).join(" | ")
    }, scope(access));
    const event = this.event("booking-rescheduled", {
      branchId: appointment.branchId,
      clientId: appointment.clientId,
      appointmentId: appointment.id,
      payload: { from: appointment.startAt, to: updated.startAt }
    }, access);
    return { appointment: updated, event };
  }

  resolveClient(clientInfo, branchId, access) {
    const phone = String(clientInfo.phone || "").trim();
    const name = String(clientInfo.name || "").trim();
    if (!phone || !name) throw badRequest("Customer name and phone are required");
    const existing = repositories.clients.list({ branchId, limit: 10000 }, scope(access, branchId)).find((client) => client.phone === phone);
    if (existing) return existing;
    return repositories.clients.create({
      id: makeId("client"),
      branchId,
      name,
      phone,
      email: clientInfo.email || "",
      tags: ["online"],
      notes: "Created from online booking portal"
    }, scope(access, branchId));
  }

  durationForAppointment(appointment, access) {
    return (appointment.serviceIds || []).reduce((sum, serviceId) => {
      const service = repositories.services.getById(serviceId, scope(access));
      return sum + Number(service?.durationMinutes || 45);
    }, 0) || 45;
  }

  event(type, { branchId = "", appointmentId = "", clientId = "", sessionId = "", payload = {} }, access) {
    return repositories.bookingPortalEvents.create({
      id: makeId("bpe"),
      branchId,
      appointmentId,
      clientId,
      sessionId,
      type,
      payload,
      status: "completed"
    }, scope(access, branchId));
  }
}

export const bookingPortalService = new BookingPortalService();
