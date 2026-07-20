import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { siemService } from "../services/siem.service.js";

/** SIEM NDJSON export (ADD-ONLY). Gated to read:security. */
export const siemRouter = Router();

siemRouter.get(
  "/siem/export",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    siemService.writeNdjson(res, req.access.tenantId, {
      since: req.query.since || "",
      limit: Math.min(Number(req.query.limit || 5000), 50000)
    });
  })
);
