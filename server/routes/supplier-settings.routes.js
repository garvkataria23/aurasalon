import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { supplierSettingsService } from "../services/supplier-settings.service.js";

export const supplierSettingsRouter = Router();

supplierSettingsRouter.get(
  "/settings/supplier",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(supplierSettingsService.get(req.query, req.access));
  })
);

supplierSettingsRouter.put(
  "/settings/supplier",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(supplierSettingsService.save(req.body, req.access));
  })
);
