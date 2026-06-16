import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_PREFIX = "pos.paymentModes";
const SETTLEMENT_TYPES = new Set(["cash", "digital", "wallet", "credit", "other"]);

const DEFAULT_PAYMENT_MODES = [
  { id: "cash", label: "Cash", shortcut: "C", settlementType: "cash", active: true, visibleOnInvoice: true, requiresReference: false, sortOrder: 10, createdAt: "system" },
  { id: "upi", label: "UPI", shortcut: "U", settlementType: "digital", active: true, visibleOnInvoice: true, requiresReference: false, sortOrder: 20, createdAt: "system" },
  { id: "card", label: "Card", shortcut: "D", settlementType: "digital", active: true, visibleOnInvoice: true, requiresReference: false, sortOrder: 30, createdAt: "system" },
  { id: "wallet", label: "Wallet", shortcut: "W", settlementType: "wallet", active: true, visibleOnInvoice: true, requiresReference: false, sortOrder: 40, createdAt: "system" }
];

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function modeId(label) {
  const slug = String(label || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");
  return slug || `mode_${Date.now()}`;
}

function normalizeMode(mode = {}, index = 0) {
  const label = String(mode.label || mode.id || "").trim().slice(0, 80);
  if (!label) throw badRequest("Payment mode label is required");
  const id = String(mode.id || modeId(label)).trim().slice(0, 80);
  const settlementType = SETTLEMENT_TYPES.has(mode.settlementType) ? mode.settlementType : "digital";
  return {
    id,
    label,
    shortcut: String(mode.shortcut || label.slice(0, 1)).trim().toUpperCase().slice(0, 3),
    settlementType,
    active: mode.active !== false,
    visibleOnInvoice: mode.visibleOnInvoice !== false,
    requiresReference: mode.requiresReference === true,
    sortOrder: Number.isFinite(Number(mode.sortOrder)) ? Number(mode.sortOrder) : (index + 1) * 10,
    createdAt: String(mode.createdAt || new Date().toISOString())
  };
}

function normalizeModes(value) {
  const source = Array.isArray(value) && value.length ? value : DEFAULT_PAYMENT_MODES;
  const seen = new Set();
  return source.map(normalizeMode).filter((mode) => {
    if (seen.has(mode.id)) return false;
    seen.add(mode.id);
    return true;
  }).sort((a, b) => Number(a.sortOrder || 0) - Number(b.sortOrder || 0));
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

export const posSettingsService = {
  paymentModes(query = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(query, access);
    const key = settingKey(branchId);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = ? AND key = ?").get(tenantId, key);
    const saved = parseJson(row?.value, null);
    return { branchId, paymentModes: normalizeModes(saved?.paymentModes || saved) };
  },

  savePaymentModes(payload = {}, access = {}) {
    const tenantId = tenantIdFrom(access);
    const branchId = branchIdFrom(payload, access);
    const key = settingKey(branchId);
    const paymentModes = normalizeModes(payload.paymentModes);
    const now = new Date().toISOString();
    const id = `setting_${tenantId}_${key}`.replace(/[^a-zA-Z0-9_]+/g, "_").slice(0, 120);
    db.prepare(`
      INSERT INTO settings (id, tenantId, key, value, scope, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(tenantId, key) DO UPDATE SET value = excluded.value, scope = excluded.scope, updatedAt = excluded.updatedAt
    `).run(id, tenantId, key, JSON.stringify({ branchId, paymentModes }), branchId ? "branch" : "tenant", now, now);
    return { branchId, paymentModes };
  }
};
