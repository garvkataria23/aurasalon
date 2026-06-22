import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { financeEngineService } from "../services/finance-engine.service.js";
import { salonOperationsService } from "../services/salon-operations.service.js";
import { securityService } from "../services/security.service.js";

export const financeEngineRouter = Router();

financeEngineRouter.get(
  "/finance/summary",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(financeEngineService.summary(req.query, req.access));
  })
);

financeEngineRouter.post(
  "/finance/cash-drawers/open",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = financeEngineService.openDrawer(req.body, req.access);
    securityService.audit({ action: "cash_drawer.opened", targetType: "finance_cash_drawer", targetId: result.id, details: { branchId: result.branchId, openingFloat: result.openingFloat } }, req.access, req);
    res.status(201).json(result);
  })
);

financeEngineRouter.patch(
  "/finance/cash-drawers/close",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = financeEngineService.closeDrawer(req.body, req.access);
    securityService.audit({ action: "cash_drawer.closed", targetType: "finance_cash_drawer", targetId: result.id, details: { branchId: result.branchId, variance: result.variance } }, req.access, req);
    res.json(result);
  })
);

financeEngineRouter.post(
  "/finance/expenses",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = financeEngineService.addExpense(req.body, req.access);
    securityService.audit({ action: "expense.created", targetType: "finance_expense", targetId: result.id, details: { amount: result.amount, category: result.category } }, req.access, req);
    res.status(201).json(result);
  })
);

financeEngineRouter.post(
  "/finance/daily-closing",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = financeEngineService.dailyClosing(req.body, req.access);
    securityService.audit({ action: "daily_closing.created", targetType: "finance_daily_closing", targetId: result.id, details: { branchId: result.branchId, businessDate: result.businessDate, totals: result.totals } }, req.access, req);
    res.status(201).json(result);
  })
);

financeEngineRouter.post(
  "/finance/invoices/:id/partial-payment",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = financeEngineService.addPartialPayment(req.params.id, req.body, req.access);
    securityService.audit({ action: "payment.partial", targetType: "invoice", targetId: req.params.id, details: { paymentId: result.payment.id, amount: req.body.amount, mode: req.body.mode } }, req.access, req);
    res.status(201).json(result);
  })
);

financeEngineRouter.post(
  "/finance/refunds",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = financeEngineService.refund(req.body, req.access);
    securityService.audit({ action: "refund.processed", targetType: "invoice", targetId: req.body.invoiceId, details: { refundId: result.refund.id, amount: req.body.amount, reason: req.body.reason || "" }, severity: "warning" }, req.access, req);
    res.status(201).json(result);
  })
);

financeEngineRouter.post(
  "/finance/credit-notes",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = salonOperationsService.createCreditNote(req.body, req.access);
    securityService.audit({ action: "credit_note.issued", targetType: "invoice", targetId: req.body.invoiceId, details: { creditNoteId: result.id, amount: result.amount, reason: result.reason || "" } }, req.access, req);
    res.status(201).json(result);
  })
);

financeEngineRouter.post(
  "/finance/staff-payouts",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    const result = financeEngineService.calculateStaffPayout(req.body, req.access);
    securityService.audit({ action: "staff_payout.calculated", targetType: "finance_staff_payout", targetId: result.id, details: { staffId: result.staffId, netAmount: result.netAmount } }, req.access, req);
    res.status(201).json(result);
  })
);
