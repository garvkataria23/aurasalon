import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { securityBlocklistService } from "../services/security-blocklist.service.js";
import { forbidden } from "../utils/app-error.js";

const ALLOWED_ROLES = new Set(["owner", "admin", "superAdmin"]);

function requireSecurityOwner(access = {}) {
  if (!ALLOWED_ROLES.has(access.role)) throw forbidden("Security blocklist is available for owner/admin accounts only");
}

export const securityBlocklistRouter = Router();

securityBlocklistRouter.get(
  "/security/blocklist",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireSecurityOwner(req.access);
    res.json({ blocks: securityBlocklistService.list(req.query, req.access) });
  })
);

securityBlocklistRouter.post(
  "/security/blocklist/:id/unblock",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireSecurityOwner(req.access);
    res.json(securityBlocklistService.unblock(req.params.id, req.access));
  })
);
