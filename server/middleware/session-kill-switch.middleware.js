import { unauthorized } from "../utils/app-error.js";
import { securityAdvancedService } from "../services/security-advanced.service.js";

export function sessionKillSwitchMiddleware(req, _res, next) {
  try {
    if (req.access?.tenantId && securityAdvancedService.isSessionRevoked(req.access)) {
      next(unauthorized("Session has been signed out by owner/admin"));
      return;
    }
  } catch {
    // Revocation lookup must not break unrelated requests.
  }
  next();
}
