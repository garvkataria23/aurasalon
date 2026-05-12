import { AppError } from "../utils/app-error.js";
import { securityService } from "../services/security.service.js";

const windows = new Map();
const WINDOW_MS = 60 * 1000;
const MAX_REQUESTS = 240;

function keyFor(req) {
  return [req.access?.tenantId || "public", req.access?.userId || req.ip || "anonymous", req.path.split("/").slice(0, 4).join("/")].join(":");
}

export function enterpriseSecurity(req, res, next) {
  const startedAt = Date.now();
  res.setHeader("x-content-type-options", "nosniff");
  res.setHeader("x-frame-options", "SAMEORIGIN");
  res.setHeader("referrer-policy", "strict-origin-when-cross-origin");
  res.setHeader("permissions-policy", "camera=(), microphone=(), geolocation=()");

  const key = keyFor(req);
  const current = Date.now();
  const bucket = windows.get(key) || { count: 0, resetAt: current + WINDOW_MS };
  if (bucket.resetAt <= current) {
    bucket.count = 0;
    bucket.resetAt = current + WINDOW_MS;
  }
  bucket.count += 1;
  windows.set(key, bucket);
  res.setHeader("x-ratelimit-limit", String(MAX_REQUESTS));
  res.setHeader("x-ratelimit-remaining", String(Math.max(0, MAX_REQUESTS - bucket.count)));
  res.setHeader("x-ratelimit-reset", new Date(bucket.resetAt).toISOString());
  if (bucket.count > MAX_REQUESTS) {
    next(new AppError("Rate limit exceeded", 429, { resetAt: bucket.resetAt }));
    return;
  }

  res.on("finish", () => {
    securityService.recordActivity(req, res.statusCode, Date.now() - startedAt);
  });
  next();
}
