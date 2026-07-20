import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { oversightCommandCenterService } from "../services/oversight-command-center.service.js";

export const oversightCommandCenterRouter = Router();

oversightCommandCenterRouter.get(
  "/oversight/summary",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(oversightCommandCenterService.summary(req.query, req.access));
  })
);

oversightCommandCenterRouter.post(
  "/oversight/audit-verify/run",
  requirePermission("write", () => "reports"),
  asyncHandler((req, res) => {
    res.status(201).json(oversightCommandCenterService.runAuditVerify({ ...req.query, ...req.body }, req.access));
  })
);

oversightCommandCenterRouter.get(
  "/oversight/siem/export",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(oversightCommandCenterService.siemExport(req.query, req.access));
  })
);
