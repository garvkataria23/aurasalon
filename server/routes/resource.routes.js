import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateResourceName, validateResourcePayload } from "../validators/request-validator.js";
import { resourceService } from "../services/resource.service.js";
import { realtimeService } from "../services/realtime.service.js";
import { securityService } from "../services/security.service.js";

export const resourceRouter = Router();

resourceRouter.param("resource", validateResourceName);

resourceRouter.get(
  "/:resource",
  requirePermission("read"),
  asyncHandler((req, res) => {
    res.json(resourceService.list(req.params.resource, req.query, req.access));
  })
);

resourceRouter.get(
  "/:resource/:id",
  requirePermission("read"),
  asyncHandler((req, res) => {
    res.json(resourceService.get(req.params.resource, req.params.id, req.access));
  })
);

resourceRouter.post(
  "/:resource",
  requirePermission("write"),
  validateResourcePayload,
  asyncHandler((req, res) => {
    const row = resourceService.create(req.params.resource, req.body, req.access);
    auditResource(req, "created", row);
    emitResourceEvent(req.params.resource, "created", row, req.access);
    res.status(201).json(row);
  })
);

resourceRouter.patch(
  "/:resource/:id",
  requirePermission("write"),
  asyncHandler((req, res) => {
    const row = resourceService.update(req.params.resource, req.params.id, req.body, req.access);
    auditResource(req, "updated", row);
    emitResourceEvent(req.params.resource, "updated", row, req.access);
    res.json(row);
  })
);

resourceRouter.delete(
  "/:resource/:id",
  requirePermission("write"),
  asyncHandler((req, res) => {
    const deleted = resourceService.delete(req.params.resource, req.params.id, req.access);
    if (deleted) auditResource(req, "deleted", { id: req.params.id });
    if (deleted) emitResourceEvent(req.params.resource, "deleted", { id: req.params.id, branchId: req.body?.branchId || "" }, req.access);
    res.json({ deleted });
  })
);

function auditResource(req, action, row) {
  const resource = req.params.resource;
  const specialActions = {
    "appointments.created": "booking.created",
    "invoices.updated": "bill.edited",
    "invoices.deleted": "bill.deleted",
    "clients.deleted": "client.deleted",
    "payments.created": "payment.created",
    "payments.updated": "payment.updated",
    "payments.deleted": "payment.deleted"
  };
  const auditAction = specialActions[`${resource}.${action}`] || `${resource}.${action}`;
  securityService.audit({
    action: auditAction,
    targetType: resource,
    targetId: row?.id || req.params.id || "",
    details: {
      method: req.method,
      body: sanitizeAuditBody(req.body || {}),
      resource,
      action
    },
    severity: action === "deleted" ? "warning" : "info"
  }, req.access, req);
}

function sanitizeAuditBody(body) {
  const copy = { ...body };
  delete copy.value;
  delete copy.password;
  delete copy.token;
  return copy;
}

function emitResourceEvent(resource, action, row, access) {
  if (resource === "appointments" && row?.id) {
    realtimeService.bookingUpdated(access, row, action);
    return;
  }
  if (resource === "notifications" && row?.id) {
    realtimeService.broadcast("notification.instant", { action, notification: row }, {
      tenantId: access.tenantId,
      branchId: row.branchId || access.branchId || "",
      channel: row.branchId ? `branch:${row.branchId}` : `tenant:${access.tenantId}`
    });
    return;
  }
  if (["sales", "payments", "invoices", "inventory", "products"].includes(resource)) {
    realtimeService.dashboardUpdated(access, row?.branchId || access.branchId || "", { source: resource, action, id: row?.id });
  }
}
