import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { authService } from "../services/auth.service.js";
import { intrusionDetectionService } from "../services/intrusion-detection.service.js";
import { securityService } from "../services/security.service.js";
import { validateBody } from "../validators/request-validator.js";

export const authRouter = Router();

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
    res.status(201).json(result);
  })
);

authRouter.post(
  "/auth/refresh",
  validateBody({ required: ["refreshToken"] }),
  asyncHandler((req, res) => {
    res.json(authService.refresh(req.body.refreshToken));
  })
);

authRouter.post(
  "/auth/logout",
  authenticateJwt(),
  asyncHandler((req, res) => {
    res.json(authService.logout(req.body.refreshToken || "", req.access));
  })
);

authRouter.get(
  "/auth/me",
  authenticateJwt(),
  asyncHandler((req, res) => {
    res.json({ user: req.user, access: req.access, tenant: req.tenant });
  })
);
