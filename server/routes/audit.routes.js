import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { db } from "../db.js";
import { ensureDashboardSchema } from "../services/dashboard-schema.service.js";
import { dayCloseLockService } from "../services/day-close-lock.service.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";

ensureDashboardSchema();

export const auditRouter = Router();

const INVOICE_ACTIVITY_ACTIONS = {
  "invoice.updated": "edited",
  "invoice.edited": "edited",
  "invoice.edit_requested": "edited",
  "invoice.edit_approved": "edited",
  "invoice.edit_rejected": "edited",
  "invoice.adjustment_note_created": "edited",
  "invoice.credit_note_required": "edited",
  "bill.edited": "edited",
  "invoice.deleted": "deleted",
  "invoice.delete_requested": "deleted",
  "invoice.delete_approved": "deleted",
  "invoice.delete_rejected": "deleted",
  "bill.deleted": "deleted",
  "invoice.restored": "restored",
  "bill.restored": "restored",
  "payment.recorded": "payment_updated",
  "payment.updated": "payment_updated",
  "invoice.payment_updated": "payment_updated",
  "bill.payment_updated": "payment_updated"
};

const HIGH_VALUE_INVOICE_APPROVAL_LIMIT = 10000;

const COLUMN_CACHE = new Map();

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function tableExists(tableName) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function tableColumns(tableName) {
  if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !tableExists(tableName)) return [];
  if (!COLUMN_CACHE.has(tableName)) {
    COLUMN_CACHE.set(tableName, db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
  }
  return COLUMN_CACHE.get(tableName);
}

function firstColumn(columns, names) {
  return names.find((name) => columns.includes(name)) || "";
}

function putColumn(target, columns, names, value) {
  const column = firstColumn(columns, names);
  if (column) target[column] = value;
}

function columnExpr(columns, names, alias, fallback = "NULL") {
  const column = firstColumn(columns, names);
  return column ? `${column} AS ${alias}` : `${fallback} AS ${alias}`;
}

function pickValue(source, keys, fallback = "") {
  for (const key of keys) {
    const value = source?.[key];
    if (value !== undefined && value !== null && String(value).trim() !== "") {
      return value;
    }
  }
  return fallback;
}

function numberValue(value) {
  const numeric = Number(value || 0);
  return Number.isFinite(numeric) ? numeric : 0;
}

function boolValue(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value === 1;
  return ["1", "true", "yes", "on"].includes(String(value || "").trim().toLowerCase());
}

function nowIso() {
  return new Date().toISOString();
}

function makeAuditId(prefix = "audit") {
  return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

function requestTenantId(req) {
  return req.access?.tenantId || String(req.headers["x-tenant-id"] || "tenant_aura");
}

function requestBranchId(req) {
  return req.access?.branchId || String(req.headers["x-branch-id"] || "");
}

function requestActor(req) {
  return String(req.user?.email || req.user?.name || req.access?.userId || req.headers["x-user-id"] || req.headers["x-user-name"] || "system");
}

function requestActorRole(req) {
  return String(req.user?.role || req.access?.role || req.headers["x-user-role"] || "staff");
}

function canonicalRole(role) {
  return String(role || "")
    .trim()
    .replace(/[-_\s]+([a-z])/g, (_match, letter) => letter.toUpperCase());
}

function auditActorMeta(req, branchId = "") {
  return {
    actorUser: requestActor(req),
    actorRole: requestActorRole(req),
    tenantId: requestTenantId(req),
    branchId: branchId || requestBranchId(req),
    timestamp: nowIso()
  };
}

function assertInvoiceRole(req, allowedRoles, message) {
  const role = canonicalRole(requestActorRole(req));
  const allowed = new Set(allowedRoles.map(canonicalRole));
  if (!allowed.has(role)) {
    throw forbidden(message || "This invoice action is restricted by role");
  }
}

function assertInvoiceRequestRole(req, actionType) {
  if (actionType === "delete") {
    assertInvoiceRole(req, ["superAdmin", "owner", "admin", "manager", "cashier", "frontDesk"], "Only owner, super admin, manager or cashier can request invoice deletion");
    return;
  }
  assertInvoiceRole(req, ["superAdmin", "owner", "admin", "manager", "cashier", "frontDesk", "accountant"], "Only owner, manager, cashier or accountant can request invoice changes");
}

function assertInvoiceRestoreRole(req) {
  assertInvoiceRole(req, ["superAdmin", "owner", "admin", "manager"], "Only owner, super admin or manager can restore invoices");
}

function assertInvoiceAdjustmentRole(req) {
  assertInvoiceRole(req, ["superAdmin", "owner", "admin", "manager", "cashier", "accountant"], "Only owner, manager, cashier or accountant can create invoice adjustment notes");
}

function assertInvoiceApprovalManager(req) {
  assertInvoiceRole(req, ["superAdmin", "owner", "admin", "manager"], "Manager, admin or owner approval is required");
}

function displayValue(value) {
  if (value === undefined || value === null || value === "") return "-";
  if (typeof value === "object") {
    try {
      return JSON.stringify(value);
    } catch {
      return String(value);
    }
  }
  return String(value);
}

function moneyValue(value) {
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    maximumFractionDigits: 0
  }).format(numberValue(value));
}

function fieldValue(source, keys) {
  for (const key of keys) {
    if (source && source[key] !== undefined && source[key] !== null && source[key] !== "") {
      return source[key];
    }
  }
  return undefined;
}

function parseArrayValue(value) {
  if (!value) return [];
  if (Array.isArray(value)) return value;
  const parsed = safeJson(value, []);
  return Array.isArray(parsed) ? parsed : [];
}

function arrayFrom(source, keys) {
  for (const key of keys) {
    const value = parseArrayValue(source?.[key]);
    if (value.length) return value;
  }
  return [];
}

function itemType(item) {
  return String(fieldValue(item, ["type", "itemType", "item_type", "category"]) || "item").toLowerCase();
}

function itemName(item) {
  return String(fieldValue(item, ["name", "itemName", "item_name", "serviceName", "service_name", "productName", "product_name"]) || "Item");
}

function itemStaff(item) {
  return String(fieldValue(item, ["staffName", "staff_name", "staff", "assignedStaffName", "assigned_staff_name"]) || "Unassigned");
}

function itemSummary(item) {
  return [
    `${itemType(item)}: ${itemName(item)}`,
    `qty ${displayValue(fieldValue(item, ["qty", "quantity"]) ?? 1)}`,
    `price ${moneyValue(fieldValue(item, ["price", "unitPrice", "unit_price", "rate"]) ?? 0)}`,
    `discount ${displayValue(fieldValue(item, ["discount", "discountAmount", "discount_amount", "manualDiscount", "manual_discount"]) ?? 0)}`,
    `GST ${displayValue(fieldValue(item, ["gst", "gstRate", "gst_rate", "taxRate", "tax_rate"]) ?? 0)}`,
    `total ${moneyValue(fieldValue(item, ["total", "lineTotal", "line_total"]) ?? 0)}`,
    `staff ${itemStaff(item)}`
  ].join(" | ");
}

function itemsSummary(source) {
  const items = arrayFrom(source, ["items", "lineItems", "line_items", "invoiceItems", "invoice_items"]);
  if (items.length) return items.map(itemSummary).join("\n");

  const name = fieldValue(source, ["itemName", "item_name", "serviceName", "service_name", "productName", "product_name"]);
  if (!name) return undefined;
  return itemSummary(source);
}

function paymentSummary(source) {
  const payments = arrayFrom(source, ["payments", "paymentSplit", "payment_split", "paymentModes", "payment_modes"]);
  if (payments.length) {
    return payments
      .map((payment) => {
        const mode = fieldValue(payment, ["mode", "paymentMode", "payment_mode", "name"]) || "Payment";
        const amount = fieldValue(payment, ["amount", "paid", "paidAmount", "paid_amount", "value"]) || 0;
        return `${mode} ${moneyValue(amount)}`;
      })
      .join(" + ");
  }

  const mode = fieldValue(source, ["paymentMode", "payment_mode", "mode"]);
  const amount = fieldValue(source, ["paid", "paidAmount", "paid_amount", "amount"]);
  if (mode !== undefined || amount !== undefined) return `${mode || "Payment"} ${moneyValue(amount || 0)}`;
  return undefined;
}

function paymentModes(source = {}) {
  const modes = invoicePaymentRows(source)
    .map((payment) => String(fieldValue(payment, ["mode", "paymentMode", "payment_mode", "name", "label"]) || "").trim().toLowerCase())
    .filter(Boolean);
  const directMode = String(fieldValue(source, ["paymentMode", "payment_mode", "mode"]) || "").trim().toLowerCase();
  if (directMode) modes.push(directMode);
  return Array.from(new Set(modes));
}

function entitlementSummary(source) {
  const parts = [];
  const membership = fieldValue(source, ["membershipName", "membership_name", "membership"]);
  const membershipDiscount = fieldValue(source, ["membershipDiscount", "membership_discount"]);
  const membershipCredits = fieldValue(source, ["membershipCredits", "membership_credits", "credits"]);
  const packageName = fieldValue(source, ["packageName", "package_name", "package"]);
  const packageCredits = fieldValue(source, ["packageCredits", "package_credits"]);
  const walletUsed = fieldValue(source, ["walletUsed", "wallet_used", "walletAmount", "wallet_amount"]);

  if (membership !== undefined) parts.push(`membership ${displayValue(membership)}`);
  if (membershipDiscount !== undefined) parts.push(`membership discount ${displayValue(membershipDiscount)}`);
  if (membershipCredits !== undefined) parts.push(`membership credits ${displayValue(membershipCredits)}`);
  if (packageName !== undefined) parts.push(`package ${displayValue(packageName)}`);
  if (packageCredits !== undefined) parts.push(`package credits ${displayValue(packageCredits)}`);
  if (walletUsed !== undefined) parts.push(`wallet ${moneyValue(walletUsed)}`);

  return parts.length ? parts.join(" | ") : undefined;
}

function addChange(changes, category, field, oldRaw, newRaw, formatter = displayValue) {
  if (oldRaw === undefined && newRaw === undefined) return;
  const oldValue = formatter(oldRaw);
  const newValue = formatter(newRaw);
  if (oldValue === newValue) return;
  changes.push({ category, field, oldValue, newValue });
}

function buildInvoiceChanges(before, after) {
  const changes = [];

  addChange(changes, "Client", "Client", fieldValue(before, ["clientName", "client_name", "customerName", "customer_name"]), fieldValue(after, ["clientName", "client_name", "customerName", "customer_name"]));
  addChange(changes, "Client", "Client phone", fieldValue(before, ["clientPhone", "client_phone", "customerPhone", "customer_phone", "phone"]), fieldValue(after, ["clientPhone", "client_phone", "customerPhone", "customer_phone", "phone"]));
  addChange(changes, "Staff", "Staff", fieldValue(before, ["staffName", "staff_name"]), fieldValue(after, ["staffName", "staff_name"]));
  addChange(changes, "Totals", "Invoice total", fieldValue(before, ["total", "grandTotal", "grand_total"]), fieldValue(after, ["total", "grandTotal", "grand_total"]), moneyValue);
  addChange(changes, "Totals", "Paid amount", fieldValue(before, ["paid", "paidAmount", "paid_amount"]), fieldValue(after, ["paid", "paidAmount", "paid_amount"]), moneyValue);
  addChange(changes, "Totals", "Due amount", fieldValue(before, ["balance", "due", "dueAmount", "due_amount"]), fieldValue(after, ["balance", "due", "dueAmount", "due_amount"]), moneyValue);
  addChange(changes, "Finance", "GST", invoiceGst(before), invoiceGst(after), moneyValue);
  addChange(changes, "Finance", "Wallet used", invoiceWallet(before), invoiceWallet(after), moneyValue);
  addChange(changes, "Finance", "Loyalty points", invoiceLoyalty(before), invoiceLoyalty(after));
  addChange(changes, "Items", "Items", itemsSummary(before), itemsSummary(after));
  addChange(changes, "Payments", "Payment mode", paymentSummary(before), paymentSummary(after));
  addChange(changes, "Benefits", "Membership / package / wallet", entitlementSummary(before), entitlementSummary(after));

  return changes;
}

function invoiceStatus(actionType) {
  if (actionType === "deleted") return "deleted";
  if (actionType === "restored") return "restored";
  return "recorded";
}

function invoicePaymentStatus(source, actionType) {
  const explicitStatus = String(source.status || source.paymentStatus || source.payment_status || "").toLowerCase();
  if (explicitStatus.includes("partial")) return "partial";
  if (explicitStatus.includes("due") || explicitStatus.includes("unpaid") || explicitStatus.includes("outstanding")) return "due";
  if (explicitStatus.includes("paid") || explicitStatus.includes("complete") || explicitStatus.includes("settled")) return "paid";

  const total = numberValue(source.total || source.grandTotal || source.grand_total || source.amount);
  const paid = numberValue(source.paid || source.paidAmount || source.paid_amount || source.collected);
  const balance = numberValue(source.balance || source.due || source.dueAmount || source.due_amount || source.balanceDue || source.balance_due);

  if (total > 0 && paid >= total && balance <= 0) return "paid";
  if (balance > 0 && paid > 0) return "partial";
  if (balance > 0) return "due";
  if (paid > 0 && total <= 0) return "paid";
  return invoiceStatus(actionType);
}

function invoiceTotal(source = {}) {
  return numberValue(fieldValue(source, ["total", "grandTotal", "grand_total", "netTotal", "net_total", "amount"]));
}

function invoicePaymentRows(source = {}) {
  return arrayFrom(source, ["payments", "paymentSplit", "payment_split", "paymentModes", "payment_modes"]);
}

function invoicePaymentMode(payment = {}) {
  return String(fieldValue(payment, ["mode", "paymentMode", "payment_mode", "label"], "")).trim().toLowerCase();
}

function bookingAdvanceAdjustedAmount(source = {}) {
  return invoicePaymentRows(source)
    .filter((payment) => invoicePaymentMode(payment) === "booking_advance")
    .reduce((sum, payment) => sum + numberValue(fieldValue(payment, ["amount", "paid", "value"])), 0);
}

function invoicePaid(source = {}) {
  const explicitPaid = numberValue(fieldValue(source, ["paid", "paidAmount", "paid_amount", "collected", "amountPaid", "amount_paid"]));
  if (explicitPaid > 0) return explicitPaid;
  return invoicePaymentRows(source).reduce((sum, payment) => sum + numberValue(fieldValue(payment, ["amount", "paid", "value"])), 0);
}

function counterPaymentCollectedAmount(source = {}) {
  return Math.max(0, invoicePaid(source) - bookingAdvanceAdjustedAmount(source));
}

function invoiceDue(source = {}) {
  const explicitDue = numberValue(fieldValue(source, ["balance", "due", "dueAmount", "due_amount", "balanceDue", "balance_due"]));
  if (explicitDue > 0) return explicitDue;
  return Math.max(0, invoiceTotal(source) - invoicePaid(source));
}

function invoiceGst(source = {}) {
  const explicitGst = numberValue(fieldValue(source, ["gst", "gstAmount", "gst_amount", "tax", "taxAmount", "tax_amount"]));
  if (explicitGst > 0) return explicitGst;

  return arrayFrom(source, ["items", "lineItems", "line_items"]).reduce((sum, item) => {
    const qty = numberValue(fieldValue(item, ["qty", "quantity"])) || 1;
    const price = numberValue(fieldValue(item, ["price", "rate", "unitPrice", "unit_price"]));
    const itemGstAmount = numberValue(fieldValue(item, ["gstAmount", "gst_amount", "taxAmount", "tax_amount"]));
    if (itemGstAmount > 0) return sum + itemGstAmount;

    const gstRate = numberValue(fieldValue(item, ["gst", "gstRate", "gst_rate", "taxRate", "tax_rate"]));
    return sum + ((price * qty * gstRate) / 100);
  }, 0);
}

function invoiceWallet(source = {}) {
  const explicitWallet = numberValue(fieldValue(source, ["wallet", "walletUsed", "wallet_used", "walletAmount", "wallet_amount"]));
  if (explicitWallet > 0) return explicitWallet;

  return invoicePaymentRows(source)
    .filter((payment) => String(fieldValue(payment, ["mode", "paymentMode", "payment_mode", "label"], "")).toLowerCase().includes("wallet"))
    .reduce((sum, payment) => sum + numberValue(fieldValue(payment, ["amount", "paid", "value"])), 0);
}

function invoiceLoyalty(source = {}) {
  return numberValue(fieldValue(source, [
    "loyalty",
    "loyaltyPoints",
    "loyalty_points",
    "points",
    "pointsEarned",
    "points_earned",
    "pointsRedeemed",
    "points_redeemed"
  ]));
}

function stockImpactSummary(source = {}, actionType = "edited") {
  const items = arrayFrom(source, ["items", "lineItems", "line_items"]);
  const productItems = items.filter((item) => {
    const type = String(fieldValue(item, ["type", "itemType", "item_type", "category"], "")).toLowerCase();
    return type.includes("product") || Boolean(fieldValue(item, ["productId", "product_id", "sku", "barcode"], ""));
  });
  const units = productItems.reduce((sum, item) => sum + (numberValue(fieldValue(item, ["qty", "quantity"])) || 1), 0);

  if (!units) return "No product stock impact";
  if (actionType === "deleted") return `${units} unit(s) should be returned to stock`;
  if (actionType === "restored") return `${units} unit(s) should be deducted again`;
  return `${units} product unit(s) affected`;
}

function buildFinanceImpact(before = {}, after = {}, actionType = "edited") {
  const originalTotal = invoiceTotal(before);
  const updatedTotal = invoiceTotal(after);
  const originalPaid = invoicePaid(before);
  const updatedPaid = invoicePaid(after);
  const originalDue = invoiceDue(before);
  const updatedDue = invoiceDue(after);

  return {
    originalTotal,
    updatedTotal,
    amountDifference: updatedTotal - originalTotal,
    paymentDifference: updatedPaid - originalPaid,
    gstDifference: invoiceGst(after) - invoiceGst(before),
    dueDifference: updatedDue - originalDue,
    walletImpact: invoiceWallet(after) - invoiceWallet(before),
    loyaltyImpact: invoiceLoyalty(after) - invoiceLoyalty(before),
    stockImpact: stockImpactSummary(actionType === "deleted" ? before : after, actionType),
    statusBefore: invoicePaymentStatus(before, actionType),
    statusAfter: invoicePaymentStatus(after, actionType)
  };
}

function invoiceDiscount(source = {}) {
  const explicitDiscount = numberValue(fieldValue(source, [
    "discount",
    "discountAmount",
    "discount_amount",
    "discountTotal",
    "discount_total",
    "manualDiscount",
    "manual_discount"
  ]));
  if (explicitDiscount > 0) return explicitDiscount;

  return arrayFrom(source, ["items", "lineItems", "line_items"]).reduce((sum, item) => {
    const quantity = numberValue(fieldValue(item, ["qty", "quantity"])) || 1;
    const discount = numberValue(fieldValue(item, ["discount", "discountAmount", "discount_amount", "manualDiscount", "manual_discount"]));
    return sum + (discount * quantity);
  }, 0);
}

function productUnitCount(source = {}) {
  return arrayFrom(source, ["items", "lineItems", "line_items"]).reduce((sum, item) => {
    const type = String(fieldValue(item, ["type", "itemType", "item_type", "category"], "")).toLowerCase();
    const productLike = type.includes("product") || Boolean(fieldValue(item, ["productId", "product_id", "sku", "barcode"], ""));
    if (!productLike) return sum;
    return sum + (numberValue(fieldValue(item, ["qty", "quantity"])) || 1);
  }, 0);
}

function booleanFlag(source = {}, keys = []) {
  return boolValue(fieldValue(source, keys));
}

function hasStockConfirmation(source = {}) {
  return booleanFlag(source, [
    "stockReversalApplied",
    "stock_reversal_applied",
    "inventoryReversed",
    "inventory_reversed",
    "stockAdjusted",
    "stock_adjusted",
    "inventoryAdjusted",
    "inventory_adjusted"
  ]) || arrayFrom(source, ["stockMovements", "stock_movements", "inventoryMovements", "inventory_movements"]).length > 0;
}

function paymentModesChanged(before = {}, after = {}) {
  const beforeModes = paymentModes(before).map(paymentModeBucket).sort();
  const afterModes = paymentModes(after).map(paymentModeBucket).sort();
  if (beforeModes.length !== afterModes.length) return true;
  return beforeModes.some((mode, index) => mode !== afterModes[index]);
}

function changeContains(changes = [], token = "") {
  const needle = String(token || "").toLowerCase();
  return changes.some((change) => [
    change.category,
    change.field,
    change.oldValue,
    change.newValue
  ].join(" ").toLowerCase().includes(needle));
}

function riskLevelScore(level) {
  return {
    low: 10,
    medium: 35,
    high: 70,
    critical: 100
  }[level] || 0;
}

function emptyRisk() {
  return {
    riskScore: 0,
    riskReasons: [],
    suggestedAction: "Monitor during the routine audit cycle.",
    strongestLevel: "low",
    strongestScore: 0
  };
}

function addRiskSignal(risk, level, reason, suggestedAction) {
  const score = riskLevelScore(level);
  if (!score || !reason) return;
  risk.riskScore += score;
  if (!risk.riskReasons.includes(reason)) {
    risk.riskReasons.push(reason);
  }
  if (score >= risk.strongestScore) {
    risk.strongestScore = score;
    risk.strongestLevel = level;
    risk.suggestedAction = suggestedAction;
  }
}

function finalizeRisk(risk) {
  const level = risk.riskScore >= 100
    ? "critical"
    : risk.riskScore >= 70
      ? "high"
      : risk.riskScore >= 35
        ? "medium"
        : "low";
  return {
    riskLevel: level,
    riskScore: risk.riskScore,
    riskReasons: risk.riskReasons.length ? risk.riskReasons : ["No unusual activity detected"],
    riskReason: risk.riskReasons.length ? risk.riskReasons.join("; ") : "No unusual activity detected",
    suggestedAction: risk.suggestedAction
  };
}

function buildBaseRisk(activity, beforeSnapshot = {}, afterSnapshot = {}, nested = {}) {
  const risk = emptyRisk();
  const total = Math.max(
    numberValue(activity.total),
    invoiceTotal(beforeSnapshot),
    invoiceTotal(afterSnapshot)
  );
  const paid = Math.max(numberValue(activity.paid), invoicePaid(beforeSnapshot), invoicePaid(afterSnapshot));
  const due = Math.max(numberValue(activity.balance), invoiceDue(beforeSnapshot), invoiceDue(afterSnapshot));
  const cashPayment = (activity.paymentModes || []).map(paymentModeBucket).includes("cash");
  const isClosedOrPaid = ["paid", "settled", "closed", "posted", "approved"].some((status) => String(activity.status || "").toLowerCase().includes(status))
    || invoiceIsClosed(beforeSnapshot)
    || invoiceIsClosed(afterSnapshot);

  if (activity.actionType === "deleted") {
    addRiskSignal(
      risk,
      total >= HIGH_VALUE_INVOICE_APPROVAL_LIMIT ? "high" : "medium",
      total >= HIGH_VALUE_INVOICE_APPROVAL_LIMIT ? "High-value invoice delete detected" : "Invoice delete detected outside normal checkout flow",
      "Review manager approval, client ledger, GST impact and deletion reason before accepting the activity."
    );
    if (!String(activity.deleteReason || activity.approvalReason || "").trim()) {
      addRiskSignal(
        risk,
        "high",
        "Deleted invoice has no captured business reason",
        "Ask the action owner to document the delete reason before closing the audit."
      );
    }
    if (cashPayment && total >= HIGH_VALUE_INVOICE_APPROVAL_LIMIT) {
      addRiskSignal(
        risk,
        "critical",
        "High cash invoice delete alert",
        "Verify cash drawer, owner approval, GST reversal and client ledger immediately."
      );
    } else if (cashPayment && total >= 5000) {
      addRiskSignal(
        risk,
        "high",
        "Cash invoice delete needs finance review",
        "Match the deleted invoice against cash drawer closing and manager approval."
      );
    }
  }

  const oldDiscount = invoiceDiscount(beforeSnapshot);
  const newDiscount = invoiceDiscount(afterSnapshot);
  const discountDelta = newDiscount - oldDiscount;
  const discountRate = total > 0 ? discountDelta / total : 0;
  if (activity.actionType === "edited" && (discountDelta >= 1000 || discountRate >= 0.1 || (discountDelta > 0 && changeContains(activity.changes, "discount")))) {
    addRiskSignal(
      risk,
      discountDelta >= 2500 || discountRate >= 0.2 ? "high" : "medium",
      `Suspicious discount change warning: ${moneyValue(oldDiscount)} to ${moneyValue(newDiscount)}`,
      "Review discount authorization and compare with staff-level discount policy."
    );
  }

  if ((activity.actionType === "payment_updated" || paymentModesChanged(beforeSnapshot, afterSnapshot) || changeContains(activity.changes, "payment mode")) && isClosedOrPaid) {
    addRiskSignal(
      risk,
      paid >= HIGH_VALUE_INVOICE_APPROVAL_LIMIT ? "high" : "medium",
      "Payment mode changed after checkout",
      "Reconcile payment settlement, cash/card/UPI references and drawer closing before marking reviewed."
    );
  }

  if (activity.actionType === "edited" && due > 0) {
    const dueRatio = total > 0 ? due / total : 0;
    if (due >= 10000 || dueRatio >= 0.5) {
      addRiskSignal(
        risk,
        due >= 10000 ? "high" : "medium",
        `High due invoice edit warning: due ${moneyValue(due)}`,
        "Confirm client outstanding balance and manager approval before accepting the edited invoice."
      );
    }
  }

  const stockSource = activity.actionType === "restored" ? afterSnapshot : beforeSnapshot;
  const productUnits = productUnitCount(stockSource);
  const stockConfirmed = hasStockConfirmation(afterSnapshot) || hasStockConfirmation(nested);
  if ((activity.actionType === "deleted" || activity.actionType === "restored") && productUnits > 0 && !stockConfirmed) {
    addRiskSignal(
      risk,
      productUnits >= 3 ? "high" : "medium",
      `Stock reversal mismatch warning: ${productUnits} product unit(s) need inventory confirmation`,
      "Verify inventory movement before the invoice audit is closed."
    );
  }

  return finalizeRisk(risk);
}

function enrichInvoiceActivityRisk(rows) {
  const staffStats = new Map();
  for (const row of rows) {
    const staffKey = row.staffName || "Unassigned";
    if (!staffStats.has(staffKey)) {
      staffStats.set(staffKey, { edits: 0, deletions: 0, editDeletes: 0 });
    }
    const stats = staffStats.get(staffKey);
    if (row.actionType === "edited") {
      stats.edits += 1;
      stats.editDeletes += 1;
    }
    if (row.actionType === "deleted") {
      stats.deletions += 1;
      stats.editDeletes += 1;
    }
  }

  return rows.map((row) => {
    const baseReasons = (Array.isArray(row.riskReasons) ? row.riskReasons : String(row.riskReason || "").split(";"))
      .map((reason) => String(reason || "").trim())
      .filter((reason) => reason && reason !== "No unusual activity detected");
    const risk = {
      ...emptyRisk(),
      riskScore: numberValue(row.riskScore),
      riskReasons: baseReasons,
      suggestedAction: row.suggestedAction || "Monitor during the routine audit cycle.",
      strongestLevel: row.riskLevel || "low",
      strongestScore: riskLevelScore(row.riskLevel)
    };

    const stats = staffStats.get(row.staffName || "Unassigned");
    if (stats && stats.editDeletes >= 3 && (row.actionType === "edited" || row.actionType === "deleted")) {
      addRiskSignal(
        risk,
        stats.editDeletes >= 5 || stats.deletions >= 3 ? "high" : "medium",
        `Same staff repeated edits/deletes: ${stats.editDeletes} invoice change(s) in audit window`,
        "Review staff permissions, shift activity and manager approvals for this pattern."
      );
    }

    const finalized = finalizeRisk(risk);
    return { ...row, ...finalized };
  });
}

function parseActivityDate(value) {
  const date = value ? new Date(value) : null;
  return date && !Number.isNaN(date.getTime()) ? date : null;
}

function includesToken(value, token) {
  if (!token) return true;
  return String(value || "").toLowerCase().includes(token);
}

function filterInvoiceActivityRows(rows, filters) {
  const q = String(filters.q || "").trim().toLowerCase();
  const client = String(filters.client || "").trim().toLowerCase();
  const staff = String(filters.staff || "").trim().toLowerCase();
  const action = String(filters.action || "").trim().toLowerCase();
  const status = String(filters.status || "").trim().toLowerCase();
  const branchId = String(filters.branchId || "").trim();
  const paymentMode = String(filters.paymentMode || "").trim().toLowerCase();
  const fromDate = filters.from ? new Date(`${filters.from}T00:00:00`) : null;
  const toDate = filters.to ? new Date(`${filters.to}T23:59:59`) : null;
  const minAmount = filters.minAmount === "" || filters.minAmount === undefined ? null : Number(filters.minAmount);
  const maxAmount = filters.maxAmount === "" || filters.maxAmount === undefined ? null : Number(filters.maxAmount);

  return rows.filter((row) => {
    const activityDate = parseActivityDate(row.actionTime);
    const total = numberValue(row.total);

    if (branchId && row.branchId && row.branchId !== branchId) return false;
    if (fromDate && activityDate && activityDate < fromDate) return false;
    if (toDate && activityDate && activityDate > toDate) return false;
    if (Number.isFinite(minAmount) && total < minAmount) return false;
    if (Number.isFinite(maxAmount) && total > maxAmount) return false;
    if (action && String(row.actionType || "").toLowerCase() !== action) return false;
    if (status && String(row.status || "").toLowerCase() !== status) return false;
    if (staff && String(row.staffName || "").toLowerCase() !== staff) return false;
    if (paymentMode && !(row.paymentModes || []).some((mode) => String(mode || "").toLowerCase().includes(paymentMode))) return false;

    if (client) {
      const clientText = `${row.clientName || ""} ${row.clientPhone || ""}`.toLowerCase();
      if (!clientText.includes(client)) return false;
    }

    if (q) {
      const searchText = [
        row.invoiceNo,
        row.invoiceNumber,
        row.invoiceId,
        row.clientName,
        row.clientPhone,
        row.staffName,
        row.branchName,
        row.actionType,
        row.riskLevel,
        row.riskReason,
        row.suggestedAction,
        ...(row.paymentModes || [])
      ].join(" ").toLowerCase();
      if (!includesToken(searchText, q)) return false;
    }

    return true;
  });
}

function loadInvoiceLookup(tenantId) {
  if (!tableExists("invoices")) return new Map();
  const columns = tableColumns("invoices");
  const tenantColumn = firstColumn(columns, ["tenant_id", "tenantId"]);
  const idColumn = firstColumn(columns, ["id", "invoice_id", "invoiceId"]);
  if (!idColumn) return new Map();

  const selectParts = [
    `${idColumn} AS id`,
    columnExpr(columns, ["invoice_number", "invoiceNumber", "number"], "invoiceNumber", "''"),
    columnExpr(columns, ["client_name", "clientName", "customer_name", "customerName"], "clientName", "''"),
    columnExpr(columns, ["client_phone", "clientPhone", "customer_phone", "customerPhone", "phone"], "clientPhone", "''"),
    columnExpr(columns, ["staff_name", "staffName"], "staffName", "''"),
    columnExpr(columns, ["branch_id", "branchId"], "branchId", "''"),
    columnExpr(columns, ["branch_name", "branchName"], "branchName", "''"),
    columnExpr(columns, ["total", "grand_total", "grandTotal"], "total", "0"),
    columnExpr(columns, ["paid", "paid_amount", "paidAmount"], "paid", "0"),
    columnExpr(columns, ["balance", "due", "due_amount", "dueAmount"], "balance", "0"),
    columnExpr(columns, ["status", "payment_status", "paymentStatus"], "status", "''")
  ];
  const where = tenantColumn ? `WHERE ${tenantColumn} = @tenantId` : "";
  const rows = db.prepare(`SELECT ${selectParts.join(", ")} FROM invoices ${where}`).all({ tenantId });
  if (tableExists("invoice_payments") && rows.length) {
    const invoiceIds = rows.map((row) => String(row.id || "")).filter(Boolean);
    if (invoiceIds.length) {
      const placeholders = invoiceIds.map(() => "?").join(",");
      const payments = db.prepare(
        `SELECT invoice_id AS invoiceId, payment_mode AS paymentMode, amount, status
           FROM invoice_payments
          WHERE tenant_id = ? AND invoice_id IN (${placeholders}) AND status = 'paid'
          ORDER BY created_at, id`
      ).all(tenantId, ...invoiceIds);
      const paymentsByInvoice = new Map();
      for (const payment of payments) {
        const invoiceId = String(payment.invoiceId || "");
        if (!paymentsByInvoice.has(invoiceId)) paymentsByInvoice.set(invoiceId, []);
        paymentsByInvoice.get(invoiceId).push(payment);
      }
      rows.forEach((row) => {
        row.payments = paymentsByInvoice.get(String(row.id || "")) || [];
      });
    }
  }
  return new Map(rows.map((row) => [String(row.id), row]));
}

function loadAuditLogInvoiceActivity(tenantId, limit) {
  if (!tableExists("audit_log")) return [];
  const rows = db.prepare(
    `SELECT id, tenant_id AS tenantId, user_id AS actionByUser, action,
            entity_type AS entityType, entity_id AS invoiceId,
            old_value AS oldValue, new_value AS newValue,
            created_at AS actionTime
     FROM audit_log
     WHERE tenant_id = @tenantId
       AND (
         lower(action) IN ('invoice.updated', 'invoice.edited', 'invoice.adjustment_note_created', 'invoice.credit_note_required', 'bill.edited', 'invoice.deleted', 'bill.deleted', 'invoice.restored', 'bill.restored', 'payment.recorded', 'payment.updated', 'invoice.payment_updated', 'bill.payment_updated', 'invoice.edit_requested', 'invoice.edit_approved', 'invoice.edit_rejected', 'invoice.delete_requested', 'invoice.delete_approved', 'invoice.delete_rejected')
         OR lower(entity_type) IN ('invoice', 'bill', 'payment')
       )
     ORDER BY created_at DESC
     LIMIT @limit`
  ).all({ tenantId, limit });

  return rows.map((row) => ({
    ...row,
    source: "audit_log",
    oldValue: safeJson(row.oldValue),
    newValue: safeJson(row.newValue)
  }));
}

function loadInvoiceAuditActivity(tenantId, limit) {
  if (!tableExists("invoice_audit_log")) return [];
  const columns = tableColumns("invoice_audit_log");
  const tenantColumn = firstColumn(columns, ["tenant_id", "tenantId"]);
  const createdColumn = firstColumn(columns, ["created_at", "createdAt"]) || "id";
  const selectParts = [
    columnExpr(columns, ["id"], "id", "hex(randomblob(8))"),
    columnExpr(columns, ["tenant_id", "tenantId"], "tenantId", "''"),
    columnExpr(columns, ["branch_id", "branchId"], "branchId", "''"),
    columnExpr(columns, ["invoice_id", "invoiceId", "entity_id", "entityId"], "invoiceId", "''"),
    columnExpr(columns, ["user_id", "userId", "actor_user_id", "actorUserId"], "actionByUser", "''"),
    columnExpr(columns, ["action", "event_type", "eventType"], "action", "''"),
    columnExpr(columns, ["old_value", "oldValue", "before_payload", "beforePayload"], "oldValue", "'{}'"),
    columnExpr(columns, ["new_value", "newValue", "after_payload", "afterPayload", "payload"], "newValue", "'{}'"),
    columnExpr(columns, ["created_at", "createdAt"], "actionTime", "CURRENT_TIMESTAMP")
  ];
  const where = tenantColumn ? `WHERE ${tenantColumn} = @tenantId` : "";
  const rows = db.prepare(
    `SELECT ${selectParts.join(", ")}
     FROM invoice_audit_log
     ${where}
     ORDER BY ${createdColumn} DESC
     LIMIT @limit`
  ).all({ tenantId, limit });

  return rows.map((row) => ({
    ...row,
    source: "invoice_audit_log",
    oldValue: safeJson(row.oldValue),
    newValue: safeJson(row.newValue)
  }));
}

function normalizeInvoiceActivity(row, invoiceLookup) {
  const action = String(row.action || "").toLowerCase();
  const actionType = INVOICE_ACTIVITY_ACTIONS[action];
  if (!actionType) return null;

  const before = row.oldValue || {};
  const after = row.newValue || {};
  const beforePayload = safeJson(pickValue(before, ["before", "beforePayload", "old", "snapshot"], {}));
  const afterPayload = safeJson(pickValue(after, ["after", "afterPayload", "new", "snapshot", "payload", "details"], {}));
  const beforeSnapshot = Object.keys(beforePayload).length ? beforePayload : before;
  const afterSnapshot = Object.keys(afterPayload).length ? afterPayload : after;
  const nested = safeJson(pickValue(after, ["payload", "details"], {}));
  const invoiceId = String(pickValue({ ...before, ...after, ...nested, ...row }, ["invoiceId", "invoice_id", "entityId", "id"], ""));
  const invoice = invoiceLookup.get(invoiceId) || {};
  const merged = { ...invoice, ...beforeSnapshot, ...afterSnapshot, ...nested, ...row };
  const financeImpact = buildFinanceImpact(beforeSnapshot, afterSnapshot, actionType);
  const activityPaymentModes = Array.from(new Set([
    ...paymentModes(beforeSnapshot),
    ...paymentModes(afterSnapshot),
    ...paymentModes(nested),
    ...paymentModes(merged)
  ]));
  const approvalStatus = String(pickValue(merged, ["approvalStatus", "approval_status"], "")).toLowerCase();
  const workflowStatus = approvalStatus === "pending"
    ? "pending_approval"
    : approvalStatus === "approved" || approvalStatus === "rejected"
      ? approvalStatus
      : invoicePaymentStatus(merged, actionType);

  const activity = {
    id: String(row.id || `${row.source}_${invoiceId}_${row.actionTime}`),
    source: row.source,
    actionType,
    invoiceId,
    invoiceNumber: String(pickValue(merged, ["invoiceNumber", "invoice_number", "number"], invoiceId || "Unknown invoice")),
    clientName: String(pickValue(merged, ["clientName", "client_name", "customerName", "customer_name"], "Unknown client")),
    clientPhone: String(pickValue(merged, ["clientPhone", "client_phone", "customerPhone", "customer_phone", "phone"], "")),
    staffName: String(pickValue(merged, ["staffName", "staff_name"], "Unassigned")),
    branchId: String(pickValue(merged, ["branchId", "branch_id"], "")),
    branchName: String(pickValue(merged, ["branchName", "branch_name"], "")),
    actionByUser: String(pickValue(merged, ["actionByUser", "userId", "user_id", "actorUserId", "actor_user_id"], "system")),
    invoiceCreatedAt: String(pickValue({ ...invoice, ...beforeSnapshot, ...afterSnapshot }, ["invoiceCreatedAt", "invoice_created_at", "createdAt", "created_at", "date"], "")),
    actionTime: String(pickValue(merged, ["actionTime", "createdAt", "created_at"], new Date().toISOString())),
    status: workflowStatus,
    approvalRequired: boolValue(pickValue(merged, ["approvalRequired", "approval_required"], false)),
    approvalStatus,
    requestActivityId: String(pickValue(merged, ["requestActivityId", "approvalRequestId", "request_activity_id", "approval_request_id"], "")),
    requestedBy: String(pickValue(merged, ["requestedBy", "requested_by"], "")),
    requestedRole: String(pickValue(merged, ["requestedRole", "requested_role"], "")),
    requestedAt: String(pickValue(merged, ["requestedAt", "requested_at"], "")),
    approvedBy: String(pickValue(merged, ["approvedBy", "approved_by"], "")),
    approvedRole: String(pickValue(merged, ["approvedRole", "approved_role"], "")),
    approvalTime: String(pickValue(merged, ["approvalTime", "approval_time", "approvedAt", "approved_at"], "")),
    rejectedBy: String(pickValue(merged, ["rejectedBy", "rejected_by"], "")),
    rejectedRole: String(pickValue(merged, ["rejectedRole", "rejected_role"], "")),
    rejectionTime: String(pickValue(merged, ["rejectionTime", "rejection_time", "rejectedAt", "rejected_at"], "")),
    rejectionReason: String(pickValue(merged, ["rejectionReason", "rejection_reason"], "")),
    approvalReason: String(pickValue(merged, ["approvalReason", "approval_reason", "reason"], "")),
    deleteReason: String(pickValue(merged, ["deleteReason", "delete_reason"], "")),
    auditRole: String(pickValue(merged, ["auditRole", "actorRole", "role"], "")),
    auditBranchId: String(pickValue(merged, ["auditBranchId", "audit_branch_id"], "")),
    auditTimestamp: String(pickValue(merged, ["auditTimestamp", "audit_timestamp"], "")),
    total: numberValue(pickValue(merged, ["total", "grandTotal", "grand_total"], 0)),
    paid: numberValue(pickValue(merged, ["paid", "paidAmount", "paid_amount"], 0)),
    balance: numberValue(pickValue(merged, ["balance", "due", "dueAmount", "due_amount"], 0)),
    advanceAdjusted: bookingAdvanceAdjustedAmount(merged),
    counterPaid: counterPaymentCollectedAmount(merged),
    paymentModes: activityPaymentModes,
    financeImpact,
    changes: buildInvoiceChanges(beforeSnapshot, afterSnapshot)
  };
  return {
    ...activity,
    ...buildBaseRisk(activity, beforeSnapshot, afterSnapshot, nested)
  };
}

function rawAuditValue(raw, names, fallback = "") {
  const column = firstColumn(raw.columns, names);
  return column ? raw.row[column] : fallback;
}

function parseRawAuditJson(raw, names) {
  const value = rawAuditValue(raw, names, {});
  return safeJson(value, {});
}

function loadRawAuditLogRow(activityId) {
  if (!tableExists("audit_log")) return null;
  const columns = tableColumns("audit_log");
  const idColumn = firstColumn(columns, ["id"]);
  if (!idColumn) return null;
  const row = db.prepare(`SELECT * FROM audit_log WHERE ${idColumn} = ?`).get(activityId);
  return row ? { row, columns, idColumn } : null;
}

function normalizeRawAuditLogRow(raw, req) {
  const oldValue = parseRawAuditJson(raw, ["old_value", "oldValue"]);
  const newValue = parseRawAuditJson(raw, ["new_value", "newValue"]);
  const invoiceLookup = loadInvoiceLookup(requestTenantId(req));
  return normalizeInvoiceActivity({
    id: rawAuditValue(raw, ["id"], makeAuditId("audit")),
    source: "audit_log",
    action: String(rawAuditValue(raw, ["action"], "")),
    entityId: String(rawAuditValue(raw, ["entity_id", "entityId"], "")),
    actionByUser: String(rawAuditValue(raw, ["user_id", "userId", "actor_user_id", "actorUserId"], "system")),
    actionTime: String(rawAuditValue(raw, ["created_at", "createdAt"], nowIso())),
    oldValue,
    newValue
  }, invoiceLookup);
}

function loadAuditActivityById(req, activityId) {
  const raw = loadRawAuditLogRow(activityId);
  return raw ? normalizeRawAuditLogRow(raw, req) : null;
}

function updateAuditLogValues(activityId, oldValue, newValue) {
  const raw = loadRawAuditLogRow(activityId);
  if (!raw) return false;
  const updates = {};
  putColumn(updates, raw.columns, ["old_value", "oldValue"], JSON.stringify(oldValue || {}));
  putColumn(updates, raw.columns, ["new_value", "newValue"], JSON.stringify(newValue || {}));
  putColumn(updates, raw.columns, ["updated_at", "updatedAt"], nowIso());
  const keys = Object.keys(updates);
  if (!keys.length) return false;
  db.prepare(`UPDATE audit_log SET ${keys.map((key) => `${key} = @${key}`).join(", ")} WHERE ${raw.idColumn} = @id`)
    .run({ ...updates, id: activityId });
  return true;
}

function insertAuditLogRow(req, { action, invoiceId, branchId, oldValue = {}, newValue = {}, severity = "info" }) {
  if (!tableExists("audit_log")) {
    throw new Error("audit_log table is required for invoice approvals");
  }
  const columns = tableColumns("audit_log");
  const row = {};
  const id = makeAuditId("audit");
  const meta = auditActorMeta(req, branchId || requestBranchId(req));
  const stampedNewValue = {
    ...(newValue || {}),
    auditActor: meta.actorUser,
    auditRole: meta.actorRole,
    auditBranchId: meta.branchId,
    auditTenantId: meta.tenantId,
    auditTimestamp: meta.timestamp
  };
  putColumn(row, columns, ["id"], id);
  putColumn(row, columns, ["tenant_id", "tenantId"], meta.tenantId);
  putColumn(row, columns, ["branch_id", "branchId"], meta.branchId);
  putColumn(row, columns, ["module", "resource"], "pos_invoices");
  putColumn(row, columns, ["entity_type", "entityType"], "invoice");
  putColumn(row, columns, ["entity_id", "entityId"], invoiceId);
  putColumn(row, columns, ["action"], action);
  putColumn(row, columns, ["severity"], severity);
  putColumn(row, columns, ["user_id", "userId", "actor_user_id", "actorUserId"], meta.actorUser);
  putColumn(row, columns, ["old_value", "oldValue"], JSON.stringify(oldValue || {}));
  putColumn(row, columns, ["new_value", "newValue"], JSON.stringify(stampedNewValue));
  putColumn(row, columns, ["created_at", "createdAt"], meta.timestamp);
  putColumn(row, columns, ["updated_at", "updatedAt"], meta.timestamp);

  const keys = Object.keys(row);
  if (!keys.includes(firstColumn(columns, ["action"]))) {
    throw new Error("audit_log action column is required for invoice approvals");
  }
  db.prepare(`INSERT INTO audit_log (${keys.join(", ")}) VALUES (${keys.map((key) => `@${key}`).join(", ")})`).run(row);
  return id;
}

function findInvoiceById(req, invoiceId) {
  const invoiceLookup = loadInvoiceLookup(requestTenantId(req));
  return invoiceLookup.get(invoiceId) || { id: invoiceId, invoiceId };
}

function invoiceTables() {
  return ["pos_invoices", "invoices", "sales_invoices", "billing_invoices", "pos_sales"];
}

function invoiceTenantWhere(columns) {
  return ["tenant_id", "tenantId"].filter((column) => columns.includes(column));
}

function findInvoiceRecord(req, invoiceId) {
  const tenantId = requestTenantId(req);
  for (const table of invoiceTables()) {
    if (!tableExists(table)) continue;
    const columns = tableColumns(table);
    const idColumn = firstColumn(columns, ["id", "invoice_id", "invoiceId"]);
    if (!idColumn) continue;
    const tenantColumns = invoiceTenantWhere(columns);
    const where = [`${idColumn} = @invoiceId`];
    const params = { invoiceId, tenantId };
    if (tenantColumns.length) {
      where.push(`(${tenantColumns.map((column) => `${column} = @tenantId`).join(" OR ")})`);
    }
    const row = db.prepare(`SELECT * FROM ${table} WHERE ${where.join(" AND ")}`).get(params);
    if (row) return { table, columns, idColumn, row, where, params };
  }
  return null;
}

function dateKey(value) {
  const date = parseActivityDate(value);
  return date ? date.toISOString().slice(0, 10) : "";
}

function invoiceBusinessDate(source = {}) {
  return dateKey(pickValue(source, ["businessDate", "business_date", "invoiceDate", "invoice_date", "createdAt", "created_at", "date"], ""));
}

function invoiceBranchId(source = {}, fallback = "") {
  return String(pickValue(source, ["branchId", "branch_id"], fallback));
}

function invoiceIsClosed(source = {}) {
  const status = String(pickValue(source, ["status", "paymentStatus", "payment_status"], "")).toLowerCase();
  const statusTokens = new Set(status.split(/[^a-z0-9]+/).filter(Boolean));
  if (["closed", "finalized", "billed", "settled", "posted", "voided", "cancelled"].some((item) => statusTokens.has(item))) return true;
  if (statusTokens.has("paid") && !statusTokens.has("unpaid") && !statusTokens.has("partial")) return true;
  if (pickValue(source, ["lockedAt", "locked_at", "finalizedAt", "finalized_at"], "")) return true;
  const total = invoiceTotal(source);
  const paid = invoicePaid(source);
  const due = invoiceDue(source);
  return total > 0 && paid >= total && due <= 0;
}

function invoiceEnterpriseState(req, invoiceId, invoice = {}) {
  const record = findInvoiceRecord(req, invoiceId);
  const lookup = findInvoiceById(req, invoiceId);
  const snapshot = { ...(record?.row || {}), ...lookup, ...invoice, id: invoiceId, invoiceId };
  const branchId = invoiceBranchId(snapshot, requestBranchId(req));
  const businessDate = invoiceBusinessDate(snapshot) || dateKey(nowIso());
  const closed = invoiceIsClosed(snapshot);
  const dayClose = tableExists("day_close_locks") && branchId && businessDate
    ? dayCloseLockService.status(branchId, businessDate, req.access || {})
    : { status: "open" };
  return { record, snapshot, branchId, businessDate, closed, dayClose };
}

function assertDayOpenForInvoice(req, state, actionLabel = "modify") {
  if (String(state.dayClose?.status || "").toLowerCase() !== "locked") return;
  throw conflict(`Invoice cannot be ${actionLabel} after day close. Create an adjustment note or credit note instead.`, {
    branchId: state.branchId,
    businessDate: state.businessDate,
    dayCloseStatus: state.dayClose.status,
    requiresAdjustmentNote: true,
    adjustmentEndpoint: `/api/pos/invoices/${state.snapshot.invoiceId || state.snapshot.id}/adjustment-note`
  });
}

function assertDirectEditAllowed(req, state) {
  assertDayOpenForInvoice(req, state, "edited");
  if (!state.closed) return;
  throw conflict("Closed invoices cannot be edited directly. Create a credit note or adjustment note instead.", {
    invoiceId: state.snapshot.invoiceId || state.snapshot.id,
    branchId: state.branchId,
    businessDate: state.businessDate,
    requiresAdjustmentNote: true,
    adjustmentEndpoint: `/api/pos/invoices/${state.snapshot.invoiceId || state.snapshot.id}/adjustment-note`
  });
}

function setInvoiceDeleted(req, invoiceId, reason) {
  const tenantId = requestTenantId(req);
  const actor = requestActor(req);
  const deletedAt = nowIso();

  for (const table of invoiceTables()) {
    if (!tableExists(table)) continue;
    const columns = tableColumns(table);
    const idColumn = firstColumn(columns, ["id", "invoice_id", "invoiceId"]);
    if (!idColumn) continue;
    const tenantColumns = ["tenant_id", "tenantId"].filter((column) => columns.includes(column));
    const where = [`${idColumn} = @invoiceId`];
    const params = { invoiceId, tenantId };
    if (tenantColumns.length) {
      where.push(`(${tenantColumns.map((column) => `${column} = @tenantId`).join(" OR ")})`);
    }
    const existing = db.prepare(`SELECT * FROM ${table} WHERE ${where.join(" AND ")}`).get(params);
    if (!existing) continue;

    const updates = {};
    putColumn(updates, columns, ["is_deleted", "deleted", "deleted_flag"], 1);
    putColumn(updates, columns, ["deleted_at", "deletedAt"], deletedAt);
    putColumn(updates, columns, ["deleted_by", "deletedBy"], actor);
    putColumn(updates, columns, ["delete_reason", "deleted_reason", "deleteReason"], reason || "");
    putColumn(updates, columns, ["status"], "deleted");
    const keys = Object.keys(updates);
    if (keys.length) {
      db.prepare(`UPDATE ${table} SET ${keys.map((key) => `${key} = @${key}`).join(", ")} WHERE ${where.join(" AND ")}`)
        .run({ ...params, ...updates });
    }
    return { ...existing, ...updates };
  }

  return null;
}

function restoredInvoiceStatus(row = {}) {
  const total = invoiceTotal(row);
  const paid = invoicePaid(row);
  const due = invoiceDue(row);
  if (total > 0 && paid >= total && due <= 0) return "paid";
  if (paid > 0) return "partial";
  return "unpaid";
}

function setInvoiceRestored(req, invoiceId, reason) {
  const record = findInvoiceRecord(req, invoiceId);
  if (!record) return null;
  const restoredAt = nowIso();
  const updates = {};
  putColumn(updates, record.columns, ["is_deleted", "deleted", "deleted_flag"], 0);
  putColumn(updates, record.columns, ["deleted_at", "deletedAt"], "");
  putColumn(updates, record.columns, ["deleted_by", "deletedBy"], "");
  putColumn(updates, record.columns, ["delete_reason", "deleted_reason", "deleteReason"], "");
  putColumn(updates, record.columns, ["restored_at", "restoredAt"], restoredAt);
  putColumn(updates, record.columns, ["restored_by", "restoredBy"], requestActor(req));
  putColumn(updates, record.columns, ["restore_reason", "restoreReason"], reason || "");
  putColumn(updates, record.columns, ["status"], restoredInvoiceStatus(record.row));
  const keys = Object.keys(updates);
  if (keys.length) {
    db.prepare(`UPDATE ${record.table} SET ${keys.map((key) => `${key} = @${key}`).join(", ")} WHERE ${record.where.join(" AND ")}`)
      .run({ ...record.params, ...updates });
  }
  return { ...record.row, ...updates };
}

function updateInvoiceDirect(req, invoiceId) {
  assertInvoiceRequestRole(req, "edit");
  const payload = safeJson(req.body?.invoice, req.body || {});
  const reason = String(req.body?.reason || req.body?.editReason || req.body?.approvalReason || "").trim();
  if (!reason) throw badRequest("Edit reason is required");

  const state = invoiceEnterpriseState(req, invoiceId, payload);
  if (!state.record) throw notFound("Invoice not found");
  assertDirectEditAllowed(req, state);

  const editableFields = {
    status: ["status"],
    paymentStatus: ["payment_status", "paymentStatus"],
    total: ["total", "grand_total", "grandTotal"],
    paid: ["paid", "paid_amount", "paidAmount"],
    balance: ["balance", "due_amount", "dueAmount", "due"],
    discount: ["discount", "discount_total", "discountTotal"],
    gst: ["gst", "gstAmount", "tax_total", "taxTotal"],
    notes: ["notes", "note"]
  };
  const updates = {};
  for (const [inputKey, columns] of Object.entries(editableFields)) {
    if (payload[inputKey] === undefined) continue;
    putColumn(updates, state.record.columns, columns, payload[inputKey]);
  }
  putColumn(updates, state.record.columns, ["updated_at", "updatedAt"], nowIso());
  const keys = Object.keys(updates);
  const meaningfulKeys = keys.filter((key) => !["updated_at", "updatedAt"].includes(key));
  if (!meaningfulKeys.length) throw badRequest("No editable invoice fields were provided");

  db.prepare(`UPDATE ${state.record.table} SET ${keys.map((key) => `${key} = @${key}`).join(", ")} WHERE ${state.record.where.join(" AND ")}`)
    .run({ ...state.record.params, ...updates });
  const updated = findInvoiceRecord(req, invoiceId)?.row || { ...state.record.row, ...updates };
  insertAuditLogRow(req, {
    action: "invoice.updated",
    invoiceId,
    branchId: state.branchId,
    oldValue: state.record.row,
    newValue: {
      ...updated,
      editReason: reason,
      enterpriseControl: "direct_edit_open_invoice",
      applied: true
    },
    severity: "warning"
  });
  return { invoiceId, status: "updated", invoice: updated };
}

function createInvoiceAdjustmentNote(req, invoiceId) {
  assertInvoiceAdjustmentRole(req);
  const state = invoiceEnterpriseState(req, invoiceId, safeJson(req.body?.invoice, {}));
  if (!state.record) throw notFound("Invoice not found");
  const reason = String(req.body?.reason || req.body?.adjustmentReason || req.body?.creditNoteReason || "").trim();
  if (!reason) throw badRequest("Adjustment note reason is required");
  const amount = numberValue(req.body?.amount || req.body?.adjustmentAmount || req.body?.creditAmount || 0);
  const noteType = String(req.body?.type || req.body?.noteType || "adjustment_note").trim() || "adjustment_note";
  const id = makeAuditId("adj");
  const createdAt = nowIso();
  const note = {
    id,
    invoiceId,
    invoiceNumber: pickValue(state.snapshot, ["invoiceNumber", "invoice_no", "invoiceNo"], invoiceId),
    type: noteType,
    amount,
    reason,
    status: "recorded",
    branchId: state.branchId,
    businessDate: state.businessDate,
    createdBy: requestActor(req),
    createdRole: requestActorRole(req),
    createdAt,
    dayCloseStatus: state.dayClose?.status || "open",
    source: state.closed || state.dayClose?.status === "locked" ? "closed_invoice_control" : "manual_adjustment"
  };
  const auditId = insertAuditLogRow(req, {
    action: "invoice.adjustment_note_created",
    invoiceId,
    branchId: state.branchId,
    oldValue: state.snapshot,
    newValue: note,
    severity: "warning"
  });
  return { ...note, auditId };
}

function restoreInvoice(req, invoiceId) {
  assertInvoiceRestoreRole(req);
  const reason = String(req.body?.reason || req.body?.restoreReason || "").trim();
  if (!reason) throw badRequest("Restore reason is required");
  const state = invoiceEnterpriseState(req, invoiceId, safeJson(req.body?.invoice, {}));
  if (!state.record) throw notFound("Invoice not found");
  assertDayOpenForInvoice(req, state, "restored");
  const restoredInvoice = setInvoiceRestored(req, invoiceId, reason);
  const auditId = insertAuditLogRow(req, {
    action: "invoice.restored",
    invoiceId,
    branchId: state.branchId,
    oldValue: state.record.row,
    newValue: {
      ...restoredInvoice,
      restoreReason: reason,
      restoredBy: requestActor(req),
      restoredRole: requestActorRole(req),
      restoredAt: nowIso(),
      applied: true
    },
    severity: "warning"
  });
  return { invoiceId, status: "restored", auditId, invoice: restoredInvoice };
}

const PENDING_INVOICE_APPROVAL_LIMIT = 5000;

function pendingInvoiceActionType(action) {
  const value = String(action || "").toLowerCase();
  if (value.includes("delete")) return "delete";
  if (value.includes("edit")) return "edit";
  if (value.includes("payment")) return "payment_update";
  return "";
}

function approvalPayloadFromRequest(req, actionType, invoiceId, invoice = {}) {
  const reason = String(req.body?.reason || req.body?.deleteReason || req.body?.approvalReason || "").trim();
  const ownerPin = String(req.body?.ownerPin || req.body?.ownerPassword || req.body?.owner_pin || "").trim();
  if (!reason) {
    const error = new Error("Reason is required");
    error.statusCode = 400;
    throw error;
  }
  if (!ownerPin) {
    const error = new Error("Owner PIN/password is required");
    error.statusCode = 400;
    throw error;
  }

  const snapshot = { ...findInvoiceById(req, invoiceId), ...invoice };
  const total = numberValue(pickValue(snapshot, ["total", "grandTotal", "grand_total", "amount"], 0));
  const highValue = total >= PENDING_INVOICE_APPROVAL_LIMIT;
  const requestedAt = nowIso();

  return {
    snapshot,
    branchId: String(pickValue(snapshot, ["branchId", "branch_id"], requestBranchId(req))),
    payload: {
      ...snapshot,
      invoiceId,
      actionType,
      approvalRequired: true,
      approvalStatus: "pending",
      approvalReason: reason,
      deleteReason: actionType === "delete" ? reason : "",
      requestedBy: requestActor(req),
      requestedRole: requestActorRole(req),
      requestedAt,
      requestedBranchId: String(pickValue(snapshot, ["branchId", "branch_id"], requestBranchId(req))),
      requestedTenantId: requestTenantId(req),
      ownerPinCaptured: true,
      ownerPinCapturedAt: requestedAt,
      approvalPolicy: actionType === "delete"
        ? "manager_approval_required"
        : highValue
          ? "high_value_approval_required"
          : "approval_required",
      highValue
    }
  };
}

function ownerPinFromRequest(req) {
  return String(req.body?.ownerPin || req.body?.ownerPassword || req.body?.owner_pin || "").trim();
}

function approvalDecisionForRequest(req, activityId, invoiceId = "") {
  if (!activityId || !tableExists("audit_log")) return null;
  const columns = tableColumns("audit_log");
  const idColumn = firstColumn(columns, ["id"]);
  const actionColumn = firstColumn(columns, ["action"]);
  const entityColumn = firstColumn(columns, ["entity_id", "entityId"]);
  const newColumn = firstColumn(columns, ["new_value", "newValue"]);
  if (!idColumn || !actionColumn || !newColumn) return null;
  const tenantColumn = firstColumn(columns, ["tenant_id", "tenantId"]);
  const createdColumn = firstColumn(columns, ["created_at", "createdAt"]) || idColumn;
  const params = { activityId, invoiceId, tenantId: requestTenantId(req) };
  const where = [`lower(${actionColumn}) IN ('invoice.edit_approved', 'invoice.edit_rejected', 'invoice.delete_approved', 'invoice.delete_rejected')`];
  if (tenantColumn) where.push(`${tenantColumn} = @tenantId`);
  if (entityColumn && invoiceId) where.push(`${entityColumn} = @invoiceId`);
  const rows = db.prepare(
    `SELECT ${idColumn} AS id, ${actionColumn} AS action, ${newColumn} AS newValue
       FROM audit_log
      WHERE ${where.join(" AND ")}
      ORDER BY ${createdColumn} DESC
      LIMIT 50`
  ).all(params);
  return rows.find((row) => {
    const value = safeJson(row.newValue, {});
    return String(value.requestActivityId || value.approvalRequestId || "") === String(activityId);
  }) || null;
}

function findPendingInvoiceApprovalRaw(req, { invoiceId = "", activityId = "", actionType = "" } = {}) {
  if (activityId) {
    const raw = loadRawAuditLogRow(activityId);
    if (!raw) return null;
    const newValue = parseRawAuditJson(raw, ["new_value", "newValue"]);
    const pendingAction = pendingInvoiceActionType(rawAuditValue(raw, ["action"], ""));
    if (String(newValue.approvalStatus || "").toLowerCase() !== "pending") return null;
    if (actionType && pendingAction !== actionType) return null;
    if (approvalDecisionForRequest(req, activityId, invoiceId || String(pickValue(newValue, ["invoiceId", "invoice_id", "id"], "")))) return null;
    return raw;
  }

  if (!invoiceId || !tableExists("audit_log")) return null;
  const columns = tableColumns("audit_log");
  const idColumn = firstColumn(columns, ["id"]);
  const actionColumn = firstColumn(columns, ["action"]);
  const entityColumn = firstColumn(columns, ["entity_id", "entityId"]);
  if (!idColumn || !actionColumn || !entityColumn) return null;

  const tenantColumn = firstColumn(columns, ["tenant_id", "tenantId"]);
  const branchColumn = firstColumn(columns, ["branch_id", "branchId"]);
  const createdColumn = firstColumn(columns, ["created_at", "createdAt"]) || idColumn;
  const tenantId = requestTenantId(req);
  const branchId = requestBranchId(req);
  const params = { invoiceId, tenantId, branchId };
  const where = [
    `${entityColumn} = @invoiceId`,
    `lower(${actionColumn}) IN ('invoice.edit_requested', 'invoice.delete_requested')`
  ];
  if (tenantColumn) where.push(`${tenantColumn} = @tenantId`);
  if (branchColumn && branchId) where.push(`(${branchColumn} = @branchId OR ${branchColumn} = '')`);

  const rows = db.prepare(
    `SELECT ${idColumn} AS id
     FROM audit_log
     WHERE ${where.join(" AND ")}
     ORDER BY ${createdColumn} DESC
     LIMIT 20`
  ).all(params);

  for (const row of rows) {
    const raw = loadRawAuditLogRow(String(row.id));
    if (!raw) continue;
    const newValue = parseRawAuditJson(raw, ["new_value", "newValue"]);
    const pendingAction = pendingInvoiceActionType(rawAuditValue(raw, ["action"], ""));
    if (String(newValue.approvalStatus || "").toLowerCase() !== "pending") continue;
    if (actionType && pendingAction !== actionType) continue;
    if (approvalDecisionForRequest(req, String(row.id), invoiceId)) continue;
    return raw;
  }

  return null;
}

function createInvoiceApprovalRequest(req, { actionType = "", invoiceId = "" } = {}) {
  const resolvedActionType = pendingInvoiceActionType(actionType || req.body?.actionType || req.body?.action);
  if (!["edit", "delete"].includes(resolvedActionType)) {
    const error = new Error("actionType must be edit or delete");
    error.statusCode = 400;
    throw error;
  }

  const resolvedInvoiceId = String(invoiceId || req.body?.invoiceId || req.body?.id || req.body?.invoice?.id || req.body?.invoice?.invoiceId || "").trim();
  if (!resolvedInvoiceId) {
    const error = new Error("invoiceId is required");
    error.statusCode = 400;
    throw error;
  }
  assertInvoiceRequestRole(req, resolvedActionType);

  const requestInvoice = safeJson(req.body?.invoice, {});
  const state = invoiceEnterpriseState(req, resolvedInvoiceId, requestInvoice);
  if (resolvedActionType === "edit") {
    assertDirectEditAllowed(req, state);
  } else {
    assertDayOpenForInvoice(req, state, "deleted");
  }

  const { snapshot, branchId, payload } = approvalPayloadFromRequest(req, resolvedActionType, resolvedInvoiceId, requestInvoice);
  const existing = findPendingInvoiceApprovalRaw(req, { invoiceId: resolvedInvoiceId, actionType: resolvedActionType });
  if (existing) {
    const id = String(rawAuditValue(existing, ["id"], ""));
    return {
      id,
      status: "pending",
      duplicate: true,
      approvalRequired: true,
      activity: loadAuditActivityById(req, id)
    };
  }

  const id = insertAuditLogRow(req, {
    action: resolvedActionType === "delete" ? "invoice.delete_requested" : "invoice.edit_requested",
    invoiceId: resolvedInvoiceId,
    branchId,
    oldValue: snapshot,
    newValue: payload,
    severity: payload.highValue || resolvedActionType === "delete" ? "warning" : "info"
  });

  return {
    id,
    status: "pending",
    duplicate: false,
    approvalRequired: true,
    activity: loadAuditActivityById(req, id)
  };
}

function approveInvoiceApprovalRequest(req, { activityId = "", invoiceId = "" } = {}) {
  assertInvoiceApprovalManager(req);
  const raw = findPendingInvoiceApprovalRaw(req, { activityId, invoiceId });
  if (!raw) {
    const error = new Error("Pending invoice approval request not found");
    error.statusCode = 404;
    throw error;
  }

  const ownerPin = ownerPinFromRequest(req);
  if (!ownerPin) {
    const error = new Error("Owner PIN/password is required");
    error.statusCode = 400;
    throw error;
  }

  const oldValue = parseRawAuditJson(raw, ["old_value", "oldValue"]);
  const newValue = parseRawAuditJson(raw, ["new_value", "newValue"]);
  const actionType = pendingInvoiceActionType(rawAuditValue(raw, ["action"], ""));
  const resolvedActivityId = String(rawAuditValue(raw, ["id"], activityId));
  const resolvedInvoiceId = String(pickValue({ ...oldValue, ...newValue }, ["invoiceId", "invoice_id", "id"], rawAuditValue(raw, ["entity_id", "entityId"], invoiceId)));
  const branchId = String(pickValue({ ...oldValue, ...newValue }, ["branchId", "branch_id"], requestBranchId(req)));
  const state = invoiceEnterpriseState(req, resolvedInvoiceId, { ...oldValue, ...newValue });
  if (actionType === "delete") {
    assertDayOpenForInvoice(req, state, "deleted");
  }
  const approvedAt = nowIso();
  const approvedValue = {
    ...newValue,
    approvalStatus: "approved",
    requestActivityId: resolvedActivityId,
    approvalRequestId: resolvedActivityId,
    approvedBy: requestActor(req),
    approvedRole: requestActorRole(req),
    approvedAt,
    approvalTime: approvedAt,
    ownerPinCaptured: true,
    ownerPinCapturedAt: approvedAt
  };

  let deletedInvoice = null;
  if (actionType === "delete") {
    deletedInvoice = setInvoiceDeleted(req, resolvedInvoiceId, approvedValue.deleteReason || approvedValue.approvalReason || "Approved invoice delete");
  }

  const decisionId = insertAuditLogRow(req, {
    action: actionType === "delete" ? "invoice.delete_approved" : "invoice.edit_approved",
    invoiceId: resolvedInvoiceId,
    branchId,
    oldValue: newValue,
    newValue: { ...approvedValue, deletedInvoice, applied: actionType === "delete" },
    severity: "info"
  });

  return {
    id: resolvedActivityId,
    invoiceId: resolvedInvoiceId,
    status: "approved",
    applied: actionType === "delete",
    decisionId,
    activity: loadAuditActivityById(req, decisionId)
  };
}

function rejectInvoiceApprovalRequest(req, { activityId = "", invoiceId = "" } = {}) {
  assertInvoiceApprovalManager(req);
  const raw = findPendingInvoiceApprovalRaw(req, { activityId, invoiceId });
  if (!raw) {
    const error = new Error("Pending invoice approval request not found");
    error.statusCode = 404;
    throw error;
  }

  const rejectionReason = String(req.body?.reason || req.body?.rejectionReason || "").trim();
  if (!rejectionReason) {
    const error = new Error("Rejection reason is required");
    error.statusCode = 400;
    throw error;
  }

  const oldValue = parseRawAuditJson(raw, ["old_value", "oldValue"]);
  const newValue = parseRawAuditJson(raw, ["new_value", "newValue"]);
  const actionType = pendingInvoiceActionType(rawAuditValue(raw, ["action"], ""));
  const resolvedActivityId = String(rawAuditValue(raw, ["id"], activityId));
  const resolvedInvoiceId = String(pickValue({ ...oldValue, ...newValue }, ["invoiceId", "invoice_id", "id"], rawAuditValue(raw, ["entity_id", "entityId"], invoiceId)));
  const branchId = String(pickValue({ ...oldValue, ...newValue }, ["branchId", "branch_id"], requestBranchId(req)));
  const rejectedAt = nowIso();
  const rejectedValue = {
    ...newValue,
    approvalStatus: "rejected",
    requestActivityId: resolvedActivityId,
    approvalRequestId: resolvedActivityId,
    rejectedBy: requestActor(req),
    rejectedRole: requestActorRole(req),
    rejectedAt,
    rejectionTime: rejectedAt,
    rejectionReason
  };

  const decisionId = insertAuditLogRow(req, {
    action: actionType === "delete" ? "invoice.delete_rejected" : "invoice.edit_rejected",
    invoiceId: resolvedInvoiceId,
    branchId,
    oldValue: newValue,
    newValue: { ...rejectedValue, applied: false },
    severity: "warning"
  });

  return {
    id: resolvedActivityId,
    invoiceId: resolvedInvoiceId,
    status: "rejected",
    applied: false,
    decisionId,
    activity: loadAuditActivityById(req, decisionId)
  };
}

function applyApprovalDecisionStatus(rows) {
  const decisions = new Map();
  for (const row of rows) {
    if (!row.requestActivityId || !["approved", "rejected"].includes(row.approvalStatus)) continue;
    decisions.set(row.requestActivityId, row);
  }
  if (!decisions.size) return rows;
  return rows.map((row) => {
    if (row.approvalStatus !== "pending") return row;
    const decision = decisions.get(row.id);
    if (!decision) return row;
    return {
      ...row,
      status: decision.approvalStatus,
      approvalStatus: decision.approvalStatus,
      approvedBy: decision.approvedBy || row.approvedBy,
      approvedRole: decision.approvedRole || row.approvedRole,
      approvalTime: decision.approvalTime || row.approvalTime,
      rejectedBy: decision.rejectedBy || row.rejectedBy,
      rejectedRole: decision.rejectedRole || row.rejectedRole,
      rejectionTime: decision.rejectionTime || row.rejectionTime,
      rejectionReason: decision.rejectionReason || row.rejectionReason
    };
  });
}

function invoiceActivityRowsForRequest(req, { limit = 200, offset = 0, slice = true } = {}) {
  const tenantId = requestTenantId(req);
  const branchId = req.access?.branchId || "";
  const queryBranchId = String(req.query.branchId || "").trim();
  const effectiveBranchId = branchId || queryBranchId;
  const rawLimit = Math.min(Math.max(Number(limit) || 200, 1), 5000);
  const invoiceLookup = loadInvoiceLookup(tenantId);
  const rawRows = [
    ...loadAuditLogInvoiceActivity(tenantId, rawLimit),
    ...loadInvoiceAuditActivity(tenantId, rawLimit)
  ];
  const seen = new Set();
  const filters = {
    q: req.query.q,
    client: req.query.client,
    staff: req.query.staff,
    action: req.query.action,
    status: req.query.status,
    branchId: effectiveBranchId,
    from: req.query.from,
    to: req.query.to,
    minAmount: req.query.minAmount,
    maxAmount: req.query.maxAmount,
    paymentMode: req.query.paymentMode
  };
  const normalizedRows = enrichInvoiceActivityRisk(applyApprovalDecisionStatus(
    rawRows
      .map((row) => normalizeInvoiceActivity(row, invoiceLookup))
      .filter(Boolean)
      .filter((row) => {
        if (effectiveBranchId && row.branchId && row.branchId !== effectiveBranchId) return false;
        const key = `${row.source}:${row.id}:${row.actionType}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      })
      .sort((a, b) => String(b.actionTime).localeCompare(String(a.actionTime)))
  ));
  const rows = filterInvoiceActivityRows(
    normalizedRows,
    filters
  );

  const start = Math.max(Number(offset) || 0, 0);
  return {
    rows: slice ? rows.slice(start, start + rawLimit) : rows,
    total: rows.length,
    limit: rawLimit,
    offset: start,
    filters
  };
}

function invoiceActivityListResponse(req) {
  const limit = Math.min(Number(req.query.limit) || 200, 1000);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  return invoiceActivityRowsForRequest(req, { limit, offset, slice: true });
}

function invoiceActivityDetailForRequest(req, activityId) {
  const normalizedActivityId = String(activityId || "").trim();
  if (!normalizedActivityId) throw badRequest("Invoice activity id is required");
  const result = invoiceActivityRowsForRequest(req, { limit: 5000, offset: 0, slice: false });
  const row = result.rows.find((activity) => String(activity.id) === normalizedActivityId);
  if (!row) {
    throw notFound("Invoice activity not found");
  }
  return row;
}

function activityDateKey(value) {
  const date = parseActivityDate(value);
  return date ? date.toISOString().slice(0, 10) : "unknown";
}

function paymentModeBucket(mode) {
  const value = String(mode || "").toLowerCase();
  if (value.includes("cash")) return "cash";
  if (value.includes("upi") || value.includes("gpay") || value.includes("phonepe") || value.includes("paytm")) return "upi";
  if (value.includes("card") || value.includes("credit") || value.includes("debit")) return "card";
  if (value.includes("wallet")) return "wallet";
  if (value.includes("bank") || value.includes("neft") || value.includes("rtgs") || value.includes("imps")) return "bank";
  return value || "untracked";
}

function incrementMetric(target, key, amount = 1) {
  target[key] = numberValue(target[key]) + amount;
}

function reportRows(rows, actionType) {
  return rows
    .filter((row) => row.actionType === actionType)
    .map((row) => ({
      date: activityDateKey(row.actionTime),
      invoiceNumber: row.invoiceNumber,
      clientName: row.clientName,
      clientPhone: row.clientPhone,
      staffName: row.staffName,
      branchName: row.branchName,
      amount: row.total,
      paid: row.paid,
      due: row.balance,
      advanceAdjusted: row.advanceAdjusted || 0,
      counterPaid: row.counterPaid || 0,
      status: row.status,
      actionByUser: row.actionByUser,
      riskLevel: row.riskLevel,
      riskReason: row.riskReason,
      suggestedAction: row.suggestedAction
    }));
}

function buildInvoiceActivityReports(rows) {
  const dailyMap = new Map();
  const staffMap = new Map();
  const paymentMap = new Map();

  for (const row of rows) {
    const date = activityDateKey(row.actionTime);
    if (!dailyMap.has(date)) {
      dailyMap.set(date, { date, edits: 0, deletions: 0, totalAmount: 0 });
    }
    const daily = dailyMap.get(date);
    if (row.actionType === "edited") incrementMetric(daily, "edits");
    if (row.actionType === "deleted") incrementMetric(daily, "deletions");
    if (row.actionType === "edited" || row.actionType === "deleted") {
      incrementMetric(daily, "totalAmount", row.total);
    }

    const staffKey = row.staffName || "Unassigned";
    if (!staffMap.has(staffKey)) {
      staffMap.set(staffKey, {
        staffName: staffKey,
        edits: 0,
        deletions: 0,
        paymentUpdates: 0,
        highAmountChanges: 0,
        totalAmount: 0,
        suspiciousScore: 0,
        riskLevel: "low",
        riskReason: "No unusual pattern",
        suggestedAction: "Monitor during the routine audit cycle."
      });
    }
    const staff = staffMap.get(staffKey);
    if (row.actionType === "edited") incrementMetric(staff, "edits");
    if (row.actionType === "deleted") incrementMetric(staff, "deletions");
    if (row.actionType === "payment_updated") incrementMetric(staff, "paymentUpdates");
    if (row.total >= HIGH_VALUE_INVOICE_APPROVAL_LIMIT) incrementMetric(staff, "highAmountChanges");
    incrementMetric(staff, "totalAmount", row.total);
    incrementMetric(staff, "suspiciousScore", row.riskScore || 0);
    if (riskLevelScore(row.riskLevel) > riskLevelScore(staff.riskLevel)) {
      staff.riskLevel = row.riskLevel;
      staff.riskReason = row.riskReason;
      staff.suggestedAction = row.suggestedAction;
    }

    const paymentRelevant = row.actionType === "payment_updated"
      || (row.changes || []).some((change) => String(change.category || "").toLowerCase().includes("payment") || String(change.field || "").toLowerCase().includes("payment"));
    if (paymentRelevant) {
      const buckets = (row.paymentModes?.length ? row.paymentModes : ["untracked"]).map(paymentModeBucket);
      for (const bucket of new Set(buckets)) {
        if (!paymentMap.has(bucket)) {
          paymentMap.set(bucket, { paymentMode: bucket, count: 0, totalAmount: 0, paymentDifference: 0 });
        }
        const payment = paymentMap.get(bucket);
        incrementMetric(payment, "count");
        incrementMetric(payment, "totalAmount", row.total);
        incrementMetric(payment, "paymentDifference", row.financeImpact?.paymentDifference || 0);
      }
    }
  }

  const staffWiseSuspiciousChanges = Array.from(staffMap.values())
    .map((staff) => {
      const suspiciousScore = staff.suspiciousScore + staff.deletions * 3 + staff.paymentUpdates * 2 + staff.edits + staff.highAmountChanges * 2;
      const reasons = [];
      if (staff.deletions >= 3) reasons.push("Repeated deleted invoices");
      if (staff.paymentUpdates >= 3) reasons.push("Repeated payment changes");
      if (staff.highAmountChanges > 0) reasons.push("High amount invoice changes");
      return {
        ...staff,
        suspiciousScore,
        riskReason: [staff.riskReason, ...reasons].filter((reason) => reason && reason !== "No unusual pattern").join("; ") || "No unusual pattern"
      };
    })
    .sort((a, b) => b.suspiciousScore - a.suspiciousScore || b.totalAmount - a.totalAmount);

  const exportRows = rows.map((row) => ({
    date: activityDateKey(row.actionTime),
    time: row.actionTime,
    invoiceNumber: row.invoiceNumber,
    clientName: row.clientName,
    clientPhone: row.clientPhone,
    staffName: row.staffName,
    branchName: row.branchName,
    actionType: row.actionType,
    status: row.status,
    paymentModes: (row.paymentModes || []).join(" | "),
    amount: row.total,
    amountDifference: row.financeImpact?.amountDifference || 0,
    paid: row.paid,
    due: row.balance,
    advanceAdjusted: row.advanceAdjusted || 0,
    counterPaid: row.counterPaid || 0,
    paymentDifference: row.financeImpact?.paymentDifference || 0,
    actionByUser: row.actionByUser,
    approvalStatus: row.approvalStatus || "",
    approvedBy: row.approvedBy || "",
    rejectedBy: row.rejectedBy || "",
    riskLevel: row.riskLevel || "low",
    riskScore: row.riskScore || 0,
    riskReason: row.riskReason || "",
    suggestedAction: row.suggestedAction || "",
    reason: row.deleteReason || row.approvalReason || row.rejectionReason || ""
  }));

  return {
    generatedAt: nowIso(),
    summary: {
      totalActivities: rows.length,
      edits: rows.filter((row) => row.actionType === "edited").length,
      deletions: rows.filter((row) => row.actionType === "deleted").length,
      restorations: rows.filter((row) => row.actionType === "restored").length,
      paymentUpdates: rows.filter((row) => row.actionType === "payment_updated").length,
      highRiskActivities: rows.filter((row) => ["high", "critical"].includes(row.riskLevel)).length,
      criticalRiskActivities: rows.filter((row) => row.riskLevel === "critical").length,
      totalAmount: rows.reduce((sum, row) => sum + numberValue(row.total), 0)
    },
    dailyEditDeleteReport: Array.from(dailyMap.values()).sort((a, b) => String(b.date).localeCompare(String(a.date))),
    staffWiseSuspiciousChanges,
    paymentAdjustmentReport: Array.from(paymentMap.values()).sort((a, b) => b.count - a.count || b.totalAmount - a.totalAmount),
    deletedInvoiceReport: reportRows(rows, "deleted"),
    restoredInvoiceReport: reportRows(rows, "restored"),
    paymentUpdateReport: reportRows(rows, "payment_updated"),
    exportRows
  };
}

function csvEscape(value) {
  const text = String(value ?? "");
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function reportToCsv(rows) {
  const headers = [
    "date",
    "time",
    "invoiceNumber",
    "clientName",
    "clientPhone",
    "staffName",
    "branchName",
    "actionType",
    "status",
    "paymentModes",
    "amount",
    "amountDifference",
    "paid",
    "due",
    "advanceAdjusted",
    "counterPaid",
    "paymentDifference",
    "actionByUser",
    "approvalStatus",
    "approvedBy",
    "rejectedBy",
    "riskLevel",
    "riskScore",
    "riskReason",
    "suggestedAction",
    "reason"
  ];
  return [
    headers.join(","),
    ...rows.map((row) => headers.map((key) => csvEscape(row[key])).join(","))
  ].join("\n");
}

function reportPdfPayload(report) {
  const lines = [
    "Aura Salon OS - Invoice Activity Report",
    `Generated: ${report.generatedAt}`,
    `Activities: ${report.summary.totalActivities}`,
    `Edits: ${report.summary.edits} | Deletions: ${report.summary.deletions} | Restored: ${report.summary.restorations} | Payment updates: ${report.summary.paymentUpdates}`,
    "",
    "Daily edit/delete report",
    ...report.dailyEditDeleteReport.slice(0, 20).map((row) => `${row.date} - edits ${row.edits}, deletions ${row.deletions}, amount INR ${Math.round(row.totalAmount)}`),
    "",
    "Staff-wise suspicious changes",
    ...report.staffWiseSuspiciousChanges.slice(0, 20).map((row) => `${row.staffName} - ${row.riskLevel || "low"} score ${row.suspiciousScore}, edits ${row.edits}, deletions ${row.deletions}, payments ${row.paymentUpdates}, reason: ${row.riskReason}`),
    "",
    "AI risk detection",
    `High risk activities: ${report.summary.highRiskActivities || 0} | Critical: ${report.summary.criticalRiskActivities || 0}`,
    ...report.exportRows.filter((row) => ["high", "critical"].includes(row.riskLevel)).slice(0, 20).map((row) => `${row.riskLevel} - ${row.invoiceNumber} - ${row.riskReason} - ${row.suggestedAction}`),
    "",
    "Payment adjustment report",
    ...report.paymentAdjustmentReport.slice(0, 20).map((row) => `${row.paymentMode} - count ${row.count}, amount INR ${Math.round(row.totalAmount)}, diff INR ${Math.round(row.paymentDifference)}`)
  ];
  return {
    filename: `invoice-activity-report-${new Date().toISOString().slice(0, 10)}.pdf`,
    contentType: "application/pdf",
    lines
  };
}

function pdfText(value) {
  return String(value ?? "")
    .replace(/[^\x09\x0A\x0D\x20-\x7E]/g, " ")
    .replace(/[\\()]/g, "\\$&")
    .replace(/[\r\n]+/g, " ");
}

function reportToPdfBuffer(lines = []) {
  const printableLines = lines.length ? lines : ["Aura Salon OS - Invoice Activity Report"];
  const stream = [
    "BT",
    "/F1 10 Tf",
    "50 780 Td",
    "14 TL",
    ...printableLines.slice(0, 75).flatMap((line) => [`(${pdfText(line).slice(0, 110)}) Tj`, "T*"]),
    "ET"
  ].join("\n");
  const objects = [
    "1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n",
    "2 0 obj\n<< /Type /Pages /Kids [3 0 R] /Count 1 >>\nendobj\n",
    "3 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>\nendobj\n",
    "4 0 obj\n<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\nendobj\n",
    `5 0 obj\n<< /Length ${Buffer.byteLength(stream, "utf8")} >>\nstream\n${stream}\nendstream\nendobj\n`
  ];
  let pdf = "%PDF-1.4\n";
  const offsets = [];
  for (const object of objects) {
    offsets.push(Buffer.byteLength(pdf, "utf8"));
    pdf += object;
  }
  const xrefOffset = Buffer.byteLength(pdf, "utf8");
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return Buffer.from(pdf, "utf8");
}

function sendInvoiceActivityReports(req, res) {
  const result = invoiceActivityRowsForRequest(req, {
    limit: Math.min(Number(req.query.limit) || 5000, 5000),
    offset: 0,
    slice: false
  });
  const report = buildInvoiceActivityReports(result.rows);
  const format = String(req.query.format || "json").trim().toLowerCase();
  const filenameBase = `invoice-activity-report-${new Date().toISOString().slice(0, 10)}`;

  if (format === "csv") {
    res.setHeader("content-type", "text/csv; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${filenameBase}.csv"`);
    res.send(reportToCsv(report.exportRows));
    return;
  }

  if (format === "pdf") {
    const payload = reportPdfPayload(report);
    res.setHeader("content-type", payload.contentType);
    res.setHeader("content-disposition", `attachment; filename="${payload.filename}"`);
    res.send(reportToPdfBuffer(payload.lines));
    return;
  }

  res.json({
    ...report,
    filters: result.filters,
    total: result.total
  });
}

function rejectAuditMutation(_req, res) {
  res.status(405).json({
    error: "Audit records are immutable and cannot be edited or deleted",
    status: 405
  });
}

auditRouter.patch("/auditLogs/:id", rejectAuditMutation);
auditRouter.delete("/auditLogs/:id", rejectAuditMutation);
auditRouter.patch("/audit/:id", rejectAuditMutation);
auditRouter.delete("/audit/:id", rejectAuditMutation);
auditRouter.patch("/security/audit/:id", rejectAuditMutation);
auditRouter.delete("/security/audit/:id", rejectAuditMutation);

auditRouter.get(
  "/invoice-activity",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(invoiceActivityListResponse(req));
  })
);

auditRouter.get(
  "/pos/invoice-activity",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(invoiceActivityListResponse(req));
  })
);

auditRouter.get(
  "/invoice-activity/reports",
  requirePermission("read", () => "security"),
  asyncHandler(sendInvoiceActivityReports)
);

auditRouter.get(
  "/pos/invoice-activity/reports",
  requirePermission("read", () => "security"),
  asyncHandler(sendInvoiceActivityReports)
);

auditRouter.get(
  "/invoice-activity/:id",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(invoiceActivityDetailForRequest(req, req.params.id));
  })
);

auditRouter.get(
  "/pos/invoice-activity/:id",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(invoiceActivityDetailForRequest(req, req.params.id));
  })
);

auditRouter.post(
  "/invoice-activity/request",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    return res.status(202).json(createInvoiceApprovalRequest(req));
  })
);

auditRouter.post(
  "/pos/invoices/:id/approval-request",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    return res.status(202).json(createInvoiceApprovalRequest(req, { invoiceId: req.params.id }));
  })
);

auditRouter.post(
  "/pos/invoices/:id/delete",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    return res.status(202).json(createInvoiceApprovalRequest(req, { actionType: "delete", invoiceId: req.params.id }));
  })
);

auditRouter.delete(
  "/invoices/:id",
  requirePermission("write", () => "invoices"),
  asyncHandler((_req, res) => {
    res.status(405).json({
      error: "Invoice hard delete is blocked. Use POST /api/pos/invoices/:id/delete for approval-based soft delete.",
      status: 405
    });
  })
);

auditRouter.delete(
  "/pos/invoices/:id",
  requirePermission("write", () => "invoices"),
  asyncHandler((_req, res) => {
    res.status(405).json({
      error: "Invoice hard delete is blocked. Use POST /api/pos/invoices/:id/delete for approval-based soft delete.",
      status: 405
    });
  })
);

auditRouter.patch(
  "/invoices/:id",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    res.json(updateInvoiceDirect(req, String(req.params.id || "")));
  })
);

auditRouter.patch(
  "/pos/invoices/:id/edit",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    res.json(updateInvoiceDirect(req, String(req.params.id || "")));
  })
);

auditRouter.post(
  "/pos/invoices/:id/adjustment-note",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    res.status(201).json(createInvoiceAdjustmentNote(req, String(req.params.id || "")));
  })
);

auditRouter.post(
  "/pos/invoices/:id/restore",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    res.json(restoreInvoice(req, String(req.params.id || "")));
  })
);

auditRouter.post(
  "/invoice-activity/:id/approve",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    return res.json(approveInvoiceApprovalRequest(req, { activityId: String(req.params.id || "") }));
  })
);

auditRouter.post(
  "/pos/invoices/:id/approve",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    return res.json(approveInvoiceApprovalRequest(req, {
      invoiceId: String(req.params.id || ""),
      activityId: String(req.body?.activityId || req.body?.approvalId || "")
    }));
  })
);

auditRouter.post(
  "/invoice-activity/:id/reject",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    return res.json(rejectInvoiceApprovalRequest(req, { activityId: String(req.params.id || "") }));
  })
);

auditRouter.post(
  "/pos/invoices/:id/reject",
  requirePermission("write", () => "invoices"),
  asyncHandler((req, res) => {
    return res.json(rejectInvoiceApprovalRequest(req, {
      invoiceId: String(req.params.id || ""),
      activityId: String(req.body?.activityId || req.body?.approvalId || "")
    }));
  })
);

auditRouter.get(
  "/audit",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    const params = {
      tenantId: req.access?.tenantId,
      entityType: req.query.entityType || "",
      entityId: req.query.entityId || "",
      userId: req.query.userId || "",
      from: req.query.from || "",
      to: req.query.to || "",
      limit: Math.min(Number(req.query.limit) || 50, 200),
      offset: Math.max(Number(req.query.offset) || 0, 0)
    };
    const rows = db.prepare(
      `SELECT id, tenant_id AS tenantId, user_id AS userId, action,
              entity_type AS entityType, entity_id AS entityId,
              old_value AS oldValue, new_value AS newValue,
              ip_address AS ipAddress, user_agent AS userAgent,
              created_at AS createdAt
       FROM audit_log
       WHERE tenant_id = @tenantId
         AND (@entityType = '' OR entity_type = @entityType)
         AND (@entityId = '' OR entity_id = @entityId)
         AND (@userId = '' OR user_id = @userId)
         AND (@from = '' OR substr(created_at, 1, 10) >= @from)
         AND (@to = '' OR substr(created_at, 1, 10) <= @to)
       ORDER BY created_at DESC
       LIMIT @limit OFFSET @offset`
    ).all(params).map((row) => ({
      ...row,
      oldValue: JSON.parse(row.oldValue || "{}"),
      newValue: JSON.parse(row.newValue || "{}")
    }));
    res.json({ rows, limit: params.limit, offset: params.offset });
  })
);
