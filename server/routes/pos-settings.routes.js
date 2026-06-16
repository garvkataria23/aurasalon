import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { posSettingsService } from "../services/pos-settings.service.js";

export const posSettingsRouter = Router();

posSettingsRouter.get(
  "/pos/settings/payment-modes",
  requirePermission("read", () => "payments"),
  asyncHandler((req, res) => {
    res.json(posSettingsService.paymentModes(req.query, req.access));
  })
);

posSettingsRouter.put(
  "/pos/settings/payment-modes",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(posSettingsService.savePaymentModes(req.body, req.access));
  })
);
