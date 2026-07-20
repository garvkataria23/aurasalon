import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { engagementLeadIntelligenceService } from "../services/engagement-lead-intelligence.service.js";
import { engagementService } from "../services/engagement.service.js";

export const engagementRouter = Router();

function requestMeta(req) {
  return {
    ipAddress: req.ip || req.socket?.remoteAddress || "",
    userAgent: req.get("user-agent") || ""
  };
}

engagementRouter.get(
  "/engagement/threads",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listThreads(req.query, req.access));
  })
);

engagementRouter.get(
  "/engagement/audit",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listAuditLogs(req.query, req.access));
  })
);

engagementRouter.get(
  "/engagement/risk-signals",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listRiskSignals(req.query, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/providers",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listProviderReadiness(req.query, req.access));
  })
);

engagementRouter.get(
  "/engagement/providers/readiness",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listProviderReadiness(req.query, req.access));
  })
);

engagementRouter.post(
  "/engagement/providers/config",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementService.saveProviderConfig(req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/providers/:id/verify",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.verifyProviderConfig(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/risk-signals/:id/review",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.reviewRiskSignal(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/clients/:clientId/360",
  requirePermission("read", () => "clients"),
  asyncHandler((req, res) => {
    res.json(engagementService.client360(req.params.clientId, req.access));
  })
);

engagementRouter.post(
  "/engagement/clients/:clientId/ai-summary",
  requirePermission("write", () => "clients"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementService.generateClientAiSummary(req.params.clientId, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/templates",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listTemplates(req.query, req.access));
  })
);

engagementRouter.post(
  "/engagement/templates",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementService.createTemplate(req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.patch(
  "/engagement/templates/:id",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.updateTemplate(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/templates/:id/render",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.renderTemplate(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/booking/slot-preview",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(engagementService.bookingSlotPreview(req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/booking/create",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementService.createBookingFromEngagement(req.body, req.access, { ...requestMeta(req), req }));
  })
);

engagementRouter.get(
  "/engagement/reviews",
  requirePermission("read", () => "reputation"),
  asyncHandler((req, res) => {
    res.json(engagementService.listReviews(req.query, req.access));
  })
);

engagementRouter.post(
  "/engagement/reviews/:id/ai-response",
  requirePermission("write", () => "reputation"),
  asyncHandler(async (req, res) => {
    res.status(201).json(await engagementService.aiReviewResponse(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/reviews/:id/approve-response",
  requirePermission("write", () => "reputation"),
  asyncHandler((req, res) => {
    res.json(engagementService.approveReviewResponse(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/reviews/:id/send-response",
  requirePermission("write", () => "reputation"),
  asyncHandler((req, res) => {
    res.json(engagementService.sendReviewResponse(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/recovery-opportunities",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listRecoveryOpportunities(req.query, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/recovery-opportunities/:id/assign",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.assignRecoveryOpportunity(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/recovery-opportunities/:id/create-draft",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementService.createDraftForRecoveryOpportunity(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/recovery-opportunities/:id/mark-done",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.markRecoveryOpportunityDone(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/sla/overdue",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listSlaOverdue(req.query, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/manager-view",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.managerView(req.query, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/leads/report",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementLeadIntelligenceService.report(req.query, req.access));
  })
);

engagementRouter.post(
  "/engagement/leads/:id/assign",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementLeadIntelligenceService.action(req.params.id, req.body, req.access, "assign"));
  })
);

engagementRouter.post(
  "/engagement/leads/:id/follow-up-note",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementLeadIntelligenceService.action(req.params.id, req.body, req.access, "follow_up_note"));
  })
);

engagementRouter.post(
  "/engagement/leads/:id/mark-won",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementLeadIntelligenceService.action(req.params.id, req.body, req.access, "mark_won"));
  })
);

engagementRouter.post(
  "/engagement/leads/:id/mark-lost",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementLeadIntelligenceService.action(req.params.id, req.body, req.access, "mark_lost"));
  })
);

engagementRouter.get(
  "/engagement/reports/staff-accountability",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.staffAccountabilityReport(req.query, req.access));
  })
);

engagementRouter.get(
  "/engagement/reports",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.engagementReports(req.query, req.access));
  })
);

engagementRouter.get(
  "/engagement/reports/export/csv",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    const csv = engagementService.engagementReportsCsv(req.query, req.access);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="engagement-reports-${Date.now()}.csv"`);
    res.send(csv);
  })
);

engagementRouter.get(
  "/engagement/reports/export/pdf",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    const pdf = engagementService.engagementReportsPdf(req.query, req.access);
    res.setHeader("Content-Type", "application/pdf");
    res.setHeader("Content-Disposition", `attachment; filename="engagement-reports-${Date.now()}.pdf"`);
    res.send(Buffer.from(pdf, "binary"));
  })
);

engagementRouter.get(
  "/engagement/threads/:id",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.getThread(req.params.id, req.access));
  })
);

engagementRouter.post(
  "/engagement/threads",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementService.createThread(req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.patch(
  "/engagement/threads/:id/status",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.updateThreadStatus(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.patch(
  "/engagement/threads/:id/assign",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.assignThread(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/threads/:id/escalate",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.escalateThread(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.get(
  "/engagement/messages",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.listMessages(req.query, req.access));
  })
);

engagementRouter.post(
  "/engagement/messages/draft",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(engagementService.createDraft(req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/messages/:id/approve",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.approveMessage(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/messages/:id/send",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.sendMessage(req.params.id, req.body, req.access, requestMeta(req)));
  })
);

engagementRouter.post(
  "/engagement/messages/:id/reject",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(engagementService.rejectMessage(req.params.id, req.body, req.access, requestMeta(req)));
  })
);
