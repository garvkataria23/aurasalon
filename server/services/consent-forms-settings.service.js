import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "consentForms.settings";

const DEFAULT_SETTINGS = {
  consentControl: {
    consentFormsEnabled: true,
    requireConsentBeforeService: true,
    requireConsentBeforeOnlineBooking: false,
    allowSkipWithOwnerApproval: true,
    storeSignedCopy: true
  },
  captureRules: {
    digitalSignatureRequired: true,
    guardianConsentForMinor: true,
    photoConsentRequired: false,
    medicalHistoryRequired: false,
    patchTestConsentRequired: false,
    aftercareAcceptanceRequired: true
  },
  formTemplates: [
    { id: "general_service", name: "General Service Consent", enabled: true, required: true },
    { id: "hair_color", name: "Hair Color / Chemical Consent", enabled: true, required: false },
    { id: "skin_treatment", name: "Skin / Facial Consent", enabled: true, required: false }
  ],
  notifications: {
    remindClientBeforeAppointment: true,
    notifyOwnerWhenMissing: true,
    notifyStaffWhenSigned: true
  },
  retention: {
    retainSignedFormsYears: 3,
    allowClientDownload: true
  }
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

function textValue(value, fallback = "", maxLength = 160) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function normalizeTemplates(value) {
  const templates = Array.isArray(value) ? value : DEFAULT_SETTINGS.formTemplates;
  return templates.slice(0, 25).map((item, index) => {
    const fallback = DEFAULT_SETTINGS.formTemplates[index] || { id: `custom_${index + 1}`, name: `Custom Form ${index + 1}`, enabled: true, required: false };
    const id = textValue(item?.id, fallback.id, 80).replace(/[^a-zA-Z0-9_-]+/g, "_") || fallback.id;
    return {
      id,
      name: textValue(item?.name, fallback.name),
      enabled: boolValue(item?.enabled, fallback.enabled),
      required: boolValue(item?.required, fallback.required)
    };
  });
}

function normalizeSettings(input = {}) {
  const consentControl = input.consentControl || {};
  const captureRules = input.captureRules || {};
  const notifications = input.notifications || {};
  const retention = input.retention || {};

  return {
    consentControl: {
      consentFormsEnabled: boolValue(consentControl.consentFormsEnabled, DEFAULT_SETTINGS.consentControl.consentFormsEnabled),
      requireConsentBeforeService: boolValue(consentControl.requireConsentBeforeService, DEFAULT_SETTINGS.consentControl.requireConsentBeforeService),
      requireConsentBeforeOnlineBooking: boolValue(consentControl.requireConsentBeforeOnlineBooking, DEFAULT_SETTINGS.consentControl.requireConsentBeforeOnlineBooking),
      allowSkipWithOwnerApproval: boolValue(consentControl.allowSkipWithOwnerApproval, DEFAULT_SETTINGS.consentControl.allowSkipWithOwnerApproval),
      storeSignedCopy: boolValue(consentControl.storeSignedCopy, DEFAULT_SETTINGS.consentControl.storeSignedCopy)
    },
    captureRules: {
      digitalSignatureRequired: boolValue(captureRules.digitalSignatureRequired, DEFAULT_SETTINGS.captureRules.digitalSignatureRequired),
      guardianConsentForMinor: boolValue(captureRules.guardianConsentForMinor, DEFAULT_SETTINGS.captureRules.guardianConsentForMinor),
      photoConsentRequired: boolValue(captureRules.photoConsentRequired, DEFAULT_SETTINGS.captureRules.photoConsentRequired),
      medicalHistoryRequired: boolValue(captureRules.medicalHistoryRequired, DEFAULT_SETTINGS.captureRules.medicalHistoryRequired),
      patchTestConsentRequired: boolValue(captureRules.patchTestConsentRequired, DEFAULT_SETTINGS.captureRules.patchTestConsentRequired),
      aftercareAcceptanceRequired: boolValue(captureRules.aftercareAcceptanceRequired, DEFAULT_SETTINGS.captureRules.aftercareAcceptanceRequired)
    },
    formTemplates: normalizeTemplates(input.formTemplates),
    notifications: {
      remindClientBeforeAppointment: boolValue(notifications.remindClientBeforeAppointment, DEFAULT_SETTINGS.notifications.remindClientBeforeAppointment),
      notifyOwnerWhenMissing: boolValue(notifications.notifyOwnerWhenMissing, DEFAULT_SETTINGS.notifications.notifyOwnerWhenMissing),
      notifyStaffWhenSigned: boolValue(notifications.notifyStaffWhenSigned, DEFAULT_SETTINGS.notifications.notifyStaffWhenSigned)
    },
    retention: {
      retainSignedFormsYears: numberValue(retention.retainSignedFormsYears, DEFAULT_SETTINGS.retention.retainSignedFormsYears, 1, 10),
      allowClientDownload: boolValue(retention.allowClientDownload, DEFAULT_SETTINGS.retention.allowClientDownload)
    }
  };
}

export const consentFormsSettingsService = {
  get(query = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(query, access);
    const key = settingKey(branchId);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = @tenantId AND key = @key").get({ tenantId, key });
    const saved = parseJson(row?.value, null);
    return {
      branchId,
      settings: normalizeSettings(saved?.settings || saved || DEFAULT_SETTINGS)
    };
  },

  save(payload = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(payload, access);
    const key = settingKey(branchId);
    const settings = normalizeSettings(payload.settings || payload);
    const now = new Date().toISOString();
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
      value: JSON.stringify({ branchId, settings }),
      scope: branchId ? "branch" : "tenant",
      createdAt: now,
      updatedAt: now
    });
    return { branchId, settings };
  }
};
