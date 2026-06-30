import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { dueRecoveryReportService } from "../services/due-recovery-report.service.js";

export const dueRecoveryReportRouter = Router();

dueRecoveryReportRouter.get("/reports/invoices/due-recovery", requirePermission("read", () => "reports"), asyncHandler((req, res) => {
  res.json(dueRecoveryReportService.report(req.query, req.access));
}));

dueRecoveryReportRouter.post("/reports/invoices/due-recovery/:invoiceId/send-reminder", requirePermission("write", () => "payments"), asyncHandler((req, res) => {
  res.status(201).json(dueRecoveryReportService.sendReminder(req.params.invoiceId, req.body, req.access));
}));

dueRecoveryReportRouter.post("/reports/invoices/due-recovery/:invoiceId/assign-manager", requirePermission("write", () => "payments"), asyncHandler((req, res) => {
  res.status(201).json(dueRecoveryReportService.assignManager(req.params.invoiceId, req.body, req.access));
}));

dueRecoveryReportRouter.post("/reports/invoices/due-recovery/:invoiceId/mark-call-done", requirePermission("write", () => "payments"), asyncHandler((req, res) => {
  res.status(201).json(dueRecoveryReportService.markCallDone(req.params.invoiceId, req.body, req.access));
}));

dueRecoveryReportRouter.post("/reports/invoices/due-recovery/:invoiceId/follow-up-note", requirePermission("write", () => "payments"), asyncHandler((req, res) => {
  res.status(201).json(dueRecoveryReportService.addFollowupNote(req.params.invoiceId, req.body, req.access));
}));
