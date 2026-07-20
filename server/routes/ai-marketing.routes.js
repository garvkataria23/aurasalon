import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { aiMarketingService } from "../services/ai-marketing.service.js";
import { validateBody } from "../validators/request-validator.js";

export const aiMarketingRouter = Router();

aiMarketingRouter.get(
  "/ai-marketing/summary",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(aiMarketingService.summary(req.query, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/segments",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(aiMarketingService.segment(req.body, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/campaigns/generate",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(aiMarketingService.generateCampaign(req.body, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/captions",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(aiMarketingService.generateCaption(req.body, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/offers/recommend",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(aiMarketingService.recommendOffers(req.body, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/retargeting-workflows",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(aiMarketingService.createRetargetingWorkflow(req.body, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/whatsapp-sequences",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(aiMarketingService.createWhatsAppSequence(req.body, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/email-templates",
  requirePermission("write", () => "marketing"),
  validateBody({ required: ["name"] }),
  asyncHandler((req, res) => {
    res.status(201).json(aiMarketingService.createEmailTemplate(req.body, req.access));
  })
);

aiMarketingRouter.post(
  "/ai-marketing/festival-campaigns",
  requirePermission("write", () => "marketing"),
  validateBody({ required: ["festival"] }),
  asyncHandler((req, res) => {
    res.status(201).json(aiMarketingService.festivalCampaign(req.body, req.access));
  })
);
