import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { pfService } from "../../services/compliance/pf.service.js";

export const pfComplianceRouter = Router();

pfComplianceRouter.post("/compliance/pf/calculate", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(pfService.calculate(req.body, req.access));
}));

pfComplianceRouter.post("/compliance/pf/calculate-batch", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(pfService.calculateBatch(req.body, req.access));
}));

pfComplianceRouter.get("/compliance/pf/contributions", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(pfService.list(req.query, req.access));
}));

pfComplianceRouter.get("/compliance/pf/contributions/:staffId", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(pfService.byStaff(req.params.staffId, req.access));
}));

pfComplianceRouter.post("/compliance/pf/generate-ecr", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(pfService.generateEcr(req.body, req.access));
}));

pfComplianceRouter.get("/compliance/pf/ecr-files", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(pfService.ecrFiles(req.query, req.access));
}));

pfComplianceRouter.get("/compliance/pf/ecr-files/:id/download", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  const file = pfService.downloadEcr(req.params.id, req.access);
  res.type("text/plain").send(file.content);
}));

pfComplianceRouter.post("/compliance/pf/mark-paid", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(pfService.markPaid(req.body, req.access));
}));

pfComplianceRouter.get("/compliance/pf/challan/:trrn", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(pfService.challan(req.params.trrn, req.access));
}));

pfComplianceRouter.get("/compliance/pf/annual-return/:fy", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(pfService.annualReturn(req.params.fy, req.access));
}));

pfComplianceRouter.post("/compliance/pf/rate-update", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(pfService.rateUpdate(req.body, req.access));
}));
