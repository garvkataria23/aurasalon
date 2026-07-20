import { AppError } from "../utils/app-error.js";

const buckets = new Map();

export function publicBookingRateLimit({ max = 60, windowMs = 60_000, key = (req) => req.ip || "unknown" } = {}) {
  return (req, _res, next) => {
    const bucketKey = `${key(req)}:${req.path}`;
    const now = Date.now();
    const bucket = buckets.get(bucketKey) || { count: 0, resetAt: now + windowMs };
    if (bucket.resetAt < now) {
      bucket.count = 0;
      bucket.resetAt = now + windowMs;
    }
    bucket.count += 1;
    buckets.set(bucketKey, bucket);
    if (bucket.count > max) {
      next(new AppError("Too many booking requests. Please wait and try again.", 429));
      return;
    }
    next();
  };
}
