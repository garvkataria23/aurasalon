import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { ptService } from "../../services/compliance/pt.service.js";

export const ptComplianceRouter = Router();

ptComplianceRouter.post("/compliance/pt/calculate", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(ptService.calculate(req.body, req.access));
}));

ptComplianceRouter.post("/compliance/pt/calculate-batch", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(ptService.calculateBatch(req.body, req.access));
}));

ptComplianceRouter.get("/compliance/pt/slabs/:stateCode", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(ptService.slabs(req.params.stateCode, req.access));
}));

ptComplianceRouter.post("/compliance/pt/slabs/update", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(ptService.updateSlab(req.body, req.access));
}));

ptComplianceRouter.get("/compliance/pt/deductions", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(ptService.list(req.query, req.access));
}));

ptComplianceRouter.post("/compliance/pt/generate-return", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(ptService.generateReturn(req.body, req.access));
}));

ptComplianceRouter.get("/compliance/pt/returns", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(ptService.returns(req.query, req.access));
}));
