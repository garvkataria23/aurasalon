import { Router } from "express";
import { env } from "../config/env.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { authService } from "../services/auth.service.js";
import { issueCsrfToken } from "../services/csrf-token.service.js";
import { intrusionDetectionService } from "../services/intrusion-detection.service.js";
import { securityService } from "../services/security.service.js";
import { validateBody } from "../validators/request-validator.js";

export const authRouter = Router();

function parseCookies(req) {
  return Object.fromEntries(
    String(req.get("cookie") || "")
      .split(";")
      .map((part) => part.trim())
      .filter(Boolean)
      .map((part) => {
        const equalsAt = part.indexOf("=");
        const key = equalsAt >= 0 ? part.slice(0, equalsAt) : part;
        const value = equalsAt >= 0 ? part.slice(equalsAt + 1) : "";
        return [decodeURIComponent(key), decodeURIComponent(value)];
      })
  );
}

function cookieOptions(maxAgeSeconds) {
  return {
    httpOnly: true,
    secure: env.nodeEnv === "production",
    sameSite: env.refreshCookieSameSite,
    path: "/",
    maxAge: maxAgeSeconds * 1000
  };
}

function publicSession(result) {
  if (env.allowRefreshTokenInResponse) return result;
  const { refreshToken: _refreshToken, ...safeResult } = result;
  return safeResult;
}

function setRefreshCookie(res, result) {
  if (!result?.refreshToken) return;
  res.cookie(env.refreshCookieName, result.refreshToken, cookieOptions(env.jwtRefreshTtlDays * 24 * 60 * 60));
}

function clearRefreshCookie(res) {
  res.clearCookie(env.refreshCookieName, cookieOptions(0));
}

function refreshTokenFromRequest(req) {
  const cookieToken = parseCookies(req)[env.refreshCookieName] || "";
  if (cookieToken) return cookieToken;
  return env.allowLegacyRefreshTokenBody ? String(req.body?.refreshToken || "") : "";
}

function demoStaffLogin(req) {
  return authService.login({
    tenantId: "tenant_aura",
    loginId: "isha.staff",
    password: process.env.DEMO_STAFF_PASSWORD || "",
    device: { type: "staff-app", name: "Aura Staff App", platform: "web" }
  }, {
    tenantId: "tenant_aura",
    host: req.get("x-forwarded-host") || req.get("host") || "",
    ip: req.ip || "",
    userAgent: req.get("user-agent") || ""
  });
}

authRouter.get(
  "/auth/csrf",
  asyncHandler((_req, res) => {
    res.json(issueCsrfToken(res));
  })
);

authRouter.post(
  "/auth/login",
  validateBody({ required: ["tenantId"] }),
  asyncHandler((req, res) => {
    const result = authService.login(req.body, {
      tenantId: req.body.tenantId,
      host: req.get("x-forwarded-host") || req.get("host") || "",
      ip: req.ip || "",
      userAgent: req.get("user-agent") || ""
    });
    intrusionDetectionService.checkAdminLogin({
      tenantId: result.tenant.id,
      userId: result.user.id,
      role: result.user.role,
      ip: req.ip || "",
      userAgent: req.get("user-agent") || "",
      deviceId: req.body.deviceId || req.body.device?.id || ""
    });
    securityService.audit({
      action: "auth.login",
      targetType: "tenant_user",
      targetId: result.user.id,
      details: { email: result.user.email, branchId: result.user.branchId, deviceId: req.body.deviceId || req.body.device?.id || "" }
    }, {
      tenantId: result.tenant.id,
      userId: result.user.id,
      role: result.user.role,
      branchId: result.user.branchId,
      branchIds: result.user.branchIds || []
    }, req);
    setRefreshCookie(res, result);
    res.status(201).json(publicSession(result));
  })
);

authRouter.get(
  "/auth/demo-staff-open",
  asyncHandler((req, res) => {
    const result = demoStaffLogin(req);
    setRefreshCookie(res, result);
    res.redirect(302, "/staff/open");
  })
);

authRouter.get(
  "/auth/demo-staff-session",
  asyncHandler((req, res) => {
    const result = demoStaffLogin(req);
    setRefreshCookie(res, result);
    res.json(publicSession(result));
  })
);

authRouter.post(
  "/auth/refresh",
  asyncHandler((req, res) => {
    const result = authService.refresh(refreshTokenFromRequest(req));
    setRefreshCookie(res, result);
    res.json(publicSession(result));
  })
);

authRouter.post(
  "/auth/logout",
  authenticateJwt(),
  asyncHandler((req, res) => {
    const result = authService.logout(refreshTokenFromRequest(req), req.access);
    clearRefreshCookie(res);
    res.json(result);
  })
);

authRouter.get(
  "/auth/me",
  authenticateJwt(),
  asyncHandler((req, res) => {
    res.json({ user: req.user, access: req.access, tenant: req.tenant });
  })
);
