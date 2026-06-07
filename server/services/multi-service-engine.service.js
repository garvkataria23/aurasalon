import { repositories } from "../repositories/repository-registry.js";
import { badRequest } from "../utils/app-error.js";
import { bookingRulesService } from "./booking-rules.service.js";
import { serviceRulesService } from "./service-rules.service.js";
import { smartBookingService } from "./smart-booking.service.js";

function addMinutes(value, minutes) {
  return new Date(new Date(value).getTime() + Number(minutes || 0) * 60000).toISOString();
}

function serviceRecord(tenantId, serviceId) {
  const service = repositories.services.getById(serviceId, { tenantId });
  if (!service) throw badRequest(`Service not found: ${serviceId}`);
  return service;
}

export const multiServiceEngineService = {
  buildTimeline(payload = {}, access) {
    const branchId = payload.branchId || access.branchId;
    const requested = payload.services || [];
    if (!branchId || !requested.length) throw badRequest("branchId and services are required");
    const requestedIds = requested.map((item) => item.serviceId || item.id).filter(Boolean);
    const chain = serviceRulesService.resolveServiceChain(access.tenantId, requestedIds);
    const startAt = payload.preferredStartTime || payload.startAt || `${payload.date || new Date().toISOString().slice(0, 10)}T10:00:00.000Z`;
    const phases = [];
    let cursor = new Date(startAt).toISOString();
    let totalPrice = 0;

    for (const item of chain) {
      const service = serviceRecord(access.tenantId, item.serviceId);
      const setupMin = Number(service.bufferBefore || 0);
      const serviceMin = Number(service.durationMinutes || 30);
      const processingMin = Number(service.processingTimeMin || 0);
      const cleanupMin = Number(service.cleanupTimeMin || service.bufferAfter || 0);
      const staffId = requested.find((req) => req.serviceId === item.serviceId)?.preferredStaffId || payload.preferredStaffId || "";
      const phaseStart = cursor;
      if (setupMin) {
        phases.push(this.phase(service, "setup", cursor, setupMin, staffId, branchId));
        cursor = addMinutes(cursor, setupMin);
      }
      phases.push(this.phase(service, "service", cursor, serviceMin, staffId, branchId));
      cursor = addMinutes(cursor, serviceMin);
      if (processingMin) {
        phases.push(this.phase(service, "processing", cursor, processingMin, "", branchId, "processing"));
        cursor = addMinutes(cursor, processingMin);
      }
      if (cleanupMin) {
        phases.push(this.phase(service, "cleanup", cursor, cleanupMin, staffId, branchId, "cleanup"));
        cursor = addMinutes(cursor, cleanupMin);
      }
      totalPrice += Number(service.price || 0) * (item.isChargeable === false ? 0 : 1);
      if (payload.mode === "parallel" && processingMin) cursor = addMinutes(phaseStart, setupMin + serviceMin + Math.ceil(processingMin / 2) + cleanupMin);
    }

    const conflicts = this.validatePhaseTimeline(phases, branchId, access);
    const deposit = bookingRulesService.isDepositRequired({
      tenantId: access.tenantId,
      branchId,
      totalAmount: totalPrice,
      customerTier: payload.customerTier
    });

    return {
      feasible: conflicts.length === 0,
      timeline: phases,
      totalDurationMin: Math.max(0, Math.round((new Date(cursor).getTime() - new Date(startAt).getTime()) / 60000)),
      totalEndTime: cursor,
      totalPrice,
      depositRequired: deposit.required,
      depositAmount: deposit.amount,
      conflicts,
      alternatives: conflicts.length && !payload._alternative ? this.generateAlternatives(payload, access) : []
    };
  },

  phase(service, phase, start, durationMin, staffId, branchId, type = "service") {
    return {
      phaseId: `${service.id}_${phase}_${start}`,
      serviceId: service.id,
      serviceName: service.name,
      phase,
      start,
      end: addMinutes(start, durationMin),
      durationMin,
      staffId,
      staffName: "",
      chairId: "",
      chairName: "",
      roomId: "",
      branchId,
      type
    };
  },

  validatePhaseTimeline(phases, branchId, access) {
    return phases.flatMap((phase) => {
      if (!phase.staffId) return [];
      return smartBookingService.findConflicts({
        branchId,
        staffId: phase.staffId,
        chair: phase.chairId,
        startAt: phase.start,
        endAt: phase.end,
        access
      });
    });
  },

  generateAlternatives(payload, access) {
    const base = new Date(payload.preferredStartTime || payload.startAt || new Date());
    return [-60, 60, 120].map((offset) => {
      try {
        return this.buildTimeline({ ...payload, preferredStartTime: addMinutes(base.toISOString(), offset), _alternative: true }, access);
      } catch {
        return null;
      }
    }).filter(Boolean).slice(0, 3);
  }
};
