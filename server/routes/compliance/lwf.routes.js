import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { lwfService } from "../../services/compliance/lwf.service.js";

export const lwfComplianceRouter = Router();

lwfComplianceRouter.post("/compliance/lwf/calculate", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(lwfService.calculate(req.body, req.access));
}));

lwfComplianceRouter.post("/compliance/lwf/calculate-batch", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(lwfService.calculateBatch(req.body, req.access));
}));

lwfComplianceRouter.get("/compliance/lwf/contributions", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(lwfService.list(req.query, req.access));
}));

lwfComplianceRouter.post("/compliance/lwf/rate-update", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(lwfService.rateUpdate(req.body, req.access));
}));
