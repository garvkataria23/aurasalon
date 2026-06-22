import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { db } from "../db.js";
import { badRequest, forbidden } from "../utils/app-error.js";
import { intrusionDetectionService } from "./intrusion-detection.service.js";
import { securityService } from "./security.service.js";

const DEFAULT_POLICIES = {
  deviceTrustEnabled: "true",
  securityPinRequiredForExport: "false",
  securityPinRequiredForRefund: "true",
  exportProtectionEnabled: "true",
  exportDailyLimit: "25",
  exportMaxRecords: "1000",
  fieldAuditEnabled: "true",
  sessionRiskScoreEnabled: "true",
  sensitiveApprovalRequired: "true",
  ipAccessRulesEnabled: "true",
  dataMaskingEnabled: "true",
  securityPlaybooksEnabled: "true",
  ssoEnforcementReady: "false",
  privilegedSessionRequired: "true",
  apiClientGovernanceEnabled: "true",
  paymentDataGuardEnabled: "true",
  privacyGovernanceEnabled: "true",
  manageAccessDevicesEnabled: "true",
  sessionKillSwitchEnabled: "true",
  subscriptionGuardEnabled: "true",
  antiAccountSharingEnabled: "true",
  fraudWarningCenterEnabled: "true",
  responsibleDisclosureEnabled: "true",
  encryptionAtRestReady: "false",
  immutableAuditEvidenceEnabled: "true",
  soc2ReadinessEnabled: "true",
  iso27001ReadinessEnabled: "true"
};

const EXPORT_PATH_PATTERN = /(export|download|csv|xlsx|pdf|backup|dump)/i;
const SUBSCRIPTION_GUARD_PATTERN = /(reports|export|download|ai|analytics|migration|security\/api-clients)/i;
const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function safeJson(value) {
  try {
    return JSON.stringify(value ?? "");
  } catch {
    return String(value ?? "");
  }
}

function sameSecret(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

function requestIp(req) {
  return req.ip || req.headers["x-forwarded-for"]?.split(",")[0]?.trim() || req.socket?.remoteAddress || "";
}

function hashDevice({ userAgent = "", ipAddress = "", deviceId = "" }) {
  return createHash("sha256")
    .update(`${deviceId}|${userAgent}|${ipAddress}`)
    .digest("hex")
    .slice(0, 32);
}

function audit(action, access, req, details = {}) {
  try {
    securityService.audit({
      action,
      targetType: "enterprise_security_layer",
      targetId: details.id || "",
      severity: details.severity || "info",
      details
    }, access, { ip: requestIp(req), get: (header) => req.get(header) || "" });
  } catch {
    // Security layer audit should not break the original request.
  }
}

function fromJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function rowWithJson(row, fields = []) {
  if (!row) return null;
  const output = { ...row };
  for (const field of fields) output[field] = fromJson(output[field], field === "checklist" || field === "reasons" ? [] : {});
  return output;
}

function countRows(sql, params = []) {
  return Number(db.prepare(sql).get(...params)?.count || 0);
}

function evidenceHash(rows = []) {
  const hash = createHash("sha256");
  for (const row of rows) {
    hash.update(`${row.source}|${row.id}|${row.action || row.fieldName || ""}|${row.createdAt || ""}|${row.updatedAt || ""}\n`);
  }
  return hash.digest("hex");
}

function controlWeight(status) {
  if (status === "ready") return 1;
  if (status === "partial") return 0.5;
  return 0;
}

export class SecurityAdvancedService {
  getPolicies(access = {}) {
    this.ensureDefaultPolicies(access);
    const rows = db.prepare(`
      SELECT policyKey, policyValue, status FROM security_policies
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY branchId ASC, policyKey ASC
    `).all(access.tenantId, access.branchId || "");
    return rows.reduce((result, row) => ({ ...result, [row.policyKey]: row.policyValue }), {});
  }

  complianceReadiness(access = {}) {
    const policies = this.getPolicies(access);
    const users = countRows("SELECT COUNT(*) count FROM tenant_users WHERE tenantId = ? AND status = 'active'", [access.tenantId]);
    const twoFactorUsers = countRows("SELECT COUNT(*) count FROM tenant_users WHERE tenantId = ? AND status = 'active' AND totpEnabled = 1", [access.tenantId]);
    const ssoTotal = countRows("SELECT COUNT(*) count FROM security_sso_settings WHERE tenantId = ?", [access.tenantId]);
    const ssoActive = countRows("SELECT COUNT(*) count FROM security_sso_settings WHERE tenantId = ? AND status IN ('active', 'enforced', 'ready')", [access.tenantId]);
    const auditRows = [
      ...db.prepare("SELECT 'security_audit_logs' source, id, action, createdAt, '' updatedAt FROM security_audit_logs WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 50").all(access.tenantId),
      ...db.prepare("SELECT 'audit_logs' source, id, action, createdAt, updatedAt FROM audit_logs WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 50").all(access.tenantId),
      ...db.prepare("SELECT 'security_field_audit_logs' source, id, fieldName, createdAt, '' updatedAt FROM security_field_audit_logs WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 50").all(access.tenantId)
    ].sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || ""))).slice(0, 100);
    const envEncryptionKeyPresent = Boolean(process.env.AURA_DB_ENCRYPTION_KEY || process.env.DB_ENCRYPTION_KEY || process.env.SQLITE_ENCRYPTION_KEY);
    const encryptionReady = policies.encryptionAtRestReady === "true" || envEncryptionKeyPresent;
    const exportProtectionReady = policies.exportProtectionEnabled !== "false" && Number(policies.exportDailyLimit || 0) > 0 && Number(policies.exportMaxRecords || 0) > 0;
    const recentRiskEvents = db.prepare(`
      SELECT riskLevel, riskScore, reasons, createdAt FROM security_risk_events
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT 50
    `).all(access.tenantId, access.branchId || "");
    const controls = [
      { key: "two_factor", framework: "SOC2 CC6 / ISO A.5", label: "2FA for admin users", status: twoFactorUsers > 0 ? "ready" : "gap", evidence: `${twoFactorUsers}/${users} active users have TOTP enabled` },
      { key: "sso", framework: "SOC2 CC6 / ISO A.5", label: "SSO readiness", status: ssoActive > 0 || policies.ssoEnforcementReady === "true" ? "ready" : ssoTotal > 0 ? "partial" : "gap", evidence: `${ssoTotal} SSO setting(s), ${ssoActive} active` },
      { key: "encryption_at_rest", framework: "SOC2 CC6 / ISO A.8", label: "Encryption-at-rest readiness", status: encryptionReady ? "ready" : "gap", evidence: envEncryptionKeyPresent ? "Encryption key environment is configured" : "Policy exists; DB encryption key is not configured" },
      { key: "immutable_audit", framework: "SOC2 CC7 / ISO A.8", label: "Immutable audit evidence", status: auditRows.length && policies.immutableAuditEvidenceEnabled !== "false" ? "ready" : "gap", evidence: `${auditRows.length} audit evidence row(s), hash ${evidenceHash(auditRows).slice(0, 16)}` },
      { key: "export_protection", framework: "SOC2 CC6 / ISO A.8", label: "Export protection", status: exportProtectionReady ? "ready" : "gap", evidence: `Daily limit ${policies.exportDailyLimit}, max records ${policies.exportMaxRecords}, PIN required ${policies.securityPinRequiredForExport}` },
      { key: "privacy_governance", framework: "SOC2 Privacy / ISO A.5", label: "Privacy request governance", status: policies.privacyGovernanceEnabled === "true" ? "ready" : "gap", evidence: "Client access/export/delete request queue" },
      { key: "incident_response", framework: "SOC2 CC7 / ISO A.5", label: "Incident response playbooks", status: policies.securityPlaybooksEnabled === "true" ? "ready" : "gap", evidence: "Security response playbooks enabled" }
    ];
    const ready = controls.filter((control) => control.status === "ready").length;
    const partial = controls.filter((control) => control.status === "partial").length;
    const score = Math.round(((ready + partial * 0.5) / controls.length) * 100);
    const riskHeatmap = this.securityRiskHeatmap({ controls, recentRiskEvents, policies });
    const evidenceExport = this.complianceEvidenceExport({ access, controls, auditRows, riskHeatmap, policies, score });
    return {
      score,
      scoreBreakdown: { ready, partial, gaps: controls.length - ready - partial, total: controls.length },
      status: score >= 85 ? "enterprise_ready" : score >= 65 ? "sale_ready_with_gaps" : "needs_hardening",
      controls,
      riskHeatmap,
      evidence: {
        immutableAuditHash: evidenceHash(auditRows),
        evidenceRows: auditRows.length,
        encryptionKeyConfigured: envEncryptionKeyPresent,
        exportProtectionReady,
        twoFactorCoverage: { users, enabled: twoFactorUsers },
        sso: { total: ssoTotal, active: ssoActive },
        exportBundleId: evidenceExport.bundleId,
        exportGeneratedAt: evidenceExport.generatedAt
      },
      evidenceExport,
      nextActions: controls.filter((control) => control.status !== "ready").map((control) => control.label)
    };
  }

  securityRiskHeatmap({ controls = [], recentRiskEvents = [], policies = {} } = {}) {
    const statusByKey = new Map(controls.map((control) => [control.key, control.status]));
    const criticalRisk = recentRiskEvents.filter((event) => event.riskLevel === "critical").length;
    const warningRisk = recentRiskEvents.filter((event) => event.riskLevel === "warning").length;
    return [
      {
        area: "Identity",
        score: Math.round((controlWeight(statusByKey.get("two_factor")) + controlWeight(statusByKey.get("sso"))) * 50),
        risk: statusByKey.get("two_factor") === "ready" && statusByKey.get("sso") !== "gap" ? "low" : "high",
        evidence: "2FA and SSO readiness"
      },
      {
        area: "Audit Evidence",
        score: Math.round(controlWeight(statusByKey.get("immutable_audit")) * 100),
        risk: statusByKey.get("immutable_audit") === "ready" ? "low" : "critical",
        evidence: "Immutable audit hash and sampled rows"
      },
      {
        area: "Export/Data Protection",
        score: Math.round((controlWeight(statusByKey.get("export_protection")) + controlWeight(statusByKey.get("encryption_at_rest"))) * 50),
        risk: policies.securityPinRequiredForExport === "true" && statusByKey.get("export_protection") === "ready" ? "low" : "warning",
        evidence: "Export guard, PIN, encryption readiness"
      },
      {
        area: "Runtime Risk",
        score: Math.max(0, 100 - criticalRisk * 30 - warningRisk * 12),
        risk: criticalRisk ? "critical" : warningRisk ? "warning" : "low",
        evidence: `${recentRiskEvents.length} recent risk events`
      },
      {
        area: "Privacy/Incident",
        score: Math.round((controlWeight(statusByKey.get("privacy_governance")) + controlWeight(statusByKey.get("incident_response"))) * 50),
        risk: statusByKey.get("privacy_governance") === "ready" && statusByKey.get("incident_response") === "ready" ? "low" : "warning",
        evidence: "Privacy queue and response playbooks"
      }
    ];
  }

  complianceEvidenceExport({ access = {}, controls = [], auditRows = [], riskHeatmap = [], policies = {}, score = 0 } = {}) {
    const generatedAt = now();
    const bundleSeed = `${access.tenantId || ""}|${access.branchId || ""}|${generatedAt}|${evidenceHash(auditRows)}`;
    return {
      bundleId: `evidence_${createHash("sha256").update(bundleSeed).digest("hex").slice(0, 12)}`,
      generatedAt,
      tenantId: access.tenantId || "",
      branchId: access.branchId || "",
      framework: ["SOC2", "ISO27001"],
      score,
      controls: controls.map((control) => ({
        key: control.key,
        framework: control.framework,
        status: control.status,
        evidence: control.evidence
      })),
      riskHeatmap,
      immutableAuditHash: evidenceHash(auditRows),
      sampledAuditRows: auditRows.length,
      exportProtection: {
        enabled: policies.exportProtectionEnabled !== "false",
        pinRequired: policies.securityPinRequiredForExport === "true",
        dailyLimit: Number(policies.exportDailyLimit || 0),
        maxRecords: Number(policies.exportMaxRecords || 0)
      }
    };
  }

  exportComplianceEvidence(access = {}, req = {}) {
    const readiness = this.complianceReadiness(access);
    audit("security.compliance_evidence.exported", access, req, { id: readiness.evidenceExport?.bundleId, score: readiness.score });
    return readiness.evidenceExport;
  }

  updatePolicies(payload = {}, access = {}, req = {}) {
    const allowed = new Set(Object.keys(DEFAULT_POLICIES));
    const timestamp = now();
    const updates = Object.entries(payload).filter(([key]) => allowed.has(key));
    if (!updates.length) throw badRequest("No supported security policy supplied");
    const stmt = db.prepare(`
      INSERT INTO security_policies (id, tenantId, branchId, policyKey, policyValue, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @policyKey, @policyValue, 'active', @createdAt, @updatedAt)
      ON CONFLICT(tenantId, branchId, policyKey)
      DO UPDATE SET policyValue = excluded.policyValue, status = 'active', updatedAt = excluded.updatedAt
    `);
    for (const [policyKey, policyValue] of updates) {
      stmt.run({
        id: makeId("policy"),
        tenantId: access.tenantId,
        branchId: access.branchId || "",
        policyKey,
        policyValue: String(policyValue),
        createdAt: timestamp,
        updatedAt: timestamp
      });
    }
    audit("security.policy.updated", access, req, { changedKeys: updates.map(([key]) => key) });
    return this.getPolicies(access);
  }

  ensureDefaultPolicies(access = {}) {
    if (!access.tenantId) return;
    const timestamp = now();
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO security_policies (id, tenantId, branchId, policyKey, policyValue, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, '', @policyKey, @policyValue, 'active', @createdAt, @updatedAt)
    `);
    for (const [policyKey, policyValue] of Object.entries(DEFAULT_POLICIES)) {
      stmt.run({ id: makeId("policy"), tenantId: access.tenantId, policyKey, policyValue, createdAt: timestamp, updatedAt: timestamp });
    }
  }

  recordDeviceSeen(access = {}, req = {}) {
    const userAgent = req.get?.("user-agent") || "";
    const ipAddress = requestIp(req);
    const headerDeviceId = req.get?.("x-device-id") || access.deviceId || "";
    const deviceId = headerDeviceId || hashDevice({ userAgent, ipAddress });
    const timestamp = now();
    const existing = db.prepare(`
      SELECT * FROM security_trusted_devices
      WHERE tenantId = ? AND userId = ? AND deviceId = ?
      LIMIT 1
    `).get(access.tenantId, access.userId || "", deviceId);

    if (existing) {
      db.prepare(`
        UPDATE security_trusted_devices
        SET ipAddress = ?, userAgent = ?, lastSeenAt = ?, updatedAt = ?
        WHERE id = ? AND tenantId = ?
      `).run(ipAddress, userAgent, timestamp, timestamp, existing.id, access.tenantId);
      return { ...existing, ipAddress, userAgent, lastSeenAt: timestamp, updatedAt: timestamp };
    }

    const record = {
      id: makeId("device"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: access.userId || "",
      deviceId,
      deviceName: req.get?.("x-device-name") || "Browser device",
      ipAddress,
      userAgent,
      trustLevel: "observed",
      firstSeenAt: timestamp,
      lastSeenAt: timestamp,
      status: "observed",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_trusted_devices
      (id, tenantId, branchId, userId, deviceId, deviceName, ipAddress, userAgent, trustLevel, firstSeenAt, lastSeenAt, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @userId, @deviceId, @deviceName, @ipAddress, @userAgent, @trustLevel, @firstSeenAt, @lastSeenAt, @status, @createdAt, @updatedAt)
    `).run(record);
    intrusionDetectionService.raiseAlert({
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      alertType: "new_device_observed",
      severity: "info",
      ipAddress,
      userId: access.userId || "",
      summary: "New device observed for account",
      details: { deviceId, userAgent }
    });
    return record;
  }

  listDevices(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    const params = [access.tenantId];
    const where = ["tenantId = ?"];
    if (access.branchId) {
      where.push("(branchId = '' OR branchId = ?)");
      params.push(access.branchId);
    }
    params.push(limit);
    return db.prepare(`
      SELECT * FROM security_trusted_devices
      WHERE ${where.join(" AND ")}
      ORDER BY lastSeenAt DESC
      LIMIT ?
    `).all(...params);
  }

  listManagedAccessDevices(query = {}, access = {}) {
    const devices = this.listDevices(query, access);
    const activeTokens = db.prepare(`
      SELECT userId, deviceId, branchId, role, COUNT(*) activeSessions, MAX(expiresAt) refreshExpiresAt
      FROM auth_refresh_tokens
      WHERE tenantId = ? AND revokedAt = '' AND expiresAt > ?
      GROUP BY userId, deviceId, branchId, role
      ORDER BY refreshExpiresAt DESC
      LIMIT 500
    `).all(access.tenantId, now());
    const revocations = db.prepare(`
      SELECT * FROM security_session_revocations
      WHERE tenantId = ?
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(access.tenantId);
    return { devices, activeTokens, revocations };
  }

  setDeviceStatus(id, status, access = {}, req = {}) {
    if (!["trusted", "revoked", "observed"].includes(status)) throw badRequest("Unsupported device status");
    const trustLevel = status === "trusted" ? "trusted" : status === "revoked" ? "blocked" : "observed";
    const result = db.prepare(`
      UPDATE security_trusted_devices
      SET status = ?, trustLevel = ?, updatedAt = ?
      WHERE id = ? AND tenantId = ?
    `).run(status, trustLevel, now(), id, access.tenantId);
    audit(`security.device.${status}`, access, req, { id, status });
    return { id, status, updated: result.changes > 0 };
  }

  signOutDevice(deviceId, access = {}, req = {}) {
    if (!deviceId) throw badRequest("deviceId is required");
    const timestamp = now();
    const result = db.prepare(`
      UPDATE auth_refresh_tokens
      SET revokedAt = ?
      WHERE tenantId = ? AND deviceId = ? AND revokedAt = ''
    `).run(timestamp, access.tenantId, deviceId);
    const record = {
      id: makeId("sessionkill"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: "",
      deviceId,
      scope: "device",
      reason: "Owner/admin signed out device",
      createdAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_session_revocations
      (id, tenantId, branchId, userId, deviceId, scope, reason, createdAt)
      VALUES (@id, @tenantId, @branchId, @userId, @deviceId, @scope, @reason, @createdAt)
    `).run(record);
    audit("security.session.device_signed_out", access, req, { id: record.id, deviceId, revokedRefreshTokens: result.changes });
    return { deviceId, revoked: result.changes, revocation: record };
  }

  signOutAllDevices(userId = "", access = {}, req = {}) {
    const targetUserId = String(userId || access.userId || "").trim();
    if (!targetUserId) throw badRequest("userId is required");
    const timestamp = now();
    const result = db.prepare(`
      UPDATE auth_refresh_tokens
      SET revokedAt = ?
      WHERE tenantId = ? AND userId = ? AND revokedAt = ''
    `).run(timestamp, access.tenantId, targetUserId);
    const record = {
      id: makeId("sessionkill"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: targetUserId,
      deviceId: "",
      scope: "user",
      reason: "Owner/admin signed out all user devices",
      createdAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_session_revocations
      (id, tenantId, branchId, userId, deviceId, scope, reason, createdAt)
      VALUES (@id, @tenantId, @branchId, @userId, @deviceId, @scope, @reason, @createdAt)
    `).run(record);
    audit("security.session.all_devices_signed_out", access, req, { id: record.id, userId: targetUserId, revokedRefreshTokens: result.changes });
    return { userId: targetUserId, revoked: result.changes, revocation: record };
  }

  isSessionRevoked(access = {}) {
    if (!access.tenantId || !access.userId) return false;
    const issuedAt = access.iat ? new Date(Number(access.iat) * 1000).toISOString() : "";
    const params = [access.tenantId, issuedAt, access.userId, access.deviceId || "", access.userId, access.deviceId || ""];
    const row = db.prepare(`
      SELECT id FROM security_session_revocations
      WHERE tenantId = ? AND createdAt >= ?
        AND (
          scope = 'tenant'
          OR (scope = 'user' AND userId = ?)
          OR (scope = 'device' AND deviceId != '' AND deviceId = ?)
          OR (scope = 'user_device' AND userId = ? AND deviceId = ?)
        )
      ORDER BY createdAt DESC
      LIMIT 1
    `).get(...params);
    return Boolean(row);
  }

  verifyPin(pin, access = {}, req = {}) {
    const expected = process.env.SECURITY_OWNER_PIN || process.env.SECURITY_REAUTH_PIN || "";
    if (!expected) throw forbidden("Security PIN is not configured");
    const ok = sameSecret(pin, expected);
    audit(ok ? "security.pin.verified" : "security.pin.failed", access, req, { severity: ok ? "info" : "warning" });
    if (!ok) throw forbidden("Invalid security PIN");
    return { verified: true, verifiedAt: now() };
  }

  recordFieldChanges({ entityType, entityId = "", before = {}, after = {}, action = "field_changed" }, access = {}, req = {}) {
    const policies = this.getPolicies(access);
    if (policies.fieldAuditEnabled === "false") return [];
    if (!entityType) throw badRequest("entityType is required");
    const timestamp = now();
    const rows = [];
    const keys = new Set([...Object.keys(before || {}), ...Object.keys(after || {})]);
    const stmt = db.prepare(`
      INSERT INTO security_field_audit_logs
      (id, tenantId, branchId, userId, entityType, entityId, fieldName, oldValue, newValue, action, ipAddress, createdAt)
      VALUES (@id, @tenantId, @branchId, @userId, @entityType, @entityId, @fieldName, @oldValue, @newValue, @action, @ipAddress, @createdAt)
    `);
    for (const fieldName of keys) {
      const oldValue = safeJson(before?.[fieldName]);
      const newValue = safeJson(after?.[fieldName]);
      if (oldValue === newValue) continue;
      const row = {
        id: makeId("field"),
        tenantId: access.tenantId,
        branchId: access.branchId || "",
        userId: access.userId || "",
        entityType,
        entityId,
        fieldName,
        oldValue,
        newValue,
        action,
        ipAddress: requestIp(req),
        createdAt: timestamp
      };
      stmt.run(row);
      rows.push(row);
    }
    if (rows.length) audit("security.field_audit.recorded", access, req, { entityType, entityId, fields: rows.map((row) => row.fieldName) });
    return rows;
  }

  listFieldAudit(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    const params = [access.tenantId];
    const where = ["tenantId = ?"];
    if (access.branchId) {
      where.push("(branchId = '' OR branchId = ?)");
      params.push(access.branchId);
    }
    if (query.entityType) {
      where.push("entityType = ?");
      params.push(String(query.entityType));
    }
    params.push(limit);
    return db.prepare(`
      SELECT * FROM security_field_audit_logs
      WHERE ${where.join(" AND ")}
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(...params);
  }

  evaluateRisk(access = {}, req = {}) {
    const policies = this.getPolicies(access);
    if (policies.sessionRiskScoreEnabled === "false") return { riskScore: 0, riskLevel: "disabled", reasons: [] };
    const ipAddress = requestIp(req);
    const userAgent = req.get?.("user-agent") || "";
    const reasons = [];
    let riskScore = 0;

    const revokedDevice = db.prepare(`
      SELECT id FROM security_trusted_devices
      WHERE tenantId = ? AND userId = ? AND status = 'revoked'
      ORDER BY updatedAt DESC LIMIT 1
    `).get(access.tenantId, access.userId || "");
    if (revokedDevice) {
      riskScore += 45;
      reasons.push("revoked_device_seen");
    }

    const openCritical = db.prepare(`
      SELECT COUNT(*) count FROM security_alerts
      WHERE tenantId = ? AND ipAddress = ? AND severity = 'critical' AND status = 'open'
    `).get(access.tenantId, ipAddress);
    if (Number(openCritical?.count || 0) > 0) {
      riskScore += 35;
      reasons.push("open_critical_alert_from_ip");
    }

    const watchRule = db.prepare(`
      SELECT effect FROM security_access_rules
      WHERE tenantId = ? AND status = 'active' AND ruleType = 'ip' AND matchValue = ?
      ORDER BY updatedAt DESC LIMIT 1
    `).get(access.tenantId, ipAddress);
    if (watchRule?.effect === "deny") {
      riskScore += 50;
      reasons.push("ip_deny_rule_match");
    } else if (watchRule?.effect === "watch") {
      riskScore += 20;
      reasons.push("ip_watch_rule_match");
    }

    if (/export|download|backup|dump/i.test(req.originalUrl || req.url || "")) {
      riskScore += 15;
      reasons.push("sensitive_export_route");
    }

    const riskLevel = riskScore >= 70 ? "critical" : riskScore >= 35 ? "warning" : "low";
    const timestamp = now();
    const record = {
      id: makeId("risk"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: access.userId || "",
      riskScore,
      riskLevel,
      ipAddress,
      userAgent,
      reasons: JSON.stringify(reasons),
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_risk_events
      (id, tenantId, branchId, userId, riskScore, riskLevel, ipAddress, userAgent, reasons, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @userId, @riskScore, @riskLevel, @ipAddress, @userAgent, @reasons, @status, @createdAt, @updatedAt)
    `).run(record);
    return rowWithJson(record, ["reasons"]);
  }

  listRiskEvents(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    return db.prepare(`
      SELECT * FROM security_risk_events
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(access.tenantId, access.branchId || "", limit).map((row) => rowWithJson(row, ["reasons"]));
  }

  createApprovalRequest(payload = {}, access = {}, req = {}) {
    const actionType = String(payload.actionType || "").trim();
    const summary = String(payload.summary || "").trim();
    if (!actionType || !summary) throw badRequest("actionType and summary are required");
    const timestamp = now();
    const record = {
      id: makeId("approval"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      requestedBy: access.userId || "",
      approvedBy: "",
      actionType,
      summary,
      details: safeJson(payload.details || {}),
      status: "pending",
      decidedAt: "",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_approval_requests
      (id, tenantId, branchId, requestedBy, approvedBy, actionType, summary, details, status, decidedAt, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @requestedBy, @approvedBy, @actionType, @summary, @details, @status, @decidedAt, @createdAt, @updatedAt)
    `).run(record);
    audit("security.approval.requested", access, req, { id: record.id, actionType, summary });
    return rowWithJson(record, ["details"]);
  }

  listApprovalRequests(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    const status = String(query.status || "").trim();
    const params = [access.tenantId, access.branchId || ""];
    const where = ["tenantId = ?", "(branchId = '' OR branchId = ?)"];
    if (status) {
      where.push("status = ?");
      params.push(status);
    }
    params.push(limit);
    return db.prepare(`
      SELECT * FROM security_approval_requests
      WHERE ${where.join(" AND ")}
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(...params).map((row) => rowWithJson(row, ["details"]));
  }

  decideApprovalRequest(id, decision, access = {}, req = {}) {
    if (!["approved", "rejected"].includes(decision)) throw badRequest("Decision must be approved or rejected");
    const timestamp = now();
    const result = db.prepare(`
      UPDATE security_approval_requests
      SET status = ?, approvedBy = ?, decidedAt = ?, updatedAt = ?
      WHERE id = ? AND tenantId = ? AND status = 'pending'
    `).run(decision, access.userId || "", timestamp, timestamp, id, access.tenantId);
    audit(`security.approval.${decision}`, access, req, { id, decision });
    return { id, status: decision, updated: result.changes > 0 };
  }

  listAccessRules(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    return db.prepare(`
      SELECT * FROM security_access_rules
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY updatedAt DESC
      LIMIT ?
    `).all(access.tenantId, access.branchId || "", limit);
  }

  createAccessRule(payload = {}, access = {}, req = {}) {
    const matchValue = String(payload.matchValue || "").trim();
    if (!matchValue) throw badRequest("matchValue is required");
    const timestamp = now();
    const record = {
      id: makeId("rule"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      ruleType: String(payload.ruleType || "ip"),
      matchValue,
      effect: String(payload.effect || "watch"),
      reason: String(payload.reason || ""),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_access_rules
      (id, tenantId, branchId, ruleType, matchValue, effect, reason, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @ruleType, @matchValue, @effect, @reason, @status, @createdAt, @updatedAt)
    `).run(record);
    audit("security.access_rule.created", access, req, { id: record.id, effect: record.effect, matchValue });
    return record;
  }

  updateAccessRuleStatus(id, status, access = {}, req = {}) {
    if (!["active", "disabled"].includes(status)) throw badRequest("Unsupported access-rule status");
    const result = db.prepare(`
      UPDATE security_access_rules SET status = ?, updatedAt = ?
      WHERE id = ? AND tenantId = ?
    `).run(status, now(), id, access.tenantId);
    audit("security.access_rule.status", access, req, { id, status });
    return { id, status, updated: result.changes > 0 };
  }

  listDataMasks(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    return db.prepare(`
      SELECT * FROM security_data_masks
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY entityType ASC, fieldName ASC
      LIMIT ?
    `).all(access.tenantId, access.branchId || "", limit);
  }

  upsertDataMask(payload = {}, access = {}, req = {}) {
    const entityType = String(payload.entityType || "").trim();
    const fieldName = String(payload.fieldName || "").trim();
    if (!entityType || !fieldName) throw badRequest("entityType and fieldName are required");
    const timestamp = now();
    const record = {
      id: makeId("mask"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      entityType,
      fieldName,
      maskType: String(payload.maskType || "partial"),
      rolesAllowed: String(payload.rolesAllowed || "owner,admin,superAdmin"),
      status: String(payload.status || "active"),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_data_masks
      (id, tenantId, branchId, entityType, fieldName, maskType, rolesAllowed, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @entityType, @fieldName, @maskType, @rolesAllowed, @status, @createdAt, @updatedAt)
      ON CONFLICT(tenantId, branchId, entityType, fieldName)
      DO UPDATE SET maskType = excluded.maskType, rolesAllowed = excluded.rolesAllowed, status = excluded.status, updatedAt = excluded.updatedAt
    `).run(record);
    audit("security.data_mask.saved", access, req, { entityType, fieldName, maskType: record.maskType });
    return record;
  }

  listPlaybooks(access = {}) {
    this.ensureDefaultPlaybooks(access);
    return db.prepare(`
      SELECT * FROM security_review_playbooks
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY severity DESC, title ASC
    `).all(access.tenantId, access.branchId || "").map((row) => rowWithJson(row, ["checklist"]));
  }

  ensureDefaultPlaybooks(access = {}) {
    if (!access.tenantId) return;
    const timestamp = now();
    const defaults = [
      ["brute_force_response", "Brute-force response", "critical", ["Review source IP", "Check affected accounts", "Keep block active", "Force password reset if needed"]],
      ["new_device_review", "New device review", "warning", ["Confirm user identity", "Trust or revoke device", "Review recent actions"]],
      ["export_investigation", "Export investigation", "warning", ["Verify business reason", "Check record count", "Require PIN for future exports"]]
    ];
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO security_review_playbooks
      (id, tenantId, branchId, playbookKey, title, severity, checklist, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, '', @playbookKey, @title, @severity, @checklist, 'active', @createdAt, @updatedAt)
    `);
    for (const [playbookKey, title, severity, checklist] of defaults) {
      stmt.run({ id: makeId("playbook"), tenantId: access.tenantId, playbookKey, title, severity, checklist: JSON.stringify(checklist), createdAt: timestamp, updatedAt: timestamp });
    }
  }

  getSsoSettings(access = {}) {
    return db.prepare(`
      SELECT * FROM security_sso_settings
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY updatedAt DESC
      LIMIT 20
    `).all(access.tenantId, access.branchId || "");
  }

  saveSsoSettings(payload = {}, access = {}, req = {}) {
    const timestamp = now();
    const record = {
      id: payload.id || makeId("sso"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      provider: String(payload.provider || "saml"),
      domainHint: String(payload.domainHint || ""),
      enforceForRoles: String(payload.enforceForRoles || "owner,admin,superAdmin"),
      status: String(payload.status || "draft"),
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_sso_settings
      (id, tenantId, branchId, provider, domainHint, enforceForRoles, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @provider, @domainHint, @enforceForRoles, @status, @createdAt, @updatedAt)
      ON CONFLICT(id) DO UPDATE SET provider = excluded.provider, domainHint = excluded.domainHint,
        enforceForRoles = excluded.enforceForRoles, status = excluded.status, updatedAt = excluded.updatedAt
    `).run(record);
    audit("security.sso_settings.saved", access, req, { id: record.id, provider: record.provider, status: record.status });
    return record;
  }

  startPrivilegedSession(payload = {}, access = {}, req = {}) {
    const purpose = String(payload.purpose || "").trim();
    if (!purpose) throw badRequest("purpose is required");
    const minutes = Math.min(Math.max(Number(payload.minutes || 15), 5), 120);
    const timestamp = now();
    const record = {
      id: makeId("privsession"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: access.userId || "",
      purpose,
      riskLevel: String(payload.riskLevel || "warning"),
      expiresAt: new Date(Date.now() + minutes * 60 * 1000).toISOString(),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_privileged_sessions
      (id, tenantId, branchId, userId, purpose, riskLevel, expiresAt, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @userId, @purpose, @riskLevel, @expiresAt, @status, @createdAt, @updatedAt)
    `).run(record);
    audit("security.privileged_session.started", access, req, { id: record.id, purpose, expiresAt: record.expiresAt });
    return record;
  }

  listPrivilegedSessions(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    db.prepare(`
      UPDATE security_privileged_sessions SET status = 'expired', updatedAt = ?
      WHERE tenantId = ? AND status = 'active' AND expiresAt <= ?
    `).run(now(), access.tenantId, now());
    return db.prepare(`
      SELECT * FROM security_privileged_sessions
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(access.tenantId, access.branchId || "", limit);
  }

  registerApiClient(payload = {}, access = {}, req = {}) {
    const clientName = String(payload.clientName || "").trim();
    if (!clientName) throw badRequest("clientName is required");
    const rawToken = `ask_${randomBytes(24).toString("hex")}`;
    const timestamp = now();
    const record = {
      id: makeId("apiclient"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      clientName,
      tokenHash: createHash("sha256").update(rawToken).digest("hex"),
      scopes: String(payload.scopes || "read:security"),
      lastUsedAt: "",
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_api_clients
      (id, tenantId, branchId, clientName, tokenHash, scopes, lastUsedAt, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @clientName, @tokenHash, @scopes, @lastUsedAt, @status, @createdAt, @updatedAt)
    `).run(record);
    audit("security.api_client.created", access, req, { id: record.id, clientName, scopes: record.scopes });
    return { ...record, tokenHash: "", token: rawToken };
  }

  listApiClients(access = {}) {
    return db.prepare(`
      SELECT id, tenantId, branchId, clientName, scopes, lastUsedAt, status, createdAt, updatedAt
      FROM security_api_clients
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
    `).all(access.tenantId, access.branchId || "");
  }

  revokeApiClient(id, access = {}, req = {}) {
    const result = db.prepare(`
      UPDATE security_api_clients SET status = 'revoked', updatedAt = ?
      WHERE id = ? AND tenantId = ?
    `).run(now(), id, access.tenantId);
    audit("security.api_client.revoked", access, req, { id });
    return { id, revoked: result.changes > 0 };
  }

  recordPaymentGuardEvent(payload = {}, access = {}, req = {}) {
    const eventType = String(payload.eventType || "").trim();
    const summary = String(payload.summary || "").trim();
    if (!eventType || !summary) throw badRequest("eventType and summary are required");
    const timestamp = now();
    const record = {
      id: makeId("payguard"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: access.userId || "",
      eventType,
      summary,
      paymentRef: String(payload.paymentRef || ""),
      severity: String(payload.severity || "info"),
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_payment_guard_events
      (id, tenantId, branchId, userId, eventType, summary, paymentRef, severity, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @userId, @eventType, @summary, @paymentRef, @severity, @status, @createdAt, @updatedAt)
    `).run(record);
    audit("security.payment_guard.recorded", access, req, { id: record.id, eventType, severity: record.severity });
    return record;
  }

  listPaymentGuardEvents(access = {}) {
    return db.prepare(`
      SELECT * FROM security_payment_guard_events
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(access.tenantId, access.branchId || "");
  }

  createPrivacyRequest(payload = {}, access = {}, req = {}) {
    const requestType = String(payload.requestType || "").trim();
    const summary = String(payload.summary || "").trim();
    if (!requestType || !summary) throw badRequest("requestType and summary are required");
    const timestamp = now();
    const record = {
      id: makeId("privacy"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      requesterId: access.userId || "",
      subjectType: String(payload.subjectType || "client"),
      subjectId: String(payload.subjectId || ""),
      requestType,
      summary,
      status: "open",
      resolvedAt: "",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_privacy_requests
      (id, tenantId, branchId, requesterId, subjectType, subjectId, requestType, summary, status, resolvedAt, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @requesterId, @subjectType, @subjectId, @requestType, @summary, @status, @resolvedAt, @createdAt, @updatedAt)
    `).run(record);
    audit("security.privacy_request.created", access, req, { id: record.id, requestType });
    return record;
  }

  listPrivacyRequests(access = {}) {
    return db.prepare(`
      SELECT * FROM security_privacy_requests
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(access.tenantId, access.branchId || "");
  }

  resolvePrivacyRequest(id, access = {}, req = {}) {
    const timestamp = now();
    const result = db.prepare(`
      UPDATE security_privacy_requests
      SET status = 'resolved', resolvedAt = ?, updatedAt = ?
      WHERE id = ? AND tenantId = ?
    `).run(timestamp, timestamp, id, access.tenantId);
    audit("security.privacy_request.resolved", access, req, { id });
    return { id, resolved: result.changes > 0 };
  }

  evaluateAccountSharing(access = {}, req = {}) {
    const policies = this.getPolicies(access);
    if (policies.antiAccountSharingEnabled === "false") return null;
    const activeRows = db.prepare(`
      SELECT deviceId, branchId, COUNT(*) count
      FROM auth_refresh_tokens
      WHERE tenantId = ? AND userId = ? AND revokedAt = '' AND expiresAt > ?
      GROUP BY deviceId, branchId
    `).all(access.tenantId, access.userId || "", now());
    const deviceCount = new Set(activeRows.map((row) => row.deviceId).filter(Boolean)).size;
    const branchCount = new Set(activeRows.map((row) => row.branchId).filter(Boolean)).size;
    if (deviceCount < 4 && branchCount < 3) return { flagged: false, deviceCount, branchCount };
    const timestamp = now();
    const record = {
      id: makeId("sharing"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: access.userId || "",
      signalType: "multi_device_branch_usage",
      summary: `Account active on ${deviceCount} devices and ${branchCount} branches`,
      details: safeJson({ deviceCount, branchCount, activeRows }),
      severity: deviceCount >= 6 || branchCount >= 4 ? "critical" : "warning",
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_account_sharing_events
      (id, tenantId, branchId, userId, signalType, summary, details, severity, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @userId, @signalType, @summary, @details, @severity, @status, @createdAt, @updatedAt)
    `).run(record);
    intrusionDetectionService.raiseAlert({
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      alertType: "anti_account_sharing_signal",
      severity: record.severity,
      ipAddress: requestIp(req),
      userId: access.userId || "",
      summary: record.summary,
      details: { deviceCount, branchCount }
    });
    return rowWithJson(record, ["details"]);
  }

  listAccountSharingEvents(query = {}, access = {}) {
    const limit = Math.min(Number(query.limit || 100), 500);
    return db.prepare(`
      SELECT * FROM security_account_sharing_events
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(access.tenantId, access.branchId || "", limit).map((row) => rowWithJson(row, ["details"]));
  }

  inspectSubscriptionGuard(req) {
    const access = req.access || {};
    if (!access.tenantId) return { guarded: false, allowed: true };
    const policies = this.getPolicies(access);
    if (policies.subscriptionGuardEnabled === "false") return { guarded: false, allowed: true };
    const path = req.originalUrl || req.url || "";
    if (!SUBSCRIPTION_GUARD_PATTERN.test(path)) return { guarded: false, allowed: true };
    const status = String(req.tenant?.subscriptionStatus || "").toLowerCase();
    const blocked = ["expired", "past_due", "cancelled", "canceled", "suspended", "inactive"].includes(status);
    if (!blocked) return { guarded: true, allowed: true };
    this.recordSubscriptionGuardEvent({ subscriptionStatus: status, path, summary: "Subscription guard blocked premium module access" }, access, req);
    return { guarded: true, allowed: false, subscriptionStatus: status };
  }

  recordSubscriptionGuardEvent(payload = {}, access = {}, req = {}) {
    const timestamp = now();
    const record = {
      id: makeId("subguard"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      userId: access.userId || "",
      subscriptionStatus: String(payload.subscriptionStatus || ""),
      path: String(payload.path || ""),
      action: String(payload.action || "module_guard"),
      summary: String(payload.summary || "Subscription guard event"),
      status: "open",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_subscription_guard_events
      (id, tenantId, branchId, userId, subscriptionStatus, path, action, summary, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @userId, @subscriptionStatus, @path, @action, @summary, @status, @createdAt, @updatedAt)
    `).run(record);
    audit("security.subscription_guard.event", access, req, { id: record.id, path: record.path, subscriptionStatus: record.subscriptionStatus });
    return record;
  }

  listSubscriptionGuardEvents(access = {}) {
    return db.prepare(`
      SELECT * FROM security_subscription_guard_events
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(access.tenantId, access.branchId || "");
  }

  ensureDefaultFraudWarnings(access = {}) {
    if (!access.tenantId) return;
    const timestamp = now();
    const defaults = [
      ["Never share OTP, password or recovery codes", "Aura staff will never ask for your password, OTP, card number or recovery code on phone, WhatsApp or email.", "warning"],
      ["Open Aura only from your official URL", "Avoid links from unknown SMS/email. Type your official CRM/POS URL directly in the browser.", "info"],
      ["Report suspicious payment requests", "If any payment link or refund request looks unusual, pause and report it to the owner/admin.", "warning"]
    ];
    const stmt = db.prepare(`
      INSERT OR IGNORE INTO security_fraud_warnings
      (id, tenantId, branchId, title, message, severity, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, '', @title, @message, @severity, 'active', @createdAt, @updatedAt)
    `);
    for (const [title, message, severity] of defaults) {
      stmt.run({ id: makeId("fraud"), tenantId: access.tenantId, title, message, severity, createdAt: timestamp, updatedAt: timestamp });
    }
  }

  listFraudWarnings(access = {}) {
    this.ensureDefaultFraudWarnings(access);
    return db.prepare(`
      SELECT * FROM security_fraud_warnings
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?) AND status = 'active'
      ORDER BY createdAt ASC
    `).all(access.tenantId, access.branchId || "");
  }

  saveFraudWarning(payload = {}, access = {}, req = {}) {
    const title = String(payload.title || "").trim();
    const message = String(payload.message || "").trim();
    if (!title || !message) throw badRequest("title and message are required");
    const timestamp = now();
    const record = {
      id: makeId("fraud"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      title,
      message,
      severity: String(payload.severity || "info"),
      status: "active",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_fraud_warnings
      (id, tenantId, branchId, title, message, severity, status, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @title, @message, @severity, @status, @createdAt, @updatedAt)
    `).run(record);
    audit("security.fraud_warning.created", access, req, { id: record.id, title });
    return record;
  }

  createDisclosureReport(payload = {}, access = {}, req = {}) {
    const summary = String(payload.summary || "").trim();
    if (!summary) throw badRequest("summary is required");
    const timestamp = now();
    const record = {
      id: makeId("disclosure"),
      tenantId: access.tenantId,
      branchId: access.branchId || "",
      reporterName: String(payload.reporterName || ""),
      reporterContact: String(payload.reporterContact || ""),
      summary,
      details: String(payload.details || ""),
      severity: String(payload.severity || "warning"),
      status: "new",
      resolvedAt: "",
      createdAt: timestamp,
      updatedAt: timestamp
    };
    db.prepare(`
      INSERT INTO security_disclosure_reports
      (id, tenantId, branchId, reporterName, reporterContact, summary, details, severity, status, resolvedAt, createdAt, updatedAt)
      VALUES (@id, @tenantId, @branchId, @reporterName, @reporterContact, @summary, @details, @severity, @status, @resolvedAt, @createdAt, @updatedAt)
    `).run(record);
    audit("security.disclosure_report.created", access, req, { id: record.id, severity: record.severity });
    return record;
  }

  listDisclosureReports(access = {}) {
    return db.prepare(`
      SELECT * FROM security_disclosure_reports
      WHERE tenantId = ? AND (branchId = '' OR branchId = ?)
      ORDER BY createdAt DESC
      LIMIT 100
    `).all(access.tenantId, access.branchId || "");
  }

  inspectExportRequest(req) {
    const path = `${req.method || ""} ${req.originalUrl || req.url || ""}`;
    if (!EXPORT_PATH_PATTERN.test(path)) return { exportRequest: false };
    const access = req.access || {};
    if (!access.tenantId) return { exportRequest: true, protected: false };
    const policies = this.getPolicies(access);
    const pinRequired = policies.securityPinRequiredForExport === "true";
    const protectionEnabled = policies.exportProtectionEnabled !== "false";
    intrusionDetectionService.recordSensitiveAccess({
      tenantId: access.tenantId,
      userId: access.userId || "",
      role: access.role || "",
      resource: path,
      ip: requestIp(req)
    });
    return {
      exportRequest: true,
      protected: protectionEnabled,
      pinRequired,
      allowed: !protectionEnabled || !pinRequired || req.get("x-security-pin-verified") === "true"
    };
  }
}

export const securityAdvancedService = new SecurityAdvancedService();
