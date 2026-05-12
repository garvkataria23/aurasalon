import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { intelligentInventoryService } from "../services/intelligent-inventory.service.js";
import { validateBody } from "../validators/request-validator.js";

export const inventoryIntelligenceRouter = Router();

inventoryIntelligenceRouter.get(
  "/inventory-intelligence/summary",
  requirePermission("read", () => "inventory"),
  asyncHandler((req, res) => {
    res.json(intelligentInventoryService.summary(req.query, req.access));
  })
);

inventoryIntelligenceRouter.get(
  "/inventory-intelligence/usage",
  requirePermission("read", () => "inventory"),
  asyncHandler((req, res) => {
    res.json(intelligentInventoryService.usageTracking(req.query, req.access));
  })
);

inventoryIntelligenceRouter.get(
  "/inventory-intelligence/predictions",
  requirePermission("read", () => "inventory"),
  asyncHandler((req, res) => {
    res.json(intelligentInventoryService.predictions(req.query, req.access));
  })
);

inventoryIntelligenceRouter.post(
  "/inventory-intelligence/suppliers",
  requirePermission("write", () => "inventory"),
  validateBody({ required: ["name"] }),
  asyncHandler((req, res) => {
    res.status(201).json(intelligentInventoryService.createSupplier(req.body, req.access));
  })
);

inventoryIntelligenceRouter.post(
  "/inventory-intelligence/purchase-entry",
  requirePermission("write", () => "inventory"),
  validateBody({ required: ["productId", "branchId", "quantity"] }),
  asyncHandler((req, res) => {
    res.status(201).json(intelligentInventoryService.purchaseEntry(req.body, req.access));
  })
);

inventoryIntelligenceRouter.post(
  "/inventory-intelligence/batches",
  requirePermission("write", () => "inventory"),
  validateBody({ required: ["productId", "branchId", "batchNumber"] }),
  asyncHandler((req, res) => {
    res.status(201).json(intelligentInventoryService.createBatch(req.body, req.access));
  })
);

inventoryIntelligenceRouter.post(
  "/inventory-intelligence/waste",
  requirePermission("write", () => "inventory"),
  validateBody({ required: ["productId", "branchId", "quantity", "reason"] }),
  asyncHandler((req, res) => {
    res.status(201).json(intelligentInventoryService.recordWaste(req.body, req.access));
  })
);

inventoryIntelligenceRouter.post(
  "/inventory-intelligence/reorder-suggestions/run",
  requirePermission("write", () => "inventory"),
  asyncHandler((req, res) => {
    res.status(201).json(intelligentInventoryService.runReorderSuggestions(req.body, req.access));
  })
);
