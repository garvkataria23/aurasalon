import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { offlineService } from "../services/offline.service.js";

export const offlineRouter = Router();

offlineRouter.get(
  "/offline/summary",
  requirePermission("read", () => "offline"),
  asyncHandler((req, res) => {
    res.json(offlineService.summary(req.query, req.access));
  })
);

offlineRouter.get(
  "/offline/retry-dashboard",
  requirePermission("read", () => "offline"),
  asyncHandler((req, res) => {
    res.json(offlineService.retryDashboard(req.query, req.access));
  })
);

offlineRouter.get(
  "/offline/device-sync-status",
  requirePermission("read", () => "offline"),
  asyncHandler((req, res) => {
    res.json(offlineService.deviceSyncStatus(req.query, req.access));
  })
);

offlineRouter.post(
  "/offline/cache-snapshots",
  requirePermission("write", () => "offline"),
  asyncHandler((req, res) => {
    res.status(201).json(offlineService.createSnapshot(req.body, req.access));
  })
);

offlineRouter.post(
  "/offline/sync-items",
  requirePermission("write", () => "offline"),
  asyncHandler((req, res) => {
    res.status(201).json(offlineService.enqueue(req.body, req.access));
  })
);

offlineRouter.post(
  "/offline/sync",
  requirePermission("write", () => "offline"),
  asyncHandler((req, res) => {
    res.json(offlineService.sync(req.body, req.access));
  })
);

offlineRouter.post(
  "/offline/sync-items/:id/retry",
  requirePermission("write", () => "offline"),
  asyncHandler((req, res) => {
    res.json(offlineService.retrySyncItem(req.params.id, req.body, req.access));
  })
);

offlineRouter.post(
  "/offline/appointments",
  requirePermission("write", () => "offline"),
  asyncHandler((req, res) => {
    res.status(201).json(offlineService.offlineAppointment(req.body, req.access));
  })
);

offlineRouter.post(
  "/offline/billing",
  requirePermission("write", () => "offline"),
  asyncHandler((req, res) => {
    res.status(201).json(offlineService.offlineBilling(req.body, req.access));
  })
);
