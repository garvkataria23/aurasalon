import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { billingAnalyticsService } from "../services/billing-analytics.service.js";
import { billingFraudDetectionService } from "../services/billing-fraud-detection.service.js";

export const billingAnalyticsRouter = Router();

billingAnalyticsRouter.get("/billing-analytics/summary", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(billingAnalyticsService.summary(req.query, req.access));
}));

billingAnalyticsRouter.get("/billing-analytics/payment-split", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(billingAnalyticsService.paymentSplit(req.query, req.access));
}));

billingAnalyticsRouter.get("/billing-analytics/margin", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(billingAnalyticsService.margin(req.query, req.access));
}));

billingAnalyticsRouter.get("/billing-analytics/fraud-alerts", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(billingFraudDetectionService.alerts(req.query, req.access));
}));

billingAnalyticsRouter.post("/billing-analytics/fraud-alerts/:id/resolve", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(billingFraudDetectionService.resolve(req.params.id, req.body, req.access));
}));
