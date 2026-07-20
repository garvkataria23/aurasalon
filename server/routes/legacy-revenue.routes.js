import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { legacyRevenueService } from "../services/legacy-revenue.service.js";

export const legacyRevenueRouter = Router();

legacyRevenueRouter.get(
  "/reports/inward-revenue/imports",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(legacyRevenueService.imports(req.access, req.query));
  })
);

legacyRevenueRouter.post(
  "/reports/inward-revenue/preview",
  requirePermission("write", () => "reports"),
  asyncHandler((req, res) => {
    res.json(legacyRevenueService.preview(req.body || {}, req.access));
  })
);

legacyRevenueRouter.post(
  "/reports/inward-revenue/import",
  requirePermission("write", () => "reports"),
  asyncHandler((req, res) => {
    res.status(201).json(legacyRevenueService.import(req.body || {}, req.access));
  })
);

legacyRevenueRouter.get(
  "/reports/inward-revenue",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(legacyRevenueService.report(req.access, req.query));
  })
);

legacyRevenueRouter.get(
  "/reports/inward-revenue/invoice/:id",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(legacyRevenueService.invoice(req.params.id, req.access));
  })
);
