import { createHash, randomBytes, randomUUID } from "node:crypto";
import { db } from "../db.js";
import { env } from "../config/env.js";
import { can } from "../middleware/rbac.js";
import { repositories } from "../repositories/repository-registry.js";
import { authService } from "./auth.service.js";
import { ownerAppointmentService } from "./owner-appointment.service.js";
import { ensureOwnerPosHandoffSchema } from "./owner-pos-handoff-schema.service.js";
import { AppError, forbidden, unauthorized } from "../utils/app-error.js";

const COOKIE_NAME = "aura_owner_pos_handoff";
const TTL_SECONDS = 120;
const COOKIE_PATH = "/api/v1/auth/owner-pos-handoff";

function hash(secret) {
  return createHash("sha256").update(secret).digest("hex");
}

function parseCookies(req) {
  return Object.fromEntries(String(req.get("cookie") || "").split(";").map((part) => part.trim()).filter(Boolean).map((part) => {
    const index = part.indexOf("=");
    return [decodeURIComponent(index < 0 ? part : part.slice(0, index)), decodeURIComponent(index < 0 ? "" : part.slice(index + 1))];
  }));
}

function origin(req) {
  return String(req.get("origin") || "").trim();
}

function trustedCallerOrigin(value) {
  if (!value) return false;
  if (env.allowedOrigins.includes(value)) return true;
  return env.nodeEnv !== "production" && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(value);
}

function cookieOptions(maxAge = TTL_SECONDS * 1000) {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: "lax",
    path: COOKIE_PATH,
    maxAge
  };
}

function targetOriginFor(req) {
  const configured = [process.env.CRM_APP_ORIGIN, process.env.APP_PUBLIC_URL, process.env.CLIENT_URL]
    .map((value) => String(value || "").trim())
    .find(Boolean);
  let candidate = configured;
  if (!candidate && env.nodeEnv !== "production") {
    const caller = origin(req);
    const hostname = /^http:\/\/localhost:\d+$/.test(caller) ? "localhost" : "127.0.0.1";
    candidate = `http://${hostname}:4300`;
  }
  if (!candidate) throw new AppError("CRM POS handoff origin is not configured", 503);
  try {
    const parsed = new URL(candidate);
    const targetOrigin = parsed.origin;
    const localDevelopment = env.nodeEnv !== "production" && /^http:\/\/(127\.0\.0\.1|localhost):\d+$/.test(targetOrigin);
    const trustedProductionOrigin = parsed.protocol === "https:" && env.allowedOrigins.includes(targetOrigin);
    if (parsed.username || parsed.password || (!localDevelopment && !trustedProductionOrigin)) {
      throw new Error("Untrusted CRM origin");
    }
    return targetOrigin;
  } catch {
    throw new AppError("CRM POS handoff origin is invalid or not trusted", 503);
  }
}

function revokeAndClear(row, res) {
  const now = new Date().toISOString();
  db.prepare(`
    UPDATE ownerPosHandoffs
    SET revokedAt = CASE WHEN revokedAt = '' THEN @now ELSE revokedAt END, updatedAt = @now
    WHERE id = @id
  `).run({ id: row.id, now });
  res.clearCookie(COOKIE_NAME, cookieOptions(0));
}

function rejectHandoff(row, res, message, status = 403) {
  revokeAndClear(row, res);
  if (status === 401) throw unauthorized(message);
  throw forbidden(message);
}

function publicContext(row) {
  const context = JSON.parse(row.contextJson || "{}");
  return {
    appointmentId: row.appointmentId,
    clientId: row.clientId,
    branchId: row.branchId,
    serviceIds: JSON.parse(row.serviceIdsJson || "[]"),
    staffId: context.staffId || ""
  };
}

export const ownerPosHandoffService = {
  create(appointmentId, access, req, res) {
    ensureOwnerPosHandoffSchema();
    const { appointment } = ownerAppointmentService.assertSupportedAction(appointmentId, access, "openPos");
    const requestOrigin = origin(req);
    if (!trustedCallerOrigin(requestOrigin)) throw forbidden("POS handoff origin is not allowed");
    const targetOrigin = targetOriginFor(req);
    const secret = randomBytes(32).toString("base64url");
    const now = new Date().toISOString();
    const expiresAt = new Date(Date.now() + TTL_SECONDS * 1000).toISOString();
    const serviceIds = Array.isArray(appointment.serviceIds) ? appointment.serviceIds : JSON.parse(appointment.serviceIds || "[]");
    db.prepare(`
      UPDATE ownerPosHandoffs
      SET revokedAt = @now, updatedAt = @now
      WHERE tenantId = @tenantId AND ownerUserId = @ownerUserId AND appointmentId = @appointmentId
        AND consumedAt = '' AND revokedAt = ''
    `).run({ tenantId: access.tenantId, ownerUserId: access.userId, appointmentId: appointment.id, now });
    db.prepare(`
      INSERT INTO ownerPosHandoffs (
        id, tenantId, branchId, secretHash, ownerUserId, appointmentId, clientId,
        serviceIdsJson, contextJson, targetOrigin, createdOrigin, consumedOrigin, expiresAt,
        consumedAt, consumedByUserId, revokedAt, createdAt, updatedAt
      ) VALUES (
        @id, @tenantId, @branchId, @secretHash, @ownerUserId, @appointmentId, @clientId,
        @serviceIdsJson, @contextJson, @targetOrigin, @createdOrigin, '', @expiresAt, '', '', '', @createdAt, @updatedAt
      )
    `).run({
      id: `oposh_${randomUUID()}`,
      tenantId: access.tenantId,
      branchId: appointment.branchId,
      secretHash: hash(secret),
      ownerUserId: access.userId,
      appointmentId: appointment.id,
      clientId: appointment.clientId || "",
      serviceIdsJson: JSON.stringify(serviceIds),
      contextJson: JSON.stringify({ staffId: appointment.staffId || "" }),
      targetOrigin,
      createdOrigin: requestOrigin,
      expiresAt,
      createdAt: now,
      updatedAt: now
    });
    res.cookie(COOKIE_NAME, secret, cookieOptions());
    return { targetUrl: `${targetOrigin}/pos`, expiresAt };
  },

  consume(req, res) {
    ensureOwnerPosHandoffSchema();
    const requestOrigin = origin(req);
    const secret = parseCookies(req)[COOKIE_NAME] || "";
    if (!secret) {
      res.clearCookie(COOKIE_NAME, cookieOptions(0));
      throw unauthorized("POS handoff is missing or expired");
    }
    const now = new Date().toISOString();
    const row = db.prepare(`
      SELECT * FROM ownerPosHandoffs
      WHERE secretHash = @secretHash
    `).get({ secretHash: hash(secret) });
    if (!row) {
      res.clearCookie(COOKIE_NAME, cookieOptions(0));
      throw unauthorized("POS handoff is invalid, expired, or already consumed");
    }
    if (row.consumedAt || row.revokedAt || row.expiresAt <= now) {
      rejectHandoff(row, res, "POS handoff is invalid, expired, or already consumed", 401);
    }
    if (!row.targetOrigin || requestOrigin !== row.targetOrigin) {
      rejectHandoff(row, res, "POS handoff origin is not authorized");
    }
    const tenant = repositories.tenants.getById(row.tenantId);
    const user = repositories.tenantUsers.getById(row.ownerUserId, { tenantId: row.tenantId });
    const branchIds = Array.isArray(user?.branchIds) ? [...new Set(user.branchIds.map((id) => String(id || "").trim()).filter(Boolean))] : [];
    if (!tenant || !["active", "trialing"].includes(String(tenant.subscriptionStatus || "").toLowerCase())) rejectHandoff(row, res, "POS handoff tenant is no longer active");
    if (!user || user.status !== "active" || String(user.role).toLowerCase() !== "owner") rejectHandoff(row, res, "POS handoff owner account is no longer active");
    if (!branchIds.includes(row.branchId)) rejectHandoff(row, res, "POS handoff branch access is no longer valid");
    const branch = db.prepare(`
      SELECT id FROM branches
      WHERE tenantId = @tenantId AND id = @branchId
    `).get({ tenantId: row.tenantId, branchId: row.branchId });
    if (!branch) rejectHandoff(row, res, "POS handoff branch is no longer available");
    const permissions = authService.permissionsForUser(user, tenant.id);
    const currentAccess = {
      tenantId: tenant.id,
      role: user.role,
      userId: user.id,
      staffId: user.staffId || "",
      branchId: row.branchId,
      branchIds,
      permissions,
      permissionVersion: Number(user.permissionVersion || 1)
    };
    if (!can(currentAccess.role, "use", "pos", currentAccess) || !can(currentAccess.role, "read", "invoices", currentAccess)) {
      rejectHandoff(row, res, "POS handoff permission is no longer available");
    }
    let appointment;
    try {
      appointment = ownerAppointmentService.assertSupportedAction(row.appointmentId, currentAccess, "openPos").appointment;
    } catch {
      rejectHandoff(row, res, "POS handoff appointment is no longer accessible");
    }
    if (!appointment || appointment.branchId !== row.branchId) rejectHandoff(row, res, "POS handoff appointment branch changed");
    const result = db.prepare(`
      UPDATE ownerPosHandoffs
      SET consumedAt = @now, consumedByUserId = @userId, consumedOrigin = @origin, updatedAt = @now
      WHERE id = @id AND consumedAt = '' AND revokedAt = '' AND expiresAt > @now
    `).run({ id: row.id, now, userId: user.id, origin: requestOrigin });
    if (result.changes !== 1) rejectHandoff(row, res, "POS handoff was already consumed", 401);
    res.clearCookie(COOKIE_NAME, cookieOptions(0));
    return {
      session: authService.issueTokenPair({ tenant, user: { ...user, branchIds, permissions }, branchId: row.branchId, deviceId: "owner-pos-handoff" }),
      posContext: publicContext(row)
    };
  }
};
