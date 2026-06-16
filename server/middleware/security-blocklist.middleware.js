import { env } from "../config/env.js";
import { securityBlocklistService } from "../services/security-blocklist.service.js";
import { forbidden } from "../utils/app-error.js";

function cleanIp(value = "") {
  return String(value || "").replace(/^::ffff:/, "");
}

function isLocalIp(ip) {
  return ["127.0.0.1", "::1", "localhost"].includes(cleanIp(ip));
}

export function securityBlocklistMiddleware(req, _res, next) {
  try {
    const ip = cleanIp(req.ip || req.socket?.remoteAddress || "");
    const tenantId = req.access?.tenantId || req.get("x-tenant-id") || req.body?.tenantId || req.query?.tenantId || "";
    const userId = req.access?.userId || "";

    if (env.nodeEnv !== "production" && isLocalIp(ip) && process.env.SECURITY_BLOCK_LOCALHOST !== "true") {
      next();
      return;
    }

    const block = securityBlocklistService.findActiveBlock({ tenantId, ipAddress: ip, userId });
    if (block) {
      next(forbidden(`Request blocked by security protection until ${block.blockedUntil}`));
      return;
    }
  } catch {
    // Blocklist lookup should fail open so security storage issues do not break normal traffic.
  }
  next();
}
