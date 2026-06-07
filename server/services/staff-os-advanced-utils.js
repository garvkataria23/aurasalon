import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { db } from "../db.js";
import { env } from "../config/env.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";
import { realtimeService } from "./realtime.service.js";
import { securityService } from "./security.service.js";
import { tenantService } from "./tenant.service.js";

export const managerRoles = new Set(["owner", "admin", "superAdmin", "manager"]);
export const payrollRoles = new Set(["owner", "admin", "superAdmin", "accountant"]);

export const now = () => new Date().toISOString();
export const today = () => now().slice(0, 10);
export const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

export function requireTenant(access = {}) {
  if (!access.tenantId) throw forbidden("Tenant context is required");
  return access;
}

export function requireRole(access, roles, message = "This action is not allowed for your role") {
  requireTenant(access);
  if (!roles.has(access.role)) throw forbidden(message);
}

export function requireManager(access) {
  requireRole(access, managerRoles, "Only manager/admin/owner can manage staff operations");
}

export function branchIdFrom(payload = {}, access = {}) {
  return payload.branchId || payload.branch_id || access.requestedBranchId || access.branchId || "";
}

export function assertBranch(access, branchId) {
  requireTenant(access);
  if (!branchId) throw badRequest("branchId is required");
  tenantService.assertBranchAccess(access, branchId);
}

export function scopedBranchWhere(access, params, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  const filters = [`${prefix}tenant_id = @tenant_id`];
  if (params.branch_id) filters.push(`${prefix}branch_id = @branch_id`);
  if (["staff", "frontDesk"].includes(access.role) && access.branchId) {
    filters.push(`${prefix}branch_id = @access_branch_id`);
    params.access_branch_id = access.branchId;
  }
  return filters.join(" AND ");
}

export function staffById(staffId, access) {
  if (!staffId) throw badRequest("staffId is required");
  const row = db.prepare("SELECT * FROM staff_master WHERE id = ? AND tenant_id = ?").get(staffId, access.tenantId);
  if (!row) throw notFound("Staff record not found");
  if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
  return row;
}

export function camel(row = {}) {
  return Object.fromEntries(Object.entries(row).map(([key, value]) => [
    key.replace(/_([a-z])/g, (_, letter) => letter.toUpperCase()),
    parseJsonMaybe(value)
  ]));
}

export function parseJsonMaybe(value) {
  if (typeof value !== "string") return value;
  const trimmed = value.trim();
  if (!trimmed || !["{", "["].includes(trimmed[0])) return value;
  try {
    return JSON.parse(trimmed);
  } catch {
    return value;
  }
}

export function toJson(value) {
  return JSON.stringify(value ?? {});
}

export function number(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

export function hashPayload(value) {
  return createHash("sha256").update(toJson(value)).digest("hex");
}

function encryptionKey() {
  return scryptSync(env.encryptionSecret || env.jwtSecret || "aura-staff-os", "staff-os-advanced", 32);
}

export function encryptJson(payload = {}) {
  if (!payload || !Object.keys(payload).length) return "";
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const text = toJson(payload);
  const encrypted = Buffer.concat([cipher.update(text, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return JSON.stringify({
    alg: "aes-256-gcm",
    iv: iv.toString("base64"),
    tag: tag.toString("base64"),
    data: encrypted.toString("base64")
  });
}

export function emitStaffEvent(type, access, branchId, id, extra = {}) {
  const payload = {
    tenantId: access.tenantId,
    branchId: branchId || "",
    id,
    type,
    timestamp: now(),
    actorUserId: access.userId || "",
    ...extra
  };
  try {
    realtimeService.broadcast(type, payload, {
      tenantId: access.tenantId,
      branchId: branchId || "",
      channel: branchId ? `branch:${branchId}` : `tenant:${access.tenantId}`
    });
  } catch {
    // Realtime delivery is best-effort after database commit.
  }
  return payload;
}

export function staffAudit(action, entityType, entityId, access, { branchId = "", before = null, after = null, details = {} } = {}) {
  const row = {
    id: makeId("saudit"),
    tenant_id: access.tenantId,
    branch_id: branchId || access.branchId || "",
    actor_user_id: access.userId || "",
    actor_role: access.role || "",
    action,
    entity_type: entityType,
    entity_id: entityId,
    before_json: before ? toJson(before) : "",
    after_json: after ? toJson(after) : "",
    details_json: toJson(details)
  };
  db.prepare(`INSERT INTO staff_audit_logs
    (id, tenant_id, branch_id, actor_user_id, actor_role, action, entity_type, entity_id, before_json, after_json, details_json)
    VALUES (@id, @tenant_id, @branch_id, @actor_user_id, @actor_role, @action, @entity_type, @entity_id, @before_json, @after_json, @details_json)`).run(row);
  try {
    securityService.audit({ action, targetType: entityType, targetId: entityId, details: { branchId, ...details } }, access);
  } catch {
    // staff_audit_logs is the advanced Staff OS source of truth.
  }
  return row;
}
