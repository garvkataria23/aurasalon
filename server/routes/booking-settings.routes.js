import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { bookingSettingsService } from "../services/booking-settings.service.js";

export const bookingSettingsRouter = Router();

bookingSettingsRouter.get(
  "/settings/booking",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(bookingSettingsService.get(req.query, req.access));
  })
);

bookingSettingsRouter.put(
  "/settings/booking",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(bookingSettingsService.save(req.body, req.access));
  })
);
