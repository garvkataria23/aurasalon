import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "membership.settings";

const DEFAULT_SETTINGS = {
  membershipCatalog: {
    membershipSalesEnabled: true,
    visibleInPos: true,
    visibleOnline: true,
    freeMembershipEnabled: true,
    paidMembershipEnabled: true
  },
  creditsBenefits: {
    serviceCreditsEnabled: true,
    walletCreditsEnabled: true,
    rewardPointsEnabled: true,
    discountBenefitsEnabled: true,
    allowBenefitStacking: false
  },
  renewalExpiry: {
    autoRenewEnabled: false,
    expiryDaysEnabled: true,
    defaultValidityDays: 365,
    renewalReminderDays: 30,
    expiredBenefitAction: "warn"
  },
  paymentBilling: {
    allowDueOnMembershipSale: true,
    membershipTaxApplicable: true,
    taxInclusiveMembershipPrice: false,
    invoiceMembershipSnapshot: true
  },
  redemptionRules: {
    blockRedemptionWhenExpired: true,
    requireStaffConfirmation: true,
    allowPartialCredits: true,
    allowFamilySharing: false
  },
  notificationsRisk: {
    renewalReminder: true,
    lowCreditReminder: true,
    ownerAlertForHighBalance: true,
    highBalanceThreshold: 10000
  },
  defaults: {
    defaultStatus: "active",
    defaultMembershipType: "paid"
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
  const membershipCatalog = input.membershipCatalog || {};
  const creditsBenefits = input.creditsBenefits || {};
  const renewalExpiry = input.renewalExpiry || {};
  const paymentBilling = input.paymentBilling || {};
  const redemptionRules = input.redemptionRules || {};
  const notificationsRisk = input.notificationsRisk || {};
  const defaults = input.defaults || {};

  return {
    membershipCatalog: {
      membershipSalesEnabled: boolValue(membershipCatalog.membershipSalesEnabled, DEFAULT_SETTINGS.membershipCatalog.membershipSalesEnabled),
      visibleInPos: boolValue(membershipCatalog.visibleInPos, DEFAULT_SETTINGS.membershipCatalog.visibleInPos),
      visibleOnline: boolValue(membershipCatalog.visibleOnline, DEFAULT_SETTINGS.membershipCatalog.visibleOnline),
      freeMembershipEnabled: boolValue(membershipCatalog.freeMembershipEnabled, DEFAULT_SETTINGS.membershipCatalog.freeMembershipEnabled),
      paidMembershipEnabled: boolValue(membershipCatalog.paidMembershipEnabled, DEFAULT_SETTINGS.membershipCatalog.paidMembershipEnabled)
    },
    creditsBenefits: {
      serviceCreditsEnabled: boolValue(creditsBenefits.serviceCreditsEnabled, DEFAULT_SETTINGS.creditsBenefits.serviceCreditsEnabled),
      walletCreditsEnabled: boolValue(creditsBenefits.walletCreditsEnabled, DEFAULT_SETTINGS.creditsBenefits.walletCreditsEnabled),
      rewardPointsEnabled: boolValue(creditsBenefits.rewardPointsEnabled, DEFAULT_SETTINGS.creditsBenefits.rewardPointsEnabled),
      discountBenefitsEnabled: boolValue(creditsBenefits.discountBenefitsEnabled, DEFAULT_SETTINGS.creditsBenefits.discountBenefitsEnabled),
      allowBenefitStacking: boolValue(creditsBenefits.allowBenefitStacking, DEFAULT_SETTINGS.creditsBenefits.allowBenefitStacking)
    },
    renewalExpiry: {
      autoRenewEnabled: boolValue(renewalExpiry.autoRenewEnabled, DEFAULT_SETTINGS.renewalExpiry.autoRenewEnabled),
      expiryDaysEnabled: boolValue(renewalExpiry.expiryDaysEnabled, DEFAULT_SETTINGS.renewalExpiry.expiryDaysEnabled),
      defaultValidityDays: numberValue(renewalExpiry.defaultValidityDays, DEFAULT_SETTINGS.renewalExpiry.defaultValidityDays, 0, 3650),
      renewalReminderDays: numberValue(renewalExpiry.renewalReminderDays, DEFAULT_SETTINGS.renewalExpiry.renewalReminderDays, 0, 365),
      expiredBenefitAction: stringValue(renewalExpiry.expiredBenefitAction, DEFAULT_SETTINGS.renewalExpiry.expiredBenefitAction, ["allow", "warn", "block"])
    },
    paymentBilling: {
      allowDueOnMembershipSale: boolValue(paymentBilling.allowDueOnMembershipSale, DEFAULT_SETTINGS.paymentBilling.allowDueOnMembershipSale),
      membershipTaxApplicable: boolValue(paymentBilling.membershipTaxApplicable, DEFAULT_SETTINGS.paymentBilling.membershipTaxApplicable),
      taxInclusiveMembershipPrice: boolValue(paymentBilling.taxInclusiveMembershipPrice, DEFAULT_SETTINGS.paymentBilling.taxInclusiveMembershipPrice),
      invoiceMembershipSnapshot: boolValue(paymentBilling.invoiceMembershipSnapshot, DEFAULT_SETTINGS.paymentBilling.invoiceMembershipSnapshot)
    },
    redemptionRules: {
      blockRedemptionWhenExpired: boolValue(redemptionRules.blockRedemptionWhenExpired, DEFAULT_SETTINGS.redemptionRules.blockRedemptionWhenExpired),
      requireStaffConfirmation: boolValue(redemptionRules.requireStaffConfirmation, DEFAULT_SETTINGS.redemptionRules.requireStaffConfirmation),
      allowPartialCredits: boolValue(redemptionRules.allowPartialCredits, DEFAULT_SETTINGS.redemptionRules.allowPartialCredits),
      allowFamilySharing: boolValue(redemptionRules.allowFamilySharing, DEFAULT_SETTINGS.redemptionRules.allowFamilySharing)
    },
    notificationsRisk: {
      renewalReminder: boolValue(notificationsRisk.renewalReminder, DEFAULT_SETTINGS.notificationsRisk.renewalReminder),
      lowCreditReminder: boolValue(notificationsRisk.lowCreditReminder, DEFAULT_SETTINGS.notificationsRisk.lowCreditReminder),
      ownerAlertForHighBalance: boolValue(notificationsRisk.ownerAlertForHighBalance, DEFAULT_SETTINGS.notificationsRisk.ownerAlertForHighBalance),
      highBalanceThreshold: numberValue(notificationsRisk.highBalanceThreshold, DEFAULT_SETTINGS.notificationsRisk.highBalanceThreshold, 0, 10000000)
    },
    defaults: {
      defaultStatus: stringValue(defaults.defaultStatus, DEFAULT_SETTINGS.defaults.defaultStatus, ["active", "inactive"]),
      defaultMembershipType: stringValue(defaults.defaultMembershipType, DEFAULT_SETTINGS.defaults.defaultMembershipType, ["free", "paid", "packageLinked"])
    }
  };
}

function normalizeAudit(input = {}) {
  return {
    lastChangedBy: input.lastChangedBy || DEFAULT_AUDIT.lastChangedBy,
    lastChangedAt: input.lastChangedAt || DEFAULT_AUDIT.lastChangedAt
  };
}

export const membershipSettingsService = {
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
