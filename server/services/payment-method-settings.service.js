import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "payment.methods.settings";

const DEFAULT_SETTINGS = {
  paymentModes: {
    cash: true,
    card: true,
    upi: true,
    wallet: true,
    giftCard: true
  },
  splitPaymentRules: {
    allowSplitPayment: true,
    requireExactSplitTotal: true
  },
  duePartialPayment: {
    partialPaymentAllowed: true,
    duePaymentMode: "warn"
  },
  refundRules: {
    refundMode: "original",
    paymentNoteRequiredForDueRefund: true,
    ownerApprovalForHighDueRefund: true,
    highDueRefundThreshold: 5000
  },
  settlement: {
    cardSettlementRequired: true,
    upiTransactionIdRequired: true,
    cardSettlementDays: 1,
    upiSettlementDays: 1
  },
  walletGiftCard: {
    walletRedemptionAllowed: true,
    walletTopupAllowed: true,
    giftCardRedemptionAllowed: true
  },
  posBillingBehavior: {
    blockDisabledPaymentModes: true,
    showPaymentPolicyWarning: true
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

function oneOf(value, allowed, fallback) {
  return allowed.includes(value) ? value : fallback;
}

function normalizeSettings(input = {}) {
  const paymentModes = input.paymentModes || {};
  const splitPaymentRules = input.splitPaymentRules || {};
  const duePartialPayment = input.duePartialPayment || {};
  const refundRules = input.refundRules || {};
  const settlement = input.settlement || {};
  const walletGiftCard = input.walletGiftCard || {};
  const posBillingBehavior = input.posBillingBehavior || {};

  return {
    paymentModes: {
      cash: boolValue(paymentModes.cash, DEFAULT_SETTINGS.paymentModes.cash),
      card: boolValue(paymentModes.card, DEFAULT_SETTINGS.paymentModes.card),
      upi: boolValue(paymentModes.upi, DEFAULT_SETTINGS.paymentModes.upi),
      wallet: boolValue(paymentModes.wallet, DEFAULT_SETTINGS.paymentModes.wallet),
      giftCard: boolValue(paymentModes.giftCard, DEFAULT_SETTINGS.paymentModes.giftCard)
    },
    splitPaymentRules: {
      allowSplitPayment: boolValue(splitPaymentRules.allowSplitPayment, DEFAULT_SETTINGS.splitPaymentRules.allowSplitPayment),
      requireExactSplitTotal: boolValue(splitPaymentRules.requireExactSplitTotal, DEFAULT_SETTINGS.splitPaymentRules.requireExactSplitTotal)
    },
    duePartialPayment: {
      partialPaymentAllowed: boolValue(duePartialPayment.partialPaymentAllowed, DEFAULT_SETTINGS.duePartialPayment.partialPaymentAllowed),
      duePaymentMode: oneOf(duePartialPayment.duePaymentMode, ["allow", "warn", "block"], DEFAULT_SETTINGS.duePartialPayment.duePaymentMode)
    },
    refundRules: {
      refundMode: oneOf(refundRules.refundMode, ["original", "cash", "wallet"], DEFAULT_SETTINGS.refundRules.refundMode),
      paymentNoteRequiredForDueRefund: boolValue(refundRules.paymentNoteRequiredForDueRefund, DEFAULT_SETTINGS.refundRules.paymentNoteRequiredForDueRefund),
      ownerApprovalForHighDueRefund: boolValue(refundRules.ownerApprovalForHighDueRefund, DEFAULT_SETTINGS.refundRules.ownerApprovalForHighDueRefund),
      highDueRefundThreshold: numberValue(refundRules.highDueRefundThreshold, DEFAULT_SETTINGS.refundRules.highDueRefundThreshold, 0, 10000000)
    },
    settlement: {
      cardSettlementRequired: boolValue(settlement.cardSettlementRequired, DEFAULT_SETTINGS.settlement.cardSettlementRequired),
      upiTransactionIdRequired: boolValue(settlement.upiTransactionIdRequired, DEFAULT_SETTINGS.settlement.upiTransactionIdRequired),
      cardSettlementDays: numberValue(settlement.cardSettlementDays, DEFAULT_SETTINGS.settlement.cardSettlementDays, 0, 30),
      upiSettlementDays: numberValue(settlement.upiSettlementDays, DEFAULT_SETTINGS.settlement.upiSettlementDays, 0, 30)
    },
    walletGiftCard: {
      walletRedemptionAllowed: boolValue(walletGiftCard.walletRedemptionAllowed, DEFAULT_SETTINGS.walletGiftCard.walletRedemptionAllowed),
      walletTopupAllowed: boolValue(walletGiftCard.walletTopupAllowed, DEFAULT_SETTINGS.walletGiftCard.walletTopupAllowed),
      giftCardRedemptionAllowed: boolValue(walletGiftCard.giftCardRedemptionAllowed, DEFAULT_SETTINGS.walletGiftCard.giftCardRedemptionAllowed)
    },
    posBillingBehavior: {
      blockDisabledPaymentModes: boolValue(posBillingBehavior.blockDisabledPaymentModes, DEFAULT_SETTINGS.posBillingBehavior.blockDisabledPaymentModes),
      showPaymentPolicyWarning: boolValue(posBillingBehavior.showPaymentPolicyWarning, DEFAULT_SETTINGS.posBillingBehavior.showPaymentPolicyWarning)
    }
  };
}

export const paymentMethodSettingsService = {
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
