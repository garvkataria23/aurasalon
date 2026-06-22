import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { qualityService } from "../services/quality.service.js";

export const qualityRouter = Router();

qualityRouter.get(
  "/quality/summary",
  requirePermission("read", () => "quality"),
  asyncHandler((req, res) => {
    res.json(qualityService.summary(req.query, req.access));
  })
);

qualityRouter.post(
  "/quality/run",
  requirePermission("write", () => "quality"),
  asyncHandler((req, res) => {
    res.status(201).json(qualityService.run(req.body, req.access, req));
  })
);

qualityRouter.post(
  "/quality/seed-demo",
  requirePermission("write", () => "quality"),
  asyncHandler((req, res) => {
    res.status(201).json(qualityService.seedDemoData(req.body, req.access, req));
  })
);
