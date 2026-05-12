import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { aiAssistantService } from "../services/ai-assistant.service.js";

export const aiRouter = Router();

aiRouter.get(
  "/ai/history",
  requirePermission("read", () => "ai"),
  asyncHandler((req, res) => {
    res.json(aiAssistantService.history(req.query, req.access));
  })
);

aiRouter.post(
  "/ai/:type",
  requirePermission("write", () => "ai"),
  asyncHandler(async (req, res) => {
    res.status(201).json(await aiAssistantService.run(req.params.type, req.body, req.access));
  })
);
