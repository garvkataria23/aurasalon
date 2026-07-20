import { env } from "../config/env.js";

const HSTS_VALUE = "max-age=63072000; includeSubDomains; preload";

const CSP_API_VALUE = [
  "default-src 'self'",
  "script-src 'self'",
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self'",
  "connect-src 'self'",
  "frame-ancestors 'none'",
  "base-uri 'self'",
  "form-action 'self'"
].join("; ");

export function securityHeadersPlus(req, res, next) {
  const forwardedProto = String(req.get("x-forwarded-proto") || "").toLowerCase();
  const isHttps = req.secure || forwardedProto === "https";

  if (isHttps || env.nodeEnv === "production") {
    res.setHeader("strict-transport-security", HSTS_VALUE);
  }

  res.setHeader("content-security-policy", CSP_API_VALUE);
  res.setHeader("x-xss-protection", "0");
  res.setHeader("cross-origin-opener-policy", "same-origin");
  res.setHeader("cross-origin-resource-policy", "same-origin");
  res.removeHeader("x-powered-by");

  next();
}
