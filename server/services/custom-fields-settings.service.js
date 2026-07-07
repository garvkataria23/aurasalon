import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "custom.fields.settings";

const FIELD_TYPES = ["text", "number", "date", "select", "checkbox", "textarea"];
const APPLIES_TO = ["client", "appointment", "invoice", "service", "staff"];

const DEFAULT_SETTINGS = {
  enabled: true,
  showOnPos: true,
  showOnBooking: false,
  allowStaffEdit: true,
  requireOwnerApprovalForRequiredFields: true,
  fields: [
    {
      id: "client_source",
      label: "Client Source",
      type: "select",
      appliesTo: "client",
      required: false,
      showOnline: false,
      active: true,
      optionsText: "Walk-in, Instagram, Google, Referral"
    },
    {
      id: "appointment_note",
      label: "Appointment Note",
      type: "textarea",
      appliesTo: "appointment",
      required: false,
      showOnline: true,
      active: true,
      optionsText: ""
    }
  ]
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

function stringValue(value, fallback, allowed = null) {
  const next = String(value ?? fallback).trim() || fallback;
  return allowed && !allowed.includes(next) ? fallback : next;
}

function fieldId(value, fallback) {
  return stringValue(value, fallback).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0, 64) || fallback;
}

function normalizeField(input = {}, index = 0) {
  const label = stringValue(input.label, `Custom Field ${index + 1}`).slice(0, 80);
  return {
    id: fieldId(input.id || label, `custom_field_${index + 1}`),
    label,
    type: stringValue(input.type, "text", FIELD_TYPES),
    appliesTo: stringValue(input.appliesTo, "client", APPLIES_TO),
    required: boolValue(input.required, false),
    showOnline: boolValue(input.showOnline, false),
    active: boolValue(input.active, true),
    optionsText: stringValue(input.optionsText, "").slice(0, 500)
  };
}

function normalizeSettings(input = {}) {
  const fields = Array.isArray(input.fields) ? input.fields : DEFAULT_SETTINGS.fields;
  return {
    enabled: boolValue(input.enabled, DEFAULT_SETTINGS.enabled),
    showOnPos: boolValue(input.showOnPos, DEFAULT_SETTINGS.showOnPos),
    showOnBooking: boolValue(input.showOnBooking, DEFAULT_SETTINGS.showOnBooking),
    allowStaffEdit: boolValue(input.allowStaffEdit, DEFAULT_SETTINGS.allowStaffEdit),
    requireOwnerApprovalForRequiredFields: boolValue(input.requireOwnerApprovalForRequiredFields, DEFAULT_SETTINGS.requireOwnerApprovalForRequiredFields),
    fields: fields.slice(0, 50).map((field, index) => normalizeField(field, index))
  };
}

function normalizeAudit(input = {}) {
  return {
    lastChangedBy: input.lastChangedBy || DEFAULT_AUDIT.lastChangedBy,
    lastChangedAt: input.lastChangedAt || DEFAULT_AUDIT.lastChangedAt
  };
}

export const customFieldsSettingsService = {
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
