import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { salonCostService } from "../services/salon-cost.service.js";

// Add-only router for Stage 25 (salon cost structure + break-even).
export const salonCostRouter = Router();

salonCostRouter.get("/balance-sheet/cost-structure",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(salonCostService.costStructure(req.query, req.access))));

salonCostRouter.get("/balance-sheet/cost-classifications",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => res.json(salonCostService.classifications(req.query, req.access))));

salonCostRouter.post("/balance-sheet/cost-classifications",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => res.status(201).json(salonCostService.classify(req.body, req.access))));