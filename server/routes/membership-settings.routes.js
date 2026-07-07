import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { membershipSettingsService } from "../services/membership-settings.service.js";

export const membershipSettingsRouter = Router();

membershipSettingsRouter.get(
  "/settings/membership",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(membershipSettingsService.get(req.query, req.access));
  })
);

membershipSettingsRouter.put(
  "/settings/membership",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(membershipSettingsService.save(req.body, req.access));
  })
);
