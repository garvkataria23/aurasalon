import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { abandonedRecoveryService } from "../services/abandoned-recovery.service.js";
import { bookingFunnelAnalyticsService } from "../services/booking-funnel-analytics.service.js";

export const bookingAnalyticsRouter = Router();

bookingAnalyticsRouter.get(
  "/booking-analytics/funnel",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(bookingFunnelAnalyticsService.getFunnelMetrics(req.access, req.query));
  })
);

bookingAnalyticsRouter.get(
  "/booking-analytics/conversion-rates",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(bookingFunnelAnalyticsService.getConversionRates(req.access, req.query));
  })
);

bookingAnalyticsRouter.get(
  "/booking-analytics/abandonments",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(bookingFunnelAnalyticsService.getAbandonmentReasons(req.access, req.query));
  })
);

bookingAnalyticsRouter.post(
  "/booking-analytics/abandonments/detect",
  requirePermission("write", () => "analytics"),
  asyncHandler((req, res) => {
    res.status(201).json(abandonedRecoveryService.detectAbandonments(req.body || {}));
  })
);

bookingAnalyticsRouter.post(
  "/booking-analytics/abandonments/:id/recover",
  requirePermission("write", () => "analytics"),
  asyncHandler((req, res) => {
    res.status(201).json(abandonedRecoveryService.attemptRecovery(req.params.id, req.access.tenantId));
  })
);

bookingAnalyticsRouter.get(
  "/booking-analytics/recovery-stats",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(bookingFunnelAnalyticsService.getRecoveryStats(req.access, req.query));
  })
);
