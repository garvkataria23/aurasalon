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

analyticsRouter.post(
  "/analytics/run",
  requirePermission("write", () => "analytics"),
  validateAnalyticsRequest,
  asyncHandler((req, res) => {
    res.status(201).json(advancedAnalyticsService.run(req.body, req.access));
  })
);
