import { logger } from "../utils/logger.js";
import { tenantService } from "../services/tenant.service.js";

export function requestContext(req, res, next) {
  const startedAt = Date.now();
  req.requestId = crypto.randomUUID();
  const tenant = tenantService.resolveTenant({
    tenantId: req.get("x-tenant-id") || "",
    host: req.get("x-forwarded-host") || req.get("host") || ""
  });
  const requestedBranchId = req.get("x-branch-id") || "";
  const user = tenantService.getTenantUser({
    tenantId: tenant?.id,
    userId: req.get("x-user-id") || "system-user",
    email: req.get("x-user-email") || "",
    fallbackRole: req.get("x-user-role") || "owner",
    fallbackBranchId: requestedBranchId
  });
  const headerRole = req.get("x-user-role");
  user.role = headerRole || user.role;
  user.branchId = requestedBranchId || user.branchId || user.branchIds?.[0] || "";
  if (headerRole && ["staff", "frontDesk"].includes(headerRole) && requestedBranchId) {
    user.branchIds = [requestedBranchId];
    user.branchId = requestedBranchId;
  }

  req.tenant = tenant;
  req.user = user;
  req.access = {
    tenantId: tenant?.id,
    role: user.role,
    userId: user.id,
    branchId: user.branchId,
    branchIds: user.branchIds || [],
    requestedBranchId
  };
  res.setHeader("x-request-id", req.requestId);
  res.setHeader("x-tenant-id", tenant?.id || "");

  res.on("finish", () => {
    logger.info("http_request", {
      requestId: req.requestId,
      method: req.method,
      path: req.originalUrl,
      status: res.statusCode,
      durationMs: Date.now() - startedAt,
      tenantId: tenant?.id,
      userRole: req.user.role
    });
  });

  next();
}
