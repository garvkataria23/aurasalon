import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { generalSettingsService } from "../services/general-settings.service.js";

export const generalSettingsRouter = Router();

generalSettingsRouter.get(
  "/settings/general",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(generalSettingsService.get(req.query, req.access));
  })
);

generalSettingsRouter.put(
  "/settings/general",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(generalSettingsService.save(req.body, req.access));
  })
);
