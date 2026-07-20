import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { packageSettingsService } from "../services/package-settings.service.js";

export const packageSettingsRouter = Router();

packageSettingsRouter.get(
  "/settings/packages",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(packageSettingsService.get(req.query, req.access));
  })
);

packageSettingsRouter.put(
  "/settings/packages",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(packageSettingsService.save(req.body, req.access));
  })
);
