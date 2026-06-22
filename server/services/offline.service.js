import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
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

  retryDashboard(query = {}, access) {
    const summary = this.summary(query, access);
    const retryCandidates = summary.syncItems
      .filter((item) => ["queued", "conflict", "failed"].includes(item.status))
      .map((item) => this.retryCandidate(item));
    const grouped = retryCandidates.reduce((acc, item) => {
      acc[item.priority] = (acc[item.priority] || 0) + 1;
      return acc;
    }, {});
    return {
      metrics: {
        queued: summary.metrics.queued,
        conflicts: summary.metrics.conflicts,
        retryCandidates: retryCandidates.length,
        priorityBilling: grouped.P1 || 0,
        priorityAppointments: grouped.P2 || 0,
        priorityInventory: grouped.P3 || 0,
        oldestQueuedAt: retryCandidates.map((item) => item.createdAt).filter(Boolean).sort()[0] || ""
      },
      retryCandidates,
      conflictHandling: {
        open: summary.metrics.conflicts,
        policy: "Server result stays source of truth until manager retries, keeps server, keeps device, or merges.",
        supportedActions: ["retry", "keep_server", "keep_device", "merge"]
      },
      offlineFirstPwa: this.pwaReadiness(summary)
    };
  }

  deviceSyncStatus(query = {}, access) {
    const summary = this.summary(query, access);
    const devices = new Map();
    for (const snapshot of summary.snapshots) {
      const id = snapshot.deviceId || "unknown-device";
      const row = devices.get(id) || this.deviceStatusBase(id);
      row.cacheSnapshots += 1;
      row.lastCacheAt = this.latest(row.lastCacheAt, snapshot.createdAt);
      row.lastSeen = this.latest(row.lastSeen, snapshot.createdAt);
      row.resources.add(snapshot.resource || "branch-cache");
      devices.set(id, row);
    }
    for (const item of summary.syncItems) {
      const id = item.deviceId || "unknown-device";
      const row = devices.get(id) || this.deviceStatusBase(id);
      row.queued += item.status === "queued" ? 1 : 0;
      row.synced += item.status === "synced" ? 1 : 0;
      row.conflicts += ["conflict", "failed"].includes(item.status) ? 1 : 0;
      row.lastSyncAttemptAt = this.latest(row.lastSyncAttemptAt, item.attemptedAt || item.syncedAt || item.updatedAt || item.createdAt);
      row.lastSeen = this.latest(row.lastSeen, item.updatedAt || item.createdAt);
      devices.set(id, row);
    }
    const rows = [...devices.values()].map((device) => ({
      ...device,
      resources: [...device.resources],
      status: device.conflicts ? "blocked" : device.queued ? "pending" : device.cacheSnapshots ? "ready" : "unknown",
      syncState: device.conflicts ? "Conflict review required" : device.queued ? "Retry pending" : "Synced",
      nextAction: device.conflicts ? "Open Conflict Center" : device.queued ? "Run Retry Dashboard" : "Keep cache fresh"
    }));
    return {
      metrics: {
        devices: rows.length,
        ready: rows.filter((row) => row.status === "ready").length,
        pending: rows.filter((row) => row.status === "pending").length,
        blocked: rows.filter((row) => row.status === "blocked").length
      },
      devices: rows,
      offlineFirstPwa: this.pwaReadiness(summary),
      mobileStaffView: {
        route: "/staff-os/mobile-preview",
        snapshotEndpoint: "/api/v1/staff-os/mobile/snapshot",
        syncEndpoint: "/api/v1/staff-os/mobile/sync",
        conflictEndpoint: "/api/v1/staff-os/mobile/conflicts"
      }
    };
  }

  retrySyncItem(id, payload = {}, access) {
    if (!id) throw badRequest("sync item id is required");
    const queryScope = scope(access, payload.branchId || access.branchId || "");
    const item = repositories.offlineSyncItems.getById(id, queryScope);
    if (!item) throw notFound("Offline sync item not found");
    if (item.branchId) tenantService.assertBranchAccess(access, item.branchId);
    if (item.status === "synced" && !payload.force) {
      return { skipped: true, reason: "Item is already synced", item };
    }
    const reset = repositories.offlineSyncItems.update(item.id, {
      status: "queued",
      conflicts: [],
      result: {
        retryRequestedAt: now(),
        retryRequestedBy: access.userId || "",
        previousStatus: item.status
      }
    }, scope(access));
    return {
      skipped: false,
      retry: {
        previousStatus: item.status,
        requestedAt: now()
      },
      item: this.processItem({ ...reset, payload: reset.payload || item.payload }, access)
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

  retryCandidate(item) {
    const priority = this.priority(item);
    return {
      id: item.id,
      branchId: item.branchId,
      deviceId: item.deviceId,
      entity: item.entity,
      operation: item.operation,
      status: item.status,
      priority,
      createdAt: item.createdAt,
      attemptedAt: item.attemptedAt,
      reason: item.conflicts?.[0]?.message || item.errorMessage || item.conflictReason || "",
      nextAction: item.status === "queued" ? "Sync now" : "Review conflict then retry"
    };
  }

  priority(item) {
    if (item.entity === "sales" || String(item.operation || "").includes("billing")) return "P1";
    if (item.entity === "appointments") return "P2";
    if (item.entity === "inventory") return "P3";
    return "P4";
  }

  deviceStatusBase(deviceId) {
    return {
      deviceId,
      cacheSnapshots: 0,
      queued: 0,
      synced: 0,
      conflicts: 0,
      resources: new Set(),
      lastSeen: "",
      lastCacheAt: "",
      lastSyncAttemptAt: ""
    };
  }

  latest(left = "", right = "") {
    if (!left) return right || "";
    if (!right) return left || "";
    return left > right ? left : right;
  }

  pwaReadiness(summary) {
    const hasCache = Number(summary.metrics.cacheSnapshots || 0) > 0;
    const hasConflicts = Number(summary.metrics.conflicts || 0) > 0;
    const queueLoad = Number(summary.metrics.queued || 0);
    return {
      ready: hasCache && !hasConflicts && queueLoad <= 50,
      installPrompt: "Use browser install/add-to-home-screen after first cache snapshot.",
      manifest: "/manifest.webmanifest",
      serviceWorker: "/offline-sw.js",
      startUrl: "/offline",
      cachedResources: summary.snapshots.map((snapshot) => snapshot.resource).filter(Boolean),
      queuePolicy: "Billing first, appointments second, inventory/background after that.",
      conflictPolicy: "Conflicts are held until manager retry or merge decision."
    };
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
