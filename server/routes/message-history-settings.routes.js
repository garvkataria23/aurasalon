import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { messageHistorySettingsService } from "../services/message-history-settings.service.js";

export const messageHistorySettingsRouter = Router();

messageHistorySettingsRouter.get(
  "/settings/message-history",
  requirePermission("read", () => "settings"),
  asyncHandler((req, res) => {
    res.json(messageHistorySettingsService.get(req.query, req.access));
  })
);

messageHistorySettingsRouter.put(
  "/settings/message-history",
  requirePermission("write", () => "settings"),
  asyncHandler((req, res) => {
    res.json(messageHistorySettingsService.save(req.body, req.access));
  })
);
