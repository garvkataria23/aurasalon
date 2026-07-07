import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "inventory.settings";

const DEFAULT_SETTINGS = {
  inventoryControl: {
    inventoryEnabled: true,
    stockAuditEnabled: true,
    fifoCostingEnabled: true,
    multiWarehouseEnabled: false,
    requireReasonForAdjustment: true,
    ownerApprovalForManualAdjustment: true
  },
  stockMovement: {
    inwardEnabled: true,
    outwardEnabled: true,
    transferEnabled: true,
    damagedStockTracking: true,
    expiredStockTracking: true,
    allowBackdatedMovement: false
  },
  reorderRules: {
    autoReorderSuggestions: true,
    defaultReorderLevel: 10,
    defaultReorderQty: 20,
    lowStockAlertEnabled: true,
    stockoutAlertEnabled: true,
    supplierSuggestionEnabled: true
  },
  warehouseRules: {
    defaultWarehouseRequired: false,
    branchWarehouseIsolation: true,
    interBranchTransferApproval: true,
    stockReservationEnabled: true
  },
  consumeRules: {
    serviceRecipeRequired: true,
    consumeDraftAutoCreate: true,
    allowExtraProductConsume: true,
    wastageLimitEnabled: true,
    highWastageApprovalRequired: true
  },
  notifications: {
    notifyOwnerLowStock: true,
    notifyOwnerStockout: true,
    notifyOwnerManualAdjustment: true,
    notifyOwnerHighWastage: true,
    notifyOwnerExpiryRisk: true
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
  const inventoryControl = input.inventoryControl || {};
  const stockMovement = input.stockMovement || {};
  const reorderRules = input.reorderRules || {};
  const warehouseRules = input.warehouseRules || {};
  const consumeRules = input.consumeRules || {};
  const notifications = input.notifications || {};

  return {
    inventoryControl: {
      inventoryEnabled: boolValue(inventoryControl.inventoryEnabled, DEFAULT_SETTINGS.inventoryControl.inventoryEnabled),
      stockAuditEnabled: boolValue(inventoryControl.stockAuditEnabled, DEFAULT_SETTINGS.inventoryControl.stockAuditEnabled),
      fifoCostingEnabled: boolValue(inventoryControl.fifoCostingEnabled, DEFAULT_SETTINGS.inventoryControl.fifoCostingEnabled),
      multiWarehouseEnabled: boolValue(inventoryControl.multiWarehouseEnabled, DEFAULT_SETTINGS.inventoryControl.multiWarehouseEnabled),
      requireReasonForAdjustment: boolValue(inventoryControl.requireReasonForAdjustment, DEFAULT_SETTINGS.inventoryControl.requireReasonForAdjustment),
      ownerApprovalForManualAdjustment: boolValue(inventoryControl.ownerApprovalForManualAdjustment, DEFAULT_SETTINGS.inventoryControl.ownerApprovalForManualAdjustment)
    },
    stockMovement: {
      inwardEnabled: boolValue(stockMovement.inwardEnabled, DEFAULT_SETTINGS.stockMovement.inwardEnabled),
      outwardEnabled: boolValue(stockMovement.outwardEnabled, DEFAULT_SETTINGS.stockMovement.outwardEnabled),
      transferEnabled: boolValue(stockMovement.transferEnabled, DEFAULT_SETTINGS.stockMovement.transferEnabled),
      damagedStockTracking: boolValue(stockMovement.damagedStockTracking, DEFAULT_SETTINGS.stockMovement.damagedStockTracking),
      expiredStockTracking: boolValue(stockMovement.expiredStockTracking, DEFAULT_SETTINGS.stockMovement.expiredStockTracking),
      allowBackdatedMovement: boolValue(stockMovement.allowBackdatedMovement, DEFAULT_SETTINGS.stockMovement.allowBackdatedMovement)
    },
    reorderRules: {
      autoReorderSuggestions: boolValue(reorderRules.autoReorderSuggestions, DEFAULT_SETTINGS.reorderRules.autoReorderSuggestions),
      defaultReorderLevel: numberValue(reorderRules.defaultReorderLevel, DEFAULT_SETTINGS.reorderRules.defaultReorderLevel, 0, 100000),
      defaultReorderQty: numberValue(reorderRules.defaultReorderQty, DEFAULT_SETTINGS.reorderRules.defaultReorderQty, 0, 100000),
      lowStockAlertEnabled: boolValue(reorderRules.lowStockAlertEnabled, DEFAULT_SETTINGS.reorderRules.lowStockAlertEnabled),
      stockoutAlertEnabled: boolValue(reorderRules.stockoutAlertEnabled, DEFAULT_SETTINGS.reorderRules.stockoutAlertEnabled),
      supplierSuggestionEnabled: boolValue(reorderRules.supplierSuggestionEnabled, DEFAULT_SETTINGS.reorderRules.supplierSuggestionEnabled)
    },
    warehouseRules: {
      defaultWarehouseRequired: boolValue(warehouseRules.defaultWarehouseRequired, DEFAULT_SETTINGS.warehouseRules.defaultWarehouseRequired),
      branchWarehouseIsolation: boolValue(warehouseRules.branchWarehouseIsolation, DEFAULT_SETTINGS.warehouseRules.branchWarehouseIsolation),
      interBranchTransferApproval: boolValue(warehouseRules.interBranchTransferApproval, DEFAULT_SETTINGS.warehouseRules.interBranchTransferApproval),
      stockReservationEnabled: boolValue(warehouseRules.stockReservationEnabled, DEFAULT_SETTINGS.warehouseRules.stockReservationEnabled)
    },
    consumeRules: {
      serviceRecipeRequired: boolValue(consumeRules.serviceRecipeRequired, DEFAULT_SETTINGS.consumeRules.serviceRecipeRequired),
      consumeDraftAutoCreate: boolValue(consumeRules.consumeDraftAutoCreate, DEFAULT_SETTINGS.consumeRules.consumeDraftAutoCreate),
      allowExtraProductConsume: boolValue(consumeRules.allowExtraProductConsume, DEFAULT_SETTINGS.consumeRules.allowExtraProductConsume),
      wastageLimitEnabled: boolValue(consumeRules.wastageLimitEnabled, DEFAULT_SETTINGS.consumeRules.wastageLimitEnabled),
      highWastageApprovalRequired: boolValue(consumeRules.highWastageApprovalRequired, DEFAULT_SETTINGS.consumeRules.highWastageApprovalRequired)
    },
    notifications: {
      notifyOwnerLowStock: boolValue(notifications.notifyOwnerLowStock, DEFAULT_SETTINGS.notifications.notifyOwnerLowStock),
      notifyOwnerStockout: boolValue(notifications.notifyOwnerStockout, DEFAULT_SETTINGS.notifications.notifyOwnerStockout),
      notifyOwnerManualAdjustment: boolValue(notifications.notifyOwnerManualAdjustment, DEFAULT_SETTINGS.notifications.notifyOwnerManualAdjustment),
      notifyOwnerHighWastage: boolValue(notifications.notifyOwnerHighWastage, DEFAULT_SETTINGS.notifications.notifyOwnerHighWastage),
      notifyOwnerExpiryRisk: boolValue(notifications.notifyOwnerExpiryRisk, DEFAULT_SETTINGS.notifications.notifyOwnerExpiryRisk)
    }
  };
}

export const inventorySettingsService = {
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
