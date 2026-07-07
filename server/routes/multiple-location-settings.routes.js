import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { multipleLocationSettingsService } from "../services/multiple-location-settings.service.js";

export const multipleLocationSettingsRouter = Router();

multipleLocationSettingsRouter.get(
  "/settings/multiple-location",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(multipleLocationSettingsService.get(req.query, req.access));
  })
);

multipleLocationSettingsRouter.put(
  "/settings/multiple-location",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(multipleLocationSettingsService.save(req.body, req.access));
  })
);
