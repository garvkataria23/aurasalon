import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { businessDetailsSettingsService } from "../services/business-details-settings.service.js";

export const businessDetailsSettingsRouter = Router();

businessDetailsSettingsRouter.get(
  "/settings/business-details",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(businessDetailsSettingsService.get(req.query, req.access));
  })
);

businessDetailsSettingsRouter.put(
  "/settings/business-details",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(businessDetailsSettingsService.save(req.body, req.access));
  })
);
