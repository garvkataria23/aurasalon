import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody } from "../validators/request-validator.js";
import { staffCommissionService } from "../services/staff-commission.service.js";
import { tipsService } from "../services/tips.service.js";

export const commissionRouter = Router();

commissionRouter.get("/commissions/staff/:staffId", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(staffCommissionService.staffReport(req.params.staffId, req.query, req.access));
}));

commissionRouter.get("/commissions/summary", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(staffCommissionService.summary(req.query, req.access));
}));

commissionRouter.post("/billing/invoices/:invoiceId/tips", requirePermission("write", () => "payments"), validateBody({ required: ["amount"] }), asyncHandler((req, res) => {
  res.status(201).json(tipsService.addTip(req.params.invoiceId, req.body, req.access));
}));

commissionRouter.get("/tips/report", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(tipsService.report(req.query, req.access));
}));

commissionRouter.get("/tips/staff-summary", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(tipsService.staffSummary(req.query, req.access));
}));

commissionRouter.post("/tips/payout", requirePermission("write", () => "finance"), validateBody({ required: ["tipIds"] }), asyncHandler((req, res) => {
  res.status(201).json(tipsService.payout(req.body, req.access));
}));

commissionRouter.post("/tips/:id/mark-reversed", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(tipsService.markReversed(req.params.id, req.body, req.access));
}));

commissionRouter.get("/tips/export.csv", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.setHeader("Content-Type", "text/csv; charset=utf-8");
  res.setHeader("Content-Disposition", "attachment; filename=\"tips-ledger.csv\"");
  res.send(tipsService.exportCsv(req.query, req.access));
}));

commissionRouter.get("/tips/payout-summary.pdf", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.setHeader("Content-Type", "application/pdf");
  res.setHeader("Content-Disposition", "attachment; filename=\"tip-payout-summary.pdf\"");
  res.send(tipsService.payoutSummaryPdf(req.query, req.access));
}));
