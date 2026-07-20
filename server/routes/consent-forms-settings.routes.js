import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { consentFormsSettingsService } from "../services/consent-forms-settings.service.js";

export const consentFormsSettingsRouter = Router();

consentFormsSettingsRouter.get(
  "/settings/consent-forms",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(consentFormsSettingsService.get(req.query, req.access));
  })
);

consentFormsSettingsRouter.put(
  "/settings/consent-forms",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(consentFormsSettingsService.save(req.body, req.access));
  })
);
