import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { serviceSettingsService } from "../services/service-settings.service.js";

export const serviceSettingsRouter = Router();

serviceSettingsRouter.get(
  "/settings/services",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(serviceSettingsService.get(req.query, req.access));
  })
);

serviceSettingsRouter.put(
  "/settings/services",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(serviceSettingsService.save(req.body, req.access));
  })
);
