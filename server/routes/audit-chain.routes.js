import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../middleware/async-handler.js";
import { persistentFixedWindowRateLimit } from "../middleware/persistent-rate-limit.middleware.js";
import { requirePermission } from "../middleware/rbac.js";
import { auditChainService } from "../services/audit-chain.service.js";

/** Tamper-evident audit chain endpoints (ADD-ONLY). */
export const auditChainRouter = Router();
auditChainRouter.use(rateLimit({ windowMs: 5 * 60 * 1000, max: 20, standardHeaders: true, legacyHeaders: false }));
auditChainRouter.use(persistentFixedWindowRateLimit({
  scope: "audit-chain",
  max: 20,
  windowMs: 5 * 60 * 1000,
  keyFn: (req) => [req.access?.tenantId || "public", req.access?.userId || req.ip || "anonymous", req.path].join(":")
}));

auditChainRouter.post("/audit-chain/seal", requirePermission("write", () => "security"),
  asyncHandler((req, res) => res.json(auditChainService.seal(req.access.tenantId))));

auditChainRouter.get("/audit-chain/verify", requirePermission("read", () => "security"),
  asyncHandler((req, res) => res.json(auditChainService.sealAndVerify(req.access.tenantId))));
