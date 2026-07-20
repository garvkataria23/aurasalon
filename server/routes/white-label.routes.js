import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { whiteLabelService } from "../services/white-label.service.js";

export const whiteLabelRouter = Router();

whiteLabelRouter.get(
  "/white-label/summary",
  requirePermission("read", () => "white-label"),
  asyncHandler((req, res) => {
    res.json(whiteLabelService.summary(req.query, req.access));
  })
);

whiteLabelRouter.get(
  "/white-label/resolve",
  requirePermission("read", () => "white-label"),
  asyncHandler((req, res) => {
    res.json(whiteLabelService.resolve(req.query, req.access));
  })
);

whiteLabelRouter.post(
  "/white-label/profiles",
  requirePermission("write", () => "white-label"),
  asyncHandler((req, res) => {
    res.status(201).json(whiteLabelService.upsertProfile(req.body, req.access));
  })
);

whiteLabelRouter.post(
  "/white-label/branch-branding",
  requirePermission("write", () => "white-label"),
  asyncHandler((req, res) => {
    res.status(201).json(whiteLabelService.upsertBranchBranding(req.body, req.access));
  })
);

whiteLabelRouter.post(
  "/white-label/domains",
  requirePermission("write", () => "white-label"),
  asyncHandler((req, res) => {
    res.status(201).json(whiteLabelService.mapDomain(req.body, req.access));
  })
);
