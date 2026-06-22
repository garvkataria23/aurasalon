import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";
import { paymentService } from "./payment.service.js";

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export class OfflinePosSyncService {
  push(payload = {}, access = {}) {
    const operations = Array.isArray(payload.operations) ? payload.operations : [payload];
    return operations.map((operation) => this.applyOperation(operation, access));
  }

  applyOperation(operation = {}, access = {}) {
    const operationId = operation.id || operation.offlineOperationId || `offline_${randomUUID().slice(0, 12)}`;
    const existing = db.prepare("SELECT * FROM offline_sync_queue WHERE tenant_id = ? AND id = ?").get(access.tenantId, operationId);
    if (existing?.sync_status === "synced") return { operationId, duplicate: true, result: safeJson(existing.payload_json, {}) };

    const branchId = operation.branch_id || operation.branchId || access.branchId;
    if (!branchId) throw badRequest("branch_id is required for offline sync");
    const row = {
      id: operationId,
      tenantId: access.tenantId,
      branchId,
      terminalId: operation.terminal_id || operation.terminalId || "",
      deviceId: operation.device_id || operation.deviceId || "",
      entityType: operation.entity_type || operation.entityType || "invoice",
      entityId: operation.entity_id || operation.entityId || "",
      operation: operation.operation || "create_invoice_draft",
      payloadJson: JSON.stringify(operation.payload || {}),
      localCreatedAt: operation.local_created_at || operation.localCreatedAt || new Date().toISOString(),
      clientVersion: Number(operation.client_version || operation.clientVersion || 1)
    };
    db.prepare(
      `INSERT OR IGNORE INTO offline_sync_queue
        (id, tenant_id, branch_id, terminal_id, device_id, entity_type, entity_id, operation,
         payload_json, local_created_at, sync_status, conflict_status, client_version, created_at)
       VALUES
        (@id, @tenantId, @branchId, @terminalId, @deviceId, @entityType, @entityId, @operation,
         @payloadJson, @localCreatedAt, 'pending', 'none', @clientVersion, CURRENT_TIMESTAMP)`
    ).run(row);

    try {
      const result = this.dispatch(row.operation, safeJson(row.payloadJson, {}), { ...access, branchId });
      db.prepare("UPDATE offline_sync_queue SET sync_status = 'synced', synced_at = CURRENT_TIMESTAMP, server_version = server_version + 1 WHERE tenant_id = ? AND id = ?").run(access.tenantId, operationId);
      return { operationId, synced: true, result };
    } catch (error) {
      db.prepare("UPDATE offline_sync_queue SET sync_status = 'failed', error_message = ? WHERE tenant_id = ? AND id = ?").run(error.message || "Sync failed", access.tenantId, operationId);
      throw error;
    }
  }

  dispatch(operation, payload, access) {
    if (operation === "create_invoice_draft") return billingService.createDraft({ ...payload, source: "offline_pos" }, access);
    if (operation === "cash_payment") return paymentService.pay(payload.invoiceId || payload.invoice_id, "cash", payload, access);
    return { accepted: true, operation, payload };
  }

  pull(query = {}, access = {}) {
    return {
      since: query.since || "",
      services: db.prepare("SELECT id, name, price, gstRate FROM services WHERE tenantId = ? LIMIT 500").all(access.tenantId),
      products: db.prepare("SELECT id, name, price, stock FROM products WHERE tenantId = ? LIMIT 500").all(access.tenantId),
      customers: db.prepare("SELECT id, name, phone, email FROM clients WHERE tenantId = ? LIMIT 500").all(access.tenantId)
    };
  }

  conflicts(access = {}) {
    return db.prepare("SELECT * FROM offline_conflicts WHERE tenant_id = ? ORDER BY created_at DESC").all(access.tenantId);
  }

  resolveConflict(id, payload = {}, access = {}) {
    const row = db.prepare("SELECT * FROM offline_conflicts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Offline conflict not found");
    const strategy = payload.resolution_strategy || payload.strategy || "server_wins";
    db.prepare("UPDATE offline_conflicts SET resolution_strategy = ?, resolved_by = ?, resolved_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .run(strategy, access.userId || "", access.tenantId, id);
    return { ...row, resolution_strategy: strategy, resolved_by: access.userId || "", resolved: true };
  }

  status(access = {}) {
    const rows = db.prepare("SELECT sync_status, COUNT(*) AS count FROM offline_sync_queue WHERE tenant_id = ? GROUP BY sync_status").all(access.tenantId);
    return { rows, offlineReady: true };
  }
}

export const offlinePosSyncService = new OfflinePosSyncService();
