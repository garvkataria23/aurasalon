import { copyFileSync, mkdirSync, readFileSync, statSync } from "node:fs";
import { createCipheriv, createHash, randomBytes, scryptSync } from "node:crypto";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { env } from "../config/env.js";
import { repositories } from "../repositories/repository-registry.js";
import { builtinRoles, can, staticGrantsForRole } from "../middleware/rbac.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const dataDir = join(__dirname, "..", "..", "data");
const backupDir = join(dataDir, "backups");
const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function key() {
  return scryptSync(env.encryptionSecret || env.jwtSecret, "aura-salon-security", 32);
}

export class SecurityService {
  summary(_query = {}, access) {
    const queryScope = scope(access);
    const auditLogs = repositories.securityAuditLogs.list({ limit: 100 }, queryScope);
    const activities = repositories.securityActivityEvents.list({ limit: 100 }, queryScope);
    const sessions = repositories.securitySessions.list({ limit: 100 }, queryScope);
    const backups = repositories.securityBackups.list({ limit: 50 }, queryScope);
    const permissions = repositories.securityPermissions.list({ limit: 1000 }, queryScope);
    const secrets = repositories.encryptedSecrets.list({ limit: 100 }, queryScope).map((item) => ({
      id: item.id,
      name: item.name,
      purpose: item.purpose,
      status: item.status,
      createdAt: item.createdAt
    }));
    const lastHour = Date.now() - 60 * 60 * 1000;
    const recentActivity = activities.filter((item) => new Date(item.createdAt).getTime() >= lastHour);
    const denied = auditLogs.filter((item) => item.severity === "warning" || item.action.includes("denied"));
    return {
      metrics: {
        auditLogs: auditLogs.length,
        activeSessions: sessions.filter((item) => item.status === "active" && !item.revokedAt).length,
        backups: backups.length,
        permissions: permissions.length,
        encryptedSecrets: secrets.length,
        recentRequests: recentActivity.length,
        deniedEvents: denied.length,
        riskScore: Math.min(100, denied.length * 10 + Math.max(0, recentActivity.length - 60))
      },
      auditLogs,
      activities,
      sessions,
      backups,
      permissions,
      secrets,
      controls: {
        rateLimiting: "enabled",
        apiProtection: "security headers + request tracking",
        auditLogs: "persisted",
        encryption: "aes-256-gcm",
        backups: "sqlite file snapshots"
      }
    };
  }

  permissionMatrix(access) {
    const matrixResources = [
      "dashboard",
      "appointments",
      "clients",
      "sales",
      "invoices",
      "payments",
      "finance",
      "products",
      "inventory",
      "inventory-intelligence",
      "staff",
      "reports",
      "analytics",
      "marketing",
      "whatsapp",
      "workflows",
      "customer-360",
      "booking-portal",
      "settings",
      "security"
    ];
    const roleDefinitions = repositories.roleDefinitions.list({ limit: 1000 }, scope(access));
    const permissionRows = repositories.securityPermissions.list({ limit: 5000 }, scope(access));
    const roles = [...new Set([...builtinRoles(), ...roleDefinitions.map((item) => item.role), ...permissionRows.map((item) => item.role)])].sort();
    const actions = ["read", "write", "admin"];
    return {
      roles: roles.map((role) => ({
        role,
        name: roleDefinitions.find((item) => item.role === role)?.name || role,
        description: roleDefinitions.find((item) => item.role === role)?.description || "",
        isSystem: roleDefinitions.find((item) => item.role === role)?.isSystem ?? (builtinRoles().includes(role) ? 1 : 0),
        staticGrants: staticGrantsForRole(role)
      })),
      resources: matrixResources,
      actions,
      matrix: roles.map((role) => ({
        role,
        resources: Object.fromEntries(
          matrixResources.map((resource) => [
            resource,
            Object.fromEntries(actions.map((action) => [action, can(role, action, resource, access)]))
          ])
        )
      })),
      permissionRows,
      customRoles: roleDefinitions.filter((item) => !Number(item.isSystem))
    };
  }

  upsertRoleDefinition(payload = {}, access, req = null) {
    if (!payload.role || !payload.name) throw badRequest("role and name are required");
    const role = String(payload.role).trim();
    if (!/^[a-zA-Z][a-zA-Z0-9_-]{2,40}$/.test(role)) {
      throw badRequest("role must start with a letter and use letters, numbers, _ or -");
    }
    const permissions = Array.isArray(payload.permissions) ? payload.permissions : [];
    if (!permissions.length) throw badRequest("permissions array is required");
    const existing = db.prepare("SELECT id FROM role_definitions WHERE tenantId = ? AND role = ?").get(access.tenantId, role);
    const data = {
      role,
      name: payload.name,
      description: payload.description || "",
      permissions,
      isSystem: payload.isSystem ? 1 : 0,
      status: payload.status || "active",
      createdBy: access.userId || ""
    };
    const definition = existing
      ? repositories.roleDefinitions.update(existing.id, data, scope(access))
      : repositories.roleDefinitions.create({ id: makeId("role"), ...data }, scope(access));

    permissions.forEach((permission) => {
      if (!permission.resource || !Array.isArray(permission.actions) || !permission.actions.length) return;
      const found = db.prepare("SELECT id FROM security_permissions WHERE tenantId = ? AND role = ? AND resource = ?").get(access.tenantId, role, permission.resource);
      const permissionData = {
        role,
        resource: permission.resource,
        actions: permission.actions,
        effect: permission.effect || "allow",
        conditions: permission.conditions || {}
      };
      if (found?.id) {
        repositories.securityPermissions.update(found.id, permissionData, scope(access));
      } else {
        repositories.securityPermissions.create({ id: makeId("perm"), ...permissionData }, scope(access));
      }
    });

    this.audit({ action: "role.upserted", targetType: "role_definition", targetId: definition.id, details: data }, access, req);
    return { definition, matrix: this.permissionMatrix(access) };
  }

  complianceSummary(query = {}, access) {
    const queryScope = scope(access, query.branchId || "");
    const auditLogs = repositories.securityAuditLogs.list({ limit: Number(query.limit || 500) }, queryScope);
    const sessions = repositories.securitySessions.list({ limit: 500 }, queryScope);
    const activities = repositories.securityActivityEvents.list({ limit: 500 }, queryScope);
    const buckets = {
      bookingCreates: auditLogs.filter((item) => item.action === "booking.created"),
      billEdits: auditLogs.filter((item) => item.action === "bill.edited"),
      clientDeletes: auditLogs.filter((item) => item.action === "client.deleted"),
      paymentChanges: auditLogs.filter((item) => item.action.startsWith("payment.") || item.action === "refund.processed"),
      discountApprovals: auditLogs.filter((item) => item.action === "discount.approved"),
      loginHistory: auditLogs.filter((item) => item.action === "auth.login")
    };
    return {
      metrics: {
        trackedEvents: auditLogs.length,
        bookingCreates: buckets.bookingCreates.length,
        billEdits: buckets.billEdits.length,
        clientDeletes: buckets.clientDeletes.length,
        paymentChanges: buckets.paymentChanges.length,
        discountApprovals: buckets.discountApprovals.length,
        logins: buckets.loginHistory.length,
        failedRequests: activities.filter((item) => Number(item.statusCode || 0) >= 400).length
      },
      buckets,
      auditLogs,
      sessions,
      activities
    };
  }

  audit({ action, targetType = "", targetId = "", details = {}, severity = "info" } = {}, access, req = null) {
    if (!action) throw badRequest("action is required");
    return repositories.securityAuditLogs.create({
      id: makeId("audit"),
      branchId: access?.branchId || "",
      actorUserId: access?.userId || "",
      actorRole: access?.role || "",
      action,
      targetType,
      targetId,
      severity,
      ipAddress: req?.ip || "",
      userAgent: req?.get?.("user-agent") || "",
      details,
      createdAt: now()
    }, scope(access));
  }

  recordActivity(req, statusCode, durationMs) {
    try {
      const access = req.access || {};
      if (!access.tenantId || req.originalUrl?.includes("/api/health") || req.originalUrl?.includes("/api/versions")) return;
      repositories.securityActivityEvents.create({
        id: makeId("act"),
        branchId: access.branchId || "",
        userId: access.userId || "",
        role: access.role || "",
        method: req.method,
        path: req.originalUrl || req.url,
        statusCode,
        durationMs,
        ipAddress: req.ip || "",
        userAgent: req.get?.("user-agent") || "",
        metadata: {
          requestId: req.requestId,
          contentLength: Number(req.get?.("content-length") || 0)
        },
        createdAt: now()
      }, scope(access));
    } catch {
      // Activity tracking must never block a business request.
    }
  }

  createSession(payload = {}, access, req = null) {
    if (!payload.userId && !access.userId) throw badRequest("userId is required");
    const session = repositories.securitySessions.create({
      id: makeId("sess"),
      userId: payload.userId || access.userId,
      role: payload.role || access.role,
      branchId: payload.branchId || access.branchId || "",
      deviceId: payload.deviceId || access.deviceId || "",
      ipAddress: payload.ipAddress || req?.ip || "",
      userAgent: payload.userAgent || req?.get?.("user-agent") || "",
      startedAt: now(),
      lastSeenAt: now(),
      expiresAt: payload.expiresAt || new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString(),
      metadata: payload.metadata || {},
      status: "active"
    }, scope(access));
    this.audit({ action: "session.created", targetType: "security_session", targetId: session.id }, access, req);
    return session;
  }

  revokeSession(id, access, req = null) {
    const session = repositories.securitySessions.getById(id, scope(access));
    if (!session) throw notFound("Session not found");
    const updated = repositories.securitySessions.update(id, {
      status: "revoked",
      revokedAt: now()
    }, scope(access));
    this.audit({ action: "session.revoked", targetType: "security_session", targetId: id, severity: "warning" }, access, req);
    return updated;
  }

  upsertPermission(payload = {}, access, req = null) {
    if (!payload.role || !payload.resource) throw badRequest("role and resource are required");
    const existing = db.prepare("SELECT id FROM security_permissions WHERE tenantId = ? AND role = ? AND resource = ?").get(access.tenantId, payload.role, payload.resource);
    const data = {
      role: payload.role,
      resource: payload.resource,
      actions: payload.actions || ["read"],
      effect: payload.effect || "allow",
      conditions: payload.conditions || {},
      status: payload.status || "active"
    };
    const permission = existing
      ? repositories.securityPermissions.update(existing.id, data, scope(access))
      : repositories.securityPermissions.create({ id: makeId("perm"), ...data }, scope(access));
    this.audit({ action: "permission.upserted", targetType: "security_permission", targetId: permission.id, details: data }, access, req);
    return permission;
  }

  encryptSecret(payload = {}, access, req = null) {
    if (!payload.name || !payload.value) throw badRequest("name and value are required");
    const iv = randomBytes(12);
    const cipher = createCipheriv("aes-256-gcm", key(), iv);
    const ciphertext = Buffer.concat([cipher.update(String(payload.value), "utf8"), cipher.final()]);
    const secret = repositories.encryptedSecrets.create({
      id: makeId("secret"),
      branchId: payload.branchId || "",
      name: payload.name,
      purpose: payload.purpose || "",
      algorithm: "aes-256-gcm",
      iv: iv.toString("base64"),
      authTag: cipher.getAuthTag().toString("base64"),
      ciphertext: ciphertext.toString("base64"),
      metadata: payload.metadata || {},
      status: "active"
    }, scope(access, payload.branchId || ""));
    this.audit({ action: "secret.encrypted", targetType: "encrypted_secret", targetId: secret.id }, access, req);
    return { id: secret.id, name: secret.name, purpose: secret.purpose, status: secret.status, createdAt: secret.createdAt };
  }

  createBackup(payload = {}, access, req = null) {
    mkdirSync(backupDir, { recursive: true });
    const source = join(dataDir, "salon-crm.sqlite");
    const stamp = new Date().toISOString().replace(/[:.]/g, "-");
    const tenantSlug = String(access.tenantId || "tenant").replace(/[^a-z0-9_-]/gi, "-");
    const filePath = join(backupDir, `${tenantSlug}-${stamp}.sqlite`);
    copyFileSync(source, filePath);
    const bytes = readFileSync(filePath);
    const stat = statSync(filePath);
    const checksum = createHash("sha256").update(bytes).digest("hex");
    const backup = repositories.securityBackups.create({
      id: makeId("backup"),
      branchId: payload.branchId || "",
      type: payload.type || "sqlite-snapshot",
      filePath,
      fileSizeBytes: stat.size,
      checksum,
      manifest: {
        tables: db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' ORDER BY name").all().map((row) => row.name),
        requestedBy: access.userId || "",
        reason: payload.reason || "manual"
      },
      result: { copied: true, checksum },
      status: "completed",
      createdBy: access.userId || ""
    }, scope(access, payload.branchId || ""));
    this.audit({ action: "backup.created", targetType: "security_backup", targetId: backup.id, details: { checksum } }, access, req);
    return backup;
  }

  activityByUser(userId, access) {
    if (!userId) throw badRequest("userId is required");
    return repositories.securityActivityEvents.list({ limit: 250 }, scope(access)).filter((item) => item.userId === userId);
  }
}

export const securityService = new SecurityService();
