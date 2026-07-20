import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { smsTemplateSettingsService } from "../services/sms-template-settings.service.js";

export const smsTemplateSettingsRouter = Router();

smsTemplateSettingsRouter.get(
  "/settings/sms-template",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(smsTemplateSettingsService.get(req.query, req.access));
  })
);

smsTemplateSettingsRouter.put(
  "/settings/sms-template",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(smsTemplateSettingsService.save(req.body, req.access));
  })
);
