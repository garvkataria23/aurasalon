import { Router } from "express";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { fyClosureService } from "../../services/compliance/fy-closure.service.js";

export const fyComplianceRouter = Router();

fyComplianceRouter.post("/compliance/fy/close/:fy", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(fyClosureService.close(req.params.fy, req.body, req.access));
}));

fyComplianceRouter.post("/compliance/fy/reopen/:fy", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(fyClosureService.reopen(req.params.fy, req.body, req.access));
}));

fyComplianceRouter.get("/compliance/fy/status/:fy", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(fyClosureService.status(req.params.fy, req.access));
}));
