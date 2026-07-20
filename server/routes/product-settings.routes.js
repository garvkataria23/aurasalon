import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { productSettingsService } from "../services/product-settings.service.js";

export const productSettingsRouter = Router();

productSettingsRouter.get(
  "/settings/products",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(productSettingsService.get(req.query, req.access));
  })
);

productSettingsRouter.put(
  "/settings/products",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(productSettingsService.save(req.body, req.access));
  })
);
