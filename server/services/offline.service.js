import { repositories } from "../repositories/repository-registry.js";
import { badRequest } from "../utils/app-error.js";
import { salonOperationsService } from "./salon-operations.service.js";
import { smartBookingService } from "./smart-booking.service.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

export class OfflineService {
  summary(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const queryScope = scope(access, branchId);
    const syncItems = repositories.offlineSyncItems.list({ branchId, limit: 200 }, queryScope);
    const snapshots = repositories.offlineCacheSnapshots.list({ branchId, limit: 100 }, queryScope);
    const queued = syncItems.filter((item) => item.status === "queued");
    const conflicts = syncItems.filter((item) => item.status === "conflict");
    return {
      metrics: {
        queued: queued.length,
        synced: syncItems.filter((item) => item.status === "synced").length,
        conflicts: conflicts.length,
        cacheSnapshots: snapshots.length,
        offlineAppointments: syncItems.filter((item) => item.entity === "appointments").length,
        offlineBills: syncItems.filter((item) => item.entity === "sales").length
      },
      syncItems,
      snapshots,
      branchCache: this.buildCache(branchId, access),
      guidance: [
        "Cache clients, services, staff and products before network drops.",
        "Offline appointments sync through the same conflict-prevention engine.",
        "Offline billing syncs through POS checkout so stock, invoice and client history stay consistent."
      ]
    };
  }

  createSnapshot(payload = {}, access) {
    const branchId = payload.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const resource = payload.resource || "branch-cache";
    const data = payload.data ?? this.buildCache(branchId, access);
    return repositories.offlineCacheSnapshots.create({
      id: makeId("cache"),
      branchId,
      deviceId: payload.deviceId || "front-desk-terminal",
      resource,
      data,
      metadata: {
        generatedAt: now(),
        counts: this.cacheCounts(data),
        requestedBy: access.userId || ""
      },
      version: Number(payload.version || 1),
      status: "fresh"
    }, scope(access, branchId));
  }

  enqueue(payload = {}, access) {
    if (!payload.deviceId || !payload.entity || !payload.operation) {
      throw badRequest("deviceId, entity and operation are required");
    }
    const branchId = payload.branchId || payload.payload?.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    return repositories.offlineSyncItems.create({
      id: makeId("sync"),
      branchId,
      deviceId: payload.deviceId,
      entity: payload.entity,
      operation: payload.operation,
      localId: payload.localId || "",
      payload: payload.payload || {},
      conflicts: [],
      result: {},
      status: "queued"
    }, scope(access, branchId));
  }

  sync(payload = {}, access) {
    const queued = payload.items?.length
      ? payload.items.map((item) => this.enqueue(item, access))
      : repositories.offlineSyncItems
          .list({ branchId: payload.branchId || access.branchId || "", limit: 250 }, scope(access, payload.branchId || access.branchId || ""))
          .filter((item) => item.status === "queued");
    const results = queued.map((item) => this.processItem(item, access));
    return {
      processed: results.length,
      synced: results.filter((item) => item.status === "synced").length,
      conflicts: results.filter((item) => item.status === "conflict").length,
      results
    };
  }

  offlineAppointment(payload = {}, access) {
    const item = this.enqueue({
      deviceId: payload.deviceId || "front-desk-terminal",
      entity: "appointments",
      operation: payload.operation || "create",
      localId: payload.localId || "",
      branchId: payload.branchId,
      payload
    }, access);
    return this.processItem(item, access);
  }

  offlineBilling(payload = {}, access) {
    const item = this.enqueue({
      deviceId: payload.deviceId || "front-desk-terminal",
      entity: "sales",
      operation: payload.operation || "checkout",
      localId: payload.localId || "",
      branchId: payload.branchId,
      payload
    }, access);
    return this.processItem(item, access);
  }

  processItem(item, access) {
    try {
      let result;
      if (item.entity === "appointments" && item.operation === "create") {
        result = smartBookingService.createBooking({ ...item.payload, source: "offline-sync" }, access);
      } else if (item.entity === "sales" && ["checkout", "create"].includes(item.operation)) {
        result = salonOperationsService.checkoutSale({ ...item.payload, source: "offline-sync" }, access);
      } else {
        throw badRequest(`Unsupported offline sync operation: ${item.entity}.${item.operation}`);
      }
      const serverId = result.appointment?.id || result.sale?.id || result.invoice?.id || "";
      return repositories.offlineSyncItems.update(item.id, {
        serverId,
        result,
        status: "synced",
        attemptedAt: now(),
        syncedAt: now()
      }, scope(access));
    } catch (error) {
      return repositories.offlineSyncItems.update(item.id, {
        conflicts: [{ message: error.message, status: error.status || 400, at: now() }],
        result: {},
        status: "conflict",
        attemptedAt: now()
      }, scope(access));
    }
  }

  buildCache(branchId, access) {
    const queryScope = scope(access, branchId);
    const branchQuery = branchId ? { branchId, limit: 10000 } : { limit: 10000 };
    return {
      generatedAt: now(),
      branchId,
      clients: repositories.clients.list(branchQuery, queryScope),
      services: repositories.services.list({ limit: 10000 }, scope(access)),
      staff: repositories.staff.list(branchQuery, queryScope),
      products: repositories.products.list(branchQuery, queryScope),
      memberships: repositories.memberships.list(branchQuery, queryScope),
      settings: repositories.settings.list({ limit: 1000 }, scope(access))
    };
  }

  cacheCounts(data = {}) {
    return Object.fromEntries(
      Object.entries(data)
        .filter(([, value]) => Array.isArray(value))
        .map(([key, value]) => [key, value.length])
    );
  }
}

export const offlineService = new OfflineService();
