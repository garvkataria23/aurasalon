import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { securitySettingsService } from "../services/security-settings.service.js";

export const securitySettingsRouter = Router();

securitySettingsRouter.get(
  "/settings/security",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(securitySettingsService.get(req.query, req.access));
  })
);

securitySettingsRouter.put(
  "/settings/security",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(securitySettingsService.save(req.body, req.access));
  })
);
