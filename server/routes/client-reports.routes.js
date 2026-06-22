import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { clientReportsService } from "../services/client-reports.service.js";

export const clientReportsRouter = Router();

clientReportsRouter.get(
  "/reports/clients/top-rfm",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(clientReportsService.topRfm(req.query, req.access));
  })
);

clientReportsRouter.get(
  "/reports/clients/lapsed",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(clientReportsService.lapsed(req.query, req.access));
  })
);

clientReportsRouter.get(
  "/reports/clients/new-vs-returning",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(clientReportsService.newVsReturning(req.query, req.access));
  })
);

clientReportsRouter.get(
  "/reports/clients/occasions",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(clientReportsService.occasions(req.query, req.access));
  })
);

clientReportsRouter.get(
  "/reports/clients/by-service",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(clientReportsService.byService(req.query, req.access));
  })
);

clientReportsRouter.get(
  "/reports/clients/:id/360",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(clientReportsService.client360(req.params.id, req.query, req.access));
  })
);
