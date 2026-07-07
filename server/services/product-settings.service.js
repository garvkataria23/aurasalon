import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "product.settings";

const DEFAULT_SETTINGS = {
  productCatalog: {
    productsEnabled: true,
    skuRequired: true,
    barcodeRequired: false,
    brandRequired: false,
    categoryRequired: true,
    allowDuplicateSku: false
  },
  stockControl: {
    stockTrackingEnabled: true,
    allowNegativeStock: false,
    lowStockAlertEnabled: true,
    defaultLowStockQty: 5,
    expiryTrackingEnabled: true,
    batchTrackingEnabled: false
  },
  pricingTax: {
    costPriceRequired: true,
    sellingPriceRequired: true,
    mrpRequired: false,
    productTaxEditable: true,
    defaultTaxPercent: 18,
    allowDiscountOnProducts: true
  },
  posBehavior: {
    visibleInPosByDefault: true,
    barcodeScanEnabled: true,
    quickAddFromPos: false,
    requireProductImage: false,
    showProductStockInPos: true
  },
  productConsume: {
    allowProductConsume: true,
    requireRecipeForServiceConsume: true,
    wastageReasonRequired: true,
    ownerApprovalForHighWastage: true
  },
  notifications: {
    notifyOwnerOnLowStock: true,
    notifyOwnerOnExpiryRisk: true,
    notifyOwnerOnNegativeStockAttempt: true
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
  const productCatalog = input.productCatalog || {};
  const stockControl = input.stockControl || {};
  const pricingTax = input.pricingTax || {};
  const posBehavior = input.posBehavior || {};
  const productConsume = input.productConsume || {};
  const notifications = input.notifications || {};

  return {
    productCatalog: {
      productsEnabled: boolValue(productCatalog.productsEnabled, DEFAULT_SETTINGS.productCatalog.productsEnabled),
      skuRequired: boolValue(productCatalog.skuRequired, DEFAULT_SETTINGS.productCatalog.skuRequired),
      barcodeRequired: boolValue(productCatalog.barcodeRequired, DEFAULT_SETTINGS.productCatalog.barcodeRequired),
      brandRequired: boolValue(productCatalog.brandRequired, DEFAULT_SETTINGS.productCatalog.brandRequired),
      categoryRequired: boolValue(productCatalog.categoryRequired, DEFAULT_SETTINGS.productCatalog.categoryRequired),
      allowDuplicateSku: boolValue(productCatalog.allowDuplicateSku, DEFAULT_SETTINGS.productCatalog.allowDuplicateSku)
    },
    stockControl: {
      stockTrackingEnabled: boolValue(stockControl.stockTrackingEnabled, DEFAULT_SETTINGS.stockControl.stockTrackingEnabled),
      allowNegativeStock: boolValue(stockControl.allowNegativeStock, DEFAULT_SETTINGS.stockControl.allowNegativeStock),
      lowStockAlertEnabled: boolValue(stockControl.lowStockAlertEnabled, DEFAULT_SETTINGS.stockControl.lowStockAlertEnabled),
      defaultLowStockQty: numberValue(stockControl.defaultLowStockQty, DEFAULT_SETTINGS.stockControl.defaultLowStockQty, 0, 100000),
      expiryTrackingEnabled: boolValue(stockControl.expiryTrackingEnabled, DEFAULT_SETTINGS.stockControl.expiryTrackingEnabled),
      batchTrackingEnabled: boolValue(stockControl.batchTrackingEnabled, DEFAULT_SETTINGS.stockControl.batchTrackingEnabled)
    },
    pricingTax: {
      costPriceRequired: boolValue(pricingTax.costPriceRequired, DEFAULT_SETTINGS.pricingTax.costPriceRequired),
      sellingPriceRequired: boolValue(pricingTax.sellingPriceRequired, DEFAULT_SETTINGS.pricingTax.sellingPriceRequired),
      mrpRequired: boolValue(pricingTax.mrpRequired, DEFAULT_SETTINGS.pricingTax.mrpRequired),
      productTaxEditable: boolValue(pricingTax.productTaxEditable, DEFAULT_SETTINGS.pricingTax.productTaxEditable),
      defaultTaxPercent: numberValue(pricingTax.defaultTaxPercent, DEFAULT_SETTINGS.pricingTax.defaultTaxPercent, 0, 100),
      allowDiscountOnProducts: boolValue(pricingTax.allowDiscountOnProducts, DEFAULT_SETTINGS.pricingTax.allowDiscountOnProducts)
    },
    posBehavior: {
      visibleInPosByDefault: boolValue(posBehavior.visibleInPosByDefault, DEFAULT_SETTINGS.posBehavior.visibleInPosByDefault),
      barcodeScanEnabled: boolValue(posBehavior.barcodeScanEnabled, DEFAULT_SETTINGS.posBehavior.barcodeScanEnabled),
      quickAddFromPos: boolValue(posBehavior.quickAddFromPos, DEFAULT_SETTINGS.posBehavior.quickAddFromPos),
      requireProductImage: boolValue(posBehavior.requireProductImage, DEFAULT_SETTINGS.posBehavior.requireProductImage),
      showProductStockInPos: boolValue(posBehavior.showProductStockInPos, DEFAULT_SETTINGS.posBehavior.showProductStockInPos)
    },
    productConsume: {
      allowProductConsume: boolValue(productConsume.allowProductConsume, DEFAULT_SETTINGS.productConsume.allowProductConsume),
      requireRecipeForServiceConsume: boolValue(productConsume.requireRecipeForServiceConsume, DEFAULT_SETTINGS.productConsume.requireRecipeForServiceConsume),
      wastageReasonRequired: boolValue(productConsume.wastageReasonRequired, DEFAULT_SETTINGS.productConsume.wastageReasonRequired),
      ownerApprovalForHighWastage: boolValue(productConsume.ownerApprovalForHighWastage, DEFAULT_SETTINGS.productConsume.ownerApprovalForHighWastage)
    },
    notifications: {
      notifyOwnerOnLowStock: boolValue(notifications.notifyOwnerOnLowStock, DEFAULT_SETTINGS.notifications.notifyOwnerOnLowStock),
      notifyOwnerOnExpiryRisk: boolValue(notifications.notifyOwnerOnExpiryRisk, DEFAULT_SETTINGS.notifications.notifyOwnerOnExpiryRisk),
      notifyOwnerOnNegativeStockAttempt: boolValue(notifications.notifyOwnerOnNegativeStockAttempt, DEFAULT_SETTINGS.notifications.notifyOwnerOnNegativeStockAttempt)
    }
  };
}

export const productSettingsService = {
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
