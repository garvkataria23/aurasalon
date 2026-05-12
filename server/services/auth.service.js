import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, forbidden, unauthorized } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function base64Url(input) {
  return Buffer.from(input).toString("base64url");
}

function decodeBase64Url(input) {
  return Buffer.from(input, "base64url").toString("utf8");
}

function sign(value) {
  return createHmac("sha256", env.jwtSecret).update(value).digest("base64url");
}

function hashToken(token) {
  return createHmac("sha256", env.jwtSecret).update(token).digest("hex");
}

function safeEqual(left, right) {
  const leftBuffer = Buffer.from(left);
  const rightBuffer = Buffer.from(right);
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

function addSeconds(seconds) {
  return new Date(Date.now() + Number(seconds) * 1000).toISOString();
}

function addDays(days) {
  return new Date(Date.now() + Number(days) * 86400000).toISOString();
}

export class AuthService {
  login(payload = {}, request = {}) {
    const tenant = tenantService.resolveTenant({ tenantId: payload.tenantId || request.tenantId || "", host: request.host || "" });
    if (!tenant) throw badRequest("Tenant not found");
    tenantService.ensureSubscriptionActive(tenant.id);
    const users = repositories.tenantUsers.list({ limit: 10000 }, { tenantId: tenant.id });
    const user = users.find((item) =>
      (payload.userId && item.id === payload.userId) ||
      (payload.email && String(item.email).toLowerCase() === String(payload.email).toLowerCase())
    );
    if (!user) throw unauthorized("Invalid mobile login credentials");
    if (user.status && user.status !== "active") throw forbidden("User is not active");
    const branchId = payload.branchId || user.branchIds?.[0] || "";
    if (branchId) tenantService.assertBranchAccess({ tenantId: tenant.id, role: user.role, branchIds: user.branchIds || [], branchId }, branchId);
    const device = payload.device ? this.registerDevice({ ...payload.device, userId: user.id, branchId }, { tenantId: tenant.id, userId: user.id, role: user.role, branchId, branchIds: user.branchIds || [] }) : null;
    return this.issueTokenPair({ tenant, user, branchId, deviceId: device?.id || payload.deviceId || "" });
  }

  refresh(refreshToken) {
    if (!refreshToken) throw unauthorized("Refresh token is required");
    const tokenHash = hashToken(refreshToken);
    const record = repositories.authRefreshTokens.list({ limit: 100000 }, {}).find((item) => item.tokenHash === tokenHash);
    if (!record || record.revokedAt || record.expiresAt <= now()) throw unauthorized("Refresh token is invalid or expired");
    const tenant = repositories.tenants.getById(record.tenantId);
    const user = repositories.tenantUsers.getById(record.userId, { tenantId: record.tenantId });
    if (!tenant || !user) throw unauthorized("Refresh token account no longer exists");
    repositories.authRefreshTokens.update(record.id, { revokedAt: now() }, { tenantId: record.tenantId });
    return this.issueTokenPair({ tenant, user, branchId: record.branchId || user.branchIds?.[0] || "", deviceId: record.deviceId || "" });
  }

  logout(refreshToken, access = {}) {
    if (!refreshToken) return { revoked: false };
    const tokenHash = hashToken(refreshToken);
    const record = repositories.authRefreshTokens.list({ limit: 10000 }, { tenantId: access.tenantId }).find((item) => item.tokenHash === tokenHash);
    if (!record) return { revoked: false };
    repositories.authRefreshTokens.update(record.id, { revokedAt: now() }, { tenantId: record.tenantId });
    return { revoked: true };
  }

  issueTokenPair({ tenant, user, branchId = "", deviceId = "" }) {
    const accessPayload = {
      iss: "aura-salon-api",
      aud: "aura-mobile",
      typ: "access",
      sub: user.id,
      tenantId: tenant.id,
      email: user.email,
      role: user.role,
      branchId,
      branchIds: user.branchIds || [],
      deviceId,
      jti: makeId("jwt")
    };
    const accessToken = this.signJwt(accessPayload, env.jwtAccessTtlSeconds);
    const refreshToken = `${makeId("refresh")}.${randomBytes(32).toString("base64url")}`;
    const refreshRecord = repositories.authRefreshTokens.create({
      id: makeId("rtok"),
      userId: user.id,
      tokenHash: hashToken(refreshToken),
      deviceId,
      role: user.role,
      branchId,
      expiresAt: addDays(env.jwtRefreshTtlDays),
      revokedAt: ""
    }, { tenantId: tenant.id });
    return {
      tokenType: "Bearer",
      accessToken,
      expiresIn: env.jwtAccessTtlSeconds,
      refreshToken,
      refreshExpiresAt: refreshRecord.expiresAt,
      user: {
        id: user.id,
        name: user.name,
        email: user.email,
        role: user.role,
        branchId,
        branchIds: user.branchIds || []
      },
      tenant: {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        subscriptionStatus: tenant.subscriptionStatus
      }
    };
  }

  signJwt(payload, ttlSeconds) {
    const header = { alg: "HS256", typ: "JWT" };
    const body = {
      ...payload,
      iat: Math.floor(Date.now() / 1000),
      exp: Math.floor(Date.now() / 1000) + Number(ttlSeconds)
    };
    const unsigned = `${base64Url(JSON.stringify(header))}.${base64Url(JSON.stringify(body))}`;
    return `${unsigned}.${sign(unsigned)}`;
  }

  verifyAccessToken(token) {
    const payload = this.verifyJwt(token);
    if (payload.typ !== "access") throw unauthorized("Access token type is invalid");
    return payload;
  }

  verifyJwt(token) {
    const parts = String(token || "").split(".");
    if (parts.length !== 3) throw unauthorized("JWT is malformed");
    const unsigned = `${parts[0]}.${parts[1]}`;
    if (!safeEqual(sign(unsigned), parts[2])) throw unauthorized("JWT signature is invalid");
    const payload = JSON.parse(decodeBase64Url(parts[1]));
    if (!payload.exp || payload.exp <= Math.floor(Date.now() / 1000)) throw unauthorized("JWT has expired");
    return payload;
  }

  registerDevice(payload = {}, access) {
    if (!payload.platform) throw badRequest("platform is required");
    const existing = payload.id ? repositories.mobileDevices.getById(payload.id, { tenantId: access.tenantId }) : null;
    const record = {
      userId: payload.userId || access.userId,
      branchId: payload.branchId || access.branchId || "",
      platform: payload.platform,
      deviceToken: payload.deviceToken || "",
      pushProvider: payload.pushProvider || "fcm",
      appVersion: payload.appVersion || "",
      capabilities: payload.capabilities || {},
      status: payload.status || "active",
      lastSeenAt: now()
    };
    if (existing) return repositories.mobileDevices.update(existing.id, record, { tenantId: access.tenantId });
    return repositories.mobileDevices.create({ id: payload.id || makeId("dev"), ...record }, { tenantId: access.tenantId });
  }
}

export const authService = new AuthService();
