import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { ecosystemService } from "../services/ecosystem.service.js";

export const ecosystemRouter = Router();

ecosystemRouter.get(
  "/ecosystem/level-coverage",
  requirePermission("read", () => "future-features"),
  asyncHandler((req, res) => {
    res.json(ecosystemService.summary(req.query, req.access));
  })
);
