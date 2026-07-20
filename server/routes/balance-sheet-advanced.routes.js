import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { dimensionService } from "../services/dimension.service.js";
import { deferredRevenueService } from "../services/deferred-revenue.service.js";
import { fixedAssetService } from "../services/fixed-asset.service.js";

// Add-only router for Stages 22-24. Mount alongside the other finance routers.
export const balanceSheetAdvancedRouter = Router();

// Stage 22 — cost centers / dimensions
balanceSheetAdvancedRouter.post("/balance-sheet/cost-centers",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(dimensionService.createCostCenter(req.body, req.access))));

balanceSheetAdvancedRouter.get("/balance-sheet/cost-centers",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(dimensionService.listCostCenters(req.query, req.access))));

balanceSheetAdvancedRouter.post("/balance-sheet/journals/dimensional",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(dimensionService.postJournalWithDimensions(req.body, req.access))));

balanceSheetAdvancedRouter.get("/balance-sheet/dimensional-pnl",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(dimensionService.dimensionalProfitLoss(req.query, req.access))));

// Stage 23 — deferred revenue
balanceSheetAdvancedRouter.post("/balance-sheet/deferred/schedules",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(deferredRevenueService.createSchedule(req.body, req.access))));

balanceSheetAdvancedRouter.get("/balance-sheet/deferred/schedules",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(deferredRevenueService.list(req.query, req.access))));

balanceSheetAdvancedRouter.post("/balance-sheet/deferred/recognize-due",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(deferredRevenueService.recognizeDue(req.body, req.access))));

balanceSheetAdvancedRouter.post("/balance-sheet/deferred/recognize-usage",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(deferredRevenueService.recognizeUsage(req.body, req.access))));

// Stage 24 — fixed assets + depreciation
balanceSheetAdvancedRouter.post("/balance-sheet/assets",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(fixedAssetService.createAsset(req.body, req.access))));

balanceSheetAdvancedRouter.get("/balance-sheet/assets",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(fixedAssetService.register(req.query, req.access))));

balanceSheetAdvancedRouter.post("/balance-sheet/assets/depreciation/run",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(fixedAssetService.runDepreciation(req.body, req.access))));

balanceSheetAdvancedRouter.post("/balance-sheet/assets/dispose",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(fixedAssetService.disposeAsset(req.body, req.access))));