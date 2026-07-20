import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { futureFeaturesService } from "../services/future-features.service.js";

export const futureFeaturesRouter = Router();

futureFeaturesRouter.get(
  "/future-features/summary",
  requirePermission("read", () => "future-features"),
  asyncHandler((req, res) => {
    res.json(futureFeaturesService.summary(req.query, req.access));
  })
);

futureFeaturesRouter.post(
  "/future-features/:type/run",
  requirePermission("write", () => "future-features"),
  asyncHandler((req, res) => {
    res.status(201).json(futureFeaturesService.run(req.params.type, req.body, req.access));
  })
);
