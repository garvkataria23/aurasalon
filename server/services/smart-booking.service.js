import { repositories } from "../repositories/repository-registry.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const minutes = (date) => date.getHours() * 60 + date.getMinutes();

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function parseDate(value) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid booking date");
  return date;
}

function dateKey(value) {
  return parseDate(value).toISOString().slice(0, 10);
}

function addMinutes(value, count) {
  return new Date(parseDate(value).getTime() + Number(count || 0) * 60000).toISOString();
}

function overlap(startA, endA, startB, endB) {
  const a1 = parseDate(startA).getTime();
  const a2 = parseDate(endA).getTime();
  const b1 = parseDate(startB).getTime();
  const b2 = parseDate(endB).getTime();
  return a1 < b2 && b1 < a2;
}

function serviceDuration(services) {
  return services.reduce((sum, service) => sum + Number(service.durationMinutes || 45), 0) || 45;
}

function servicePrice(services) {
  return services.reduce((sum, service) => sum + Number(service.price || 0), 0);
}

export class SmartBookingService {
  summary(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const queryScope = scope(access, branchId);
    const appointments = repositories.appointments.list({ branchId, limit: 10000 }, queryScope);
    const waitlist = repositories.bookingWaitlist.list({ branchId, limit: 10000 }, queryScope);
    const onlineRequests = repositories.onlineBookingRequests.list({ branchId, limit: 10000 }, queryScope);
    const recommendations = repositories.bookingRecommendations.list({ branchId, limit: 100 }, queryScope);
    const checkins = repositories.qrCheckins.list({ branchId, limit: 100 }, queryScope);
    const queue = repositories.realtimeQueue.list({ branchId, limit: 10000 }, queryScope);
    const openAppointments = appointments.filter((item) => ["booked", "arrived"].includes(item.status));
    const conflicts = this.detectConflictRisks(openAppointments);
    const prediction = this.queuePrediction({ branchId }, access);

    return {
      metrics: {
        openBookings: openAppointments.length,
        waitlist: waitlist.filter((item) => item.status === "waiting").length,
        onlineRequests: onlineRequests.filter((item) => item.status === "requested").length,
        qrCheckinsToday: checkins.filter((item) => item.createdAt?.startsWith(now().slice(0, 10))).length,
        queueWaiting: queue.filter((item) => item.status === "waiting").length,
        conflictRisks: conflicts.length,
        predictedWaitMinutes: prediction.predictedWaitMinutes
      },
      recommendations,
      waitlist,
      onlineRequests,
      checkins,
      conflicts,
      prediction
    };
  }

  recommendSlots(payload = {}, access) {
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = payload.branchId || access.branchId;
    if (!branchId) throw badRequest("branchId is required for smart slot recommendation");
    tenantService.assertBranchAccess(access, branchId);
    const services = this.resolveServices(payload.serviceIds || [payload.serviceId].filter(Boolean), access);
    const staffPool = this.staffPool(services, branchId, access);
    if (!staffPool.length) throw badRequest("No available staff is assigned to the selected service");
    if (payload.staffId && !staffPool.some((person) => person.id === payload.staffId)) {
      throw badRequest("Selected staff is not available for the selected service and branch");
    }
    const durationMinutes = Number(payload.durationMinutes || serviceDuration(services));
    const startDay = payload.date ? new Date(`${payload.date}T00:00:00.000Z`) : new Date();
    const appointments = repositories.appointments.list({ branchId, limit: 10000 }, scope(access, branchId));
    const recommendations = [];

    for (let day = 0; day < Number(payload.days || 7); day += 1) {
      const cursor = new Date(startDay);
      cursor.setUTCDate(cursor.getUTCDate() + day);
      for (let hour = 10; hour <= 19; hour += 1) {
        for (const minute of [0, 30]) {
          const start = new Date(cursor);
          start.setUTCHours(hour, minute, 0, 0);
          if (start.getTime() < Date.now()) continue;
          const endAt = addMinutes(start.toISOString(), durationMinutes);
          const staff = payload.staffId
            ? staffPool.find((person) => person.id === payload.staffId)
            : this.autoAssignStaff({ branchId, serviceIds: services.map((item) => item.id), startAt: start.toISOString(), endAt }, access);
          if (!staff) continue;
          const conflictCount = this.findConflicts({
            branchId,
            staffId: staff.id,
            chair: payload.chair || "",
            startAt: start.toISOString(),
            endAt,
            appointments
          }).length;
          if (conflictCount) continue;
          const workload = appointments.filter((item) => item.staffId === staff.id && item.startAt?.startsWith(start.toISOString().slice(0, 10))).length;
          const score = Math.max(55, 98 - workload * 7 - Math.abs(minutes(start) - 780) / 18);
          recommendations.push({
            startAt: start.toISOString(),
            endAt,
            staffId: staff.id,
            staffName: staff.name,
            branchId,
            chair: payload.chair || this.suggestChair(start.toISOString(), appointments),
            score: Math.round(score),
            estimatedRevenue: servicePrice(services),
            reason: workload ? "Balanced staff workload and no calendar conflict" : "High-fit slot with low staff load"
          });
          if (recommendations.length >= Number(payload.limit || 8)) break;
        }
        if (recommendations.length >= Number(payload.limit || 8)) break;
      }
      if (recommendations.length >= Number(payload.limit || 8)) break;
    }

    const record = repositories.bookingRecommendations.create({
      id: makeId("brec"),
      branchId,
      clientId: payload.clientId || "",
      source: payload.source || "smart-booking",
      request: payload,
      recommendations,
      selectedSlot: {},
      signals: {
        durationMinutes,
        serviceIds: services.map((item) => item.id),
        staffConsidered: staffPool.length,
        existingBookings: appointments.length
      },
      status: recommendations.length ? "generated" : "no-slot"
    }, scope(access, branchId));

    return { record, recommendations };
  }

  createBooking(payload = {}, access) {
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = payload.branchId || access.branchId;
    if (!payload.clientId || !branchId || !payload.startAt) throw badRequest("clientId, branchId and startAt are required");
    tenantService.assertBranchAccess(access, branchId);
    const services = this.resolveServices(payload.serviceIds || [payload.serviceId].filter(Boolean), access);
    const durationMinutes = Number(payload.durationMinutes || serviceDuration(services));
    const endAt = payload.endAt || addMinutes(payload.startAt, durationMinutes);
    const staff = payload.staffId
      ? repositories.staff.getById(payload.staffId, scope(access))
      : this.autoAssignStaff({ branchId, serviceIds: services.map((item) => item.id), startAt: payload.startAt, endAt }, access);
    if (!staff) throw badRequest("No staff is available for this booking");
    if (staff.branchId !== branchId) throw badRequest("Selected staff does not belong to the selected branch");
    const conflicts = this.findConflicts({ branchId, staffId: staff.id, chair: payload.chair || "", startAt: payload.startAt, endAt, access });
    if (conflicts.length) throw conflict("Booking conflict detected", { conflicts });

    const appointment = repositories.appointments.create({
      id: makeId("appt"),
      clientId: payload.clientId,
      staffId: staff.id,
      branchId,
      serviceIds: services.map((item) => item.id),
      startAt: parseDate(payload.startAt).toISOString(),
      endAt,
      status: payload.walkIn ? "arrived" : "booked",
      source: payload.source || "smart-booking",
      onlineStatus: payload.onlineStatus || "confirmed",
      chair: payload.chair || this.suggestChair(payload.startAt, repositories.appointments.list({ branchId, limit: 10000 }, scope(access, branchId))),
      notes: payload.notes || "Created by smart booking engine"
    }, scope(access, branchId));

    if (payload.recommendationId) {
      repositories.bookingRecommendations.update(payload.recommendationId, {
        selectedSlot: { appointmentId: appointment.id, startAt: appointment.startAt, staffId: appointment.staffId },
        status: "converted"
      }, scope(access));
    }

    repositories.notifications.create({
      id: makeId("note"),
      clientId: payload.clientId,
      branchId,
      type: "smart-booking-confirmation",
      channel: "WhatsApp",
      message: `Your salon booking is confirmed for ${new Date(appointment.startAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`,
      status: "queued-whatsapp"
    }, scope(access, branchId));
    tenantService.recordUsage({ tenantId: access.tenantId, metric: "appointments", referenceType: "appointment", referenceId: appointment.id });
    return { appointment, conflicts: [] };
  }

  addWaitlist(payload = {}, access) {
    const branchId = payload.branchId || access.branchId;
    if (!payload.clientId || !branchId) throw badRequest("clientId and branchId are required");
    tenantService.assertBranchAccess(access, branchId);
    const recommendation = this.recommendSlots({ ...payload, branchId, days: payload.days || 10, limit: 5, source: "waitlist" }, access);
    const item = repositories.bookingWaitlist.create({
      id: makeId("wait"),
      branchId,
      clientId: payload.clientId,
      serviceIds: payload.serviceIds || [payload.serviceId].filter(Boolean),
      preferredDate: payload.preferredDate || payload.date || "",
      preferredStaffId: payload.preferredStaffId || "",
      preferences: payload.preferences || {},
      recommendations: recommendation.recommendations,
      priority: payload.priority || "normal",
      status: "waiting"
    }, scope(access, branchId));
    return { waitlist: item, recommendations: recommendation.recommendations };
  }

  promoteWaitlist(id, payload = {}, access) {
    const item = repositories.bookingWaitlist.getById(id, scope(access));
    if (!item) throw notFound("Waitlist item not found");
    tenantService.assertBranchAccess(access, item.branchId);
    const slot = payload.slot || item.recommendations?.[0];
    if (!slot) throw badRequest("No slot is available to promote this waitlist item");
    const result = this.createBooking({
      clientId: item.clientId,
      branchId: item.branchId,
      serviceIds: item.serviceIds,
      staffId: slot.staffId,
      startAt: slot.startAt,
      endAt: slot.endAt,
      chair: slot.chair,
      source: "waitlist-promotion"
    }, access);
    const waitlist = repositories.bookingWaitlist.update(item.id, {
      status: "converted",
      convertedAppointmentId: result.appointment.id
    }, scope(access));
    return { waitlist, appointment: result.appointment };
  }

  onlineRequest(payload = {}, access) {
    const branchId = payload.branchId || access.branchId;
    if (!branchId || !payload.clientInfo) throw badRequest("branchId and clientInfo are required");
    tenantService.assertBranchAccess(access, branchId);
    const recommendation = this.recommendSlots({ ...payload, branchId, source: "online-portal" }, access);
    const request = repositories.onlineBookingRequests.create({
      id: makeId("obr"),
      branchId,
      clientId: payload.clientId || "",
      clientInfo: payload.clientInfo,
      serviceIds: payload.serviceIds || [payload.serviceId].filter(Boolean),
      preferences: payload.preferences || {},
      recommendedSlots: recommendation.recommendations,
      selectedSlotAt: payload.selectedSlotAt || "",
      status: "requested",
      source: payload.source || "online-portal"
    }, scope(access, branchId));
    return { request, recommendedSlots: recommendation.recommendations };
  }

  qrCheckIn(payload = {}, access) {
    const branchId = payload.branchId || access.branchId;
    if (!branchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, branchId);
    const appointment = payload.appointmentId
      ? repositories.appointments.getById(payload.appointmentId, scope(access))
      : this.findAppointmentForQr(payload.code, branchId, access);
    if (!appointment) throw notFound("Appointment not found for QR check-in");
    const updatedAppointment = repositories.appointments.update(appointment.id, {
      status: "arrived",
      onlineStatus: "checked-in",
      notes: [appointment.notes, "QR check-in completed"].filter(Boolean).join(" | ")
    }, scope(access));
    const queue = repositories.realtimeQueue.create({
      id: makeId("queue"),
      branchId,
      clientId: appointment.clientId,
      appointmentId: appointment.id,
      type: "qr-check-in",
      title: "QR check-in arrival",
      priority: payload.priority || "normal",
      status: "waiting",
      assignedStaffId: appointment.staffId,
      payload: { source: payload.source || "qr", code: payload.code || "", appointmentId: appointment.id },
      history: [{ at: now(), event: "checked-in", by: access.userId || "system" }]
    }, scope(access, branchId));
    const checkin = repositories.qrCheckins.create({
      id: makeId("checkin"),
      branchId,
      appointmentId: appointment.id,
      clientId: appointment.clientId,
      source: payload.source || "qr",
      code: payload.code || "",
      queueItemId: queue.id,
      status: "arrived",
      metadata: payload.metadata || {}
    }, scope(access, branchId));
    return { checkin, appointment: updatedAppointment, queue };
  }

  queuePrediction(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const queue = repositories.realtimeQueue.list({ branchId, limit: 10000 }, scope(access, branchId));
    const waiting = queue.filter((item) => item.status === "waiting");
    const staffCount = Math.max(1, repositories.staff.list({ branchId, limit: 10000 }, scope(access, branchId)).filter((item) => item.status !== "inactive").length);
    const predictedWaitMinutes = Math.round((waiting.length * 18) / staffCount + Math.min(20, waiting.filter((item) => item.priority === "high").length * 6));
    return {
      branchId,
      waiting: waiting.length,
      staffOnlineCapacity: staffCount,
      predictedWaitMinutes,
      queuePressure: predictedWaitMinutes > 45 ? "high" : predictedWaitMinutes > 20 ? "medium" : "low",
      nextActions: predictedWaitMinutes > 30 ? ["Open one more chair", "Auto-notify waiting clients", "Prioritize arrived appointments"] : ["Keep current queue flow"]
    };
  }

  autoAssignStaff({ branchId, serviceIds = [], startAt, endAt }, access) {
    const services = this.resolveServices(serviceIds, access);
    const staffPool = this.staffPool(services, branchId, access);
    const appointments = repositories.appointments.list({ branchId, limit: 10000 }, scope(access, branchId));
    const available = staffPool
      .map((staff) => ({
        staff,
        conflicts: this.findConflicts({ branchId, staffId: staff.id, startAt, endAt, appointments }).length,
        dayLoad: appointments.filter((item) => item.staffId === staff.id && item.startAt?.startsWith(dateKey(startAt))).length,
        performance: Number(staff.performance?.rating || 4.4)
      }))
      .filter((item) => item.conflicts === 0)
      .sort((a, b) => a.dayLoad - b.dayLoad || b.performance - a.performance);
    return available[0]?.staff || null;
  }

  detectConflictRisks(appointments) {
    const risks = [];
    for (let i = 0; i < appointments.length; i += 1) {
      for (let j = i + 1; j < appointments.length; j += 1) {
        const first = appointments[i];
        const second = appointments[j];
        if (first.id === second.id || first.branchId !== second.branchId) continue;
        const sameStaff = first.staffId && first.staffId === second.staffId;
        const sameChair = first.chair && first.chair === second.chair;
        if ((sameStaff || sameChair) && overlap(first.startAt, first.endAt || addMinutes(first.startAt, 45), second.startAt, second.endAt || addMinutes(second.startAt, 45))) {
          risks.push({ appointmentIds: [first.id, second.id], reason: sameStaff ? "staff-overlap" : "chair-overlap" });
        }
      }
    }
    return risks;
  }

  findConflicts({ branchId, staffId, chair = "", startAt, endAt, appointments = null, access = null }) {
    const rows = appointments || repositories.appointments.list({ branchId, limit: 10000 }, scope(access || {}, branchId));
    return rows.filter((appointment) => {
      if (appointment.branchId !== branchId || ["cancelled", "no-show"].includes(appointment.status)) return false;
      const appointmentEnd = appointment.endAt || addMinutes(appointment.startAt, 45);
      if (!overlap(startAt, endAt, appointment.startAt, appointmentEnd)) return false;
      return appointment.staffId === staffId || (chair && appointment.chair === chair);
    });
  }

  findAppointmentForQr(code = "", branchId, access) {
    const rows = repositories.appointments.list({ branchId, limit: 10000 }, scope(access, branchId));
    return rows.find((item) => item.id === code || item.clientId === code || `${item.id}:${item.clientId}` === code) || null;
  }

  resolveServices(serviceIds = [], access) {
    const ids = serviceIds.filter(Boolean);
    if (!ids.length) throw badRequest("At least one service is required");
    return ids.map((id) => {
      const service = repositories.services.getById(id, scope(access));
      if (!service) throw notFound(`Service not found: ${id}`);
      return service;
    });
  }

  staffPool(services, branchId, access) {
    const serviceIds = services.map((item) => item.id);
    return repositories.staff.list({ branchId, limit: 10000 }, scope(access, branchId)).filter((person) => {
      const assigned = person.assignedServices || [];
      return !assigned.length || serviceIds.some((id) => assigned.includes(id));
    });
  }

  suggestChair(startAt, appointments) {
    const chairs = ["Chair 1", "Chair 2", "Chair 3", "Room 1"];
    const endAt = addMinutes(startAt, 45);
    return chairs.find((chair) => !appointments.some((item) => item.chair === chair && overlap(startAt, endAt, item.startAt, item.endAt || addMinutes(item.startAt, 45)))) || "Chair 1";
  }
}

export const smartBookingService = new SmartBookingService();
