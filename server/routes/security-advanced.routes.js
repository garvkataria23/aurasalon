import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { forbidden } from "../utils/app-error.js";
import { securityAdvancedService } from "../services/security-advanced.service.js";

const ALLOWED_ROLES = new Set(["owner", "admin", "superAdmin"]);

function requireSecurityOwner(access = {}) {
  if (!ALLOWED_ROLES.has(access.role)) throw forbidden("Advanced security controls are available for owner/admin accounts only");
}

export const securityAdvancedRouter = Router();

securityAdvancedRouter.use("/security", authenticateJwt(), (req, _res, next) => {
  requireSecurityOwner(req.access);
  next();
});

securityAdvancedRouter.get("/security/policy", asyncHandler((req, res) => {
  res.json({ policies: securityAdvancedService.getPolicies(req.access) });
}));

securityAdvancedRouter.put("/security/policy", asyncHandler((req, res) => {
  res.json({ policies: securityAdvancedService.updatePolicies(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.post("/security/pin/verify", asyncHandler((req, res) => {
  res.json(securityAdvancedService.verifyPin(req.body?.pin || "", req.access, req));
}));

securityAdvancedRouter.get("/security/devices", asyncHandler((req, res) => {
  res.json({ devices: securityAdvancedService.listDevices(req.query, req.access) });
}));

securityAdvancedRouter.get("/security/access/devices", asyncHandler((req, res) => {
  res.json(securityAdvancedService.listManagedAccessDevices(req.query, req.access));
}));

securityAdvancedRouter.post("/security/devices/observe", asyncHandler((req, res) => {
  res.json({ device: securityAdvancedService.recordDeviceSeen(req.access, req) });
}));

securityAdvancedRouter.post("/security/devices/:id/trust", asyncHandler((req, res) => {
  res.json(securityAdvancedService.setDeviceStatus(req.params.id, "trusted", req.access, req));
}));

securityAdvancedRouter.post("/security/devices/:id/revoke", asyncHandler((req, res) => {
  res.json(securityAdvancedService.setDeviceStatus(req.params.id, "revoked", req.access, req));
}));

securityAdvancedRouter.post("/security/access/devices/:deviceId/sign-out", asyncHandler((req, res) => {
  res.json(securityAdvancedService.signOutDevice(req.params.deviceId, req.access, req));
}));

securityAdvancedRouter.post("/security/access/sign-out-all", asyncHandler((req, res) => {
  res.json(securityAdvancedService.signOutAllDevices(req.body?.userId || "", req.access, req));
}));

securityAdvancedRouter.get("/security/field-audit", asyncHandler((req, res) => {
  res.json({ logs: securityAdvancedService.listFieldAudit(req.query, req.access) });
}));

securityAdvancedRouter.post("/security/field-audit/record", asyncHandler((req, res) => {
  res.json({ logs: securityAdvancedService.recordFieldChanges(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.post("/security/risk/evaluate", asyncHandler((req, res) => {
  res.json({ risk: securityAdvancedService.evaluateRisk(req.access, req) });
}));

securityAdvancedRouter.get("/security/risk/events", asyncHandler((req, res) => {
  res.json({ events: securityAdvancedService.listRiskEvents(req.query, req.access) });
}));

securityAdvancedRouter.get("/security/approvals", asyncHandler((req, res) => {
  res.json({ approvals: securityAdvancedService.listApprovalRequests(req.query, req.access) });
}));

securityAdvancedRouter.post("/security/approvals", asyncHandler((req, res) => {
  res.json({ approval: securityAdvancedService.createApprovalRequest(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.post("/security/approvals/:id/approve", asyncHandler((req, res) => {
  res.json(securityAdvancedService.decideApprovalRequest(req.params.id, "approved", req.access, req));
}));

securityAdvancedRouter.post("/security/approvals/:id/reject", asyncHandler((req, res) => {
  res.json(securityAdvancedService.decideApprovalRequest(req.params.id, "rejected", req.access, req));
}));

securityAdvancedRouter.get("/security/access-rules", asyncHandler((req, res) => {
  res.json({ rules: securityAdvancedService.listAccessRules(req.query, req.access) });
}));

securityAdvancedRouter.post("/security/access-rules", asyncHandler((req, res) => {
  res.json({ rule: securityAdvancedService.createAccessRule(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.post("/security/access-rules/:id/disable", asyncHandler((req, res) => {
  res.json(securityAdvancedService.updateAccessRuleStatus(req.params.id, "disabled", req.access, req));
}));

securityAdvancedRouter.get("/security/data-masks", asyncHandler((req, res) => {
  res.json({ masks: securityAdvancedService.listDataMasks(req.query, req.access) });
}));

securityAdvancedRouter.post("/security/data-masks", asyncHandler((req, res) => {
  res.json({ mask: securityAdvancedService.upsertDataMask(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.get("/security/playbooks", asyncHandler((req, res) => {
  res.json({ playbooks: securityAdvancedService.listPlaybooks(req.access) });
}));

securityAdvancedRouter.get("/security/sso-settings", asyncHandler((req, res) => {
  res.json({ settings: securityAdvancedService.getSsoSettings(req.access) });
}));

securityAdvancedRouter.post("/security/sso-settings", asyncHandler((req, res) => {
  res.json({ setting: securityAdvancedService.saveSsoSettings(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.get("/security/privileged-sessions", asyncHandler((req, res) => {
  res.json({ sessions: securityAdvancedService.listPrivilegedSessions(req.query, req.access) });
}));

securityAdvancedRouter.post("/security/privileged-sessions", asyncHandler((req, res) => {
  res.json({ session: securityAdvancedService.startPrivilegedSession(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.get("/security/api-clients", asyncHandler((req, res) => {
  res.json({ clients: securityAdvancedService.listApiClients(req.access) });
}));

securityAdvancedRouter.post("/security/api-clients", asyncHandler((req, res) => {
  res.json({ client: securityAdvancedService.registerApiClient(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.post("/security/api-clients/:id/revoke", asyncHandler((req, res) => {
  res.json(securityAdvancedService.revokeApiClient(req.params.id, req.access, req));
}));

securityAdvancedRouter.get("/security/payment-guard", asyncHandler((req, res) => {
  res.json({ events: securityAdvancedService.listPaymentGuardEvents(req.access) });
}));

securityAdvancedRouter.post("/security/payment-guard", asyncHandler((req, res) => {
  res.json({ event: securityAdvancedService.recordPaymentGuardEvent(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.get("/security/subscription-guard", asyncHandler((req, res) => {
  res.json({ events: securityAdvancedService.listSubscriptionGuardEvents(req.access) });
}));

securityAdvancedRouter.post("/security/account-sharing/evaluate", asyncHandler((req, res) => {
  res.json({ signal: securityAdvancedService.evaluateAccountSharing(req.access, req) });
}));

securityAdvancedRouter.get("/security/account-sharing", asyncHandler((req, res) => {
  res.json({ events: securityAdvancedService.listAccountSharingEvents(req.query, req.access) });
}));

securityAdvancedRouter.get("/security/fraud-warnings", asyncHandler((req, res) => {
  res.json({ warnings: securityAdvancedService.listFraudWarnings(req.access) });
}));

securityAdvancedRouter.post("/security/fraud-warnings", asyncHandler((req, res) => {
  res.json({ warning: securityAdvancedService.saveFraudWarning(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.get("/security/disclosure-reports", asyncHandler((req, res) => {
  res.json({ reports: securityAdvancedService.listDisclosureReports(req.access) });
}));

securityAdvancedRouter.post("/security/disclosure-reports", asyncHandler((req, res) => {
  res.json({ report: securityAdvancedService.createDisclosureReport(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.get("/security/privacy-requests", asyncHandler((req, res) => {
  res.json({ requests: securityAdvancedService.listPrivacyRequests(req.access) });
}));

securityAdvancedRouter.post("/security/privacy-requests", asyncHandler((req, res) => {
  res.json({ request: securityAdvancedService.createPrivacyRequest(req.body || {}, req.access, req) });
}));

securityAdvancedRouter.post("/security/privacy-requests/:id/resolve", asyncHandler((req, res) => {
  res.json(securityAdvancedService.resolvePrivacyRequest(req.params.id, req.access, req));
}));
