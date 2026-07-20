import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { ownerDashboardService } from "../services/owner-dashboard.service.js";
import { forbidden } from "../utils/app-error.js";

export const ownerDashboardRouter = Router();

ownerDashboardRouter.get(
  "/owner-console/dashboard",
  requirePermission("read", () => "dashboard"),
  asyncHandler((req, res) => {
    if (req.access?.role !== "owner") throw forbidden("Owner role is required");
    res.json(ownerDashboardService.getDashboard(req.access, req.query));
  })
);
