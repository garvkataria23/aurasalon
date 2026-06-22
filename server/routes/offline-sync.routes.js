import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { offlinePosSyncService } from "../services/offline-pos-sync.service.js";

export const offlineSyncRouter = Router();

offlineSyncRouter.post("/offline-sync/push", requirePermission("write", () => "offline"), asyncHandler((req, res) => {
  res.status(201).json(offlinePosSyncService.push(req.body, req.access));
}));
offlineSyncRouter.get("/offline-sync/pull", requirePermission("read", () => "offline"), asyncHandler((req, res) => {
  res.json(offlinePosSyncService.pull(req.query, req.access));
}));
offlineSyncRouter.get("/offline-sync/conflicts", requirePermission("read", () => "offline"), asyncHandler((req, res) => {
  res.json(offlinePosSyncService.conflicts(req.access));
}));
offlineSyncRouter.post("/offline-sync/conflicts/:id/resolve", requirePermission("write", () => "offline"), asyncHandler((req, res) => {
  res.json(offlinePosSyncService.resolveConflict(req.params.id, req.body, req.access));
}));
offlineSyncRouter.get("/offline-sync/status", requirePermission("read", () => "offline"), asyncHandler((req, res) => {
  res.json(offlinePosSyncService.status(req.access));
}));
