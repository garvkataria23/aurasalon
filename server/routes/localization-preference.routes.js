import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { localizationPreferenceService } from "../services/localization-preference.service.js";

export const localizationPreferenceRouter = Router();

localizationPreferenceRouter.get(
  "/localization/preference",
  requirePermission("read", () => "localization"),
  asyncHandler((req, res) => {
    res.json(localizationPreferenceService.get(req.access));
  })
);

localizationPreferenceRouter.put(
  "/localization/preference",
  requirePermission("write", () => "localization"),
  asyncHandler((req, res) => {
    res.json(localizationPreferenceService.save(req.body, req.access));
  })
);
