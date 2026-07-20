import { repositories } from "../repositories/repository-registry.js";
import { badRequest } from "../utils/app-error.js";
import { availabilityAugmentService } from "./availability-augment.service.js";
import { serviceRulesService } from "./service-rules.service.js";
import { smartBookingService } from "./smart-booking.service.js";
import { scoreSlot } from "./slot-scoring.engine.js";

const cache = new Map();

function cacheKey(payload, tenantId) {
  return JSON.stringify({
    tenantId,
    branchId: payload.branchId,
    serviceIds: payload.serviceIds || [],
    date: payload.date,
    tier: payload.customerTier || "bronze"
  });
}

function cached(key) {
  const hit = cache.get(key);
  if (!hit || hit.expiresAt < Date.now()) return null;
  return hit.value;
}

function setCache(key, value) {
  cache.set(key, { value, expiresAt: Date.now() + 30_000 });
  return value;
}

export const onlineSlotEngineService = {
  recommendSlots(payload = {}, access) {
    const tenantId = access.tenantId;
    const branchId = payload.branchId || access.branchId;
    if (!branchId) throw badRequest("branchId is required");
    const serviceIds = Array.isArray(payload.serviceIds) ? payload.serviceIds : String(payload.serviceIds || "").split(",").filter(Boolean);
    if (!serviceIds.length) throw badRequest("serviceIds are required");

    const services = serviceIds.map((id) => repositories.services.getById(id, { tenantId })).filter(Boolean);
    const blockedService = services.find((service) => Number(service.onlineBookable ?? 1) !== 1);
    if (blockedService) throw badRequest(`${blockedService.name || blockedService.id} is not online bookable`);

    if (availabilityAugmentService.isDateBlocked({ tenantId, branchId, date: payload.date || payload.startAt || new Date(), source: "online" })) {
      return { record: null, recommendations: [], slots: [], cache: "MISS", reason: "blackout" };
    }

    const key = cacheKey({ ...payload, serviceIds }, tenantId);
    const hit = cached(key);
    if (hit) return { ...hit, cache: "HIT" };

    const chain = serviceRulesService.resolveServiceChain(tenantId, serviceIds);
    const resolvedServiceIds = chain.map((item) => item.serviceId);
    const result = smartBookingService.recommendSlots({
      ...payload,
      branchId,
      serviceIds: resolvedServiceIds,
      preferredStaffId: payload.preferredStaffId || payload.staffId || "",
      source: "online-v2"
    }, access);

    const withoutHolds = availabilityAugmentService.filterActiveHolds
      ? availabilityAugmentService.filterActiveHolds({ tenantId, branchId, slots: result.recommendations || [] })
      : (result.recommendations || []).filter((slot) => !availabilityAugmentService.hasActiveHold({
          tenantId,
          branchId,
          staffId: slot.staffId,
          chairId: slot.chair,
          startTime: slot.startAt,
          endTime: slot.endAt
        }));

    const ranked = withoutHolds
      .map((slot) => ({ ...slot, ...scoreSlot(slot, { ...payload, tenantId, branchId, serviceIds: resolvedServiceIds }) }))
      .sort((a, b) => b.score - a.score);
    return setCache(key, {
      record: result.record,
      recommendations: ranked,
      slots: ranked,
      resolvedServices: chain,
      cache: "MISS"
    });
  },

  invalidate() {
    cache.clear();
  }
};
