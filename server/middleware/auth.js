import { authService } from "../services/auth.service.js";
import { tenantService } from "../services/tenant.service.js";
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
      const requestedBranchId = req.get("x-branch-id") || payload.branchId || "";
      if (requestedBranchId) tenantService.assertBranchAccess(payload, requestedBranchId);
      const tenant = tenantService.resolveTenant({ tenantId: payload.tenantId, host: req.get("host") || "" });
      req.auth = payload;
      req.tenant = tenant;
      req.user = {
        id: payload.sub,
        email: payload.email,
        role: payload.role,
        branchId: requestedBranchId || payload.branchId || "",
        branchIds: payload.branchIds || []
      };
      req.access = {
        tenantId: payload.tenantId,
        role: payload.role,
        userId: payload.sub,
        branchId: requestedBranchId || payload.branchId || "",
        branchIds: payload.branchIds || [],
        requestedBranchId,
        deviceId: payload.deviceId || ""
      };
      next();
    } catch (error) {
      next(error);
    }
  };
}
