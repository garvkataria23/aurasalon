import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "security.settings";

const DEFAULT_SETTINGS = {
  loginSession: {
    sessionTimeoutMinutes: 60,
    refreshTokenDays: 7,
    requireReauthForSensitiveActions: true,
    sessionKillSwitchEnabled: true
  },
  passwordPolicy: {
    minLength: 8,
    requireUppercase: true,
    requireNumber: true,
    requireSymbol: false,
    expiryDays: 90
  },
  twoFactor: {
    ownerRequired: true,
    staffOptional: true,
    rememberDeviceDays: 30
  },
  deviceIpProtection: {
    unknownDeviceAlert: true,
    ipBlocklistEnabled: true,
    geoRiskAlert: true,
    maxFailedAttempts: 5
  },
  exportDataAccess: {
    exportProtectionEnabled: true,
    requireOwnerApprovalForExport: true,
    maskClientContactForStaff: true
  },
  approvalsAudit: {
    auditLogEnabled: true,
    securityAlertNotifications: true,
    dailySecurityDigest: true,
    approvalRequiredForRoleChange: true
  }
};

const DEFAULT_AUDIT = {
  lastChangedBy: "Not saved yet",
  lastChangedAt: ""
};

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function tenantIdFrom(access = {}) {
  const tenantId = access.tenantId || "";
  if (!tenantId) throw badRequest("tenantId is required");
  return tenantId;
}

function branchIdFrom(input = {}, access = {}) {
  const branchId = input.branchId || access.branchId || "";
  if (branchId) tenantService.assertBranchAccess(access, branchId);
  return branchId;
}

function settingKey(branchId) {
  return `${SETTING_PREFIX}.${branchId || "all"}`;
}

function boolValue(value, fallback) {
  return typeof value === "boolean" ? value : fallback;
}

function numberValue(value, fallback, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(max, Math.max(min, Math.round(parsed)));
}

function normalizeSettings(input = {}) {
  const loginSession = input.loginSession || {};
  const passwordPolicy = input.passwordPolicy || {};
  const twoFactor = input.twoFactor || {};
  const deviceIpProtection = input.deviceIpProtection || {};
  const exportDataAccess = input.exportDataAccess || {};
  const approvalsAudit = input.approvalsAudit || {};

  return {
    loginSession: {
      sessionTimeoutMinutes: numberValue(loginSession.sessionTimeoutMinutes, DEFAULT_SETTINGS.loginSession.sessionTimeoutMinutes, 5, 1440),
      refreshTokenDays: numberValue(loginSession.refreshTokenDays, DEFAULT_SETTINGS.loginSession.refreshTokenDays, 1, 90),
      requireReauthForSensitiveActions: boolValue(loginSession.requireReauthForSensitiveActions, DEFAULT_SETTINGS.loginSession.requireReauthForSensitiveActions),
      sessionKillSwitchEnabled: boolValue(loginSession.sessionKillSwitchEnabled, DEFAULT_SETTINGS.loginSession.sessionKillSwitchEnabled)
    },
    passwordPolicy: {
      minLength: numberValue(passwordPolicy.minLength, DEFAULT_SETTINGS.passwordPolicy.minLength, 6, 64),
      requireUppercase: boolValue(passwordPolicy.requireUppercase, DEFAULT_SETTINGS.passwordPolicy.requireUppercase),
      requireNumber: boolValue(passwordPolicy.requireNumber, DEFAULT_SETTINGS.passwordPolicy.requireNumber),
      requireSymbol: boolValue(passwordPolicy.requireSymbol, DEFAULT_SETTINGS.passwordPolicy.requireSymbol),
      expiryDays: numberValue(passwordPolicy.expiryDays, DEFAULT_SETTINGS.passwordPolicy.expiryDays, 0, 365)
    },
    twoFactor: {
      ownerRequired: boolValue(twoFactor.ownerRequired, DEFAULT_SETTINGS.twoFactor.ownerRequired),
      staffOptional: boolValue(twoFactor.staffOptional, DEFAULT_SETTINGS.twoFactor.staffOptional),
      rememberDeviceDays: numberValue(twoFactor.rememberDeviceDays, DEFAULT_SETTINGS.twoFactor.rememberDeviceDays, 0, 90)
    },
    deviceIpProtection: {
      unknownDeviceAlert: boolValue(deviceIpProtection.unknownDeviceAlert, DEFAULT_SETTINGS.deviceIpProtection.unknownDeviceAlert),
      ipBlocklistEnabled: boolValue(deviceIpProtection.ipBlocklistEnabled, DEFAULT_SETTINGS.deviceIpProtection.ipBlocklistEnabled),
      geoRiskAlert: boolValue(deviceIpProtection.geoRiskAlert, DEFAULT_SETTINGS.deviceIpProtection.geoRiskAlert),
      maxFailedAttempts: numberValue(deviceIpProtection.maxFailedAttempts, DEFAULT_SETTINGS.deviceIpProtection.maxFailedAttempts, 1, 50)
    },
    exportDataAccess: {
      exportProtectionEnabled: boolValue(exportDataAccess.exportProtectionEnabled, DEFAULT_SETTINGS.exportDataAccess.exportProtectionEnabled),
      requireOwnerApprovalForExport: boolValue(exportDataAccess.requireOwnerApprovalForExport, DEFAULT_SETTINGS.exportDataAccess.requireOwnerApprovalForExport),
      maskClientContactForStaff: boolValue(exportDataAccess.maskClientContactForStaff, DEFAULT_SETTINGS.exportDataAccess.maskClientContactForStaff)
    },
    approvalsAudit: {
      auditLogEnabled: boolValue(approvalsAudit.auditLogEnabled, DEFAULT_SETTINGS.approvalsAudit.auditLogEnabled),
      securityAlertNotifications: boolValue(approvalsAudit.securityAlertNotifications, DEFAULT_SETTINGS.approvalsAudit.securityAlertNotifications),
      dailySecurityDigest: boolValue(approvalsAudit.dailySecurityDigest, DEFAULT_SETTINGS.approvalsAudit.dailySecurityDigest),
      approvalRequiredForRoleChange: boolValue(approvalsAudit.approvalRequiredForRoleChange, DEFAULT_SETTINGS.approvalsAudit.approvalRequiredForRoleChange)
    }
  };
}

function normalizeAudit(input = {}) {
  return {
    lastChangedBy: input.lastChangedBy || DEFAULT_AUDIT.lastChangedBy,
    lastChangedAt: input.lastChangedAt || DEFAULT_AUDIT.lastChangedAt
  };
}

export const securitySettingsService = {
  get(query = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(query, access);
    const key = settingKey(branchId);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = @tenantId AND key = @key").get({ tenantId, key });
    const saved = parseJson(row?.value, null);
    return {
      branchId,
      settings: normalizeSettings(saved?.settings || saved || DEFAULT_SETTINGS),
      audit: normalizeAudit(saved?.audit)
    };
  },

  save(payload = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(payload, access);
    const key = settingKey(branchId);
    const settings = normalizeSettings(payload.settings || payload);
    const now = new Date().toISOString();
    const audit = {
      lastChangedBy: access.user?.email || access.user?.id || access.role || "system",
      lastChangedAt: now
    };
    const id = `setting_${tenantId}_${key}`.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 120);
    db.prepare(`
      INSERT INTO settings (id, tenantId, key, value, scope, createdAt, updatedAt)
      VALUES (@id, @tenantId, @key, @value, @scope, @createdAt, @updatedAt)
      ON CONFLICT(tenantId, key) DO UPDATE SET
        value = excluded.value,
        scope = excluded.scope,
        updatedAt = excluded.updatedAt
    `).run({
      id,
      tenantId,
      key,
      value: JSON.stringify({ branchId, settings, audit }),
      scope: branchId ? "branch" : "tenant",
      createdAt: now,
      updatedAt: now
    });
    return { branchId, settings, audit };
  }
};
