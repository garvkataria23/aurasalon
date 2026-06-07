import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { cashDrawerService } from "../services/cash-drawer.service.js";
import { dailyClosingService } from "../services/daily-closing.service.js";

export const dailyClosingRouter = Router();

dailyClosingRouter.post("/cash-drawer/open", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(cashDrawerService.open(req.body, req.access));
}));

dailyClosingRouter.post("/cash-drawer/close", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(cashDrawerService.close(req.body, req.access));
}));

dailyClosingRouter.get("/cash-drawer/current", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(cashDrawerService.current(req.query.branchId || req.query.branch_id, req.access));
}));

dailyClosingRouter.post("/daily-closing/close", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(dailyClosingService.close(req.body, req.access));
}));

dailyClosingRouter.get("/daily-closing/report", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(dailyClosingService.report(req.query, req.access));
}));

dailyClosingRouter.get("/daily-closing/:date", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(dailyClosingService.get(req.params.date, req.query, req.access));
}));
