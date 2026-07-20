import { statSync } from "node:fs";
import { db, dbPath } from "../db.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";
import { realtimeService } from "./realtime.service.js";
import { securityService } from "./security.service.js";
import { tenantService } from "./tenant.service.js";

export const managerRoles = new Set(["owner", "admin", "superAdmin", "manager"]);
export const ownerRoles = new Set(["owner", "admin", "superAdmin"]);
export const now = () => new Date().toISOString();
export const today = () => now().slice(0, 10);
export const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

export function requireTenant(access = {}) {
  if (!access.tenantId) throw forbidden("Tenant context is required");
  return access;
}

export function requireManager(access, message = "Manager, admin or owner access is required") {
  requireTenant(access);
  if (!managerRoles.has(access.role)) throw forbidden(message);
}

export function requireOwner(access, message = "Owner or admin access is required") {
  requireTenant(access);
  if (!ownerRoles.has(access.role)) throw forbidden(message);
}

export function branchFrom(payload = {}, access = {}) {
  return payload.branchId || payload.branch_id || access.requestedBranchId || access.branchId || "";
}

export function assertBranch(access, branchId = "") {
  requireTenant(access);
  if (branchId) tenantService.assertBranchAccess(access, branchId);
}

export function scopedWhere(access, params = {}, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  const filters = [`${prefix}tenant_id = @tenant_id`];
  params.tenant_id = access.tenantId;
  if (params.branch_id) filters.push(`${prefix}branch_id = @branch_id`);
  if (["staff", "frontDesk"].includes(access.role) && access.branchId) {
    filters.push(`${prefix}branch_id = @access_branch_id`);
    params.access_branch_id = access.branchId;
  }
  return filters.join(" AND ");
}

export function toJson(value) {
  return JSON.stringify(value ?? {});
}

export function parseJson(value, fallback = {}) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function camel(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    key.endsWith("_json") ? parseJson(value, key.includes("reasons") || key.includes("risks") || key.includes("actions") ? [] : {}) : value
  ]));
}

export function listRows(table, access, query = {}, { orderBy = "created_at DESC", limit = 100 } = {}) {
  requireTenant(access);
  const params = { tenant_id: access.tenantId };
  const branchId = query.branchId || query.branch_id || "";
  if (branchId) {
    assertBranch(access, branchId);
    params.branch_id = branchId;
  }
  const where = scopedWhere(access, params);
  return db.prepare(`SELECT * FROM ${table} WHERE ${where} ORDER BY ${orderBy} LIMIT @limit`).all({ ...params, limit: number(query.limit, limit) }).map(camel);
}

export function getScoped(table, id, access) {
  requireTenant(access);
  const row = db.prepare(`SELECT * FROM ${table} WHERE id = ? AND tenant_id = ?`).get(id, access.tenantId);
  if (!row) throw notFound("Record not found");
  if (row.branch_id) assertBranch(access, row.branch_id);
  return row;
}

export function emitEvent(type, access, branchId, id, extra = {}) {
  const payload = {
    tenantId: access.tenantId,
    branchId: branchId || "",
    id,
    type,
    actorUserId: access.userId || "",
    timestamp: now(),
    ...extra
  };
  try {
    realtimeService.broadcast(type, payload, {
      tenantId: access.tenantId,
      branchId: branchId || "",
      channel: branchId ? `branch:${branchId}` : `tenant:${access.tenantId}`
    });
  } catch {
    // Realtime delivery is best-effort after a successful database mutation.
  }
  return payload;
}

export function auditDecision(action, entityType, entityId, access, { branchId = "", details = {} } = {}) {
  const row = {
    id: makeId("cc_audit"),
    tenant_id: access.tenantId,
    branch_id: branchId || access.branchId || "",
    actor_user_id: access.userId || "",
    actor_role: access.role || "",
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_json: "",
    after_json: "",
    details_json: toJson(details)
  };
  try {
    db.prepare(`INSERT INTO staff_audit_logs
      (id, tenant_id, branch_id, actor_user_id, actor_role, action, entity_type, entity_id, before_json, after_json, details_json)
      VALUES (@id, @tenant_id, @branch_id, @actor_user_id, @actor_role, @action, @entity_type, @entity_id, @before_json, @after_json, @details_json)`).run(row);
  } catch {
    // Older test databases may be partially migrated; security audit below remains the fallback.
  }
  try {
    securityService.audit({ action, targetType: entityType, targetId: entityId, details: { branchId, ...details } }, access);
  } catch {
    // Security audit should not block approval-safe recommendations.
  }
  return row;
}

export function riskFromText(text = "") {
  const lowered = String(text).toLowerCase();
  if (/(payroll|salary|payment|refund|delete|discount|vip|compliance|security|cash)/.test(lowered)) return "high";
  if (/(campaign|whatsapp|client|inventory|staff|invoice|price)/.test(lowered)) return "medium";
  return "low";
}

export function approvalRequired(riskLevel) {
  return ["high", "medium"].includes(riskLevel) ? 1 : 0;
}

export function dbSizeBytes() {
  try {
    return statSync(dbPath).size;
  } catch {
    return 0;
  }
}

export function tableCount(table, tenantId, branchId = "") {
  const info = db.prepare(`PRAGMA table_info(${table})`).all();
  if (!info.length) return 0;
  const columns = new Set(info.map((column) => column.name));
  if (columns.has("tenant_id")) {
    const params = { tenant_id: tenantId, branch_id: branchId };
    const branchFilter = branchId && columns.has("branch_id") ? " AND branch_id = @branch_id" : "";
    return number(db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE tenant_id = @tenant_id${branchFilter}`).get(params)?.count);
  }
  if (columns.has("tenantId")) {
    return number(db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE tenantId = ?`).get(tenantId)?.count);
  }
  return number(db.prepare(`SELECT COUNT(*) count FROM ${table}`).get()?.count);
}
