import { Router } from "express";
import rateLimit from "express-rate-limit";
import { authService } from "../services/auth.service.js";
import { mfaService } from "../services/mfa.service.js";
import { authenticateJwt } from "./auth.js";
import { asyncHandler } from "./async-handler.js";
import { validateBody } from "../validators/request-validator.js";
import { forbidden, unauthorized } from "../utils/app-error.js";
import { persistentFixedWindowRateLimit } from "./persistent-rate-limit.middleware.js";

/**
 * Step-up authentication (ADD-ONLY).
 *
 * Sensitive actions (refund, payroll, data erasure) require a fresh re-auth.
 * Flow: client POSTs an MFA code to /auth/step-up and receives a short-lived
 * step-up token, then sends it as `x-step-up-token` on the sensitive request.
 * requireStepUp() validates it for the current user.
 */

const STEP_UP_TTL = 300;

export const stepUpRouter = Router();
const stepUpEdgeRateLimit = rateLimit({ windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false });
const stepUpPersistentRateLimit = persistentFixedWindowRateLimit({
  scope: "step-up",
  max: 20,
  windowMs: 5 * 60 * 1000,
  keyFn: (req) => [req.access?.tenantId || "public", req.access?.userId || req.ip || "anonymous", req.path].join(":")
});

stepUpRouter.post(
  "/auth/step-up",
  stepUpEdgeRateLimit,
  stepUpPersistentRateLimit,
  authenticateJwt(),
  validateBody({ required: ["code"] }),
  asyncHandler((req, res) => {
    const ok = mfaService.verifyForUser({ tenantId: req.access.tenantId, userId: req.access.userId }, req.body.code);
    if (!ok) throw unauthorized("Invalid authenticator code");
    const token = authService.signJwt(
      { typ: "step_up", sub: req.access.userId, tenantId: req.access.tenantId },
      STEP_UP_TTL
    );
    res.json({ stepUpToken: token, expiresIn: STEP_UP_TTL });
  })
);

export function requireStepUp() {
  return (req, _res, next) => {
    const token = req.get("x-step-up-token") || req.body?.stepUpToken || "";
    if (!token) {
      next(forbidden("Step-up authentication required for this action", { code: "step_up_required" }));
      return;
    }
    try {
      const payload = authService.verifyJwt(token);
      if (payload.typ !== "step_up" || payload.sub !== req.access?.userId || payload.tenantId !== req.access?.tenantId) {
        throw new Error("mismatch");
      }
      next();
    } catch {
      next(forbidden("Step-up token is invalid or expired", { code: "step_up_required" }));
    }
  };
}
