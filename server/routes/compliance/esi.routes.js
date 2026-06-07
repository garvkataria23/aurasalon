import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { esiService } from "../../services/compliance/esi.service.js";

export const esiComplianceRouter = Router();

esiComplianceRouter.post("/compliance/esi/calculate", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(esiService.calculate(req.body, req.access));
}));

esiComplianceRouter.post("/compliance/esi/calculate-batch", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(esiService.calculateBatch(req.body, req.access));
}));

esiComplianceRouter.get("/compliance/esi/contributions", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(esiService.list(req.query, req.access));
}));

esiComplianceRouter.post("/compliance/esi/generate-return", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(esiService.generateReturn(req.body, req.access));
}));

esiComplianceRouter.get("/compliance/esi/returns", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(esiService.returns(req.query, req.access));
}));

esiComplianceRouter.get("/compliance/esi/returns/:id/download", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  const file = esiService.downloadReturn(req.params.id, req.access);
  res.type("text/csv").send(file.content);
}));

esiComplianceRouter.get("/compliance/esi/applicability-check/:staffId", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(esiService.applicabilityCheck(req.params.staffId, req.access));
}));

esiComplianceRouter.post("/compliance/esi/mark-paid", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(esiService.markPaid(req.body, req.access));
}));
