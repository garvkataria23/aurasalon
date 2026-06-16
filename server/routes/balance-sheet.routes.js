import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { balanceSheetService } from "../services/balance-sheet.service.js";
import { balanceSheetHardeningService } from "../services/balance-sheet-hardening.service.js";

export const balanceSheetRouter = Router();

balanceSheetRouter.get("/balance-sheet/accounts", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.accounts(req.query, req.access));
}));

balanceSheetRouter.post("/balance-sheet/journals", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(balanceSheetService.createJournal(req.body, req.access));
}));

balanceSheetRouter.get("/balance-sheet/live", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.live(req.query, req.access));
}));

balanceSheetRouter.get("/balance-sheet/trial-balance", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.trialBalance(req.query, req.access));
}));

balanceSheetRouter.get("/balance-sheet/ledger", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.ledger(req.query, req.access));
}));

balanceSheetRouter.get("/balance-sheet/working-capital", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.workingCapital(req.query, req.access));
}));

balanceSheetRouter.get("/balance-sheet/cost-structure", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.costStructure(req.query, req.access));
}));

balanceSheetRouter.get("/balance-sheet/daily-operations", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.dailyOperations(req.query, req.access));
}));

balanceSheetRouter.get("/balance-sheet/finance-os", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.financeOs(req.query, req.access));
}));

balanceSheetRouter.post("/balance-sheet/pos-gl-sync", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(balanceSheetService.syncPosToGl(req.body, req.access));
}));

balanceSheetRouter.post("/balance-sheet/copilot", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetService.financeCopilot(req.body, req.access));
}));

balanceSheetRouter.post("/balance-sheet/inventory-cogs-sync", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(balanceSheetService.syncInventoryCogs(req.body, req.access));
}));

balanceSheetRouter.post("/balance-sheet/daily-accruals", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(balanceSheetService.postDailyAccruals(req.body, req.access));
}));

balanceSheetRouter.post("/balance-sheet/month-close-automation", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(balanceSheetService.runMonthCloseAutomation(req.body, req.access));
}));

balanceSheetRouter.post("/balance-sheet/owner-daily-close", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(balanceSheetService.ownerDailyClose(req.body, req.access));
}));

balanceSheetRouter.post("/balance-sheet/outbox/process", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetHardeningService.processOutbox(req.body, req.access));
}));

balanceSheetRouter.get("/balance-sheet/outbox", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(balanceSheetHardeningService.outbox(req.query, req.access));
}));

balanceSheetRouter.post("/balance-sheet/snapshots", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(balanceSheetService.createSnapshot(req.body, req.access));
}));
