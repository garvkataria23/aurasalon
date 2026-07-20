import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { bonusService } from "../../services/compliance/bonus.service.js";

export const bonusComplianceRouter = Router();

bonusComplianceRouter.post("/compliance/bonus/calculate/:fy", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(bonusService.calculate(req.params.fy, req.body, req.access));
}));

bonusComplianceRouter.get("/compliance/bonus/eligible-staff/:fy", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(bonusService.eligibleStaff(req.params.fy, req.access));
}));

bonusComplianceRouter.post("/compliance/bonus/approve", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(bonusService.approve(req.body, req.access));
}));

bonusComplianceRouter.post("/compliance/bonus/disburse", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(bonusService.disburse(req.body, req.access));
}));

bonusComplianceRouter.get("/compliance/bonus/form-c/:fy", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(bonusService.formC(req.params.fy, req.access));
}));
