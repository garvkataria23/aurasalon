import { badRequest, conflict, forbidden } from "../utils/app-error.js";
import { tenantService } from "../services/tenant.service.js";

export const INVOICE_TYPES = [
  "service",
  "product",
  "mixed",
  "membership",
  "package",
  "deposit",
  "refund",
  "credit_note",
  "debit_note",
  "proforma",
  "tax_invoice",
  "estimate",
  "corporate",
  "wallet_recharge"
];

export const PAYMENT_MODES = [
  "cash",
  "upi",
  "card",
  "wallet",
  "razorpay",
  "stripe",
  "bank_transfer",
  "gift_card",
  "membership",
  "loyalty_points",
  "split"
];

const PAID_OR_LOCKED_STATUSES = new Set(["paid", "voided", "refunded", "cancelled"]);

const DISCOUNT_LIMITS_BY_ROLE = {
  owner: 100,
  admin: 100,
  superAdmin: 100,
  manager: 25,
  accountant: 15,
  frontDesk: 10,
  cashier: 10,
  staff: 5,
  customer: 0
};

function assertAccess(access = {}) {
  if (!access.tenantId) throw badRequest("tenant_id is required");
  return access;
}

function normalizeBranchId(payload = {}, access = {}) {
  const branchId = payload.branch_id || payload.branchId || access.branchId || "";
  if (!branchId) throw badRequest("branch_id is required");
  tenantService.assertBranchAccess(access, branchId);
  return branchId;
}

export function assertTenantIsolation(access = {}, row = {}, label = "Record") {
  assertAccess(access);
  const rowTenant = row.tenant_id || row.tenantId;
  if (rowTenant && rowTenant !== access.tenantId) throw forbidden(`${label} belongs to another tenant`);
  const rowBranch = row.branch_id || row.branchId;
  if (rowBranch) tenantService.assertBranchAccess(access, rowBranch);
}

export function assertInvoiceEditable(invoice = {}) {
  if (!invoice.id) throw badRequest("Invoice is required");
  if (invoice.locked_at) throw conflict("Paid or locked invoice cannot be edited");
  if (PAID_OR_LOCKED_STATUSES.has(invoice.status) || invoice.payment_status === "paid") {
    throw conflict("Paid invoice cannot be edited directly; use refund, void or credit note workflow");
  }
}

export function assertNonNegativeTotal(total) {
  if (Number(total) < 0) throw badRequest("Invoice total cannot be negative");
}

export function assertDiscountLimit({ access = {}, subtotal = 0, discountAmount = 0 }) {
  assertAccess(access);
  const role = access.role || "staff";
  const limitPct = DISCOUNT_LIMITS_BY_ROLE[role] ?? 0;
  const safeSubtotal = Number(subtotal || 0);
  const safeDiscount = Number(discountAmount || 0);
  if (safeDiscount <= 0 || safeSubtotal <= 0) return;
  const requestedPct = (safeDiscount / safeSubtotal) * 100;
  if (requestedPct > limitPct + 0.0001) {
    throw forbidden(`Discount exceeds ${role} role limit of ${limitPct}%`, {
      role,
      allowedPercent: limitPct,
      requestedPercent: Math.round(requestedPct * 100) / 100
    });
  }
}

export function normalizeInvoiceItems(items = []) {
  if (!Array.isArray(items) || !items.length) throw badRequest("At least one invoice item is required");
  return items.map((item) => {
    const quantity = Number(item.quantity ?? 1);
    const price = Number(item.unit_price ?? item.unitPrice ?? item.price ?? 0);
    if (!Number.isFinite(quantity) || quantity <= 0) throw badRequest("Invoice item quantity must be greater than zero");
    if (!Number.isFinite(price) || price < 0) throw badRequest("Invoice item price cannot be negative");
    return item;
  });
}

export function inferInvoiceType(items = [], fallback = "tax_invoice") {
  const types = new Set(items.map((item) => item.item_type || item.itemType || item.type || "service"));
  if (types.size > 1) return "mixed";
  const [only] = [...types];
  if (["service", "product", "membership", "package", "deposit", "wallet_recharge"].includes(only)) return only;
  return fallback;
}

export function validateDraftInvoicePayload(payload = {}, access = {}) {
  assertAccess(access);
  const branchId = normalizeBranchId(payload, access);
  const items = normalizeInvoiceItems(payload.items || []);
  const invoiceType = payload.invoice_type || payload.invoiceType || inferInvoiceType(items);
  if (!INVOICE_TYPES.includes(invoiceType)) throw badRequest(`Invalid invoice_type: ${invoiceType}`);

  return {
    ...payload,
    tenant_id: access.tenantId,
    branch_id: branchId,
    customer_id: payload.customer_id || payload.customerId || payload.clientId || "",
    appointment_id: payload.appointment_id || payload.appointmentId || "",
    corporate_account_id: payload.corporate_account_id || payload.corporateAccountId || "",
    credit_account_id: payload.credit_account_id || payload.creditAccountId || "",
    invoice_type: invoiceType,
    source: payload.source || "pos",
    items
  };
}

export function validatePaymentPayload(payload = {}) {
  const paymentMode = payload.payment_mode || payload.paymentMode || payload.mode;
  const amount = Number(payload.amount || 0);
  if (!PAYMENT_MODES.includes(paymentMode)) throw badRequest(`Invalid payment mode: ${paymentMode}`);
  if (!Number.isFinite(amount) || amount <= 0) throw badRequest("Payment amount must be greater than zero");
  return {
    payment_mode: paymentMode,
    amount,
    provider: payload.provider || "",
    provider_payment_id: payload.provider_payment_id || payload.providerPaymentId || "",
    provider_order_id: payload.provider_order_id || payload.providerOrderId || "",
    provider_link_id: payload.provider_link_id || payload.providerLinkId || "",
    terminal_id: payload.terminal_id || payload.terminalId || "",
    reference_no: payload.reference_no || payload.referenceNo || payload.reference || "",
    notes: payload.notes || ""
  };
}

export function validateBillDiscount(discount = {}) {
  const type = discount.discount_type || discount.discountType || discount.type || "amount";
  const value = Number(discount.discount_value ?? discount.discountValue ?? discount.value ?? 0);
  if (!["amount", "percent", "percentage"].includes(type)) throw badRequest("Invalid discount type");
  if (!Number.isFinite(value) || value < 0) throw badRequest("Discount value cannot be negative");
  return {
    discount_type: type,
    discount_value: value,
    reason: discount.reason || ""
  };
}

export function validateManualPosInvoicePayload(payload = {}, access = {}) {
  return validateDraftInvoicePayload({ ...payload, source: payload.source || "manual_pos" }, access);
}
