import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "packages.settings";

const DEFAULT_SETTINGS = {
  packageCatalog: {
    packageSalesEnabled: true,
    visibleInPos: true,
    packageGroupsEnabled: true,
    paidPackageAddonEnabled: true
  },
  creditsRedemption: {
    allowPartialRedemption: true,
    allowCrossServiceRedemption: false,
    blockRedemptionWhenExpired: true,
    requireStaffConfirmation: true
  },
  expiryRenewal: {
    expiryDaysEnabled: true,
    defaultExpiryDays: 365,
    renewalReminderDays: 30,
    expiredPendingAction: "warn"
  },
  pricingPayment: {
    allowDiscountOnPackage: true,
    packageTaxApplicable: true,
    taxInclusivePackagePrice: false,
    allowDueOnPackageSale: true
  },
  onlineBooking: {
    showPackagesOnline: true,
    allowClientPackagePurchase: false,
    allowPackageServiceBooking: true
  },
  remindersRisk: {
    pendingCreditReminder: true,
    expiryReminder: true,
    ownerAlertForHighPendingValue: true,
    highPendingValueThreshold: 10000
  },
  defaults: {
    defaultStatus: "active",
    defaultPackageType: "serviceCredits"
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
  const packageCatalog = input.packageCatalog || {};
  const creditsRedemption = input.creditsRedemption || {};
  const expiryRenewal = input.expiryRenewal || {};
  const pricingPayment = input.pricingPayment || {};
  const onlineBooking = input.onlineBooking || {};
  const remindersRisk = input.remindersRisk || {};
  const defaults = input.defaults || {};

  return {
    packageCatalog: {
      packageSalesEnabled: boolValue(packageCatalog.packageSalesEnabled, DEFAULT_SETTINGS.packageCatalog.packageSalesEnabled),
      visibleInPos: boolValue(packageCatalog.visibleInPos, DEFAULT_SETTINGS.packageCatalog.visibleInPos),
      packageGroupsEnabled: boolValue(packageCatalog.packageGroupsEnabled, DEFAULT_SETTINGS.packageCatalog.packageGroupsEnabled),
      paidPackageAddonEnabled: boolValue(packageCatalog.paidPackageAddonEnabled, DEFAULT_SETTINGS.packageCatalog.paidPackageAddonEnabled)
    },
    creditsRedemption: {
      allowPartialRedemption: boolValue(creditsRedemption.allowPartialRedemption, DEFAULT_SETTINGS.creditsRedemption.allowPartialRedemption),
      allowCrossServiceRedemption: boolValue(creditsRedemption.allowCrossServiceRedemption, DEFAULT_SETTINGS.creditsRedemption.allowCrossServiceRedemption),
      blockRedemptionWhenExpired: boolValue(creditsRedemption.blockRedemptionWhenExpired, DEFAULT_SETTINGS.creditsRedemption.blockRedemptionWhenExpired),
      requireStaffConfirmation: boolValue(creditsRedemption.requireStaffConfirmation, DEFAULT_SETTINGS.creditsRedemption.requireStaffConfirmation)
    },
    expiryRenewal: {
      expiryDaysEnabled: boolValue(expiryRenewal.expiryDaysEnabled, DEFAULT_SETTINGS.expiryRenewal.expiryDaysEnabled),
      defaultExpiryDays: numberValue(expiryRenewal.defaultExpiryDays, DEFAULT_SETTINGS.expiryRenewal.defaultExpiryDays, 0, 3650),
      renewalReminderDays: numberValue(expiryRenewal.renewalReminderDays, DEFAULT_SETTINGS.expiryRenewal.renewalReminderDays, 0, 365),
      expiredPendingAction: stringValue(expiryRenewal.expiredPendingAction, DEFAULT_SETTINGS.expiryRenewal.expiredPendingAction, ["allow", "warn", "block"])
    },
    pricingPayment: {
      allowDiscountOnPackage: boolValue(pricingPayment.allowDiscountOnPackage, DEFAULT_SETTINGS.pricingPayment.allowDiscountOnPackage),
      packageTaxApplicable: boolValue(pricingPayment.packageTaxApplicable, DEFAULT_SETTINGS.pricingPayment.packageTaxApplicable),
      taxInclusivePackagePrice: boolValue(pricingPayment.taxInclusivePackagePrice, DEFAULT_SETTINGS.pricingPayment.taxInclusivePackagePrice),
      allowDueOnPackageSale: boolValue(pricingPayment.allowDueOnPackageSale, DEFAULT_SETTINGS.pricingPayment.allowDueOnPackageSale)
    },
    onlineBooking: {
      showPackagesOnline: boolValue(onlineBooking.showPackagesOnline, DEFAULT_SETTINGS.onlineBooking.showPackagesOnline),
      allowClientPackagePurchase: boolValue(onlineBooking.allowClientPackagePurchase, DEFAULT_SETTINGS.onlineBooking.allowClientPackagePurchase),
      allowPackageServiceBooking: boolValue(onlineBooking.allowPackageServiceBooking, DEFAULT_SETTINGS.onlineBooking.allowPackageServiceBooking)
    },
    remindersRisk: {
      pendingCreditReminder: boolValue(remindersRisk.pendingCreditReminder, DEFAULT_SETTINGS.remindersRisk.pendingCreditReminder),
      expiryReminder: boolValue(remindersRisk.expiryReminder, DEFAULT_SETTINGS.remindersRisk.expiryReminder),
      ownerAlertForHighPendingValue: boolValue(remindersRisk.ownerAlertForHighPendingValue, DEFAULT_SETTINGS.remindersRisk.ownerAlertForHighPendingValue),
      highPendingValueThreshold: numberValue(remindersRisk.highPendingValueThreshold, DEFAULT_SETTINGS.remindersRisk.highPendingValueThreshold, 0, 10000000)
    },
    defaults: {
      defaultStatus: stringValue(defaults.defaultStatus, DEFAULT_SETTINGS.defaults.defaultStatus, ["active", "inactive"]),
      defaultPackageType: stringValue(defaults.defaultPackageType, DEFAULT_SETTINGS.defaults.defaultPackageType, ["serviceCredits", "valueWallet", "mixed"])
    }
  };
}

function normalizeAudit(input = {}) {
  return {
    lastChangedBy: input.lastChangedBy || DEFAULT_AUDIT.lastChangedBy,
    lastChangedAt: input.lastChangedAt || DEFAULT_AUDIT.lastChangedAt
  };
}

export const packageSettingsService = {
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
