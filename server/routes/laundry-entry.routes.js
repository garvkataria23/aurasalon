import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { laundryEntryService } from "../services/laundry-entry.service.js";

export const laundryEntryRouter = Router();

laundryEntryRouter.get(
  "/inventory/laundry-entries/context",
  requirePermission("read", () => "inventory"),
  asyncHandler((req, res) => {
    res.json(laundryEntryService.context(req.query, req.access));
  })
);

laundryEntryRouter.get(
  "/inventory/laundry-entries",
  requirePermission("read", () => "inventory"),
  asyncHandler((req, res) => {
    res.json(laundryEntryService.list(req.query, req.access));
  })
);

laundryEntryRouter.get(
  "/inventory/laundry-entries/:id",
  requirePermission("read", () => "inventory"),
  asyncHandler((req, res) => {
    res.json(laundryEntryService.detail(req.params.id, req.access));
  })
);

laundryEntryRouter.post(
  "/inventory/laundry-entries",
  requirePermission("write", () => "inventory"),
  asyncHandler((req, res) => {
    res.status(201).json(laundryEntryService.create(req.body, req.access));
  })
);
