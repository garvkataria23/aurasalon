import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { billSettingsService } from "../services/bill-settings.service.js";

export const billSettingsRouter = Router();

billSettingsRouter.get(
  "/settings/bill-setting",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(billSettingsService.get(req.query, req.access));
  })
);

billSettingsRouter.put(
  "/settings/bill-setting",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(billSettingsService.save(req.body, req.access));
  })
);
