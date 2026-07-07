import { Router } from "express";
import rateLimit from "express-rate-limit";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { requireStepUp } from "../middleware/step-up.js";
import { persistentFixedWindowRateLimit } from "../middleware/persistent-rate-limit.middleware.js";
import { gdprService } from "../services/gdpr.service.js";
import { securityService } from "../services/security.service.js";

/**
 * GDPR / data-subject rights routes (ADD-ONLY feature).
 * Mounted under the JWT-protected /api/v1 group.
 *
 * Authorization:
 *   - export & retention : read:security  (privileged staff / DPO)
 *   - erase              : write:security (owner/admin/superAdmin)
 * Every action is written to the security audit trail.
 */
export const gdprRouter = Router();
gdprRouter.use("/gdpr", rateLimit({ windowMs: 5 * 60 * 1000, max: 30, standardHeaders: true, legacyHeaders: false }));
gdprRouter.use("/gdpr", persistentFixedWindowRateLimit({
  scope: "gdpr",
  max: 30,
  windowMs: 5 * 60 * 1000,
  keyFn: (req) => [req.access?.tenantId || "public", req.access?.userId || req.ip || "anonymous", req.path].join(":")
}));

gdprRouter.get(
  "/gdpr/clients/:id/export",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    const data = gdprService.exportClientData(req.params.id, req.access);
    securityService.audit(
      {
        action: "gdpr.export",
        targetType: "client",
        targetId: req.params.id,
        severity: "warning",
        details: { tables: data.summary.tables, totalRows: data.summary.totalRows }
      },
      req.access,
      req
    );
    res.json(data);
  })
);

gdprRouter.post(
  "/gdpr/clients/:id/erase",
  requirePermission("write", () => "security"),
  requireStepUp(),
  asyncHandler((req, res) => {
    const result = gdprService.eraseClientData(req.params.id, req.access, { reason: req.body?.reason });
    securityService.audit(
      {
        action: "gdpr.erase",
        targetType: "client",
        targetId: req.params.id,
        severity: "critical",
        details: { reason: result.reason, tablesScrubbed: result.relatedTablesScrubbed?.length || 0 }
      },
      req.access,
      req
    );
    res.json(result);
  })
);

gdprRouter.get(
  "/gdpr/retention/candidates",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    const inactiveDays = Number(req.query.inactiveDays || 1825);
    res.json(gdprService.retentionCandidates(req.access, { inactiveDays }));
  })
);
