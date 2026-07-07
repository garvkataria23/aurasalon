import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "supplier.settings";

const DEFAULT_SETTINGS = {
  supplierControl: {
    suppliersEnabled: true,
    supplierCodeRequired: false,
    gstinRequired: false,
    contactRequired: true,
    allowDuplicateSupplier: false,
    supplierApprovalRequired: true
  },
  purchaseControl: {
    purchaseOrderEnabled: true,
    purchaseBillDraftEnabled: true,
    requirePoBeforePurchase: false,
    ownerApprovalForHighValuePo: true,
    highValuePoLimit: 50000,
    allowDirectPurchaseBill: true
  },
  compliance: {
    gstinValidationEnabled: true,
    paymentTermsRequired: true,
    bankDetailsRequired: false,
    documentUploadRequired: false,
    blockInactiveSupplierPurchase: true
  },
  priceIntel: {
    trackPriceRise: true,
    cheaperSupplierSuggestion: true,
    priceChangeApprovalRequired: true,
    compareLastPurchaseRate: true
  },
  paymentRisk: {
    payableTrackingEnabled: true,
    creditLimitEnabled: false,
    defaultCreditLimit: 0,
    overdueAlertEnabled: true,
    riskSupplierReviewRequired: true
  },
  notifications: {
    notifyOwnerOnNewSupplier: true,
    notifyOwnerOnPriceRise: true,
    notifyOwnerOnOverduePayable: true,
    notifyOwnerOnRiskSupplier: true
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

function normalizeSettings(input = {}) {
  const supplierControl = input.supplierControl || {};
  const purchaseControl = input.purchaseControl || {};
  const compliance = input.compliance || {};
  const priceIntel = input.priceIntel || {};
  const paymentRisk = input.paymentRisk || {};
  const notifications = input.notifications || {};

  return {
    supplierControl: {
      suppliersEnabled: boolValue(supplierControl.suppliersEnabled, DEFAULT_SETTINGS.supplierControl.suppliersEnabled),
      supplierCodeRequired: boolValue(supplierControl.supplierCodeRequired, DEFAULT_SETTINGS.supplierControl.supplierCodeRequired),
      gstinRequired: boolValue(supplierControl.gstinRequired, DEFAULT_SETTINGS.supplierControl.gstinRequired),
      contactRequired: boolValue(supplierControl.contactRequired, DEFAULT_SETTINGS.supplierControl.contactRequired),
      allowDuplicateSupplier: boolValue(supplierControl.allowDuplicateSupplier, DEFAULT_SETTINGS.supplierControl.allowDuplicateSupplier),
      supplierApprovalRequired: boolValue(supplierControl.supplierApprovalRequired, DEFAULT_SETTINGS.supplierControl.supplierApprovalRequired)
    },
    purchaseControl: {
      purchaseOrderEnabled: boolValue(purchaseControl.purchaseOrderEnabled, DEFAULT_SETTINGS.purchaseControl.purchaseOrderEnabled),
      purchaseBillDraftEnabled: boolValue(purchaseControl.purchaseBillDraftEnabled, DEFAULT_SETTINGS.purchaseControl.purchaseBillDraftEnabled),
      requirePoBeforePurchase: boolValue(purchaseControl.requirePoBeforePurchase, DEFAULT_SETTINGS.purchaseControl.requirePoBeforePurchase),
      ownerApprovalForHighValuePo: boolValue(purchaseControl.ownerApprovalForHighValuePo, DEFAULT_SETTINGS.purchaseControl.ownerApprovalForHighValuePo),
      highValuePoLimit: numberValue(purchaseControl.highValuePoLimit, DEFAULT_SETTINGS.purchaseControl.highValuePoLimit, 0, 100000000),
      allowDirectPurchaseBill: boolValue(purchaseControl.allowDirectPurchaseBill, DEFAULT_SETTINGS.purchaseControl.allowDirectPurchaseBill)
    },
    compliance: {
      gstinValidationEnabled: boolValue(compliance.gstinValidationEnabled, DEFAULT_SETTINGS.compliance.gstinValidationEnabled),
      paymentTermsRequired: boolValue(compliance.paymentTermsRequired, DEFAULT_SETTINGS.compliance.paymentTermsRequired),
      bankDetailsRequired: boolValue(compliance.bankDetailsRequired, DEFAULT_SETTINGS.compliance.bankDetailsRequired),
      documentUploadRequired: boolValue(compliance.documentUploadRequired, DEFAULT_SETTINGS.compliance.documentUploadRequired),
      blockInactiveSupplierPurchase: boolValue(compliance.blockInactiveSupplierPurchase, DEFAULT_SETTINGS.compliance.blockInactiveSupplierPurchase)
    },
    priceIntel: {
      trackPriceRise: boolValue(priceIntel.trackPriceRise, DEFAULT_SETTINGS.priceIntel.trackPriceRise),
      cheaperSupplierSuggestion: boolValue(priceIntel.cheaperSupplierSuggestion, DEFAULT_SETTINGS.priceIntel.cheaperSupplierSuggestion),
      priceChangeApprovalRequired: boolValue(priceIntel.priceChangeApprovalRequired, DEFAULT_SETTINGS.priceIntel.priceChangeApprovalRequired),
      compareLastPurchaseRate: boolValue(priceIntel.compareLastPurchaseRate, DEFAULT_SETTINGS.priceIntel.compareLastPurchaseRate)
    },
    paymentRisk: {
      payableTrackingEnabled: boolValue(paymentRisk.payableTrackingEnabled, DEFAULT_SETTINGS.paymentRisk.payableTrackingEnabled),
      creditLimitEnabled: boolValue(paymentRisk.creditLimitEnabled, DEFAULT_SETTINGS.paymentRisk.creditLimitEnabled),
      defaultCreditLimit: numberValue(paymentRisk.defaultCreditLimit, DEFAULT_SETTINGS.paymentRisk.defaultCreditLimit, 0, 100000000),
      overdueAlertEnabled: boolValue(paymentRisk.overdueAlertEnabled, DEFAULT_SETTINGS.paymentRisk.overdueAlertEnabled),
      riskSupplierReviewRequired: boolValue(paymentRisk.riskSupplierReviewRequired, DEFAULT_SETTINGS.paymentRisk.riskSupplierReviewRequired)
    },
    notifications: {
      notifyOwnerOnNewSupplier: boolValue(notifications.notifyOwnerOnNewSupplier, DEFAULT_SETTINGS.notifications.notifyOwnerOnNewSupplier),
      notifyOwnerOnPriceRise: boolValue(notifications.notifyOwnerOnPriceRise, DEFAULT_SETTINGS.notifications.notifyOwnerOnPriceRise),
      notifyOwnerOnOverduePayable: boolValue(notifications.notifyOwnerOnOverduePayable, DEFAULT_SETTINGS.notifications.notifyOwnerOnOverduePayable),
      notifyOwnerOnRiskSupplier: boolValue(notifications.notifyOwnerOnRiskSupplier, DEFAULT_SETTINGS.notifications.notifyOwnerOnRiskSupplier)
    }
  };
}

export const supplierSettingsService = {
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
