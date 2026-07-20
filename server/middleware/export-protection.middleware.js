import { forbidden } from "../utils/app-error.js";
import { securityAdvancedService } from "../services/security-advanced.service.js";

export function exportProtectionMiddleware(req, _res, next) {
  try {
    const result = securityAdvancedService.inspectExportRequest(req);
    if (result.exportRequest && result.protected && !result.allowed) {
      next(forbidden("Security PIN verification required for export/download actions"));
      return;
    }
    next();
  } catch {
    next();
  }
}
