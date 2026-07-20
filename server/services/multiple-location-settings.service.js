import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "multipleLocation.settings";

const DEFAULT_SETTINGS = {
  locationControl: {
    multipleLocationEnabled: true,
    branchSwitcherEnabled: true,
    centralOwnerDashboard: true,
    branchScopedLogin: true
  },
  branchAccess: {
    visibilityMode: "assigned",
    defaultBranchMode: "lastSelected",
    allowCrossBranchReports: true,
    allowCrossBranchSearch: true
  },
  dataSharing: {
    shareClientsAcrossBranches: true,
    shareMembershipsAcrossBranches: true,
    sharePackagesAcrossBranches: true,
    shareWalletAcrossBranches: false,
    shareInventoryAcrossBranches: false,
    shareStaffAcrossBranches: false
  },
  bookingTransfer: {
    crossBranchBooking: true,
    bookingTransferAllowed: true,
    clientTransferAllowed: true,
    packageRedemptionAnyBranch: true,
    membershipRedemptionAnyBranch: true,
    ownerApprovalForTransfer: true,
    conflictHandling: "approval"
  },
  settlement: {
    interBranchSettlementRequired: true,
    settlementMode: "monthly",
    revenueCreditBranch: "serviceBranch",
    inventoryCostBranch: "consumingBranch"
  },
  notifications: {
    notifyOwnerOnBranchChange: true,
    notifyStaffOnTransfer: true,
    notifyClientOnBranchTransfer: true
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

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeSettings(input = {}) {
  const locationControl = input.locationControl || {};
  const branchAccess = input.branchAccess || {};
  const dataSharing = input.dataSharing || {};
  const bookingTransfer = input.bookingTransfer || {};
  const settlement = input.settlement || {};
  const notifications = input.notifications || {};

  return {
    locationControl: {
      multipleLocationEnabled: boolValue(locationControl.multipleLocationEnabled, DEFAULT_SETTINGS.locationControl.multipleLocationEnabled),
      branchSwitcherEnabled: boolValue(locationControl.branchSwitcherEnabled, DEFAULT_SETTINGS.locationControl.branchSwitcherEnabled),
      centralOwnerDashboard: boolValue(locationControl.centralOwnerDashboard, DEFAULT_SETTINGS.locationControl.centralOwnerDashboard),
      branchScopedLogin: boolValue(locationControl.branchScopedLogin, DEFAULT_SETTINGS.locationControl.branchScopedLogin)
    },
    branchAccess: {
      visibilityMode: oneOf(branchAccess.visibilityMode, ["all", "assigned", "region"], DEFAULT_SETTINGS.branchAccess.visibilityMode),
      defaultBranchMode: oneOf(branchAccess.defaultBranchMode, ["lastSelected", "homeBranch", "askEveryLogin"], DEFAULT_SETTINGS.branchAccess.defaultBranchMode),
      allowCrossBranchReports: boolValue(branchAccess.allowCrossBranchReports, DEFAULT_SETTINGS.branchAccess.allowCrossBranchReports),
      allowCrossBranchSearch: boolValue(branchAccess.allowCrossBranchSearch, DEFAULT_SETTINGS.branchAccess.allowCrossBranchSearch)
    },
    dataSharing: {
      shareClientsAcrossBranches: boolValue(dataSharing.shareClientsAcrossBranches, DEFAULT_SETTINGS.dataSharing.shareClientsAcrossBranches),
      shareMembershipsAcrossBranches: boolValue(dataSharing.shareMembershipsAcrossBranches, DEFAULT_SETTINGS.dataSharing.shareMembershipsAcrossBranches),
      sharePackagesAcrossBranches: boolValue(dataSharing.sharePackagesAcrossBranches, DEFAULT_SETTINGS.dataSharing.sharePackagesAcrossBranches),
      shareWalletAcrossBranches: boolValue(dataSharing.shareWalletAcrossBranches, DEFAULT_SETTINGS.dataSharing.shareWalletAcrossBranches),
      shareInventoryAcrossBranches: boolValue(dataSharing.shareInventoryAcrossBranches, DEFAULT_SETTINGS.dataSharing.shareInventoryAcrossBranches),
      shareStaffAcrossBranches: boolValue(dataSharing.shareStaffAcrossBranches, DEFAULT_SETTINGS.dataSharing.shareStaffAcrossBranches)
    },
    bookingTransfer: {
      crossBranchBooking: boolValue(bookingTransfer.crossBranchBooking, DEFAULT_SETTINGS.bookingTransfer.crossBranchBooking),
      bookingTransferAllowed: boolValue(bookingTransfer.bookingTransferAllowed, DEFAULT_SETTINGS.bookingTransfer.bookingTransferAllowed),
      clientTransferAllowed: boolValue(bookingTransfer.clientTransferAllowed, DEFAULT_SETTINGS.bookingTransfer.clientTransferAllowed),
      packageRedemptionAnyBranch: boolValue(bookingTransfer.packageRedemptionAnyBranch, DEFAULT_SETTINGS.bookingTransfer.packageRedemptionAnyBranch),
      membershipRedemptionAnyBranch: boolValue(bookingTransfer.membershipRedemptionAnyBranch, DEFAULT_SETTINGS.bookingTransfer.membershipRedemptionAnyBranch),
      ownerApprovalForTransfer: boolValue(bookingTransfer.ownerApprovalForTransfer, DEFAULT_SETTINGS.bookingTransfer.ownerApprovalForTransfer),
      conflictHandling: oneOf(bookingTransfer.conflictHandling, ["warn", "block", "approval"], DEFAULT_SETTINGS.bookingTransfer.conflictHandling)
    },
    settlement: {
      interBranchSettlementRequired: boolValue(settlement.interBranchSettlementRequired, DEFAULT_SETTINGS.settlement.interBranchSettlementRequired),
      settlementMode: oneOf(settlement.settlementMode, ["daily", "weekly", "monthly"], DEFAULT_SETTINGS.settlement.settlementMode),
      revenueCreditBranch: oneOf(settlement.revenueCreditBranch, ["saleBranch", "serviceBranch"], DEFAULT_SETTINGS.settlement.revenueCreditBranch),
      inventoryCostBranch: oneOf(settlement.inventoryCostBranch, ["stockBranch", "consumingBranch"], DEFAULT_SETTINGS.settlement.inventoryCostBranch)
    },
    notifications: {
      notifyOwnerOnBranchChange: boolValue(notifications.notifyOwnerOnBranchChange, DEFAULT_SETTINGS.notifications.notifyOwnerOnBranchChange),
      notifyStaffOnTransfer: boolValue(notifications.notifyStaffOnTransfer, DEFAULT_SETTINGS.notifications.notifyStaffOnTransfer),
      notifyClientOnBranchTransfer: boolValue(notifications.notifyClientOnBranchTransfer, DEFAULT_SETTINGS.notifications.notifyClientOnBranchTransfer)
    }
  };
}

export const multipleLocationSettingsService = {
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
