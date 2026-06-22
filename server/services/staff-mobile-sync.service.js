import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import {
  assertBranch,
  branchIdFrom,
  camel,
  emitStaffEvent,
  makeId,
  now,
  requireManager,
  requireTenant,
  scopedBranchWhere,
  staffAudit,
  staffById,
  toJson
} from "./staff-os-advanced-utils.js";
import { staffOsService } from "./staff-os.service.js";

export class StaffMobileSyncService {
  registerDevice(payload = {}, access) {
    access = requireTenant(access);
    const staff = staffById(payload.staffId || payload.staff_id || access.userId, access);
    const branchId = branchIdFrom(payload, access) || staff.branch_id;
    assertBranch(access, branchId);
    const row = {
      id: makeId("mobdev"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      staff_id: staff.id,
      device_uid: payload.deviceUid || payload.device_uid || "",
      platform: payload.platform || "",
      sync_token: makeId("sync_token")
    };
    if (!row.device_uid) throw badRequest("deviceUid is required");
    db.prepare(`INSERT OR REPLACE INTO staff_mobile_devices
      (id, tenant_id, branch_id, staff_id, device_uid, platform, sync_token, updated_at)
      VALUES (@id, @tenant_id, @branch_id, @staff_id, @device_uid, @platform, @sync_token, CURRENT_TIMESTAMP)`).run(row);
    emitStaffEvent("staff:mobile_device_registered", access, branchId, row.id);
    return camel(db.prepare("SELECT * FROM staff_mobile_devices WHERE tenant_id = ? AND device_uid = ?").get(access.tenantId, row.device_uid));
  }

  snapshot(query = {}, access) {
    access = requireTenant(access);
    const staff = staffById(query.staffId || query.staff_id || access.userId, access);
    const branchId = query.branchId || access.requestedBranchId || staff.branch_id;
    assertBranch(access, branchId);
    const data = {
      generatedAt: now(),
      staff: camel(staff),
      today: staffOsService.mobileToday({ staffId: staff.id, date: query.date }, access),
      tasks: staffOsService.listTasks({ staffId: staff.id, branchId }, access)
    };
    const row = {
      id: makeId("mobsnap"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      staff_id: staff.id,
      snapshot_json: toJson(data),
      sync_token: query.syncToken || makeId("sync")
    };
    db.prepare(`INSERT INTO staff_mobile_snapshots (id, tenant_id, branch_id, staff_id, snapshot_json, sync_token)
      VALUES (@id, @tenant_id, @branch_id, @staff_id, @snapshot_json, @sync_token)`).run(row);
    return { ...data, syncToken: row.sync_token };
  }

  sync(payload = {}, access) {
    access = requireTenant(access);
    const device = this.device(payload.deviceId || payload.device_id, payload.deviceUid || payload.device_uid, access);
    const mutations = Array.isArray(payload.mutations) ? payload.mutations : [];
    const results = [];
    const conflicts = [];
    for (const mutation of mutations) {
      const idempotencyKey = mutation.idempotencyKey || mutation.idempotency_key;
      if (!idempotencyKey) throw badRequest("Every offline mutation requires idempotencyKey");
      const existing = db.prepare("SELECT * FROM staff_mobile_sync_queue WHERE tenant_id = ? AND idempotency_key = ?").get(access.tenantId, idempotencyKey);
      if (existing) {
        results.push({ idempotencyKey, status: "duplicate", result: JSON.parse(existing.result_json || "{}") });
        continue;
      }
      const queueId = makeId("msync");
      let status = "processed";
      let result = {};
      try {
        result = this.applyMutation(mutation, device, access);
      } catch (error) {
        status = "conflict";
        const conflict = this.createConflict(queueId, mutation, device, access, error.message);
        conflicts.push(conflict);
        result = { conflictId: conflict.id, error: error.message };
      }
      db.prepare(`INSERT INTO staff_mobile_sync_queue
        (id, tenant_id, branch_id, staff_id, device_id, action_type, idempotency_key, payload_json, status, result_json, processed_at)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        queueId, access.tenantId, device.branch_id, device.staff_id, device.id, mutation.actionType || mutation.action_type,
        idempotencyKey, toJson(mutation), status, toJson(result), now()
      );
      results.push({ idempotencyKey, status, result });
    }
    db.prepare("UPDATE staff_mobile_devices SET last_sync_at = ?, updated_at = ? WHERE id = ? AND tenant_id = ?").run(now(), now(), device.id, access.tenantId);
    emitStaffEvent("staff:mobile_sync_received", access, device.branch_id, device.id, { mutations: mutations.length, conflicts: conflicts.length });
    return { deviceId: device.id, processed: results.length, results, conflicts };
  }

  conflicts(query = {}, access) {
    access = requireTenant(access);
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      status: query.status || "open",
      limit: Math.min(Number(query.limit || 100), 500)
    };
    const filters = [scopedBranchWhere(access, params)];
    if (params.status) filters.push("status = @status");
    return db.prepare(`SELECT * FROM staff_mobile_conflicts WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params).map(camel);
  }

  resolveConflict(id, payload = {}, access) {
    access = requireTenant(access);
    requireManager(access);
    const row = db.prepare("SELECT * FROM staff_mobile_conflicts WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Mobile conflict not found");
    assertBranch(access, row.branch_id);
    db.prepare("UPDATE staff_mobile_conflicts SET status = 'resolved', resolution = ?, resolved_by = ?, resolved_at = ? WHERE id = ? AND tenant_id = ?")
      .run(payload.resolution || "server_wins", access.userId || "", now(), id, access.tenantId);
    emitStaffEvent("staff:mobile_conflict_resolved", access, row.branch_id, id);
    return camel(db.prepare("SELECT * FROM staff_mobile_conflicts WHERE id = ? AND tenant_id = ?").get(id, access.tenantId));
  }

  applyMutation(mutation, device, access) {
    const action = mutation.actionType || mutation.action_type;
    const payload = { ...(mutation.payload || {}), staffId: device.staff_id, branchId: device.branch_id };
    if (action === "clock_in") {
      const active = db.prepare("SELECT id FROM staff_attendance_logs WHERE tenant_id = ? AND staff_id = ? AND status = 'clocked_in'")
        .get(access.tenantId, device.staff_id);
      if (active) throw new Error("Attendance conflict: staff already clocked in");
      return staffOsService.clockIn(payload, access);
    }
    if (action === "clock_out") return staffOsService.clockOut(payload, access);
    if (action === "request_leave") return staffOsService.requestLeave(payload, access);
    if (action === "complete_task") return staffOsService.updateTask(payload.taskId, { status: "completed", version: payload.version }, access);
    if (["start_service", "complete_service", "add_product_usage", "add_service_note", "complete_checklist_item"].includes(action)) {
      return { accepted: true, action, serverPolicy: "queued_for_domain_processing" };
    }
    throw new Error(`Unsupported offline action: ${action}`);
  }

  createConflict(queueId, mutation, device, access, reason) {
    const row = {
      id: makeId("mconf"),
      tenant_id: access.tenantId,
      branch_id: device.branch_id,
      staff_id: device.staff_id,
      device_id: device.id,
      sync_queue_id: queueId,
      conflict_type: mutation.actionType || mutation.action_type || "unknown",
      local_payload_json: toJson(mutation),
      server_payload_json: toJson({ reason }),
      resolution: "server_wins",
      status: "open"
    };
    db.prepare(`INSERT INTO staff_mobile_conflicts
      (id, tenant_id, branch_id, staff_id, device_id, sync_queue_id, conflict_type, local_payload_json, server_payload_json, resolution, status)
      VALUES (@id, @tenant_id, @branch_id, @staff_id, @device_id, @sync_queue_id, @conflict_type, @local_payload_json, @server_payload_json, @resolution, @status)`).run(row);
    emitStaffEvent("staff:mobile_conflict_created", access, device.branch_id, row.id);
    return camel(row);
  }

  device(deviceId, deviceUid, access) {
    const row = deviceId
      ? db.prepare("SELECT * FROM staff_mobile_devices WHERE id = ? AND tenant_id = ?").get(deviceId, access.tenantId)
      : db.prepare("SELECT * FROM staff_mobile_devices WHERE device_uid = ? AND tenant_id = ?").get(deviceUid || "", access.tenantId);
    if (!row) throw notFound("Mobile device not registered");
    assertBranch(access, row.branch_id);
    return row;
  }
}

export const staffMobileSyncService = new StaffMobileSyncService();
