import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { deploymentService } from "../services/deployment.service.js";

export const deploymentRouter = Router();

deploymentRouter.get(
  "/deployment/summary",
  requirePermission("read", () => "deployment"),
  asyncHandler((req, res) => {
    res.json(deploymentService.summary(req.query, req.access));
  })
);

deploymentRouter.post(
  "/deployment/preflight",
  requirePermission("write", () => "deployment"),
  asyncHandler((req, res) => {
    res.status(201).json(deploymentService.preflight(req.body, req.access, req));
  })
);

deploymentRouter.post(
  "/deployment/backup",
  requirePermission("write", () => "deployment"),
  asyncHandler((req, res) => {
    res.status(201).json(deploymentService.backup(req.body, req.access, req));
  })
);

deploymentRouter.post(
  "/deployment/events",
  requirePermission("write", () => "deployment"),
  asyncHandler((req, res) => {
    res.status(201).json(deploymentService.record(req.body, req.access, req));
  })
);
