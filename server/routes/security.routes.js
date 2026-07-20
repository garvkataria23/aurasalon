import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { securityService } from "../services/security.service.js";

export const securityRouter = Router();

securityRouter.get(
  "/security/summary",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.summary(req.query, req.access));
  })
);

securityRouter.post(
  "/security/audit",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.status(201).json(securityService.audit(req.body, req.access, req));
  })
);

securityRouter.get(
  "/security/audit",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json({ auditLogs: securityService.auditTrail(req.query, req.access) });
  })
);

securityRouter.post(
  "/security/sessions",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.status(201).json(securityService.createSession(req.body, req.access, req));
  })
);

securityRouter.patch(
  "/security/sessions/:id/revoke",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.revokeSession(req.params.id, req.access, req));
  })
);

securityRouter.post(
  "/security/permissions",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.status(201).json(securityService.upsertPermission(req.body, req.access, req));
  })
);

securityRouter.get(
  "/security/permission-matrix",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.permissionMatrix(req.access));
  })
);

securityRouter.get(
  "/security/user-management",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.userManagement(req.access));
  })
);

securityRouter.post(
  "/security/users",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.status(201).json(securityService.createTenantUser(req.body, req.access, req));
  })
);

securityRouter.patch(
  "/security/users/:id",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.updateTenantUser(req.params.id, req.body, req.access, req));
  })
);

securityRouter.delete(
  "/security/users/:id",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.disableTenantUser(req.params.id, req.access, req));
  })
);

securityRouter.post(
  "/security/roles",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.status(201).json(securityService.upsertRoleDefinition(req.body, req.access, req));
  })
);

securityRouter.get(
  "/security/compliance",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.complianceSummary(req.query, req.access));
  })
);

securityRouter.post(
  "/security/encrypt",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.status(201).json(securityService.encryptSecret(req.body, req.access, req));
  })
);

securityRouter.post(
  "/security/backups",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.status(201).json(securityService.createBackup(req.body, req.access, req));
  })
);

securityRouter.get(
  "/security/activity/:userId",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(securityService.activityByUser(req.params.userId, req.access));
  })
);
