import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "message.history.settings";

const DEFAULT_SETTINGS = {
  logging: {
    sms: true,
    whatsapp: true,
    email: true,
    invoiceNotifications: true,
    staffNotifications: true,
    engagementMessages: true
  },
  retention: {
    retentionDays: 365,
    autoArchiveEnabled: true,
    hideDeletedLogs: true
  },
  visibility: {
    showClientMessages: true,
    showStaffMessages: true,
    showSystemMessages: true,
    maskPhoneNumbers: false
  },
  deliveryTracking: {
    trackQueued: true,
    trackSent: true,
    trackDelivered: true,
    trackFailed: true,
    captureProviderReference: true
  },
  searchExport: {
    backendSearchEnabled: true,
    csvDownloadEnabled: true,
    includePayloadInExport: false
  },
  alerts: {
    failedMessageAlert: true,
    highFailureRateAlert: true,
    ownerDailyDigest: true,
    failureRateThreshold: 10
  },
  resendPolicy: {
    allowManualResend: true,
    resendRequiresOwnerApproval: true,
    notesRequiredForResend: true
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
  const logging = input.logging || {};
  const retention = input.retention || {};
  const visibility = input.visibility || {};
  const deliveryTracking = input.deliveryTracking || {};
  const searchExport = input.searchExport || {};
  const alerts = input.alerts || {};
  const resendPolicy = input.resendPolicy || {};

  return {
    logging: {
      sms: boolValue(logging.sms, DEFAULT_SETTINGS.logging.sms),
      whatsapp: boolValue(logging.whatsapp, DEFAULT_SETTINGS.logging.whatsapp),
      email: boolValue(logging.email, DEFAULT_SETTINGS.logging.email),
      invoiceNotifications: boolValue(logging.invoiceNotifications, DEFAULT_SETTINGS.logging.invoiceNotifications),
      staffNotifications: boolValue(logging.staffNotifications, DEFAULT_SETTINGS.logging.staffNotifications),
      engagementMessages: boolValue(logging.engagementMessages, DEFAULT_SETTINGS.logging.engagementMessages)
    },
    retention: {
      retentionDays: numberValue(retention.retentionDays, DEFAULT_SETTINGS.retention.retentionDays, 1, 3650),
      autoArchiveEnabled: boolValue(retention.autoArchiveEnabled, DEFAULT_SETTINGS.retention.autoArchiveEnabled),
      hideDeletedLogs: boolValue(retention.hideDeletedLogs, DEFAULT_SETTINGS.retention.hideDeletedLogs)
    },
    visibility: {
      showClientMessages: boolValue(visibility.showClientMessages, DEFAULT_SETTINGS.visibility.showClientMessages),
      showStaffMessages: boolValue(visibility.showStaffMessages, DEFAULT_SETTINGS.visibility.showStaffMessages),
      showSystemMessages: boolValue(visibility.showSystemMessages, DEFAULT_SETTINGS.visibility.showSystemMessages),
      maskPhoneNumbers: boolValue(visibility.maskPhoneNumbers, DEFAULT_SETTINGS.visibility.maskPhoneNumbers)
    },
    deliveryTracking: {
      trackQueued: boolValue(deliveryTracking.trackQueued, DEFAULT_SETTINGS.deliveryTracking.trackQueued),
      trackSent: boolValue(deliveryTracking.trackSent, DEFAULT_SETTINGS.deliveryTracking.trackSent),
      trackDelivered: boolValue(deliveryTracking.trackDelivered, DEFAULT_SETTINGS.deliveryTracking.trackDelivered),
      trackFailed: boolValue(deliveryTracking.trackFailed, DEFAULT_SETTINGS.deliveryTracking.trackFailed),
      captureProviderReference: boolValue(deliveryTracking.captureProviderReference, DEFAULT_SETTINGS.deliveryTracking.captureProviderReference)
    },
    searchExport: {
      backendSearchEnabled: boolValue(searchExport.backendSearchEnabled, DEFAULT_SETTINGS.searchExport.backendSearchEnabled),
      csvDownloadEnabled: boolValue(searchExport.csvDownloadEnabled, DEFAULT_SETTINGS.searchExport.csvDownloadEnabled),
      includePayloadInExport: boolValue(searchExport.includePayloadInExport, DEFAULT_SETTINGS.searchExport.includePayloadInExport)
    },
    alerts: {
      failedMessageAlert: boolValue(alerts.failedMessageAlert, DEFAULT_SETTINGS.alerts.failedMessageAlert),
      highFailureRateAlert: boolValue(alerts.highFailureRateAlert, DEFAULT_SETTINGS.alerts.highFailureRateAlert),
      ownerDailyDigest: boolValue(alerts.ownerDailyDigest, DEFAULT_SETTINGS.alerts.ownerDailyDigest),
      failureRateThreshold: numberValue(alerts.failureRateThreshold, DEFAULT_SETTINGS.alerts.failureRateThreshold, 1, 100)
    },
    resendPolicy: {
      allowManualResend: boolValue(resendPolicy.allowManualResend, DEFAULT_SETTINGS.resendPolicy.allowManualResend),
      resendRequiresOwnerApproval: boolValue(resendPolicy.resendRequiresOwnerApproval, DEFAULT_SETTINGS.resendPolicy.resendRequiresOwnerApproval),
      notesRequiredForResend: boolValue(resendPolicy.notesRequiredForResend, DEFAULT_SETTINGS.resendPolicy.notesRequiredForResend)
    }
  };
}

function normalizeAudit(input = {}) {
  return {
    lastChangedBy: input.lastChangedBy || DEFAULT_AUDIT.lastChangedBy,
    lastChangedAt: input.lastChangedAt || DEFAULT_AUDIT.lastChangedAt
  };
}

export const messageHistorySettingsService = {
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
