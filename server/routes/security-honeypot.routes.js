import { Router } from "express";
import { intrusionDetectionService } from "../services/intrusion-detection.service.js";

const HONEYPOT_PATHS = [
  "/admin",
  "/wp-admin",
  "/.env",
  "/phpmyadmin",
  "/server-status",
  "/api/admin/export-all"
];

function tenantIdFor(req) {
  return req.access?.tenantId || req.get("x-tenant-id") || req.body?.tenantId || req.query?.tenantId || "public";
}

function branchIdFor(req) {
  return req.access?.branchId || req.get("x-branch-id") || req.body?.branchId || req.query?.branchId || "";
}

function recordHoneypotHit(req) {
  intrusionDetectionService.raiseAlert({
    tenantId: tenantIdFor(req),
    branchId: branchIdFor(req),
    alertType: "honeypot_probe",
    severity: "critical",
    ipAddress: req.ip || "",
    userId: req.access?.userId || "",
    summary: `Scanner/probing request hit fake security endpoint: ${req.originalUrl || req.path}`,
    details: {
      method: req.method,
      path: req.originalUrl || req.path,
      userAgent: req.get("user-agent") || "",
      referer: req.get("referer") || ""
    }
  });
}

export const securityHoneypotRouter = Router();

for (const path of HONEYPOT_PATHS) {
  securityHoneypotRouter.all(path, (req, res) => {
    recordHoneypotHit(req);
    res.status(404).json({ message: "Not found" });
  });
}
