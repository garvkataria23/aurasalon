import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { paymentMethodSettingsService } from "../services/payment-method-settings.service.js";

export const paymentMethodSettingsRouter = Router();

paymentMethodSettingsRouter.get(
  "/settings/payment-methods",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(paymentMethodSettingsService.get(req.query, req.access));
  })
);

paymentMethodSettingsRouter.put(
  "/settings/payment-methods",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(paymentMethodSettingsService.save(req.body, req.access));
  })
);
