import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { intrusionDetectionService } from "../services/intrusion-detection.service.js";
import { forbidden } from "../utils/app-error.js";
import { isOwnerControlRole } from "../services/access-control.service.js";

const ALLOWED_ROLES = new Set(["owner", "admin", "superAdmin"]);

function requireSecurityOwner(access = {}) {
  if (!isOwnerControlRole(access.role) && !ALLOWED_ROLES.has(access.role)) throw forbidden("Security alerts are available for owner/admin accounts only");
}

export const securityAlertsRouter = Router();

securityAlertsRouter.get(
  "/security/alerts",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireSecurityOwner(req.access);
    res.json({ alerts: intrusionDetectionService.listAlerts(req.query, req.access) });
  })
);

securityAlertsRouter.get(
  "/security/alerts/summary",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireSecurityOwner(req.access);
    res.json(intrusionDetectionService.summary(req.access));
  })
);

securityAlertsRouter.post(
  "/security/alerts/:id/resolve",
  authenticateJwt(),
  asyncHandler((req, res) => {
    requireSecurityOwner(req.access);
    res.json(intrusionDetectionService.resolveAlert(req.params.id, req.access));
  })
);
