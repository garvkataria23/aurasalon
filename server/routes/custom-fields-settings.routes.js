import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { customFieldsSettingsService } from "../services/custom-fields-settings.service.js";

export const customFieldsSettingsRouter = Router();

customFieldsSettingsRouter.get(
  "/settings/custom-fields",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(customFieldsSettingsService.get(req.query, req.access));
  })
);

customFieldsSettingsRouter.put(
  "/settings/custom-fields",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(customFieldsSettingsService.save(req.body, req.access));
  })
);
