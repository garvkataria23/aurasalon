import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { invoiceEventLedgerService } from "../services/invoice-event-ledger.service.js";

export const invoiceLedgerRouter = Router();

invoiceLedgerRouter.get("/invoice-ledger/:invoiceId/events", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json({ rows: invoiceEventLedgerService.listEvents(req.params.invoiceId, req.access) });
}));

invoiceLedgerRouter.get("/invoice-ledger/:invoiceId/snapshot", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json(invoiceEventLedgerService.snapshot(req.params.invoiceId, req.access));
}));

invoiceLedgerRouter.post("/invoice-ledger/:invoiceId/verify", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json(invoiceEventLedgerService.verify(req.params.invoiceId, req.access));
}));
