import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { siteLogsService } from "../services/site-logs.service.js";

export const siteLogsRouter = Router();

siteLogsRouter.get(
  "/site-logs/overview",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(siteLogsService.overview(req.query, req.access));
  })
);

siteLogsRouter.get(
  "/site-logs",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(siteLogsService.list(req.query, req.access));
  })
);

siteLogsRouter.get(
  "/site-logs/:id",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(siteLogsService.detail(String(req.params.id || ""), req.access));
  })
);
