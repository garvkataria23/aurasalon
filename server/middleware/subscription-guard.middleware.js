import { forbidden } from "../utils/app-error.js";
import { securityAdvancedService } from "../services/security-advanced.service.js";

export function subscriptionGuardMiddleware(req, _res, next) {
  try {
    const result = securityAdvancedService.inspectSubscriptionGuard(req);
    if (result.guarded && !result.allowed) {
      next(forbidden("Subscription guard has locked this premium module. Please renew or contact owner/admin."));
      return;
    }
  } catch {
    // Subscription guard failures should not block core operations.
  }
  next();
}
