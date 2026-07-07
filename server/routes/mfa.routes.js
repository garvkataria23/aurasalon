import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { authService } from "../services/auth.service.js";
import { mfaService } from "../services/mfa.service.js";
import { securityService } from "../services/security.service.js";
import { repositories } from "../repositories/repository-registry.js";
import { validateBody } from "../validators/request-validator.js";
import { unauthorized } from "../utils/app-error.js";
import { persistentFixedWindowRateLimit } from "../middleware/persistent-rate-limit.middleware.js";

/**
 * MFA + strong session management (ADD-ONLY feature).
 *
 * Two routers are exported:
 *   - mfaPublicRouter  : unauthenticated 2-step login (password -> TOTP)
 *   - mfaRouter        : JWT-protected MFA enrolment + session controls
 *
 * Nothing here modifies the existing /auth/login flow. Tenants that want MFA
 * call /auth/secure-login instead; the original endpoint keeps working.
 */

const CHALLENGE_TTL_SECONDS = 300; // 5 minutes to enter the code

function issueChallengeToken({ tenantId, userId, branchId, deviceId }) {
  return authService.signJwt(
    { typ: "mfa_challenge", sub: userId, tenantId, branchId, deviceId },
    CHALLENGE_TTL_SECONDS
  );
}

function verifyChallengeToken(token) {
  const payload = authService.verifyJwt(token);
  if (payload.typ !== "mfa_challenge") throw unauthorized("Challenge token is invalid");
  return payload;
}

export const mfaPublicRouter = Router();
const mfaPublicEdgeRateLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const mfaPublicRateLimit = persistentFixedWindowRateLimit({
  scope: "mfa-public",
  max: 20,
  windowMs: 5 * 60 * 1000,
  keyFn: (req) => [req.ip || "anonymous", req.path].join(":")
});
mfaPublicRouter.use("/auth/secure-login", mfaPublicEdgeRateLimit);
mfaPublicRouter.use("/auth/secure-login", mfaPublicRateLimit);

/**
 * Step 1 — verify the password. If the account has MFA enabled we DO NOT
 * return a usable session; instead the freshly minted refresh token is
 * revoked immediately and the access token is discarded server-side. The
 * client only receives a short-lived challenge token.
 */
mfaPublicRouter.post(
  "/auth/secure-login",
  validateBody({ required: ["tenantId"] }),
  asyncHandler((req, res) => {
    const result = authService.login(req.body, {
      tenantId: req.body.tenantId,
      host: req.get("x-forwarded-host") || req.get("host") || ""
    });

    const mfaEnabled = mfaService.isEnabledForUser({ tenantId: result.tenant.id, userId: result.user.id });
    if (!mfaEnabled) {
      securityService.audit(
        { action: "auth.login", targetType: "tenant_user", targetId: result.user.id, details: { mfa: false } },
        { tenantId: result.tenant.id, userId: result.user.id, role: result.user.role, branchId: result.user.branchId },
        req
      );
      return res.status(201).json(result);
    }

    // Burn the session that login() just created — MFA is not satisfied yet.
    authService.logout(result.refreshToken, { tenantId: result.tenant.id });
    const challengeToken = issueChallengeToken({
      tenantId: result.tenant.id,
      userId: result.user.id,
      branchId: result.user.branchId,
      deviceId: req.body.deviceId || req.body.device?.id || ""
    });
    securityService.audit(
      { action: "auth.mfa_challenge", targetType: "tenant_user", targetId: result.user.id, severity: "info" },
      { tenantId: result.tenant.id, userId: result.user.id, role: result.user.role, branchId: result.user.branchId },
      req
    );
    return res.status(200).json({
      mfaRequired: true,
      methods: ["totp", "recovery_code"],
      challengeToken,
      expiresIn: CHALLENGE_TTL_SECONDS
    });
  })
);

/** Step 2 — verify the TOTP (or recovery) code and mint the real session. */
mfaPublicRouter.post(
  "/auth/secure-login/verify",
  validateBody({ required: ["challengeToken", "code"] }),
  asyncHandler((req, res) => {
    const challenge = verifyChallengeToken(req.body.challengeToken);
    const tenant = repositories.tenants.getById(challenge.tenantId);
    const user = repositories.tenantUsers.getById(challenge.sub, { tenantId: challenge.tenantId });
    if (!tenant || !user) throw unauthorized("Account no longer exists");

    const ok = mfaService.verifyForUser({ tenantId: challenge.tenantId, userId: challenge.sub }, req.body.code);
    const access = { tenantId: tenant.id, userId: user.id, role: user.role, branchId: challenge.branchId || "" };
    if (!ok) {
      securityService.audit(
        { action: "auth.mfa_failed", targetType: "tenant_user", targetId: user.id, severity: "warning" },
        access,
        req
      );
      throw unauthorized("Invalid authenticator code");
    }

    const tokens = authService.issueTokenPair({
      tenant,
      user,
      branchId: challenge.branchId || user.branchIds?.[0] || "",
      deviceId: challenge.deviceId || ""
    });
    securityService.createSession(
      { userId: user.id, role: user.role, branchId: challenge.branchId || "", deviceId: challenge.deviceId || "", metadata: { mfa: true } },
      access,
      req
    );
    securityService.audit(
      { action: "auth.mfa_success", targetType: "tenant_user", targetId: user.id, details: { mfa: true } },
      access,
      req
    );
    return res.status(201).json(tokens);
  })
);

export const mfaRouter = Router();
const mfaProtectedEdgeRateLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 60, standardHeaders: true, legacyHeaders: false });
const mfaProtectedRateLimit = persistentFixedWindowRateLimit({
  scope: "mfa-protected",
  max: 60,
  windowMs: 5 * 60 * 1000,
  keyFn: (req) => [req.access?.tenantId || "public", req.access?.userId || req.ip || "anonymous", req.path].join(":")
});
mfaRouter.use(mfaProtectedEdgeRateLimit);
mfaRouter.use(mfaProtectedRateLimit);

mfaRouter.get(
  "/auth/mfa/status",
  authenticateJwt(),
  asyncHandler((req, res) => {
    res.json(mfaService.status(req.access));
  })
);

mfaRouter.post(
  "/auth/mfa/setup",
  authenticateJwt(),
  asyncHandler((req, res) => {
    const enrolment = mfaService.setup(req.access, { accountLabel: req.user?.email || req.user?.loginId || "" });
    securityService.audit(
      { action: "auth.mfa_setup_started", targetType: "tenant_user", targetId: req.access.userId },
      req.access,
      req
    );
    res.status(201).json(enrolment);
  })
);

mfaRouter.post(
  "/auth/mfa/enable",
  authenticateJwt(),
  validateBody({ required: ["code"] }),
  asyncHandler((req, res) => {
    const result = mfaService.enable(req.access, req.body.code);
    securityService.audit(
      { action: "auth.mfa_enabled", targetType: "tenant_user", targetId: req.access.userId, severity: "warning" },
      req.access,
      req
    );
    res.json(result);
  })
);

mfaRouter.post(
  "/auth/mfa/disable",
  authenticateJwt(),
  validateBody({ required: ["code"] }),
  asyncHandler((req, res) => {
    const result = mfaService.disable(req.access, req.body.code);
    securityService.audit(
      { action: "auth.mfa_disabled", targetType: "tenant_user", targetId: req.access.userId, severity: "warning" },
      req.access,
      req
    );
    res.json(result);
  })
);

// ---- strong session management --------------------------------------------
mfaRouter.get(
  "/auth/sessions",
  authenticateJwt(),
  asyncHandler((req, res) => {
    const sessions = repositories.securitySessions
      .list({ limit: 500 }, { tenantId: req.access.tenantId })
      .filter((s) => s.userId === req.access.userId)
      .map((s) => ({
        id: s.id,
        deviceId: s.deviceId,
        ipAddress: s.ipAddress,
        userAgent: s.userAgent,
        startedAt: s.startedAt,
        lastSeenAt: s.lastSeenAt,
        expiresAt: s.expiresAt,
        status: s.status,
        current: Boolean(req.access.deviceId) && s.deviceId === req.access.deviceId
      }));
    res.json({ sessions });
  })
);

mfaRouter.post(
  "/auth/sessions/:id/revoke",
  authenticateJwt(),
  asyncHandler((req, res) => {
    res.json(securityService.revokeSession(req.params.id, req.access, req));
  })
);

mfaRouter.post(
  "/auth/sessions/revoke-others",
  authenticateJwt(),
  asyncHandler((req, res) => {
    const sessions = repositories.securitySessions
      .list({ limit: 500 }, { tenantId: req.access.tenantId })
      .filter((s) => s.userId === req.access.userId && s.status === "active");
    let revoked = 0;
    for (const session of sessions) {
      if (req.access.deviceId && session.deviceId === req.access.deviceId) continue;
      securityService.revokeSession(session.id, req.access, req);
      revoked += 1;
    }
    res.json({ revoked });
  })
);
