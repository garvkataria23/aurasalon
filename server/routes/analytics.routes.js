import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { advancedAnalyticsService } from "../services/advanced-analytics.service.js";
import { validateAnalyticsRequest } from "../validators/request-validator.js";

export const analyticsRouter = Router();

analyticsRouter.get(
  "/analytics/snapshots",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(advancedAnalyticsService.snapshots(req.query, req.access));
  })
);

analyticsRouter.get(
  "/analytics/latest",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(advancedAnalyticsService.latest(req.query, req.access));
  })
);

analyticsRouter.get(
  "/analytics/report-command-center",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(advancedAnalyticsService.reportCommandCenter(req.query, req.access));
  })
);

analyticsRouter.get(
  "/analytics/kpi-detail/:module/:kpiKey",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(advancedAnalyticsService.kpiDetail(req.params.module, req.params.kpiKey, req.query, req.access));
  })
);

analyticsRouter.get(
  "/analytics/export-controls",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(advancedAnalyticsService.exportControls(req.query, req.access));
  })
);

analyticsRouter.get(
  "/analytics/report-schedules",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(advancedAnalyticsService.reportSchedules(req.query, req.access));
  })
);

analyticsRouter.post(
  "/analytics/report-schedules",
  requirePermission("write", () => "analytics"),
  asyncHandler((req, res) => {
    res.status(201).json(advancedAnalyticsService.createSchedule(req.body, req.access));
  })
);

analyticsRouter.post(
  "/analytics/anomalies/run",
  requirePermission("write", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(advancedAnalyticsService.runAnomalyDetection(req.body, req.access));
  })
);

analyticsRouter.post(
  "/analytics/run",
  requirePermission("write", () => "analytics"),
  validateAnalyticsRequest,
  asyncHandler((req, res) => {
    res.status(201).json(advancedAnalyticsService.run(req.body, req.access));
  })
);
