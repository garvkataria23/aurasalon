import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { pendingPackagesReportService } from "../services/pending-packages-report.service.js";

export const pendingPackagesReportRouter = Router();

pendingPackagesReportRouter.get(
  "/reports/pending-packages",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(pendingPackagesReportService.report(req.query, req.access));
  })
);

pendingPackagesReportRouter.get(
  "/reports/expired-packages",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(pendingPackagesReportService.expired(req.query, req.access));
  })
);
