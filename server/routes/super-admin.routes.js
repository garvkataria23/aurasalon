import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { superAdminService } from "../services/super-admin.service.js";
import { validateBody } from "../validators/request-validator.js";

export const superAdminRouter = Router();

superAdminRouter.get(
  "/super-admin/overview",
  asyncHandler((req, res) => {
    res.json(superAdminService.overview(req.access));
  })
);

superAdminRouter.post(
  "/super-admin/analytics/run",
  asyncHandler((req, res) => {
    res.status(201).json(superAdminService.analytics(req.body, req.access));
  })
);

superAdminRouter.patch(
  "/super-admin/tenants/:id/suspension",
  validateBody({ required: ["status"] }),
  asyncHandler((req, res) => {
    res.json(superAdminService.suspendTenant(req.params.id, req.body, req.access));
  })
);

superAdminRouter.patch(
  "/super-admin/tenants/:id/subscription",
  asyncHandler((req, res) => {
    res.json(superAdminService.updateTenantSubscription(req.params.id, req.body, req.access));
  })
);

superAdminRouter.post(
  "/super-admin/plans",
  validateBody({ required: ["name", "code"] }),
  asyncHandler((req, res) => {
    res.status(201).json(superAdminService.createPlan(req.body, req.access));
  })
);

superAdminRouter.patch(
  "/super-admin/plans/:id",
  asyncHandler((req, res) => {
    res.json(superAdminService.updatePlan(req.params.id, req.body, req.access));
  })
);

superAdminRouter.post(
  "/super-admin/feature-toggles",
  validateBody({ required: ["key", "name"] }),
  asyncHandler((req, res) => {
    res.status(201).json(superAdminService.upsertFeatureToggle(req.body, req.access));
  })
);

superAdminRouter.patch(
  "/super-admin/feature-toggles/:id/enabled",
  validateBody({ required: ["enabled"] }),
  asyncHandler((req, res) => {
    res.json(superAdminService.setFeatureToggleEnabled(req.params.id, req.body.enabled, req.access));
  })
);

superAdminRouter.delete(
  "/super-admin/feature-toggles/:id",
  asyncHandler((req, res) => {
    res.json(superAdminService.deleteFeatureToggle(req.params.id, req.access));
  })
);
