import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "smsTemplate.settings";

const DEFAULT_SETTINGS = {
  smsControl: {
    smsEnabled: true,
    transactionalSmsEnabled: true,
    promotionalSmsEnabled: false,
    requireOwnerApprovalForPromo: true,
    dltTemplateIdRequired: true
  },
  sender: {
    senderId: "AURAOS",
    countryCode: "+91",
    fallbackToWhatsapp: false,
    quietHoursEnabled: true,
    quietHoursStart: "21:00",
    quietHoursEnd: "09:00"
  },
  automation: {
    appointmentConfirmation: true,
    appointmentReminder: true,
    birthdayGreeting: true,
    paymentDueReminder: true,
    packageExpiryReminder: true,
    consentReminder: true,
    reviewRequest: true
  },
  templates: [
    {
      id: "appointment_confirmation",
      name: "Appointment Confirmation",
      enabled: true,
      dltTemplateId: "",
      body: "Hi {{clientName}}, your appointment at {{businessName}} is confirmed for {{appointmentDate}} {{appointmentTime}}."
    },
    {
      id: "appointment_reminder",
      name: "Appointment Reminder",
      enabled: true,
      dltTemplateId: "",
      body: "Hi {{clientName}}, reminder for your appointment at {{businessName}} on {{appointmentDate}} {{appointmentTime}}."
    },
    {
      id: "payment_due",
      name: "Payment Due Reminder",
      enabled: true,
      dltTemplateId: "",
      body: "Hi {{clientName}}, your pending amount is {{dueAmount}} at {{businessName}}."
    }
  ],
  alerts: {
    notifyOwnerOnFailedSms: true,
    notifyOwnerOnLowBalance: true,
    lowBalanceThreshold: 100
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

function textValue(value, fallback = "", maxLength = 1000) {
  return String(value ?? fallback).trim().slice(0, maxLength);
}

function normalizeTemplates(value) {
  const templates = Array.isArray(value) ? value : DEFAULT_SETTINGS.templates;
  return templates.slice(0, 30).map((item, index) => {
    const fallback = DEFAULT_SETTINGS.templates[index] || {
      id: `custom_sms_${index + 1}`,
      name: `Custom SMS ${index + 1}`,
      enabled: true,
      dltTemplateId: "",
      body: ""
    };
    return {
      id: textValue(item?.id, fallback.id, 80).replace(/[^a-zA-Z0-9_-]+/g, "_") || fallback.id,
      name: textValue(item?.name, fallback.name, 160),
      enabled: boolValue(item?.enabled, fallback.enabled),
      dltTemplateId: textValue(item?.dltTemplateId, fallback.dltTemplateId, 120),
      body: textValue(item?.body, fallback.body, 1000)
    };
  });
}

function normalizeSettings(input = {}) {
  const smsControl = input.smsControl || {};
  const sender = input.sender || {};
  const automation = input.automation || {};
  const alerts = input.alerts || {};

  return {
    smsControl: {
      smsEnabled: boolValue(smsControl.smsEnabled, DEFAULT_SETTINGS.smsControl.smsEnabled),
      transactionalSmsEnabled: boolValue(smsControl.transactionalSmsEnabled, DEFAULT_SETTINGS.smsControl.transactionalSmsEnabled),
      promotionalSmsEnabled: boolValue(smsControl.promotionalSmsEnabled, DEFAULT_SETTINGS.smsControl.promotionalSmsEnabled),
      requireOwnerApprovalForPromo: boolValue(smsControl.requireOwnerApprovalForPromo, DEFAULT_SETTINGS.smsControl.requireOwnerApprovalForPromo),
      dltTemplateIdRequired: boolValue(smsControl.dltTemplateIdRequired, DEFAULT_SETTINGS.smsControl.dltTemplateIdRequired)
    },
    sender: {
      senderId: textValue(sender.senderId, DEFAULT_SETTINGS.sender.senderId, 20),
      countryCode: textValue(sender.countryCode, DEFAULT_SETTINGS.sender.countryCode, 8),
      fallbackToWhatsapp: boolValue(sender.fallbackToWhatsapp, DEFAULT_SETTINGS.sender.fallbackToWhatsapp),
      quietHoursEnabled: boolValue(sender.quietHoursEnabled, DEFAULT_SETTINGS.sender.quietHoursEnabled),
      quietHoursStart: textValue(sender.quietHoursStart, DEFAULT_SETTINGS.sender.quietHoursStart, 8),
      quietHoursEnd: textValue(sender.quietHoursEnd, DEFAULT_SETTINGS.sender.quietHoursEnd, 8)
    },
    automation: {
      appointmentConfirmation: boolValue(automation.appointmentConfirmation, DEFAULT_SETTINGS.automation.appointmentConfirmation),
      appointmentReminder: boolValue(automation.appointmentReminder, DEFAULT_SETTINGS.automation.appointmentReminder),
      birthdayGreeting: boolValue(automation.birthdayGreeting, DEFAULT_SETTINGS.automation.birthdayGreeting),
      paymentDueReminder: boolValue(automation.paymentDueReminder, DEFAULT_SETTINGS.automation.paymentDueReminder),
      packageExpiryReminder: boolValue(automation.packageExpiryReminder, DEFAULT_SETTINGS.automation.packageExpiryReminder),
      consentReminder: boolValue(automation.consentReminder, DEFAULT_SETTINGS.automation.consentReminder),
      reviewRequest: boolValue(automation.reviewRequest, DEFAULT_SETTINGS.automation.reviewRequest)
    },
    templates: normalizeTemplates(input.templates),
    alerts: {
      notifyOwnerOnFailedSms: boolValue(alerts.notifyOwnerOnFailedSms, DEFAULT_SETTINGS.alerts.notifyOwnerOnFailedSms),
      notifyOwnerOnLowBalance: boolValue(alerts.notifyOwnerOnLowBalance, DEFAULT_SETTINGS.alerts.notifyOwnerOnLowBalance),
      lowBalanceThreshold: numberValue(alerts.lowBalanceThreshold, DEFAULT_SETTINGS.alerts.lowBalanceThreshold, 0, 100000)
    }
  };
}

export const smsTemplateSettingsService = {
  get(query = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(query, access);
    const key = settingKey(branchId);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = @tenantId AND key = @key").get({ tenantId, key });
    const saved = parseJson(row?.value, null);
    return { branchId, settings: normalizeSettings(saved?.settings || saved || DEFAULT_SETTINGS) };
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
