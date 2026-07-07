import { AppError } from "../utils/app-error.js";
import { securityRateLimitStore } from "../services/security-rate-limit-store.service.js";

function defaultKey(req) {
  return [
    req.ip || req.socket?.remoteAddress || "anonymous",
    req.method || "",
    (req.path || req.originalUrl || "").split("/").slice(0, 4).join("/")
  ].join(":");
}

export function persistentFixedWindowRateLimit({
  scope,
  max = 60,
  windowMs = 60_000,
  keyFn = defaultKey,
  applies = () => true,
  headerPrefix = "x-ratelimit",
  message = "Rate limit exceeded"
} = {}) {
  return (req, res, next) => {
    if (!applies(req)) {
      next();
      return;
    }
    const bucket = securityRateLimitStore.hit({
      tenantId: req.access?.tenantId || req.get?.("x-tenant-id") || "public",
      branchId: req.access?.branchId || req.get?.("x-branch-id") || "",
      scope,
      bucketKey: keyFn(req),
      windowMs
    });
    const resetMs = new Date(bucket.resetAt).getTime();
    res.setHeader(`${headerPrefix}-limit`, String(max));
    res.setHeader(`${headerPrefix}-remaining`, String(Math.max(0, max - bucket.count)));
    res.setHeader(`${headerPrefix}-reset`, bucket.resetAt);
    if (bucket.count > max) {
      const retryAfter = Math.max(1, Math.ceil((resetMs - Date.now()) / 1000));
      res.setHeader("retry-after", String(retryAfter));
      next(new AppError(message, 429, { retryAfter, resetAt: bucket.resetAt }));
      return;
    }
    next();
  };
}
