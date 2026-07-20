import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { calendarSettingsService } from "../services/calendar-settings.service.js";

export const calendarSettingsRouter = Router();

calendarSettingsRouter.get(
  "/settings/calendar",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(calendarSettingsService.get(req.query, req.access));
  })
);

calendarSettingsRouter.put(
  "/settings/calendar",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(calendarSettingsService.save(req.body, req.access));
  })
);
