import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "other.settings";

const DEFAULT_SETTINGS = {
  discountMembership: true,
  barcodeBilling: true,
  tipOption: true,
  packageExpiryDays: true,
  paidPackageAddon: true,
  appointmentProductSearchByBrandAndType: true,
  appointmentProductSearchByProductName: true,
  staffCommissionOnBookingForm: true
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

function normalizeSettings(input = {}) {
  return Object.fromEntries(
    Object.entries(DEFAULT_SETTINGS).map(([key, fallback]) => [key, typeof input[key] === "boolean" ? input[key] : fallback])
  );
}

function actorFrom(access = {}) {
  return access.userId || access.email || access.role || "owner";
}

export const otherSettingsService = {
  defaults() {
    return DEFAULT_SETTINGS;
  },

  get(query = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(query, access);
    const key = settingKey(branchId);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = @tenantId AND key = @key").get({ tenantId, key });
    const saved = parseJson(row?.value, null);
    return {
      branchId,
      settings: normalizeSettings(saved?.settings || saved || DEFAULT_SETTINGS),
      audit: { ...DEFAULT_AUDIT, ...(saved?.audit || {}) }
    };
  },

  save(payload = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(payload, access);
    const key = settingKey(branchId);
    const settings = normalizeSettings(payload.settings || payload);
    const now = new Date().toISOString();
    const audit = { lastChangedBy: actorFrom(access), lastChangedAt: now };
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
