import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { churnRiskService } from "../services/churn-risk.service.js";
import { noShowRiskService } from "../services/no-show-risk.service.js";
import { rebookingRecommendationService } from "../services/rebooking-recommendation.service.js";
import { upsellSuggestionService } from "../services/upsell-suggestion.service.js";

export const bookingIntelligenceRouter = Router();

bookingIntelligenceRouter.get(
  "/booking-intelligence/no-show-risk/:customerId",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(noShowRiskService.calculateRisk(req.access, req.params.customerId, req.query));
  })
);

bookingIntelligenceRouter.get(
  "/booking-intelligence/rebooking-suggestion/:customerId",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(rebookingRecommendationService.generateRebookingMessage(req.access, req.params.customerId));
  })
);

bookingIntelligenceRouter.post(
  "/booking-intelligence/rebooking-suggestion/:customerId/queue",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(rebookingRecommendationService.queueReminder(req.access, req.params.customerId));
  })
);

bookingIntelligenceRouter.get(
  "/booking-intelligence/churn-risk",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(churnRiskService.getAtRiskCustomers(req.access, req.query));
  })
);

bookingIntelligenceRouter.get(
  "/booking-intelligence/churn-risk/:customerId",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(churnRiskService.calculateChurnScore(req.access, req.params.customerId));
  })
);

bookingIntelligenceRouter.get(
  "/booking-intelligence/upsell-suggestions",
  requirePermission("read", () => "services"),
  asyncHandler((req, res) => {
    res.json(upsellSuggestionService.suggestAddOns(req.access, req.query.serviceIds || "", req.query.customerId || ""));
  })
);
