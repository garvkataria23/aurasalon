import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { gratuityService } from "../../services/compliance/gratuity.service.js";

export const gratuityComplianceRouter = Router();

gratuityComplianceRouter.post("/compliance/gratuity/calculate/:staffId", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(gratuityService.calculate(req.params.staffId, req.body, req.access));
}));

gratuityComplianceRouter.post("/compliance/gratuity/provision-monthly", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(gratuityService.provisionMonthly(req.body, req.access));
}));

gratuityComplianceRouter.get("/compliance/gratuity/provisions", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(gratuityService.provisions(req.query, req.access));
}));

gratuityComplianceRouter.post("/compliance/gratuity/payout", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(gratuityService.payout(req.body, req.access));
}));

gratuityComplianceRouter.get("/compliance/gratuity/eligible-staff", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(gratuityService.eligibleStaff(req.query, req.access));
}));
