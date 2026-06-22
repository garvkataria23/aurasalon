import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { tdsService } from "../../services/compliance/tds.service.js";

export const tdsComplianceRouter = Router();

tdsComplianceRouter.post("/compliance/tds/calculate", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(tdsService.calculate(req.body, req.access));
}));

tdsComplianceRouter.post("/compliance/tds/calculate-batch", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(tdsService.calculateBatch(req.body, req.access));
}));

tdsComplianceRouter.post("/compliance/tds/declaration", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(tdsService.declaration(req.body, req.access));
}));

tdsComplianceRouter.get("/compliance/tds/declaration/:staffId/:fy", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(tdsService.getDeclaration(req.params.staffId, req.params.fy, req.access));
}));

tdsComplianceRouter.post("/compliance/tds/declaration/lock", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(tdsService.lockDeclaration(req.body, req.access));
}));

tdsComplianceRouter.post("/compliance/tds/proof-upload", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(tdsService.markProof({ ...req.body, verified: false }, req.access));
}));

tdsComplianceRouter.post("/compliance/tds/proof-verify", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(tdsService.markProof({ ...req.body, verified: true }, req.access));
}));

tdsComplianceRouter.post("/compliance/tds/generate-form-24q", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(tdsService.generateForm24q(req.body, req.access));
}));

tdsComplianceRouter.post("/compliance/tds/generate-form-16", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(tdsService.generateForm16(req.body, req.access));
}));

tdsComplianceRouter.get("/compliance/tds/form-16/:staffId/:fy/download", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  const file = tdsService.downloadForm16(req.params.staffId, req.params.fy, req.access);
  res.type("application/pdf").send(file.content);
}));

tdsComplianceRouter.get("/compliance/tds/regime-comparison/:staffId/:fy", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(tdsService.regimeComparison(req.params.staffId, req.params.fy, req.access));
}));
