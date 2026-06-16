import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { growthRankBotService } from "../services/growth-rank-bot.service.js";
import { validateBody } from "../validators/request-validator.js";

export const growthRankBotRouter = Router();

growthRankBotRouter.get(
  "/growth-rank-bot/dashboard",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.dashboard(req.query, req.access));
  })
);

growthRankBotRouter.get(
  "/growth-rank-bot/audits",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.listAudits(req.query, req.access));
  })
);

growthRankBotRouter.get(
  "/growth-rank-bot/audits/:id/weekly-report",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.weeklyReport(req.params.id, req.access));
  })
);

growthRankBotRouter.get(
  "/growth-rank-bot/audits/:id/rank-tracker",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.rankTracker(req.params.id, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/rank-snapshots/import",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.importRankSnapshots(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/integration-sync",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.syncIntegrationMetrics(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/weekly-report",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.generateWeeklyReport(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/auto-tasks/run",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.runAutoTaskBatch(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/copilot/ask",
  requirePermission("write", () => "marketing"),
  validateBody({ required: ["question"] }),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.askGrowthCopilot(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/campaign-profit",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.recordCampaignProfit(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/publishing-planner",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.schedulePublishingItem(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/seo-pages/generate",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.generateSeoPages(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits/:id/competitor-alerts",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.createCompetitorAlert(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.get(
  "/growth-rank-bot/client-portal/:token",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.clientPortal(req.params.token, req.access));
  })
);

growthRankBotRouter.get(
  "/growth-rank-bot/audits/:id",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.getAudit(req.params.id, req.access));
  })
);

growthRankBotRouter.patch(
  "/growth-rank-bot/audits/:id",
  requirePermission("write", () => "marketing"),
  validateBody({ required: ["businessName"] }),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.updateAudit(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.patch(
  "/growth-rank-bot/tasks/:id/status",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.updateTaskStatus(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.patch(
  "/growth-rank-bot/content/:id/status",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.updateContentStatus(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.patch(
  "/growth-rank-bot/proposals/:id/status",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.updateProposalStatus(req.params.id, req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/attribution-events",
  requirePermission("write", () => "marketing"),
  validateBody({ required: ["auditId", "source"] }),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.recordAttribution(req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/preview",
  requirePermission("read", () => "marketing"),
  validateBody({ required: ["businessName"] }),
  asyncHandler((req, res) => {
    res.json(growthRankBotService.preview(req.body, req.access));
  })
);

growthRankBotRouter.post(
  "/growth-rank-bot/audits",
  requirePermission("write", () => "marketing"),
  validateBody({ required: ["businessName"] }),
  asyncHandler((req, res) => {
    res.status(201).json(growthRankBotService.createAudit(req.body, req.access));
  })
);
