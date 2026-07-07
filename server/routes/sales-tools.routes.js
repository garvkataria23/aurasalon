import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { salesToolsSummaryService } from "../services/sales-tools-summary.service.js";

export const salesToolsRouter = Router();

salesToolsRouter.get(
  "/sales-tools/summary",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(salesToolsSummaryService.summary(req.query, req.access));
  })
);
