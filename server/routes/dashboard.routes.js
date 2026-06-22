import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { dashboardService } from "../services/dashboard.service.js";
import { chairUtilizationService } from "../services/chair-utilization.service.js";
import { anomalyDetectionService } from "../services/anomaly-detection.service.js";

export const dashboardRouter = Router();

dashboardRouter.get(
  "/dashboard/executive",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    const tenantId = req.access?.tenantId;
    const branchId = req.query.branchId || req.access?.requestedBranchId || "";
    res.json(dashboardService.getExecutiveDashboard({ tenantId, branchId, query: req.query }));
  })
);

dashboardRouter.get(
  "/dashboard/chair-utilization",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(chairUtilizationService.getUtilizationByDate(
      req.access?.tenantId,
      req.query.branchId || req.access?.requestedBranchId || "",
      req.query.date || new Date().toISOString().slice(0, 10)
    ));
  })
);

dashboardRouter.get(
  "/dashboard/chair-utilization/heatmap",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    res.json(chairUtilizationService.getUtilizationHeatmap(
      req.access?.tenantId,
      req.query.branchId || req.access?.requestedBranchId || "",
      req.query.from || today,
      req.query.to || today
    ));
  })
);

dashboardRouter.get(
  "/dashboard/chair-utilization/recommendation",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(chairUtilizationService.getOptimalChairCountRecommendation(
      req.access?.tenantId,
      req.query.branchId || req.access?.requestedBranchId || ""
    ));
  })
);

dashboardRouter.get(
  "/dashboard/anomalies",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(anomalyDetectionService.getAnomalies(req.access?.tenantId, req.query.status || "open"));
  })
);

dashboardRouter.post(
  "/dashboard/anomalies/:id/resolve",
  requirePermission("write", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(anomalyDetectionService.resolveAnomaly(req.access?.tenantId, req.params.id));
  })
);
