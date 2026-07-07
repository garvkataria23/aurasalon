import { authService } from "../services/auth.service.js";
import { tenantService } from "../services/tenant.service.js";
import { db } from "../db.js";
import { ensureTenantUserAccessColumns, normalizeRole } from "../services/access-control.service.js";
import { unauthorized } from "../utils/app-error.js";

function bearerToken(req) {
  const header = req.get("authorization") || "";
  const [scheme, token] = header.split(" ");
  return scheme?.toLowerCase() === "bearer" ? token : "";
}

export function authenticateJwt({ required = true } = {}) {
  return (req, _res, next) => {
    const token = bearerToken(req);
    if (!token) {
      if (required) {
        next(unauthorized());
        return;
      }
      next();
      return;
    }
    try {
      const payload = authService.verifyAccessToken(token);
      ensureTenantUserAccessColumns();
      const userRow = db.prepare("SELECT status, permissionVersion FROM tenant_users WHERE tenantId = @tenantId AND id = @id").get({ tenantId: payload.tenantId, id: payload.sub });
      if (!userRow || userRow.status !== "active") throw unauthorized("User session is no longer active");
      if (Number(userRow.permissionVersion || 1) !== Number(payload.permissionVersion || 1)) throw unauthorized("User permissions changed; please sign in again");
      payload.role = normalizeRole(payload.role);
      const requestedBranchId = req.get("x-branch-id") || payload.branchId || "";
      if (requestedBranchId) tenantService.assertBranchAccess(payload, requestedBranchId);
      const tenant = tenantService.resolveTenant({ tenantId: payload.tenantId, host: req.get("host") || "" });
      req.auth = payload;
      req.tenant = tenant;
      req.user = {
        id: payload.sub,
        email: payload.email,
        loginId: payload.loginId || "",
        role: payload.role,
        staffId: payload.staffId || "",
        branchId: requestedBranchId || payload.branchId || "",
        branchIds: payload.branchIds || [],
        permissions: payload.permissions || []
      };
      req.access = {
        tenantId: payload.tenantId,
        role: payload.role,
        userId: payload.sub,
        staffId: payload.staffId || "",
        loginId: payload.loginId || "",
        branchId: requestedBranchId || payload.branchId || "",
        branchIds: payload.branchIds || [],
        permissions: payload.permissions || [],
        requestedBranchId,
        deviceId: payload.deviceId || "",
        jti: payload.jti || "",
        iat: payload.iat || 0
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
