import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { migrationService } from "../services/migration.service.js";

export const migrationRouter = Router();

migrationRouter.get(
  "/migration/adapters",
  requirePermission("read"),
  asyncHandler((_req, res) => {
    res.json(migrationService.adapters());
  })
);

migrationRouter.get(
  "/migration/templates",
  requirePermission("read"),
  asyncHandler((_req, res) => {
    res.json(migrationService.templates());
  })
);

migrationRouter.get(
  "/migration/templates/:resource",
  requirePermission("read"),
  asyncHandler((req, res) => {
    res.json(migrationService.templates(req.params.resource));
  })
);

migrationRouter.get(
  "/migration/mappings",
  requirePermission("read"),
  asyncHandler((req, res) => {
    res.json(migrationService.mappings(req.access));
  })
);

migrationRouter.post(
  "/migration/mappings",
  requirePermission("write"),
  asyncHandler((req, res) => {
    res.status(201).json(migrationService.saveMapping(req.body, req.access));
  })
);

migrationRouter.get(
  "/migration/onboarding",
  requirePermission("read"),
  asyncHandler((req, res) => {
    res.json(migrationService.onboarding(req.access));
  })
);

migrationRouter.get(
  "/migration/jobs",
  requirePermission("read"),
  asyncHandler((req, res) => {
    res.json(migrationService.jobs(req.access));
  })
);

migrationRouter.get(
  "/migration/jobs/:id",
  requirePermission("read"),
  asyncHandler((req, res) => {
    const job = migrationService.job(req.params.id, req.access);
    if (!job) {
      res.status(404).json({ message: "Migration job not found" });
      return;
    }
    res.json(job);
  })
);

migrationRouter.post(
  "/migration/analyze",
  requirePermission("write"),
  asyncHandler((req, res) => {
    res.json(migrationService.analyze(req.body, req.access));
  })
);

migrationRouter.post(
  "/migration/dry-run",
  requirePermission("write"),
  asyncHandler((req, res) => {
    res.status(201).json(migrationService.dryRun(req.body, req.access));
  })
);

migrationRouter.post(
  "/migration/import",
  requirePermission("write"),
  asyncHandler((req, res) => {
    res.status(201).json(migrationService.import(req.body, req.access));
  })
);

migrationRouter.post(
  "/migration/jobs/:id/rollback",
  requirePermission("write"),
  asyncHandler((req, res) => {
    res.json(migrationService.rollback(req.params.id, req.access, req.body || {}));
  })
);

migrationRouter.post(
  "/migration/rollback",
  requirePermission("write"),
  asyncHandler((req, res) => {
    res.json(migrationService.rollbackByFilter(req.access, req.body || {}));
  })
);

migrationRouter.post(
  "/migration/rollback/last",
  requirePermission("write"),
  asyncHandler((req, res) => {
    res.json(migrationService.rollbackLast(req.access, req.body || {}));
  })
);
