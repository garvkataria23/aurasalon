import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { otherSettingsService } from "../services/other-settings.service.js";

export const otherSettingsRouter = Router();

otherSettingsRouter.get(
  "/settings/others",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(otherSettingsService.get(req.query, req.access));
  })
);

otherSettingsRouter.put(
  "/settings/others",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(otherSettingsService.save(req.body, req.access));
  })
);
