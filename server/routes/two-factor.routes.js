import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { repositories } from "../repositories/repository-registry.js";
import { securityService } from "../services/security.service.js";
import { twoFactorService } from "../services/two-factor.service.js";
import { badRequest, forbidden } from "../utils/app-error.js";

const ALLOWED_ROLES = new Set(["owner", "admin", "superAdmin"]);
const now = () => new Date().toISOString();

function requireTwoFactorRole(access = {}) {
  if (!ALLOWED_ROLES.has(access.role)) throw forbidden("Two-factor authentication is available for owner/admin accounts only");
}

function parseRecoveryCodes(value) {
  try {
    const parsed = JSON.parse(value || "[]");
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function getCurrentUser(req) {
  const user = repositories.tenantUsers.getById(req.user.id, { tenantId: req.access.tenantId });
  if (!user) throw forbidden("User not found");
  return user;
}

export const twoFactorRouter = Router();

twoFactorRouter.post(
  "/auth/2fa/setup",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireTwoFactorRole(req.access);
    const user = getCurrentUser(req);
    const secret = twoFactorService.generateSecret();

    repositories.tenantUsers.update(user.id, { totpPendingSecret: secret }, { tenantId: req.access.tenantId });

    res.json({
      secret,
      provisioningUri: twoFactorService.generateProvisioningUri({
        secret,
        accountName: user.email || user.loginId || user.id,
        issuer: "Aura Salon"
      })
    });
  })
);

twoFactorRouter.post(
  "/auth/2fa/enable",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireTwoFactorRole(req.access);
    const user = getCurrentUser(req);
    const token = String(req.body?.token || req.body?.totpToken || "").trim();
    if (!user.totpPendingSecret) throw badRequest("Run 2FA setup first");
    if (!twoFactorService.verifyToken({ secret: user.totpPendingSecret, token })) throw badRequest("Invalid authenticator code");

    const recoveryCodes = twoFactorService.generateRecoveryCodes();
    repositories.tenantUsers.update(user.id, {
      totpSecret: user.totpPendingSecret,
      totpEnabled: 1,
      totpPendingSecret: "",
      totpRecoveryCodes: JSON.stringify(recoveryCodes),
      totpVerifiedAt: now()
    }, { tenantId: req.access.tenantId });

    securityService.audit({
      action: "auth.2fa.enabled",
      targetType: "tenant_user",
      targetId: user.id,
      details: { email: user.email || "", loginId: user.loginId || "" },
      severity: "info"
    }, req.access, req);

    res.json({ enabled: true, recoveryCodes });
  })
);

twoFactorRouter.post(
  "/auth/2fa/disable",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireTwoFactorRole(req.access);
    const user = getCurrentUser(req);
    if (!user.totpEnabled) {
      res.json({ enabled: false });
      return;
    }

    const token = String(req.body?.token || req.body?.totpToken || "").trim();
    const normalizedRecovery = token.toUpperCase();
    const recoveryCodes = parseRecoveryCodes(user.totpRecoveryCodes);
    const isRecovery = recoveryCodes.includes(normalizedRecovery);
    const isValidTotp = twoFactorService.verifyToken({ secret: user.totpSecret, token });
    if (!isValidTotp && !isRecovery) throw badRequest("Invalid authenticator code or recovery code");

    repositories.tenantUsers.update(user.id, {
      totpSecret: "",
      totpEnabled: 0,
      totpPendingSecret: "",
      totpRecoveryCodes: "[]",
      totpVerifiedAt: ""
    }, { tenantId: req.access.tenantId });

    securityService.audit({
      action: "auth.2fa.disabled",
      targetType: "tenant_user",
      targetId: user.id,
      details: { email: user.email || "", loginId: user.loginId || "" },
      severity: "warning"
    }, req.access, req);

    res.json({ enabled: false });
  })
);

twoFactorRouter.get(
  "/auth/2fa/status",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireTwoFactorRole(req.access);
    const user = getCurrentUser(req);
    res.json({
      enabled: Boolean(user.totpEnabled),
      verifiedAt: user.totpVerifiedAt || "",
      pendingSetup: Boolean(user.totpPendingSecret)
    });
  })
);
