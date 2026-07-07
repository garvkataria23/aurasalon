import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { inventorySettingsService } from "../services/inventory-settings.service.js";

export const inventorySettingsRouter = Router();

inventorySettingsRouter.get(
  "/settings/inventory",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(inventorySettingsService.get(req.query, req.access));
  })
);

inventorySettingsRouter.put(
  "/settings/inventory",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(inventorySettingsService.save(req.body, req.access));
  })
);
