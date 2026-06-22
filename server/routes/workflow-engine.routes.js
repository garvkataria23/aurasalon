import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { workflowEngineService } from "../services/workflow-engine.service.js";

export const workflowEngineRouter = Router();

workflowEngineRouter.get(
  "/workflows/summary",
  requirePermission("read", () => "workflows"),
  asyncHandler((req, res) => {
    res.json(workflowEngineService.summary(req.query, req.access));
  })
);

workflowEngineRouter.post(
  "/workflows",
  requirePermission("write", () => "workflows"),
  asyncHandler((req, res) => {
    res.status(201).json(workflowEngineService.createDefinition(req.body, req.access));
  })
);

workflowEngineRouter.patch(
  "/workflows/:id",
  requirePermission("write", () => "workflows"),
  asyncHandler((req, res) => {
    res.json(workflowEngineService.updateDefinition(req.params.id, req.body, req.access));
  })
);

workflowEngineRouter.post(
  "/workflows/:id/run",
  requirePermission("write", () => "workflows"),
  asyncHandler((req, res) => {
    res.status(201).json(workflowEngineService.runWorkflow(req.params.id, req.body, req.access));
  })
);

workflowEngineRouter.post(
  "/workflows/run-due",
  requirePermission("write", () => "workflows"),
  asyncHandler((req, res) => {
    res.status(201).json(workflowEngineService.runDue(req.access));
  })
);
