import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { balanceSheetHardeningService } from "../services/balance-sheet-hardening.service.js";

export const balanceSheetHardeningRouter = Router();

balanceSheetHardeningRouter.get("/balance-sheet/hardening/status",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.hardeningStatus(req.query, req.access))));

balanceSheetHardeningRouter.get("/balance-sheet/hardening",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.hardeningStatus(req.query, req.access))));

balanceSheetHardeningRouter.post("/balance-sheet/outbox",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(balanceSheetHardeningService.enqueue(req.body, req.access))));

balanceSheetHardeningRouter.post("/balance-sheet/outbox/process",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.processOutbox(req.body, req.access))));

balanceSheetHardeningRouter.get("/balance-sheet/outbox",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.outbox(req.query, req.access))));

balanceSheetHardeningRouter.post("/balance-sheet/inventory/receive",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(balanceSheetHardeningService.receiveStock(req.body, req.access))));

balanceSheetHardeningRouter.post("/balance-sheet/inventory/issue",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(balanceSheetHardeningService.issueStock(req.body, req.access))));

balanceSheetHardeningRouter.get("/balance-sheet/inventory/valuation",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.inventoryValuation(req.query, req.access))));

balanceSheetHardeningRouter.get("/balance-sheet/periods",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.periods(req.query, req.access))));

balanceSheetHardeningRouter.post("/balance-sheet/periods/close",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(balanceSheetHardeningService.closePeriod(req.body, req.access))));

balanceSheetHardeningRouter.post("/balance-sheet/periods/reopen",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.reopenPeriod(req.body, req.access))));

balanceSheetHardeningRouter.post("/balance-sheet/reconcile",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(balanceSheetHardeningService.reconcile(req.body, req.access))));

balanceSheetHardeningRouter.get("/balance-sheet/reconcile/latest",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(balanceSheetHardeningService.latestReconciliation(req.query, req.access))));
