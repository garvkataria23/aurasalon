import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { repositoryForTable } from "../repositories/repository-registry.js";
import { tenantService } from "../services/tenant.service.js";
import { validateBody } from "../validators/request-validator.js";

export const saasRouter = Router();

saasRouter.get(
  "/saas/context",
  asyncHandler((req, res) => {
    res.json(tenantService.getContext(req.access));
  })
);

saasRouter.get(
  "/saas/plans",
  asyncHandler((_req, res) => {
    res.json(repositoryForTable("subscription_plans").list({ limit: 100 }));
  })
);

saasRouter.post(
  "/saas/onboarding",
  validateBody({ required: ["salonName", "ownerEmail"] }),
  asyncHandler((req, res) => {
    res.status(201).json(tenantService.onboardTenant(req.body));
  })
);

saasRouter.get(
  "/saas/usage",
  requirePermission("read", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.usageSummary(req.access.tenantId));
  })
);

saasRouter.get(
  "/saas/billing-preview",
  requirePermission("read", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.billingPreview(req.access.tenantId, req.query.periodStart));
  })
);

saasRouter.get(
  "/saas/features",
  requirePermission("read", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.featureAccess(req.access.tenantId));
  })
);

saasRouter.get(
  "/saas/tenant-health",
  requirePermission("read", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.tenantHealth(req.access.tenantId));
  })
);

saasRouter.get(
  "/saas/subscription-limits",
  requirePermission("read", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.subscriptionLimits(req.access.tenantId));
  })
);

saasRouter.get(
  "/saas/usage-based-billing",
  requirePermission("read", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.usageBasedBilling(req.access.tenantId, req.query.periodStart));
  })
);

saasRouter.get(
  "/saas/white-label-readiness",
  requirePermission("read", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.whiteLabelReadiness(req.access.tenantId));
  })
);

saasRouter.post(
  "/saas/domain-mappings",
  requirePermission("write", () => "tenants"),
  validateBody({ required: ["domain"] }),
  asyncHandler((req, res) => {
    res.status(201).json(tenantService.addDomain(req.access, req.body));
  })
);

saasRouter.post(
  "/saas/domain-mappings/:id/verify",
  requirePermission("write", () => "tenants"),
  asyncHandler((req, res) => {
    res.json(tenantService.verifyDomain(req.access, req.params.id));
  })
);

saasRouter.patch(
  "/saas/subscription",
  requirePermission("write", () => "tenants"),
  validateBody({ required: ["planId"] }),
  asyncHandler((req, res) => {
    res.json(tenantService.switchPlan(req.access, req.body.planId));
  })
);
