import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "services.settings";

const DEFAULT_SETTINGS = {
  serviceCatalog: {
    serviceGroupsEnabled: true,
    serviceAddonsEnabled: true,
    packagesEnabled: true,
    membershipServicesEnabled: true
  },
  pricingDuration: {
    defaultDurationMinutes: 30,
    allowCustomDuration: true,
    allowPriceOverride: true,
    taxInclusiveDefault: false
  },
  staffAssignment: {
    staffAssignmentRequired: false,
    allowMultiStaff: true,
    skillBasedAssignment: true,
    roomResourceRequired: false
  },
  onlineBooking: {
    showServicesOnline: true,
    hideInactiveServices: true,
    allowPackageServiceBooking: true,
    requireDepositForOnlineServices: false
  },
  recipeInventory: {
    requireRecipeForService: false,
    blockConsumeWithoutRecipe: false,
    warnHighWastage: true
  },
  commission: {
    staffCommissionEnabled: true,
    commissionBasis: "servicePrice",
    incentiveEligible: true
  },
  qualityControl: {
    requireServiceNotes: false,
    requireBeforeAfterPhoto: false,
    consentRequiredForRiskServices: true
  },
  defaults: {
    defaultStatus: "active",
    defaultGstRate: 18
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

function stringValue(value, fallback, allowed = null) {
  const next = String(value ?? fallback).trim() || fallback;
  return allowed && !allowed.includes(next) ? fallback : next;
}

function normalizeSettings(input = {}) {
  const serviceCatalog = input.serviceCatalog || {};
  const pricingDuration = input.pricingDuration || {};
  const staffAssignment = input.staffAssignment || {};
  const onlineBooking = input.onlineBooking || {};
  const recipeInventory = input.recipeInventory || {};
  const commission = input.commission || {};
  const qualityControl = input.qualityControl || {};
  const defaults = input.defaults || {};

  return {
    serviceCatalog: {
      serviceGroupsEnabled: boolValue(serviceCatalog.serviceGroupsEnabled, DEFAULT_SETTINGS.serviceCatalog.serviceGroupsEnabled),
      serviceAddonsEnabled: boolValue(serviceCatalog.serviceAddonsEnabled, DEFAULT_SETTINGS.serviceCatalog.serviceAddonsEnabled),
      packagesEnabled: boolValue(serviceCatalog.packagesEnabled, DEFAULT_SETTINGS.serviceCatalog.packagesEnabled),
      membershipServicesEnabled: boolValue(serviceCatalog.membershipServicesEnabled, DEFAULT_SETTINGS.serviceCatalog.membershipServicesEnabled)
    },
    pricingDuration: {
      defaultDurationMinutes: numberValue(pricingDuration.defaultDurationMinutes, DEFAULT_SETTINGS.pricingDuration.defaultDurationMinutes, 5, 480),
      allowCustomDuration: boolValue(pricingDuration.allowCustomDuration, DEFAULT_SETTINGS.pricingDuration.allowCustomDuration),
      allowPriceOverride: boolValue(pricingDuration.allowPriceOverride, DEFAULT_SETTINGS.pricingDuration.allowPriceOverride),
      taxInclusiveDefault: boolValue(pricingDuration.taxInclusiveDefault, DEFAULT_SETTINGS.pricingDuration.taxInclusiveDefault)
    },
    staffAssignment: {
      staffAssignmentRequired: boolValue(staffAssignment.staffAssignmentRequired, DEFAULT_SETTINGS.staffAssignment.staffAssignmentRequired),
      allowMultiStaff: boolValue(staffAssignment.allowMultiStaff, DEFAULT_SETTINGS.staffAssignment.allowMultiStaff),
      skillBasedAssignment: boolValue(staffAssignment.skillBasedAssignment, DEFAULT_SETTINGS.staffAssignment.skillBasedAssignment),
      roomResourceRequired: boolValue(staffAssignment.roomResourceRequired, DEFAULT_SETTINGS.staffAssignment.roomResourceRequired)
    },
    onlineBooking: {
      showServicesOnline: boolValue(onlineBooking.showServicesOnline, DEFAULT_SETTINGS.onlineBooking.showServicesOnline),
      hideInactiveServices: boolValue(onlineBooking.hideInactiveServices, DEFAULT_SETTINGS.onlineBooking.hideInactiveServices),
      allowPackageServiceBooking: boolValue(onlineBooking.allowPackageServiceBooking, DEFAULT_SETTINGS.onlineBooking.allowPackageServiceBooking),
      requireDepositForOnlineServices: boolValue(onlineBooking.requireDepositForOnlineServices, DEFAULT_SETTINGS.onlineBooking.requireDepositForOnlineServices)
    },
    recipeInventory: {
      requireRecipeForService: boolValue(recipeInventory.requireRecipeForService, DEFAULT_SETTINGS.recipeInventory.requireRecipeForService),
      blockConsumeWithoutRecipe: boolValue(recipeInventory.blockConsumeWithoutRecipe, DEFAULT_SETTINGS.recipeInventory.blockConsumeWithoutRecipe),
      warnHighWastage: boolValue(recipeInventory.warnHighWastage, DEFAULT_SETTINGS.recipeInventory.warnHighWastage)
    },
    commission: {
      staffCommissionEnabled: boolValue(commission.staffCommissionEnabled, DEFAULT_SETTINGS.commission.staffCommissionEnabled),
      commissionBasis: stringValue(commission.commissionBasis, DEFAULT_SETTINGS.commission.commissionBasis, ["servicePrice", "netOfDiscount", "netOfTax"]),
      incentiveEligible: boolValue(commission.incentiveEligible, DEFAULT_SETTINGS.commission.incentiveEligible)
    },
    qualityControl: {
      requireServiceNotes: boolValue(qualityControl.requireServiceNotes, DEFAULT_SETTINGS.qualityControl.requireServiceNotes),
      requireBeforeAfterPhoto: boolValue(qualityControl.requireBeforeAfterPhoto, DEFAULT_SETTINGS.qualityControl.requireBeforeAfterPhoto),
      consentRequiredForRiskServices: boolValue(qualityControl.consentRequiredForRiskServices, DEFAULT_SETTINGS.qualityControl.consentRequiredForRiskServices)
    },
    defaults: {
      defaultStatus: stringValue(defaults.defaultStatus, DEFAULT_SETTINGS.defaults.defaultStatus, ["active", "inactive"]),
      defaultGstRate: numberValue(defaults.defaultGstRate, DEFAULT_SETTINGS.defaults.defaultGstRate, 0, 100)
    }
  };
}

function normalizeAudit(input = {}) {
  return {
    lastChangedBy: input.lastChangedBy || DEFAULT_AUDIT.lastChangedBy,
    lastChangedAt: input.lastChangedAt || DEFAULT_AUDIT.lastChangedAt
  };
}

export const serviceSettingsService = {
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
