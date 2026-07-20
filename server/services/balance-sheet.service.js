import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { seedChartOfAccounts } from "./balance-sheet-schema.service.js";
import { istToday, periodOf, normalizeBusinessDate } from "../utils/finance-time.js";
import { ensureHardeningSchema } from "./balance-sheet-hardening-schema.service.js";
import {
  SALON_OUTGOING_CATEGORIES,
  classifySalonOutgoing,
  salonOutgoingCategoryLabel,
  salonOutgoingCoverage
} from "./salon-outgoing-category.service.js";

const id = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;
const today = () => istToday(); // Stage 17: accounting day rolls over at IST midnight.
const money = (value) => Math.round(Number(value || 0));
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;
const rupeesToText = (value) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const parseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const tableExists = (name) => Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
const safeAll = (sql, params = {}) => {
  try {
    return db.prepare(sql).all(params);
  } catch {
    return [];
  }
};
const safeGet = (sql, params = {}) => {
  try {
    return db.prepare(sql).get(params) || {};
  } catch {
    return {};
  }
};
const sqlIdentifier = /^[A-Za-z_][A-Za-z0-9_]*$/;
const tableColumnCache = new Map();
const PREPAID_INVOICE_TYPES = new Set(["membership", "package", "gift_card", "giftcard", "prepaid"]);
const isPresent = (status) => ["present", "clocked_in", "clocked_out", "approved"].includes(String(status || "").toLowerCase());

function tableColumns(name) {
  if (!sqlIdentifier.test(name) || !tableExists(name)) return new Set();
  const cached = tableColumnCache.get(name);
  if (cached) return cached;
  const columns = new Set(safeAll(`PRAGMA table_info(${name})`).map((row) => row.name));
  tableColumnCache.set(name, columns);
  return columns;
}

function coalesceColumnExpression(columns, names, fallback = "NULL") {
  const available = names.filter((name) => sqlIdentifier.test(name) && columns.has(name));
  return available.length ? `COALESCE(${available.join(", ")}, ${fallback})` : fallback;
}

function selectColumnExpression(columns, names, alias, fallback = "NULL") {
  return `${coalesceColumnExpression(columns, names, fallback)} AS ${alias}`;
}

function amountPaiseFromRow(row = {}, paiseKeys = [], rupeeKeys = []) {
  for (const key of paiseKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      const paiseVal = Number(value);
      if (Number.isFinite(paiseVal) && paiseVal !== 0) return Math.round(paiseVal);
    }
  }
  for (const key of rupeeKeys) {
    const value = row[key];
    if (value !== undefined && value !== null && value !== "") {
      const rupee = Number(value);
      if (Number.isFinite(rupee) && rupee !== 0) return Math.round(rupee * 100);
    }
  }
  return 0;
}

function invoiceTotalPaise(row = {}) {
  return amountPaiseFromRow(row, ["totalPaise", "grandTotalPaise"], ["total", "grandTotal"]);
}

function invoicePaidPaise(row = {}) {
  return amountPaiseFromRow(row, ["paidPaise", "paidAmountPaise"], ["paid", "paidAmount", "total", "grandTotal"]);
}

function invoiceDuePaise(row = {}) {
  const explicitDue = amountPaiseFromRow(row, ["balancePaise", "dueAmountPaise"], ["balance", "dueAmount"]);
  if (explicitDue > 0) return explicitDue;
  return Math.max(0, invoiceTotalPaise(row) - invoicePaidPaise(row));
}

function invoiceDiscountPaise(row = {}) {
  return amountPaiseFromRow(row, ["discountPaise", "discountTotalPaise"], ["discount", "discountTotal"]);
}

function invoiceGstPaise(row = {}) {
  return amountPaiseFromRow(row, ["gstPaise", "gstAmountPaise", "taxPaise"], ["gstAmount", "taxAmount"]);
}

function paymentAmountPaise(row = {}) {
  return amountPaiseFromRow(row, ["amountPaise", "paidPaise"], ["amount", "paid"]);
}

function normalizedPaymentMode(mode = "") {
  return String(mode || "").toLowerCase().includes("cash") ? "cash" : "bank";
}

function salonOutgoingCategory(type = "", accountName = "", remarks = "") {
  return classifySalonOutgoing(type, accountName, remarks).key;
}

function isOperatingOutgoingCategory(category = "") {
  const found = SALON_OUTGOING_CATEGORIES.find((item) => item.key === category);
  return found ? Boolean(found.operating) : true;
}

function outgoingCategoryLabel(category = "") {
  return salonOutgoingCategoryLabel(category);
}

function outgoingLineBreakdown(row = {}) {
  const lineItems = parseJson(row.line_items_json, []);
  const usable = Array.isArray(lineItems) && lineItems.length
    ? lineItems
    : [{ type: row.transaction_type, accountName: row.paid_to_account_name, amount: row.amount, remarks: "" }];
  return usable
    .map((item) => {
      const category = salonOutgoingCategory(item.type || row.transaction_type, item.accountName || row.paid_to_account_name, item.remarks || "");
      const meta = classifySalonOutgoing(item.type || row.transaction_type, item.accountName || row.paid_to_account_name, item.remarks || "");
      const amountPaise = money(Number(item.amount ?? row.amount ?? 0) * 100);
      return {
        category,
        label: meta.label,
        bucket: meta.bucket,
        impact: meta.impact,
        amountPaise,
        operating: meta.operating
      };
    })
    .filter((item) => item.amountPaise > 0);
}

function purchasePayableRows({ tenantId, branchId = "", fromDate, toDate, limit = 500 } = {}) {
  const rows = [];
  if (tableExists("purchase_bill_drafts")) {
    const billDateExpr = "substr(COALESCE(NULLIF(confirmed_at, ''), NULLIF(bill_date, ''), updated_at, created_at), 1, 10)";
    rows.push(...safeAll(`
      SELECT id, branch_id AS branchId, supplier_id AS supplierId, supplier_name AS supplierName,
        bill_no AS billNo, bill_date AS billDate, total_amount AS totalAmount, gst_amount AS gstAmount,
        confirmed_at AS confirmedAt, confirmed_inventory_json AS confirmedInventoryJson, purchase_order_id AS purchaseOrderId
      FROM purchase_bill_drafts
      WHERE tenant_id=@tenantId AND (@branchId='' OR branch_id=@branchId)
        AND status='confirmed'
        AND ${billDateExpr} BETWEEN @fromDate AND @toDate
      ORDER BY ${billDateExpr} DESC, updated_at DESC
      LIMIT @limit
    `, { tenantId, branchId, fromDate, toDate, limit }).map((row) => {
      const totalPaise = money(Number(row.totalAmount || 0) * 100);
      const taxPaise = money(Number(row.gstAmount || 0) * 100);
      const movements = parseJson(row.confirmedInventoryJson, []);
      return {
        sourceType: "purchase_bill_draft",
        sourceId: row.id,
        branchId: row.branchId || "",
        supplierId: row.supplierId || "",
        supplierName: row.supplierName || row.supplierId || "",
        billNo: row.billNo || row.id,
        businessDate: String(row.confirmedAt || row.billDate || fromDate).slice(0, 10),
        totalPaise,
        taxPaise,
        inventoryPaise: Math.max(0, totalPaise - taxPaise),
        referenceIds: Array.isArray(movements) ? movements.flatMap((item) => [item.transactionId, item.batchId]).filter(Boolean) : []
      };
    }));
  }
  if (tableExists("purchase_orders")) {
    const poDateExpr = "substr(COALESCE(NULLIF(grn_date, ''), NULLIF(updated_at, ''), created_at), 1, 10)";
    rows.push(...safeAll(`
      SELECT po.id, po.branch_id AS branchId, po.supplier_id AS supplierId, po.po_number AS poNumber,
        po.supplier_invoice_no AS supplierInvoiceNo, po.grn_date AS grnDate, po.total_received_cost AS totalReceivedCost,
        COALESCE((SELECT SUM(received_gst_amount) FROM purchase_order_items poi WHERE poi.tenant_id=po.tenant_id AND poi.purchase_order_id=po.id), 0) AS receivedGstAmount
      FROM purchase_orders po
      WHERE po.tenant_id=@tenantId AND (@branchId='' OR po.branch_id=@branchId)
        AND po.status IN ('partial_receive', 'closed')
        AND ${poDateExpr} BETWEEN @fromDate AND @toDate
        AND NOT EXISTS (
          SELECT 1 FROM purchase_bill_drafts d
          WHERE d.tenant_id=po.tenant_id AND d.purchase_order_id=po.id AND d.status='confirmed'
        )
      ORDER BY ${poDateExpr} DESC, po.updated_at DESC
      LIMIT @limit
    `, { tenantId, branchId, fromDate, toDate, limit }).map((row) => {
      const totalPaise = money(Number(row.totalReceivedCost || 0) * 100);
      const taxPaise = money(Number(row.receivedGstAmount || 0) * 100);
      return {
        sourceType: "purchase_order_receipt",
        sourceId: row.id,
        branchId: row.branchId || "",
        supplierId: row.supplierId || "",
        supplierName: row.supplierId || "",
        billNo: row.supplierInvoiceNo || row.poNumber || row.id,
        businessDate: String(row.grnDate || fromDate).slice(0, 10),
        totalPaise,
        taxPaise,
        inventoryPaise: Math.max(0, totalPaise - taxPaise),
        referenceIds: [row.id].filter(Boolean)
      };
    }));
  }
  return rows.filter((row) => row.totalPaise > 0);
}

function purchaseInputGstRows(options = {}) {
  return purchasePayableRows(options).filter((row) => row.taxPaise > 0);
}

function purchaseOutboxExists(tenantId, row = {}) {
  const eventKey = `purchase.bill:${tenantId}:${row.branchId || ""}:${row.sourceType}:${row.sourceId}`;
  if (safeGet("SELECT id FROM glOutbox WHERE tenantId=@tenantId AND eventKey=@eventKey LIMIT 1", { tenantId, eventKey }).id) return true;
  const refs = [row.sourceId, ...(row.referenceIds || [])].filter(Boolean);
  for (const ref of refs) {
    if (safeGet(`
      SELECT id FROM glOutbox
      WHERE tenantId=@tenantId AND eventType='inventory.purchase' AND instr(eventKey, @needle) > 0
      LIMIT 1
    `, { tenantId, needle: String(ref) }).id) return true;
  }
  return false;
}

function prepaidAdvanceRows({ tenantId, branchId = "", fromDate, toDate, limit = 200 } = {}) {
  if (!tenantId || !tableExists("deferredSchedules")) return [];
  return safeAll(`
    SELECT id, branchId, sourceType, sourceId, customerId, totalPaise, recognizedPaise,
      (totalPaise - recognizedPaise) AS balancePaise, method, startDate, status, createdAt
    FROM deferredSchedules
    WHERE tenantId=@tenantId
      AND (@branchId='' OR branchId=@branchId)
      AND sourceType IN ('membership', 'package', 'giftcard', 'prepaid')
      AND (
        startDate BETWEEN @fromDate AND @toDate
        OR substr(createdAt, 1, 10) BETWEEN @fromDate AND @toDate
      )
    ORDER BY startDate DESC, createdAt DESC
    LIMIT @limit
  `, { tenantId, branchId, fromDate, toDate, limit }).map((row) => ({
    id: row.id,
    branchId: row.branchId || "",
    sourceType: PREPAID_INVOICE_TYPES.has(row.sourceType) || row.sourceType === "giftcard" ? row.sourceType : "prepaid",
    sourceId: row.sourceId || "",
    customerId: row.customerId || "",
    totalPaise: money(row.totalPaise),
    recognizedPaise: money(row.recognizedPaise),
    balancePaise: Math.max(0, money(row.balancePaise)),
    method: row.method || "",
    startDate: row.startDate || "",
    status: row.status || ""
  }));
}

function walletTransactionRows({ tenantId, branchId = "", fromDate, toDate, limit = 1000 } = {}) {
  const columns = tableColumns("wallet_transactions");
  if (!tenantId || !columns.size) return [];
  const tenantExpr = coalesceColumnExpression(columns, ["tenantId", "tenant_id"], "@tenantId");
  const branchExpr = coalesceColumnExpression(columns, ["branchId", "branch_id"], "''");
  const dateExpr = coalesceColumnExpression(columns, ["createdAt", "created_at"], "@fromDate");
  return safeAll(`
    SELECT
      ${selectColumnExpression(columns, ["id"], "id", "''")},
      ${selectColumnExpression(columns, ["branchId", "branch_id"], "branchId", "''")},
      ${selectColumnExpression(columns, ["clientId", "client_id", "customerId", "customer_id"], "customerId", "''")},
      ${selectColumnExpression(columns, ["invoiceId", "invoice_id"], "invoiceId", "''")},
      ${selectColumnExpression(columns, ["type"], "type", "''")},
      ${selectColumnExpression(columns, ["amount"], "amount", "0")},
      ${selectColumnExpression(columns, ["balanceAfter", "balance_after"], "balanceAfter", "0")},
      ${selectColumnExpression(columns, ["referenceType", "reference_type"], "referenceType", "''")},
      ${selectColumnExpression(columns, ["referenceId", "reference_id"], "referenceId", "''")},
      ${selectColumnExpression(columns, ["notes", "description"], "notes", "''")},
      ${selectColumnExpression(columns, ["createdAt", "created_at"], "createdAt", "@fromDate")}
    FROM wallet_transactions
    WHERE ${tenantExpr}=@tenantId
      AND (@branchId='' OR ${branchExpr}=@branchId)
      AND substr(${dateExpr}, 1, 10) BETWEEN @fromDate AND @toDate
    ORDER BY ${dateExpr} DESC
    LIMIT @limit
  `, { tenantId, branchId, fromDate, toDate, limit }).map((row) => ({
    id: row.id,
    branchId: row.branchId || branchId || "",
    customerId: row.customerId || "",
    invoiceId: row.invoiceId || row.referenceId || "",
    type: String(row.type || "").toLowerCase(),
    amountPaise: money(Number(row.amount || 0) * 100),
    balanceAfterPaise: money(Number(row.balanceAfter || 0) * 100),
    referenceType: row.referenceType || "",
    referenceId: row.referenceId || "",
    notes: row.notes || "",
    createdAt: row.createdAt || fromDate,
    sourceType: "wallet"
  }));
}

function walletBalanceRows({ tenantId, branchId = "", limit = 100 } = {}) {
  const columns = tableColumns("clients");
  if (!tenantId || !columns.has("id")) return [];
  const tenantExpr = coalesceColumnExpression(columns, ["tenantId", "tenant_id"], "@tenantId");
  const branchExpr = coalesceColumnExpression(columns, ["branchId", "branch_id"], "''");
  const walletExpr = coalesceColumnExpression(columns, ["walletBalance", "wallet_balance"], "0");
  return safeAll(`
    SELECT
      ${selectColumnExpression(columns, ["id"], "id", "''")},
      ${selectColumnExpression(columns, ["name", "fullName", "full_name"], "name", "''")},
      ${selectColumnExpression(columns, ["branchId", "branch_id"], "branchId", "''")},
      ${selectColumnExpression(columns, ["walletBalance", "wallet_balance"], "walletBalance", "0")}
    FROM clients
    WHERE ${tenantExpr}=@tenantId
      AND (@branchId='' OR ${branchExpr}=@branchId)
      AND ${walletExpr} > 0
    ORDER BY ${walletExpr} DESC
    LIMIT @limit
  `, { tenantId, branchId, limit }).map((row) => ({
    id: row.id,
    name: row.name || row.id,
    branchId: row.branchId || "",
    balancePaise: money(Number(row.walletBalance || 0) * 100)
  }));
}

function storeCreditBalanceRows({ tenantId, branchId = "", limit = 100 } = {}) {
  if (!tenantId || !tableExists("store_credits")) return [];
  return safeAll(`
    SELECT id, customer_id AS customerId, source_invoice_id AS sourceInvoiceId, source_refund_id AS sourceRefundId,
      amount, balance, expiry_date AS expiryDate, reason, status, created_at AS createdAt
    FROM store_credits
    WHERE tenant_id=@tenantId AND status='active' AND COALESCE(balance, 0) > 0
    ORDER BY created_at DESC
    LIMIT @limit
  `, { tenantId, branchId, limit }).map((row) => ({
    id: row.id,
    branchId,
    customerId: row.customerId || "",
    sourceInvoiceId: row.sourceInvoiceId || "",
    sourceRefundId: row.sourceRefundId || "",
    amountPaise: money(Number(row.amount || 0) * 100),
    balancePaise: money(Number(row.balance || 0) * 100),
    reason: row.reason || "",
    status: row.status || "",
    createdAt: row.createdAt || ""
  }));
}

function storeCreditTransactionRows({ tenantId, branchId = "", fromDate, toDate, limit = 1000 } = {}) {
  if (!tenantId || !tableExists("store_credit_transactions") || !tableExists("store_credits")) return [];
  return safeAll(`
    SELECT tx.id, tx.store_credit_id AS storeCreditId, tx.invoice_id AS invoiceId, tx.type, tx.amount,
      tx.balance_after AS balanceAfter, tx.created_at AS createdAt, sc.customer_id AS customerId,
      sc.source_invoice_id AS sourceInvoiceId, sc.source_refund_id AS sourceRefundId, sc.reason
    FROM store_credit_transactions tx
    JOIN store_credits sc ON sc.tenant_id=tx.tenant_id AND sc.id=tx.store_credit_id
    WHERE tx.tenant_id=@tenantId
      AND substr(tx.created_at, 1, 10) BETWEEN @fromDate AND @toDate
    ORDER BY tx.created_at DESC
    LIMIT @limit
  `, { tenantId, branchId, fromDate, toDate, limit }).map((row) => ({
    id: row.id,
    branchId,
    storeCreditId: row.storeCreditId || "",
    customerId: row.customerId || "",
    invoiceId: row.invoiceId || row.sourceInvoiceId || row.sourceRefundId || "",
    type: String(row.type || "").toLowerCase(),
    amountPaise: money(Number(row.amount || 0) * 100),
    balanceAfterPaise: money(Number(row.balanceAfter || 0) * 100),
    reason: row.reason || "",
    createdAt: row.createdAt || fromDate,
    sourceType: "store_credit"
  }));
}

function journalExists(tenantId, idempotencyKey) {
  if (!tenantId || !idempotencyKey) return false;
  return Boolean(safeGet("SELECT id FROM journalEntries WHERE tenantId=@tenantId AND idempotencyKey=@idempotencyKey LIMIT 1", { tenantId, idempotencyKey }).id);
}

function isWalletOutflow(row = {}) {
  const type = String(row.type || "").toLowerCase();
  return row.amountPaise < 0 || ["debit", "use", "redeem", "refund_reversal"].includes(type);
}

function isWalletPaymentMode(mode = "") {
  return String(mode || "").toLowerCase().includes("wallet");
}

function isOpenStatutoryStatus(status = "") {
  return !["paid", "remitted", "cancelled", "void"].includes(String(status || "").toLowerCase());
}

function statutoryAmountPaise(row = {}, keys = []) {
  return money(keys.reduce((sum, key) => sum + Number(row[key] || 0), 0) * 100);
}

function payrollStatutoryRows({ tenantId, branchId = "", month, limit = 1000 } = {}) {
  if (!tenantId || !month) return [];
  const rows = [];
  if (tableExists("pf_contributions")) {
    rows.push(...safeAll(`
      SELECT id, branch_id AS branchId, staff_id AS staffId, payroll_id AS payrollId, wage_month AS wageMonth, status,
        employee_pf, employer_pf, employer_eps, vpf_amount, edli_contribution, pf_admin_charges, edli_admin_charges,
        total_employee, total_employer
      FROM pf_contributions
      WHERE tenant_id=@tenantId AND (@branchId='' OR branch_id=@branchId) AND wage_month=@month
      ORDER BY created_at DESC
      LIMIT @limit
    `, { tenantId, branchId, month, limit }).map((row) => ({
      id: row.id,
      branchId: row.branchId || "",
      staffId: row.staffId || "",
      payrollId: row.payrollId || "",
      wageMonth: row.wageMonth || month,
      category: "pf",
      status: row.status || "pending",
      amountPaise: statutoryAmountPaise(row, ["total_employee", "total_employer"]) || statutoryAmountPaise(row, ["employee_pf", "employer_pf", "employer_eps", "vpf_amount", "edli_contribution", "pf_admin_charges", "edli_admin_charges"])
    })));
  }
  if (tableExists("esi_contributions")) {
    rows.push(...safeAll(`
      SELECT id, branch_id AS branchId, staff_id AS staffId, payroll_id AS payrollId, wage_month AS wageMonth, status,
        employee_esi, employer_esi, total_esi
      FROM esi_contributions
      WHERE tenant_id=@tenantId AND (@branchId='' OR branch_id=@branchId) AND wage_month=@month
      ORDER BY created_at DESC
      LIMIT @limit
    `, { tenantId, branchId, month, limit }).map((row) => ({
      id: row.id,
      branchId: row.branchId || "",
      staffId: row.staffId || "",
      payrollId: row.payrollId || "",
      wageMonth: row.wageMonth || month,
      category: "esi",
      status: row.status || "pending",
      amountPaise: statutoryAmountPaise(row, ["total_esi"]) || statutoryAmountPaise(row, ["employee_esi", "employer_esi"])
    })));
  }
  if (tableExists("pt_deductions")) {
    rows.push(...safeAll(`
      SELECT id, branch_id AS branchId, staff_id AS staffId, payroll_id AS payrollId, wage_month AS wageMonth, status, pt_amount
      FROM pt_deductions
      WHERE tenant_id=@tenantId AND (@branchId='' OR branch_id=@branchId) AND wage_month=@month
      ORDER BY created_at DESC
      LIMIT @limit
    `, { tenantId, branchId, month, limit }).map((row) => ({
      id: row.id,
      branchId: row.branchId || "",
      staffId: row.staffId || "",
      payrollId: row.payrollId || "",
      wageMonth: row.wageMonth || month,
      category: "pt",
      status: row.status || "pending",
      amountPaise: statutoryAmountPaise(row, ["pt_amount"])
    })));
  }
  if (tableExists("tds_deductions")) {
    rows.push(...safeAll(`
      SELECT id, branch_id AS branchId, staff_id AS staffId, payroll_id AS payrollId, wage_month AS wageMonth, status, tds_this_month
      FROM tds_deductions
      WHERE tenant_id=@tenantId AND (@branchId='' OR branch_id=@branchId) AND wage_month=@month
      ORDER BY created_at DESC
      LIMIT @limit
    `, { tenantId, branchId, month, limit }).map((row) => ({
      id: row.id,
      branchId: row.branchId || "",
      staffId: row.staffId || "",
      payrollId: row.payrollId || "",
      wageMonth: row.wageMonth || month,
      category: "tds",
      status: row.status || "pending",
      amountPaise: statutoryAmountPaise(row, ["tds_this_month"])
    })));
  }
  if (!rows.length && tableExists("payroll_statutory_calculations")) {
    rows.push(...safeAll(`
      SELECT id, branch_id AS branchId, staff_id AS staffId, payroll_run_id AS payrollId, period_start AS periodStart,
        period_end AS periodEnd, status, pf_employee, pf_employer, esic_employee, esic_employer, professional_tax, tds_amount
      FROM payroll_statutory_calculations
      WHERE tenant_id=@tenantId AND (@branchId='' OR branch_id=@branchId) AND substr(period_end, 1, 7)=@month
      ORDER BY period_end DESC
      LIMIT @limit
    `, { tenantId, branchId, month, limit }).flatMap((row) => ([
      { id: `${row.id}:pf`, branchId: row.branchId || "", staffId: row.staffId || "", payrollId: row.payrollId || "", wageMonth: month, category: "pf", status: row.status || "pending", amountPaise: statutoryAmountPaise(row, ["pf_employee", "pf_employer"]) },
      { id: `${row.id}:esi`, branchId: row.branchId || "", staffId: row.staffId || "", payrollId: row.payrollId || "", wageMonth: month, category: "esi", status: row.status || "pending", amountPaise: statutoryAmountPaise(row, ["esic_employee", "esic_employer"]) },
      { id: `${row.id}:pt`, branchId: row.branchId || "", staffId: row.staffId || "", payrollId: row.payrollId || "", wageMonth: month, category: "pt", status: row.status || "pending", amountPaise: statutoryAmountPaise(row, ["professional_tax"]) },
      { id: `${row.id}:tds`, branchId: row.branchId || "", staffId: row.staffId || "", payrollId: row.payrollId || "", wageMonth: month, category: "tds", status: row.status || "pending", amountPaise: statutoryAmountPaise(row, ["tds_amount"]) }
    ])));
  }
  return rows.filter((row) => row.amountPaise > 0);
}

function fixedAssetAmountPaise(row = {}) {
  return money(row.costPaise || row.purchaseCostPaise || 0);
}

function fixedAssetRows({ tenantId, branchId = "", fromDate = "", toDate = "", limit = 1000 } = {}) {
  const columns = tableColumns("fixedAssets");
  if (!tenantId || !columns.size) return [];
  const tenantExpr = coalesceColumnExpression(columns, ["tenantId", "tenant_id"], "@tenantId");
  const branchExpr = coalesceColumnExpression(columns, ["branchId", "branch_id"], "''");
  const dateExpr = coalesceColumnExpression(columns, ["acquisitionDate", "purchaseDate", "createdAt", "created_at"], "@fromDate");
  return safeAll(`
    SELECT
      ${selectColumnExpression(columns, ["id"], "id", "''")},
      ${selectColumnExpression(columns, ["branchId", "branch_id"], "branchId", "''")},
      ${selectColumnExpression(columns, ["code"], "code", "''")},
      ${selectColumnExpression(columns, ["name", "assetName"], "name", "''")},
      ${selectColumnExpression(columns, ["category"], "category", "'equipment'")},
      ${selectColumnExpression(columns, ["acquisitionDate", "purchaseDate"], "acquisitionDate", "@fromDate")},
      ${selectColumnExpression(columns, ["costPaise", "purchaseCostPaise"], "costPaise", "0")},
      ${selectColumnExpression(columns, ["accumulatedDepreciationPaise"], "accumulatedDepreciationPaise", "0")},
      ${selectColumnExpression(columns, ["status"], "status", "'active'")}
    FROM fixedAssets
    WHERE ${tenantExpr}=@tenantId
      AND (@branchId='' OR ${branchExpr}=@branchId)
      AND (@fromDate='' OR substr(${dateExpr}, 1, 10) BETWEEN @fromDate AND @toDate)
    ORDER BY ${dateExpr} DESC
    LIMIT @limit
  `, { tenantId, branchId, fromDate, toDate: toDate || fromDate, limit }).map((row) => {
    const costPaise = fixedAssetAmountPaise(row);
    const accumulatedPaise = money(row.accumulatedDepreciationPaise);
    return {
      id: row.id,
      branchId: row.branchId || "",
      code: row.code || row.id,
      name: row.name || row.code || row.id,
      category: row.category || "equipment",
      acquisitionDate: String(row.acquisitionDate || "").slice(0, 10),
      costPaise,
      accumulatedPaise,
      netPaise: Math.max(0, costPaise - accumulatedPaise),
      status: row.status || "active"
    };
  }).filter((row) => row.costPaise > 0);
}

function depreciationEntryRows({ tenantId, branchId = "", period, limit = 1000 } = {}) {
  if (!tenantId || !period || !tableExists("depreciationEntries") || !tableExists("fixedAssets")) return [];
  return safeAll(`
    SELECT d.id, d.assetId, d.period, d.amountPaise, d.journalEntryId,
      a.branchId, a.code, a.name, a.assetName
    FROM depreciationEntries d
    JOIN fixedAssets a ON a.tenantId=d.tenantId AND a.id=d.assetId
    WHERE d.tenantId=@tenantId
      AND (@branchId='' OR a.branchId=@branchId)
      AND d.period=@period
    ORDER BY a.code ASC
    LIMIT @limit
  `, { tenantId, branchId, period, limit }).map((row) => ({
    id: row.id,
    assetId: row.assetId,
    branchId: row.branchId || "",
    code: row.code || row.assetId,
    name: row.name || row.assetName || row.code || row.assetId,
    period: row.period,
    amountPaise: money(row.amountPaise),
    journalEntryId: row.journalEntryId || ""
  })).filter((row) => row.amountPaise > 0);
}

function posInvoiceRows({ tenantId, branchId = "", fromDate, toDate, limit = 5000 } = {}) {
  const columns = tableColumns("invoices");
  if (!tenantId || !columns.has("id")) return [];
  const tenantExpr = coalesceColumnExpression(columns, ["tenantId", "tenant_id"], "@tenantId");
  const branchExpr = coalesceColumnExpression(columns, ["branchId", "branch_id"], "''");
  const dateExpr = coalesceColumnExpression(columns, ["createdAt", "created_at", "businessDate", "invoiceDate", "invoice_date", "paidAt", "paid_at"], "@fromDate");
  return safeAll(`
    SELECT
      ${selectColumnExpression(columns, ["id"], "id", "''")},
      ${selectColumnExpression(columns, ["invoiceNumber", "invoice_no", "invoiceNo", "number"], "invoiceNumber", "''")},
      ${selectColumnExpression(columns, ["tenantId", "tenant_id"], "tenantId", "''")},
      ${selectColumnExpression(columns, ["branchId", "branch_id"], "branchId", "''")},
      ${selectColumnExpression(columns, ["clientId", "client_id"], "clientId", "''")},
      ${selectColumnExpression(columns, ["staffId", "staff_id"], "staffId", "''")},
      ${selectColumnExpression(columns, ["lineItems", "line_items"], "lineItems", "NULL")},
      ${selectColumnExpression(columns, ["total", "grandTotal", "grand_total"], "total", "NULL")},
      ${selectColumnExpression(columns, ["totalPaise", "grandTotalPaise", "grand_total_paise"], "totalPaise", "NULL")},
      ${selectColumnExpression(columns, ["paid", "paidAmount", "paid_amount"], "paid", "NULL")},
      ${selectColumnExpression(columns, ["paidPaise", "paidAmountPaise", "paid_amount_paise"], "paidPaise", "NULL")},
      ${selectColumnExpression(columns, ["balance", "dueAmount", "due_amount"], "balance", "NULL")},
      ${selectColumnExpression(columns, ["discount", "discountTotal", "discount_total"], "discount", "NULL")},
      ${selectColumnExpression(columns, ["discountPaise", "discountTotalPaise", "discount_total_paise"], "discountPaise", "NULL")},
      ${selectColumnExpression(columns, ["gstAmount", "gst_amount", "taxAmount", "tax_total"], "gstAmount", "NULL")},
      ${selectColumnExpression(columns, ["gstPaise", "gstAmountPaise", "taxPaise"], "gstPaise", "NULL")},
      ${selectColumnExpression(columns, ["status"], "status", "''")},
      ${selectColumnExpression(columns, ["createdAt", "created_at", "businessDate", "invoiceDate", "invoice_date", "paidAt", "paid_at"], "createdAt", "@fromDate")}
    FROM invoices
    WHERE ${tenantExpr} = @tenantId
      AND (@branchId = '' OR ${branchExpr} = @branchId)
      AND substr(${dateExpr}, 1, 10) BETWEEN @fromDate AND @toDate
    ORDER BY ${dateExpr} DESC
    LIMIT @limit
  `, { tenantId, branchId, fromDate, toDate, limit });
}

function posPaymentRows({ tenantId, branchId = "", fromDate, toDate, limit = 5000 } = {}) {
  const columns = tableColumns("payments");
  if (!tenantId || (!columns.has("invoiceId") && !columns.has("invoice_id"))) return [];
  const tenantExpr = coalesceColumnExpression(columns, ["tenantId", "tenant_id"], "@tenantId");
  const branchExpr = coalesceColumnExpression(columns, ["branchId", "branch_id"], "''");
  const dateExpr = coalesceColumnExpression(columns, ["createdAt", "created_at", "businessDate", "paymentDate", "payment_date", "paidAt", "paid_at"], "@fromDate");
  return safeAll(`
    SELECT
      ${selectColumnExpression(columns, ["id"], "id", "''")},
      ${selectColumnExpression(columns, ["invoiceId", "invoice_id"], "invoiceId", "''")},
      ${selectColumnExpression(columns, ["tenantId", "tenant_id"], "tenantId", "''")},
      ${selectColumnExpression(columns, ["branchId", "branch_id"], "branchId", "''")},
      ${selectColumnExpression(columns, ["mode", "paymentMode", "payment_mode"], "mode", "''")},
      ${selectColumnExpression(columns, ["amount", "paid"], "amount", "NULL")},
      ${selectColumnExpression(columns, ["amountPaise", "paidPaise"], "amountPaise", "NULL")},
      ${selectColumnExpression(columns, ["reference", "referenceNo", "reference_no"], "reference", "''")},
      ${selectColumnExpression(columns, ["remarks", "note", "notes"], "remarks", "''")},
      ${selectColumnExpression(columns, ["createdAt", "created_at", "businessDate", "paymentDate", "payment_date", "paidAt", "paid_at"], "createdAt", "@fromDate")}
    FROM payments
    WHERE ${tenantExpr} = @tenantId
      AND (@branchId = '' OR ${branchExpr} = @branchId)
      AND substr(${dateExpr}, 1, 10) BETWEEN @fromDate AND @toDate
    ORDER BY ${dateExpr} DESC
    LIMIT @limit
  `, { tenantId, branchId, fromDate, toDate, limit });
}

function staffCommissionRows({ tenantId, branchId = "", businessDate } = {}) {
  const columns = tableColumns("staff_commissions");
  if (!tenantId || !columns.size) return [];
  const tenantExpr = coalesceColumnExpression(columns, ["tenantId", "tenant_id"], "@tenantId");
  const branchExpr = coalesceColumnExpression(columns, ["branchId", "branch_id"], "''");
  const periodStartExpr = coalesceColumnExpression(columns, ["periodStart", "period_start"], "@businessDate");
  const periodEndExpr = coalesceColumnExpression(columns, ["periodEnd", "period_end"], "@businessDate");
  return safeAll(`
    SELECT
      ${selectColumnExpression(columns, ["staffId", "staff_id"], "staffId", "''")},
      ${selectColumnExpression(columns, ["commissionAmount", "commission_amount"], "commissionAmount", "0")},
      ${selectColumnExpression(columns, ["status"], "status", "''")},
      ${selectColumnExpression(columns, ["periodStart", "period_start"], "periodStart", "@businessDate")},
      ${selectColumnExpression(columns, ["periodEnd", "period_end"], "periodEnd", "@businessDate")}
    FROM staff_commissions
    WHERE ${tenantExpr} = @tenantId
      AND (@branchId = '' OR ${branchExpr} = @branchId)
      AND @businessDate BETWEEN ${periodStartExpr} AND ${periodEndExpr}
  `, { tenantId, branchId, businessDate });
}

function staffPayrollRows({ tenantId, branchId = "", businessDate } = {}) {
  const columns = tableColumns("staff_payroll_components");
  if (!tenantId || !columns.size) return [];
  const tenantExpr = coalesceColumnExpression(columns, ["tenantId", "tenant_id"], "@tenantId");
  const branchExpr = coalesceColumnExpression(columns, ["branchId", "branch_id"], "''");
  const periodStartExpr = coalesceColumnExpression(columns, ["periodStart", "period_start"], "''");
  const periodEndExpr = coalesceColumnExpression(columns, ["periodEnd", "period_end"], "''");
  return safeAll(`
    SELECT
      ${selectColumnExpression(columns, ["staffId", "staff_id"], "staffId", "''")},
      ${selectColumnExpression(columns, ["basic", "basicSalary", "basic_salary"], "basic", "0")},
      ${selectColumnExpression(columns, ["grossPay", "gross_pay"], "grossPay", "0")},
      ${selectColumnExpression(columns, ["netPay", "net_pay"], "netPay", "0")},
      ${selectColumnExpression(columns, ["periodStart", "period_start"], "periodStart", "''")},
      ${selectColumnExpression(columns, ["periodEnd", "period_end"], "periodEnd", "''")}
    FROM staff_payroll_components
    WHERE ${tenantExpr} = @tenantId
      AND (@branchId = '' OR ${branchExpr} = @branchId)
      AND (
        (${periodStartExpr} <= @businessDate AND ${periodEndExpr} >= @businessDate)
        OR ${periodStartExpr} = ''
        OR ${periodEndExpr} = ''
      )
    ORDER BY ${periodEndExpr} DESC
    LIMIT 10000
  `, { tenantId, branchId, businessDate });
}

function staffCommissionRuleRows({ tenantId, branchId = "" } = {}) {
  if (!tenantId || !tableExists("staff_commission_rules")) return [];
  return safeAll(`
    SELECT staffId, servicePercent, productPercent, membershipPercent, packagePercent, flatAmount, targetBonus, slabs, rules, status, updatedAt, createdAt
    FROM staff_commission_rules
    WHERE tenantId=@tenantId
      AND (@branchId='' OR branchId=@branchId)
      AND status='active'
    ORDER BY updatedAt DESC, createdAt DESC
  `, { tenantId, branchId });
}

function productConsumeDraftRows({ tenantId, branchId = "", businessDate, invoiceIds = [] } = {}) {
  if (!tenantId || !tableExists("product_consume_drafts")) return [];
  const invoiceSet = new Set(invoiceIds.map((value) => String(value || "")).filter(Boolean));
  return safeAll(`
    SELECT invoice_id, service_id, service_name, status, expected_cost, actual_cost, line_items_json, created_at
    FROM product_consume_drafts
    WHERE tenant_id=@tenantId
      AND (@branchId='' OR branch_id=@branchId)
    ORDER BY created_at DESC
    LIMIT 1000
  `, { tenantId, branchId }).filter((row) => {
    const invoiceId = String(row.invoice_id || "");
    return invoiceSet.has(invoiceId) || String(row.created_at || "").slice(0, 10) === businessDate;
  });
}

function mergeProductRows(rows = []) {
  const bySku = new Map();
  for (const row of rows) {
    const sku = String(row.sku || row.productName || row.productId || "Product");
    const current = bySku.get(sku) || { sku, qty: 0, costPaise: 0 };
    current.qty += Number(row.qty || 0);
    current.costPaise += money(row.costPaise || 0);
    bySku.set(sku, current);
  }
  return [...bySku.values()].sort((a, b) => b.costPaise - a.costPaise).slice(0, 10);
}

function productRowsFromDrafts(drafts = []) {
  const rows = [];
  for (const draft of drafts) {
    const lines = parseJson(draft.line_items_json, []);
    for (const line of Array.isArray(lines) ? lines : []) {
      const qty = Number(line.actualQty ?? line.actual_qty ?? line.expectedQty ?? line.expected_qty ?? line.quantity ?? 0);
      const cost = Number(line.actualCost ?? line.actual_cost ?? line.expectedCost ?? line.expected_cost ?? 0);
      rows.push({
        sku: line.productName || line.product_name || line.productId || line.product_id || draft.service_name || "Product",
        qty,
        costPaise: money(cost * 100)
      });
    }
    if (!lines.length) {
      const cost = Number(draft.actual_cost || draft.expected_cost || 0);
      rows.push({ sku: draft.service_name || draft.service_id || "Product consume", qty: 1, costPaise: money(cost * 100) });
    }
  }
  return rows;
}

function staffEmployeeDetailsByStaff({ tenantId, branchId = "" } = {}) {
  if (!tenantId || !tableExists("staff_employee_details")) return new Map();
  const rows = safeAll(`
    SELECT staff_id, attendance_salary_json
    FROM staff_employee_details
    WHERE tenant_id=@tenantId
      AND (@branchId='' OR branch_id=@branchId)
  `, { tenantId, branchId });
  return new Map(rows.map((row) => [String(row.staff_id || ""), row]));
}

function staffProfileSalaryPaise(person = {}, detailsRow = {}) {
  const details = parseJson(person.employeeDetails || person.employee_details || "{}", {});
  const salary = parseJson(
    person.attendanceSalary
      || person.attendance_salary_json
      || detailsRow.attendance_salary_json
      || details.attendanceSalary
      || details.attendance_salary
      || "{}",
    {}
  );
  return money(Number(salary.basicSalary || salary.basic_salary || salary.grossPay || salary.gross_pay || 0) * 100);
}

function lineType(item = {}) {
  return String(item.type || item.itemType || item.item_type || "service").toLowerCase();
}

function commissionPercentForType(type, rule = {}) {
  if (type === "product") return Number(rule.productPercent ?? rule.retailPercent ?? 5);
  if (type === "membership") return Number(rule.membershipPercent ?? 3);
  if (type === "package") return Number(rule.packagePercent ?? 3);
  return Number(rule.servicePercent ?? rule.value ?? 10);
}

function ruleForStaff(person = {}, persistedRule = {}) {
  return {
    ...parseJson(person.commissionRule || person.commission_rule || "{}", {}),
    ...persistedRule,
    ...parseJson(persistedRule.rules || "{}", {})
  };
}

function scope(access = {}, branchId = "") {
  if (!access.tenantId) throw badRequest("Tenant context is required");
  tenantService.ensureSubscriptionActive(access.tenantId);
  const requestedBranch = branchId || access.requestedBranchId || "";
  if (requestedBranch) tenantService.assertBranchAccess(access, requestedBranch);
  return { tenantId: access.tenantId, branchId: requestedBranch };
}

function rowAccount(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    accountType: row.accountType,
    accountSubType: row.accountSubType,
    normalBalance: row.normalBalance,
    active: Boolean(row.active),
    systemAccount: Boolean(row.systemAccount)
  };
}

function accountIdByCode(tenantId, branchId, code) {
  seedChartOfAccounts(tenantId, branchId);
  const row = db.prepare("SELECT id FROM chartOfAccounts WHERE tenantId = ? AND branchId = ? AND code = ?").get(tenantId, branchId, code);
  if (!row) throw badRequest(`Chart of accounts missing code ${code}`);
  return row.id;
}

function signedBalance(row) {
  const debit = Number(row.debitPaise || 0);
  const credit = Number(row.creditPaise || 0);
  return row.normalBalance === "credit" ? credit - debit : debit - credit;
}

// Contribution to the account's STATEMENT SECTION, by accountType's natural
// side. Ensures contra accounts (e.g. accumulated depreciation: an asset that
// carries a credit balance) correctly REDUCE their section instead of inflating
// it. Used for balance-sheet section totals and working-capital aggregation.
function sectionBalance(row) {
  const debit = Number(row.debitPaise || 0);
  const credit = Number(row.creditPaise || 0);
  const debitNatured = row.accountType === "asset" || row.accountType === "expense";
  return debitNatured ? debit - credit : credit - debit;
}

function sectionTotal(rows) {
  return rows.reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
}

function invoiceLineType(line = {}) {
  return String(line.type || line.itemType || line.item_type || "").toLowerCase();
}

function invoiceLineAmountPaise(line = {}) {
  const direct = line.totalAmount ?? line.total_amount ?? line.total ?? line.amount;
  if (direct !== undefined && direct !== null && direct !== "") return money(Number(direct) * 100);
  const price = Number(line.price ?? line.unitPrice ?? line.unit_price ?? 0);
  const qty = Number(line.quantity ?? line.qty ?? 1) || 1;
  return money(price * qty * 100);
}

function invoiceDeferredPaise(tenantId, invoiceId) {
  if (!tenantId || !invoiceId) return 0;
  const enterpriseLines = safeAll(
    "SELECT * FROM invoice_items WHERE tenant_id = @tenantId AND invoice_id = @invoiceId",
    { tenantId, invoiceId }
  );
  const invoice = safeGet("SELECT * FROM invoices WHERE id=@invoiceId", { invoiceId });
  const invoiceTenantId = invoice.tenant_id || invoice.tenantId || "";
  if (invoiceTenantId && invoiceTenantId !== tenantId) return 0;
  const legacyLines = parseJson(invoice.lineItems || invoice.line_items, []);
  const lines = enterpriseLines.length ? enterpriseLines : (Array.isArray(legacyLines) ? legacyLines : []);
  return lines
    .filter((line) => PREPAID_INVOICE_TYPES.has(invoiceLineType(line)))
    .reduce((sum, line) => sum + invoiceLineAmountPaise(line), 0);
}

function invoicePaymentOutboxExists(tenantId, invoiceId) {
  if (!tenantId || !invoiceId) return false;
  return Boolean(db.prepare(`
    SELECT id FROM glOutbox
    WHERE tenantId=@tenantId AND eventType='invoice.paid'
      AND instr(payloadJson, @needle) > 0
    LIMIT 1
  `).get({ tenantId, needle: `"invoiceId":"${invoiceId}"` }));
}

function invoiceReceivableOutboxExists(tenantId, invoiceId) {
  if (!tenantId || !invoiceId) return false;
  return Boolean(db.prepare(`
    SELECT id FROM glOutbox
    WHERE tenantId=@tenantId AND eventType='invoice.receivable'
      AND instr(payloadJson, @needle) > 0
    LIMIT 1
  `).get({ tenantId, needle: `"invoiceId":"${invoiceId}"` }));
}

export const balanceSheetService = {
  accounts(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    seedChartOfAccounts(tenantId, branchId);
    return db.prepare(`
      SELECT * FROM chartOfAccounts
      WHERE tenantId = @tenantId AND branchId = @branchId
      ORDER BY code ASC
    `).all({ tenantId, branchId }).map(rowAccount);
  },

  createJournal(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    // Stage 17: normalise to IST business day (rejects accidental future-dating).
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.entryDate);
    // Stage 20: locked accounting periods reject new postings.
    this.assertPeriodOpen(tenantId, branchId, businessDate);
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    if (lines.length < 2) throw badRequest("At least two journal lines are required");
    const accounts = new Map(this.accounts({ branchId }, access).map((account) => [account.id, account]));
    let debitTotal = 0;
    let creditTotal = 0;
    for (const line of lines) {
      if (!accounts.has(line.accountId)) throw badRequest(`Unknown account: ${line.accountId}`);
      const debit = money(line.debitPaise);
      const credit = money(line.creditPaise);
      if (debit < 0 || credit < 0 || (debit && credit)) throw badRequest("Each line must have either debit or credit");
      debitTotal += debit;
      creditTotal += credit;
    }
    if (debitTotal <= 0 || debitTotal !== creditTotal) {
      throw badRequest("Journal entry must balance: total debit must equal total credit");
    }

    const entryId = id("je");
    const stamp = new Date().toISOString();
    const idempotencyKey = payload.idempotencyKey || `${tenantId}:${branchId}:${payload.sourceType || "manual"}:${payload.sourceId || entryId}`;
    const existing = db.prepare("SELECT * FROM journalEntries WHERE tenantId = ? AND idempotencyKey = ?").get(tenantId, idempotencyKey);
    if (existing) return this.journal(existing.id, access);

    const insertEntry = db.prepare(`
      INSERT INTO journalEntries (
        id, tenantId, branchId, entryDate, businessDate, sourceType, sourceId, memo,
        status, locked, reversalOf, idempotencyKey, createdBy, createdAt, updatedAt
      ) VALUES (
        @id, @tenantId, @branchId, @entryDate, @businessDate, @sourceType, @sourceId, @memo,
        'posted', 1, @reversalOf, @idempotencyKey, @createdBy, @createdAt, @updatedAt
      )
    `);
    const insertLine = db.prepare(`
      INSERT INTO journalEntryLines
        (id, tenantId, branchId, journalEntryId, accountId, debitPaise, creditPaise, lineMemo, createdAt)
      VALUES
        (@id, @tenantId, @branchId, @journalEntryId, @accountId, @debitPaise, @creditPaise, @lineMemo, @createdAt)
    `);
    db.transaction(() => {
      insertEntry.run({
        id: entryId,
        tenantId,
        branchId,
        entryDate: businessDate,
        businessDate,
        sourceType: payload.sourceType || "manual",
        sourceId: payload.sourceId || "",
        memo: payload.memo || "",
        reversalOf: payload.reversalOf || "",
        idempotencyKey,
        createdBy: access.userId || "system",
        createdAt: stamp,
        updatedAt: stamp
      });
      for (const line of lines) {
        insertLine.run({
          id: id("jel"),
          tenantId,
          branchId,
          journalEntryId: entryId,
          accountId: line.accountId,
          debitPaise: money(line.debitPaise),
          creditPaise: money(line.creditPaise),
          lineMemo: line.memo || "",
          createdAt: stamp
        });
      }
    })();
    return this.journal(entryId, access);
  },

  // Stage 20: immutable journals — the only correction path is a balanced
  // reversal entry. Original is flagged 'reversed' but never edited or deleted.
  reverseJournal(entryId, payload = {}, access = {}) {
    const { tenantId } = scope(access);
    const entry = db.prepare("SELECT * FROM journalEntries WHERE tenantId = ? AND id = ?").get(tenantId, entryId);
    if (!entry) throw notFound("Journal entry not found");
    if (entry.branchId) tenantService.assertBranchAccess(access, entry.branchId);
    if (entry.status === "reversed") throw badRequest("Journal entry is already reversed");
    if (entry.sourceType === "reversal") throw badRequest("A reversal entry cannot itself be reversed");

    const reversalDate = normalizeBusinessDate(payload.businessDate || today());
    this.assertPeriodOpen(tenantId, entry.branchId, reversalDate);

    const original = this.journal(entryId, access);
    const lines = original.lines.map((line) => ({
      accountId: line.accountId,
      debitPaise: line.creditPaise,
      creditPaise: line.debitPaise,
      memo: `Reversal of ${entryId}`
    }));
    const reversal = this.createJournal({
      branchId: entry.branchId,
      businessDate: reversalDate,
      sourceType: "reversal",
      sourceId: entryId,
      reversalOf: entryId,
      memo: payload.reason || `Reversal of ${entryId}`,
      idempotencyKey: `reversal:${tenantId}:${entryId}`,
      lines
    }, access);

    db.prepare("UPDATE journalEntries SET status = 'reversed', updatedAt = ? WHERE tenantId = ? AND id = ?")
      .run(new Date().toISOString(), tenantId, entryId);

    return { original: entryId, reversal };
  },

  journal(entryId, access = {}) {
    const { tenantId } = scope(access);
    const entry = db.prepare("SELECT * FROM journalEntries WHERE tenantId = ? AND id = ?").get(tenantId, entryId);
    if (!entry) throw notFound("Journal entry not found");
    if (entry.branchId) tenantService.assertBranchAccess(access, entry.branchId);
    const lines = db.prepare(`
      SELECT l.*, a.code, a.name, a.accountType
      FROM journalEntryLines l
      JOIN chartOfAccounts a ON a.id = l.accountId AND a.tenantId = l.tenantId
      WHERE l.tenantId = ? AND l.journalEntryId = ?
      ORDER BY l.createdAt ASC
    `).all(tenantId, entryId);
    return {
      id: entry.id,
      branchId: entry.branchId,
      businessDate: entry.businessDate,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      memo: entry.memo,
      status: entry.status,
      locked: Boolean(entry.locked),
      reversalOf: entry.reversalOf,
      lines: lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        accountCode: line.code,
        accountName: line.name,
        accountType: line.accountType,
        debit: rupees(line.debitPaise),
        credit: rupees(line.creditPaise),
        debitPaise: line.debitPaise,
        creditPaise: line.creditPaise,
        memo: line.lineMemo
      }))
    };
  },

  trialBalance(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const rows = this.accountBalances(tenantId, branchId, asOfDate);
    const debitTotal = rows.reduce((sum, row) => sum + Math.max(0, Number(row.debitPaise || 0) - Number(row.creditPaise || 0)), 0);
    const creditTotal = rows.reduce((sum, row) => sum + Math.max(0, Number(row.creditPaise || 0) - Number(row.debitPaise || 0)), 0);
    return {
      asOfDate,
      balanced: debitTotal === creditTotal,
      debitTotal: rupees(debitTotal),
      creditTotal: rupees(creditTotal),
      difference: rupees(debitTotal - creditTotal),
      rows: rows.map((row) => ({
        accountId: row.id,
        code: row.code,
        name: row.name,
        accountType: row.accountType,
        debit: rupees(Math.max(0, Number(row.debitPaise || 0) - Number(row.creditPaise || 0))),
        credit: rupees(Math.max(0, Number(row.creditPaise || 0) - Number(row.debitPaise || 0))),
        balance: rupees(signedBalance(row))
      }))
    };
  },

  live(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const balances = this.accountBalances(tenantId, branchId, asOfDate)
      .map((row) => ({ ...row, balancePaise: sectionBalance(row) }));
    const assets = balances.filter((row) => row.accountType === "asset").map(this.statementRow);
    const liabilities = balances.filter((row) => row.accountType === "liability").map(this.statementRow);
    const equity = balances.filter((row) => row.accountType === "equity").map(this.statementRow);
    const income = balances.filter((row) => row.accountType === "income").reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const expenses = balances.filter((row) => row.accountType === "expense").reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const retainedEarningsPaise = income - expenses;
    if (retainedEarningsPaise) {
      equity.push({ code: "3999", name: "Current Profit / Loss", accountSubType: "current_profit", balance: rupees(retainedEarningsPaise), balancePaise: retainedEarningsPaise });
    }
    const totalAssetsPaise = sectionTotal(assets);
    const totalLiabilitiesPaise = sectionTotal(liabilities);
    const totalEquityPaise = sectionTotal(equity);
    const accountingEquationDifferencePaise = totalAssetsPaise - totalLiabilitiesPaise - totalEquityPaise;
    const readiness = this.readinessSnapshot(tenantId, branchId);
    return {
      asOfDate,
      branchId,
      productionReady: readiness.productionReady,
      productionReadinessReason: readiness.reason,
      totals: {
        assets: rupees(totalAssetsPaise),
        liabilities: rupees(totalLiabilitiesPaise),
        equity: rupees(totalEquityPaise),
        accountingEquationDifference: rupees(accountingEquationDifferencePaise)
      },
      totalsPaise: {
        assets: totalAssetsPaise,
        liabilities: totalLiabilitiesPaise,
        equity: totalEquityPaise,
        accountingEquationDifference: accountingEquationDifferencePaise
      },
      balanced: accountingEquationDifferencePaise === 0,
      sections: { assets, liabilities, equity },
      workingCapital: this.workingCapital({ branchId, asOfDate }, access),
      alerts: this.balanceAlerts(totalAssetsPaise, totalLiabilitiesPaise, totalEquityPaise, accountingEquationDifferencePaise)
    };
  },

  financeControls(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const sheet = this.live({ branchId, asOfDate }, access);
    const trial = this.trialBalance({ branchId, asOfDate }, access);
    const balances = this.accountBalances(tenantId, branchId, asOfDate);
    const inventoryBookPaise = safeGet(
      "SELECT COALESCE(SUM(totalValuePaise), 0) AS value FROM inventoryItems WHERE tenantId=@tenantId AND branchId=@branchId",
      { tenantId, branchId }
    ).value || 0;
    const inventoryGlPaise = sectionBalance(balances.find((row) => row.code === "1200") || {});
    const latestReconciliation = safeGet(
      "SELECT * FROM reconciliationRuns WHERE tenantId=@tenantId AND branchId=@branchId ORDER BY asOfDate DESC, createdAt DESC LIMIT 1",
      { tenantId, branchId }
    );
    const openCriticalAlerts = Number(safeGet(
      "SELECT COUNT(*) AS count FROM balanceSheetAlerts WHERE tenantId=@tenantId AND branchId=@branchId AND status='open' AND severity='critical'",
      { tenantId, branchId }
    ).count || 0);
    const varianceDetection = [
      {
        key: "accounting_equation",
        label: "Accounting equation",
        amount: sheet.totals.accountingEquationDifference,
        amountPaise: sheet.totalsPaise.accountingEquationDifference,
        severity: sheet.balanced ? "ok" : "critical"
      },
      {
        key: "trial_balance",
        label: "Trial balance debit/credit",
        amount: trial.difference,
        amountPaise: money(Number(trial.difference || 0) * 100),
        severity: trial.balanced ? "ok" : "critical"
      },
      {
        key: "inventory_wma_gl",
        label: "WMA inventory vs GL",
        amount: rupees(money(inventoryBookPaise) - money(inventoryGlPaise)),
        amountPaise: money(inventoryBookPaise) - money(inventoryGlPaise),
        severity: Math.abs(money(inventoryBookPaise) - money(inventoryGlPaise)) <= 100 ? "ok" : "warn"
      }
    ];
    const criticalVariance = varianceDetection.some((item) => item.severity === "critical");
    const auditTrail = db.prepare(`
      SELECT id, businessDate, sourceType, sourceId, memo, status, createdBy, createdAt
      FROM journalEntries
      WHERE tenantId=@tenantId AND branchId=@branchId
      ORDER BY businessDate DESC, createdAt DESC
      LIMIT 12
    `).all({ tenantId, branchId });
    const exportAllowed = Boolean(sheet.productionReady) && !criticalVariance && openCriticalAlerts === 0;
    return {
      asOfDate,
      branchId,
      sourceOfTruth: "journalEntryLines",
      productionReady: sheet.productionReady,
      latestReconciliation: latestReconciliation.id ? {
        id: latestReconciliation.id,
        asOfDate: latestReconciliation.asOfDate,
        status: latestReconciliation.status,
        createdAt: latestReconciliation.createdAt
      } : null,
      varianceDetection,
      auditTrail,
      exportControl: {
        allowed: exportAllowed,
        reason: exportAllowed
          ? "Export allowed: reconciliation is clean and no critical variance is open."
          : "Export review required: run reconciliation and clear critical accounting variance before relying on exported figures.",
        format: "csv",
        requiresFinanceRead: true,
        watermark: exportAllowed ? "production-ready" : "review-required"
      }
    };
  },

  // Lightweight, dependency-free production readiness derived from stage 21
  // reconciliation history + open critical alerts (no circular service import).
  readinessSnapshot(tenantId, branchId) {
    ensureHardeningSchema();
    let latest = null;
    let criticalAlerts = 0;
    try {
      latest = db.prepare(
        "SELECT status FROM reconciliationRuns WHERE tenantId = ? AND branchId = ? ORDER BY asOfDate DESC, createdAt DESC LIMIT 1"
      ).get(tenantId, branchId);
      criticalAlerts = db.prepare(
        "SELECT COUNT(*) AS n FROM balanceSheetAlerts WHERE tenantId = ? AND branchId = ? AND status = 'open' AND severity = 'critical'"
      ).get(tenantId, branchId).n;
    } catch {
      latest = null;
      criticalAlerts = 0;
    }
    const productionReady = Boolean(latest) && latest.status === "ok" && criticalAlerts === 0;
    return {
      productionReady,
      reason: !latest
        ? "Run the stage 21 reconciliation watchdog to certify production readiness."
        : latest.status !== "ok"
          ? "Reconciliation found open issues; resolve them before production reliance."
          : criticalAlerts > 0
            ? "Open critical accounting alerts must be cleared."
            : "Stage 16-21 controls active and reconciliation clean."
    };
  },

  workingCapital(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const rows = this.accountBalances(tenantId, branchId, asOfDate).map((row) => ({ ...row, balancePaise: sectionBalance(row) }));
    const currentAssets = rows.filter((row) => row.accountType === "asset" && ["cash", "bank", "receivables", "inventory"].includes(row.accountSubType));
    const currentLiabilities = rows.filter((row) => row.accountType === "liability" && ["payables", "tax", "loan"].includes(row.accountSubType));
    const inventory = currentAssets.filter((row) => row.accountSubType === "inventory").reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const cash = currentAssets.filter((row) => ["cash", "bank"].includes(row.accountSubType)).reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const ca = currentAssets.reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const cl = currentLiabilities.reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    return {
      asOfDate,
      currentAssets: rupees(ca),
      currentLiabilities: rupees(cl),
      workingCapital: rupees(ca - cl),
      currentRatio: cl ? Math.round((ca / cl) * 100) / 100 : null,
      quickRatio: cl ? Math.round(((ca - inventory) / cl) * 100) / 100 : null,
      cashRatio: cl ? Math.round((cash / cl) * 100) / 100 : null,
      cashRunwayDays: cl ? Math.max(0, Math.round((cash / Math.max(1, cl / 30)))) : null
    };
  },

  costStructure(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const toDate = normalizeBusinessDate(query.toDate || query.asOfDate, { allowFuture: true });
    const fromDate = String(query.fromDate || `${periodOf(toDate)}-01`).slice(0, 10);
    const avgTicketPaise = money(query.avgTicketPaise || 0);
    const rows = db.prepare(`
      SELECT a.code, a.name, a.accountType, a.accountSubType,
        COALESCE(SUM(l.debitPaise), 0) AS debitPaise,
        COALESCE(SUM(l.creditPaise), 0) AS creditPaise
      FROM chartOfAccounts a
      LEFT JOIN (
        journalEntryLines l
        JOIN journalEntries e ON e.id = l.journalEntryId
          AND e.tenantId = l.tenantId
          AND e.branchId = l.branchId
          AND e.status = 'posted'
          AND e.businessDate BETWEEN @fromDate AND @toDate
      ) ON l.accountId = a.id AND l.tenantId = a.tenantId AND l.branchId = a.branchId
      WHERE a.tenantId = @tenantId AND a.branchId = @branchId AND a.active = 1
      GROUP BY a.id
      ORDER BY a.code ASC
    `).all({ tenantId, branchId, fromDate, toDate });
    const lines = rows
      .map((row) => {
        const raw = row.accountType === "income"
          ? Number(row.creditPaise || 0) - Number(row.debitPaise || 0)
          : Number(row.debitPaise || 0) - Number(row.creditPaise || 0);
        const name = String(row.name || "").toLowerCase();
        const category = name.includes("salary") || name.includes("payroll") ? "salary"
          : name.includes("commission") ? "commission"
            : name.includes("rent") ? "rent"
              : name.includes("stock") || name.includes("inventory") || name.includes("cogs") || name.includes("consum") ? "product"
                : row.accountType;
        const behavior = ["product", "commission"].includes(category) ? "variable" : row.accountType === "expense" ? "fixed" : "income";
        return { code: row.code, name: row.name, behavior, category, amountPaise: raw, amount: rupees(raw) };
      })
      .filter((row) => row.amountPaise !== 0);
    const revenuePaise = lines.filter((line) => line.category === "income").reduce((sum, line) => sum + line.amountPaise, 0);
    const variablePaise = lines.filter((line) => line.behavior === "variable").reduce((sum, line) => sum + line.amountPaise, 0);
    const fixedPaise = lines.filter((line) => line.behavior === "fixed").reduce((sum, line) => sum + line.amountPaise, 0);
    const salaryPaise = lines.filter((line) => line.category === "salary" || line.category === "commission").reduce((sum, line) => sum + line.amountPaise, 0);
    const contributionPaise = revenuePaise - variablePaise;
    const netPaise = contributionPaise - fixedPaise;
    const contributionRatio = revenuePaise > 0 ? contributionPaise / revenuePaise : 0;
    const breakEvenPaise = contributionRatio > 0 ? Math.round(fixedPaise / contributionRatio) : null;
    return {
      fromDate,
      toDate,
      revenue: rupees(revenuePaise),
      variableCost: rupees(variablePaise),
      fixedCost: rupees(fixedPaise),
      salaryCost: rupees(salaryPaise),
      contributionMargin: rupees(contributionPaise),
      contributionMarginRatioPct: revenuePaise ? Math.round(contributionRatio * 1000) / 10 : 0,
      salaryToRevenuePct: revenuePaise ? Math.round((salaryPaise / revenuePaise) * 1000) / 10 : null,
      breakEvenRevenue: breakEvenPaise === null ? null : rupees(breakEvenPaise),
      breakEvenClients: breakEvenPaise !== null && avgTicketPaise > 0 ? Math.ceil(breakEvenPaise / avgTicketPaise) : null,
      netProfit: rupees(netPaise),
      marginOfSafetyPct: revenuePaise && breakEvenPaise !== null ? Math.round(((revenuePaise - breakEvenPaise) / revenuePaise) * 1000) / 10 : null,
      lines
    };
  },

  dailyOperations(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const businessDate = normalizeBusinessDate(query.asOfDate || query.businessDate || today(), { allowFuture: true });
    const invoices = posInvoiceRows({ tenantId, branchId, fromDate: businessDate, toDate: businessDate });
    const salesPaise = invoices.reduce((sum, row) => sum + invoiceTotalPaise(row), 0);
    const paidPaise = invoices.reduce((sum, row) => sum + invoicePaidPaise(row), 0);
    const duePaise = invoices.reduce((sum, row) => sum + invoiceDuePaise(row), 0);
    const discountPaise = invoices.reduce((sum, row) => sum + invoiceDiscountPaise(row), 0);
    const gstPaise = invoices.reduce((sum, row) => sum + invoiceGstPaise(row), 0);

    const attendanceRows = tableExists("staff_attendance")
      ? safeAll("SELECT staffId, status, minutesWorked, overtimeMinutes FROM staff_attendance WHERE tenantId=@tenantId AND branchId=@branchId AND date=@businessDate", { tenantId, branchId, businessDate })
      : [];
    const attendanceByStaff = new Map(attendanceRows.map((row) => [String(row.staffId || ""), row]));
    const commissionRows = staffCommissionRows({ tenantId, branchId, businessDate });
    const commissionByStaff = new Map();
    const postedCommissionStaff = new Set();
    for (const row of commissionRows) {
      const staffId = String(row.staffId || "");
      const amountPaise = money(Number(row.commissionAmount || 0) * 100);
      if (amountPaise > 0) postedCommissionStaff.add(staffId);
      commissionByStaff.set(staffId, (commissionByStaff.get(staffId) || 0) + amountPaise);
    }
    if (tableExists("staff_commission_runs")) {
      const runs = safeAll("SELECT entries FROM staff_commission_runs WHERE tenantId=@tenantId AND (branchId=@branchId OR @branchId='') AND @businessDate BETWEEN periodStart AND periodEnd", { tenantId, branchId, businessDate });
      for (const run of runs) {
        for (const entry of parseJson(run.entries, [])) {
          const staffId = String(entry.staffId || entry.staff_id || "");
          const amountPaise = money(Number(entry.commission ?? entry.commissionAmount ?? entry.amount ?? 0) * 100);
          if (amountPaise > 0) postedCommissionStaff.add(staffId);
          commissionByStaff.set(staffId, (commissionByStaff.get(staffId) || 0) + amountPaise);
        }
      }
    }
    const staffRows = safeAll(`
      SELECT * FROM staff
      WHERE (branchId=@branchId OR @branchId='')
        AND COALESCE(status, 'active') NOT IN ('archived', 'blocked', 'deleted', 'inactive', 'suspended', 'terminated')
      ORDER BY name ASC
    `, { branchId });
    const commissionRulesByStaff = new Map();
    for (const row of staffCommissionRuleRows({ tenantId, branchId })) {
      const staffId = String(row.staffId || "");
      if (staffId && !commissionRulesByStaff.has(staffId)) commissionRulesByStaff.set(staffId, row);
    }
    const employeeDetailsByStaff = staffEmployeeDetailsByStaff({ tenantId, branchId });
    const payrollRows = staffPayrollRows({ tenantId, branchId, businessDate });
    const payrollByStaff = new Map(payrollRows.map((row) => [String(row.staffId || ""), row]));
    const invoiceRevenueByStaff = new Map();
    const invoiceTypeRevenueByStaff = new Map();
    const invoiceLineCountByStaff = new Map();
    const addStaffRevenue = (staffId, type, amountPaise) => {
      if (!staffId || amountPaise <= 0) return;
      const cleanType = lineType({ type });
      invoiceRevenueByStaff.set(staffId, (invoiceRevenueByStaff.get(staffId) || 0) + amountPaise);
      const typeMap = invoiceTypeRevenueByStaff.get(staffId) || new Map();
      typeMap.set(cleanType, (typeMap.get(cleanType) || 0) + amountPaise);
      invoiceTypeRevenueByStaff.set(staffId, typeMap);
      invoiceLineCountByStaff.set(staffId, (invoiceLineCountByStaff.get(staffId) || 0) + 1);
    };
    for (const row of invoices) {
      const invoiceStaffId = String(row.staffId || "");
      const items = parseJson(row.lineItems, []);
      if (Array.isArray(items) && items.length) {
        for (const item of items) {
          const staffId = String(item.staffId || item.staff_id || invoiceStaffId || "");
          addStaffRevenue(staffId, lineType(item), invoiceLineAmountPaise(item));
        }
      } else {
        addStaffRevenue(invoiceStaffId, "service", invoiceTotalPaise(row));
      }
    }
    const staffById = new Map(staffRows.map((person) => [String(person.id || ""), person]));
    for (const [staffId, typeMap] of invoiceTypeRevenueByStaff.entries()) {
      if (postedCommissionStaff.has(staffId)) continue;
      const person = staffById.get(staffId) || {};
      const rule = ruleForStaff(person, commissionRulesByStaff.get(staffId) || {});
      let liveCommissionPaise = 0;
      for (const [type, amountPaise] of typeMap.entries()) {
        liveCommissionPaise += money(amountPaise * (commissionPercentForType(type, rule) / 100));
      }
      liveCommissionPaise += money(Number(rule.flatAmount ?? rule.fixedPerLine ?? rule.fixed ?? 0) * 100 * (invoiceLineCountByStaff.get(staffId) || 0));
      if (liveCommissionPaise > 0) {
        commissionByStaff.set(staffId, (commissionByStaff.get(staffId) || 0) + liveCommissionPaise);
      }
    }
    const staff = staffRows.map((person) => {
      const staffId = String(person.id || "");
      const attendance = attendanceByStaff.get(staffId);
      const payroll = payrollByStaff.get(staffId) || {};
      const commissionPaise = commissionByStaff.get(staffId) || 0;
      const revenuePaise = invoiceRevenueByStaff.get(staffId) || 0;
      const monthlyPayPaise = money(Number(payroll.netPay || payroll.grossPay || payroll.basic || 0) * 100) || staffProfileSalaryPaise(person, employeeDetailsByStaff.get(staffId));
      const workedToday = isPresent(attendance?.status) || revenuePaise > 0;
      const dailySalaryPaise = workedToday ? Math.round(monthlyPayPaise / 30) : 0;
      return {
        staffId,
        name: person.name,
        role: person.role,
        attendance: attendance?.status || (revenuePaise > 0 ? "invoice_live" : "not_marked"),
        minutesWorked: Number(attendance?.minutesWorked || 0),
        revenue: rupees(revenuePaise),
        dailySalary: rupees(dailySalaryPaise),
        commission: rupees(commissionPaise),
        totalStaffCost: rupees(dailySalaryPaise + commissionPaise),
        netContribution: rupees(revenuePaise - dailySalaryPaise - commissionPaise)
      };
    });
    const movementProductRows = tableExists("inventoryMovements")
      ? safeAll(`SELECT sku, SUM(qty) AS qty, SUM(totalCostPaise) AS costPaise FROM inventoryMovements
          WHERE tenantId=@tenantId AND branchId=@branchId AND businessDate=@businessDate AND movementType='out'
          GROUP BY sku ORDER BY costPaise DESC LIMIT 10`, { tenantId, branchId, businessDate })
      : [];
    const consumeDraftRows = productConsumeDraftRows({
      tenantId,
      branchId,
      businessDate,
      invoiceIds: invoices.map((invoice) => invoice.id)
    });
    const productRows = mergeProductRows([...movementProductRows, ...productRowsFromDrafts(consumeDraftRows)]);
    const productCostPaise = productRows.reduce((sum, row) => sum + money(row.costPaise), 0);
    const costs = this.costStructure({ branchId, toDate: businessDate }, access);
    const rentLine = (costs.lines || []).find((line) => String(line.name || "").toLowerCase().includes("rent"));
    const dailyRentPaise = rentLine ? money((Number(rentLine.amount || 0) * 100) / 30) : 0;
    const salaryPaise = staff.reduce((sum, row) => sum + money(row.dailySalary * 100), 0);
    const commissionPaise = staff.reduce((sum, row) => sum + money(row.commission * 100), 0);
    const directCostPaise = salaryPaise + commissionPaise + productCostPaise + dailyRentPaise;
    return {
      businessDate,
      invoiceCount: invoices.length,
      sales: rupees(salesPaise),
      paid: rupees(paidPaise),
      due: rupees(duePaise),
      discount: rupees(discountPaise),
      gst: rupees(gstPaise),
      productConsumption: rupees(productCostPaise),
      dailyRent: rupees(dailyRentPaise),
      salary: rupees(salaryPaise),
      commission: rupees(commissionPaise),
      directCost: rupees(directCostPaise),
      netAfterTrackedCost: rupees(salesPaise - directCostPaise),
      staff,
      products: productRows.map((row) => ({ sku: row.sku, qty: Number(row.qty || 0), cost: rupees(row.costPaise) }))
    };
  },

  financeOs(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate || today(), { allowFuture: true });
    ensureHardeningSchema();
    const daily = this.dailyOperations({ branchId, asOfDate }, access);
    const costs = this.costStructure({ branchId, toDate: asOfDate, avgTicketPaise: query.avgTicketPaise || 0 }, access);
    const sheet = this.live({ branchId, asOfDate }, access);
    const outbox = safeGet(`
      SELECT
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status='posted' THEN 1 ELSE 0 END) AS posted
      FROM glOutbox WHERE tenantId=@tenantId AND branchId=@branchId
    `, { tenantId, branchId });
    const invoiceRows = posInvoiceRows({ tenantId, branchId, fromDate: asOfDate, toDate: asOfDate });
    const serviceMap = new Map();
    for (const invoice of invoiceRows) {
      const items = parseJson(invoice.lineItems, []);
      for (const item of Array.isArray(items) ? items : []) {
        const type = String(item.type || item.itemType || "").toLowerCase();
        const name = String(item.name || item.serviceName || item.productName || type || "Item");
        const qty = Number(item.quantity || item.qty || 1);
        const revenuePaise = money(Number(item.total ?? item.lineTotal ?? item.price ?? 0) * 100);
        const current = serviceMap.get(name) || { name, type: type || "service", count: 0, revenuePaise: 0 };
        current.count += qty;
        current.revenuePaise += revenuePaise;
        serviceMap.set(name, current);
      }
    }
    const serviceMargins = [...serviceMap.values()]
      .sort((a, b) => b.revenuePaise - a.revenuePaise)
      .slice(0, 8)
      .map((row) => {
        const estimatedCostPaise = row.type === "product" ? Math.round(row.revenuePaise * 0.45) : 0;
        const commissionPaise = Math.round(row.revenuePaise * 0.1);
        const marginPaise = row.revenuePaise - estimatedCostPaise - commissionPaise;
        return {
          name: row.name,
          type: row.type,
          count: row.count,
          revenue: rupees(row.revenuePaise),
          productCost: rupees(estimatedCostPaise),
          staffCommission: rupees(commissionPaise),
          margin: rupees(marginPaise),
          marginPct: row.revenuePaise ? Math.round((marginPaise / row.revenuePaise) * 1000) / 10 : 0
        };
      });
    const glRevenuePaise = this.accountBalances(tenantId, branchId, asOfDate)
      .filter((row) => row.accountType === "income")
      .reduce((sum, row) => sum + Number(row.creditPaise || 0) - Number(row.debitPaise || 0), 0);
    const inventoryValuePaise = this.accountBalances(tenantId, branchId, asOfDate)
      .filter((row) => row.accountSubType === "inventory")
      .reduce((sum, row) => sum + sectionBalance(row), 0);
    const wmaValue = safeGet("SELECT SUM(totalValuePaise) AS value FROM inventoryItems WHERE tenantId=@tenantId AND branchId=@branchId", { tenantId, branchId });
    const revenueDiffPaise = money(daily.sales * 100) - glRevenuePaise;
    const inventoryDiffPaise = Number(wmaValue.value || 0) - inventoryValuePaise;
    const outgoingRows = tableExists("outgoing_fund_entries")
      ? safeAll(`
        SELECT *
        FROM outgoing_fund_entries
        WHERE tenant_id=@tenantId AND (branch_id=@branchId OR @branchId='')
          AND entry_date=@asOfDate AND status <> 'deleted'
        ORDER BY created_at DESC LIMIT 12
      `, { tenantId, branchId, asOfDate })
      : [];
    const outgoingPaise = outgoingRows.reduce((sum, row) => sum + money(Number(row.amount || 0) * 100), 0);
    const cashOutgoingPaise = outgoingRows
      .filter((row) => String(`${row.payment_mode || ""} ${row.paid_from_account_name || ""}`).toLowerCase().includes("cash"))
      .reduce((sum, row) => sum + money(Number(row.amount || 0) * 100), 0);
    const bankOutgoingPaise = outgoingPaise - cashOutgoingPaise;
    const paymentRows = posPaymentRows({ tenantId, branchId, fromDate: asOfDate, toDate: asOfDate, limit: 200 });
    const cashCollectionPaise = paymentRows
      .filter((row) => normalizedPaymentMode(row.mode) === "cash")
      .reduce((sum, row) => sum + paymentAmountPaise(row), 0);
    const bankCollectionPaise = paymentRows.reduce((sum, row) => sum + paymentAmountPaise(row), 0) - cashCollectionPaise;
    const outgoingLines = outgoingRows.flatMap((row) => outgoingLineBreakdown(row));
    const operatingOutgoingPaise = outgoingLines
      .filter((line) => line.operating)
      .reduce((sum, line) => sum + line.amountPaise, 0);
    const nonOperatingOutgoingPaise = Math.max(0, outgoingPaise - operatingOutgoingPaise);
    const purchaseRows = purchasePayableRows({ tenantId, branchId, fromDate: asOfDate, toDate: asOfDate, limit: 100 });
    const purchasePayablePaise = purchaseRows.reduce((sum, row) => sum + row.totalPaise, 0);
    const purchaseTaxPaise = purchaseRows.reduce((sum, row) => sum + row.taxPaise, 0);
    const purchaseInventoryPaise = purchaseRows.reduce((sum, row) => sum + row.inventoryPaise, 0);
    const purchaseInputGstRowsToday = purchaseRows.filter((row) => row.taxPaise > 0);
    const purchaseInputGstPaise = purchaseInputGstRowsToday.reduce((sum, row) => sum + row.taxPaise, 0);
    const financeMonth = periodOf(asOfDate);
    const prepaidRows = prepaidAdvanceRows({ tenantId, branchId, fromDate: asOfDate, toDate: asOfDate, limit: 100 });
    const prepaidAdvancePaise = prepaidRows.reduce((sum, row) => sum + row.totalPaise, 0);
    const prepaidBalancePaise = prepaidRows.reduce((sum, row) => sum + row.balancePaise, 0);
    const walletBalances = walletBalanceRows({ tenantId, branchId, limit: 100 });
    const walletTransactionRowsToday = walletTransactionRows({ tenantId, branchId, fromDate: asOfDate, toDate: asOfDate, limit: 100 });
    const storeCreditBalances = storeCreditBalanceRows({ tenantId, branchId, limit: 100 });
    const storeCreditTransactionsToday = storeCreditTransactionRows({ tenantId, branchId, fromDate: asOfDate, toDate: asOfDate, limit: 100 });
    const walletBalancePaise = walletBalances.reduce((sum, row) => sum + row.balancePaise, 0);
    const storeCreditBalancePaise = storeCreditBalances.reduce((sum, row) => sum + row.balancePaise, 0);
    const statutoryRows = payrollStatutoryRows({ tenantId, branchId, month: financeMonth, limit: 500 });
    const openStatutoryRows = statutoryRows.filter((row) => isOpenStatutoryStatus(row.status));
    const statutoryLiabilityPaise = openStatutoryRows.reduce((sum, row) => sum + row.amountPaise, 0);
    const fixedAssetAllRows = fixedAssetRows({ tenantId, branchId, limit: 500 });
    const fixedAssetPurchaseRows = fixedAssetRows({ tenantId, branchId, fromDate: `${financeMonth}-01`, toDate: asOfDate, limit: 100 });
    const depreciationRows = depreciationEntryRows({ tenantId, branchId, period: financeMonth, limit: 100 });
    const fixedAssetGrossPaise = fixedAssetAllRows.reduce((sum, row) => sum + row.costPaise, 0);
    const fixedAssetAccumulatedPaise = fixedAssetAllRows.reduce((sum, row) => sum + row.accumulatedPaise, 0);
    const fixedAssetPurchasePaise = fixedAssetPurchaseRows.reduce((sum, row) => sum + row.costPaise, 0);
    const depreciationPaise = depreciationRows.reduce((sum, row) => sum + row.amountPaise, 0);
    const cashBankReconciliation = {
      cashCollection: rupees(cashCollectionPaise),
      bankCollection: rupees(bankCollectionPaise),
      cashOutgoing: rupees(cashOutgoingPaise),
      bankOutgoing: rupees(bankOutgoingPaise),
      expectedCash: rupees(cashCollectionPaise - cashOutgoingPaise),
      expectedBankNet: rupees(bankCollectionPaise - bankOutgoingPaise),
      paymentRows: paymentRows.length,
      outgoingRows: outgoingRows.length
    };
    const expenseMap = new Map();
    const addExpense = (category, amountPaise, source) => {
      const key = String(category || "general").toLowerCase();
      const current = expenseMap.get(key) || { category: key, amountPaise: 0, sources: new Set() };
      current.amountPaise += money(amountPaise);
      current.sources.add(source);
      expenseMap.set(key, current);
    };
    addExpense("salary", money(daily.salary * 100), "attendance");
    addExpense("commission", money(daily.commission * 100), "invoice");
    addExpense("rent", money(daily.dailyRent * 100), "fixed-cost");
    addExpense("product", money(daily.productConsumption * 100), "inventory");
    for (const line of outgoingLines) {
      if (line.operating) addExpense(line.category, line.amountPaise, "outgoing");
    }
    const expenseCategoryProfit = [...expenseMap.values()].map((row) => ({
      category: row.category,
      amount: rupees(row.amountPaise),
      netAfterCategory: rupees(money(daily.sales * 100) - row.amountPaise),
      sources: [...row.sources]
    })).sort((a, b) => b.amount - a.amount);
    const outgoingCoverageRaw = salonOutgoingCoverage(outgoingLines);
    const outgoingBucketMap = new Map();
    for (const line of outgoingLines) {
      const key = line.bucket || "review";
      const current = outgoingBucketMap.get(key) || { bucket: key, amountPaise: 0, entries: 0 };
      current.amountPaise += line.amountPaise;
      current.entries += 1;
      outgoingBucketMap.set(key, current);
    }
    const outgoingConnection = outgoingRows.reduce((summary, row) => {
      const approvalStatus = String(row.approval_status || "pending").toLowerCase();
      const linkedPartyType = String(row.linked_party_type || "none").toLowerCase();
      const hasPartyLink = Boolean(row.linked_party_name || (linkedPartyType && linkedPartyType !== "none"));
      summary.inputGstPaise += money(Number(row.gst_amount || 0) * 100);
      if (row.bill_url) summary.withBill += 1;
      else summary.missingBill += 1;
      if (hasPartyLink) summary.linked += 1;
      else summary.missingLink += 1;
      if (["approved", "not_required"].includes(approvalStatus)) summary.approved += 1;
      if (approvalStatus === "pending") summary.pendingApproval += 1;
      return summary;
    }, { inputGstPaise: 0, withBill: 0, missingBill: 0, linked: 0, missingLink: 0, approved: 0, pendingApproval: 0 });
    const outgoingCoverage = {
      total: rupees(outgoingPaise),
      operating: rupees(operatingOutgoingPaise),
      balanceSheetOnly: rupees(nonOperatingOutgoingPaise),
      categoriesUsed: outgoingCoverageRaw.categories.length,
      categoriesAvailable: SALON_OUTGOING_CATEGORIES.length,
      connection: {
        inputGst: rupees(outgoingConnection.inputGstPaise),
        withBill: outgoingConnection.withBill,
        missingBill: outgoingConnection.missingBill,
        linked: outgoingConnection.linked,
        missingLink: outgoingConnection.missingLink,
        approved: outgoingConnection.approved,
        pendingApproval: outgoingConnection.pendingApproval
      },
      buckets: [...outgoingBucketMap.values()]
        .map((row) => ({ bucket: row.bucket, amount: rupees(row.amountPaise), entries: row.entries }))
        .sort((a, b) => b.amount - a.amount),
      categories: outgoingCoverageRaw.categories.map((row) => ({
        key: row.key,
        label: row.label,
        bucket: row.bucket,
        impact: row.impact,
        operating: row.operating,
        amount: rupees(row.amountPaise),
        entries: row.entries
      })),
      missing: outgoingCoverageRaw.missing.slice(0, 12).map((row) => ({
        key: row.key,
        label: row.label,
        bucket: row.bucket,
        impact: row.impact
      }))
    };
    const branchRows = safeAll("SELECT id, name FROM branches WHERE tenantId=@tenantId ORDER BY name ASC LIMIT 20", { tenantId });
    const branchWise = branchRows.map((branch) => {
      const bid = String(branch.id || "");
      const branchDaily = this.dailyOperations({ branchId: bid, asOfDate }, access);
      const branchSheet = this.live({ branchId: bid, asOfDate }, access);
      return {
        branchId: bid,
        branchName: branch.name || bid,
        cash: branchSheet.sections.assets.filter((row) => ["cash", "bank"].includes(row.accountSubType)).reduce((sum, row) => sum + Number(row.balance || 0), 0),
        receivable: branchSheet.sections.assets.filter((row) => row.accountSubType === "receivables").reduce((sum, row) => sum + Number(row.balance || 0), 0),
        payable: branchSheet.sections.liabilities.filter((row) => row.accountSubType === "payables").reduce((sum, row) => sum + Number(row.balance || 0), 0),
        stock: branchSheet.sections.assets.filter((row) => row.accountSubType === "inventory").reduce((sum, row) => sum + Number(row.balance || 0), 0),
        profit: branchDaily.netAfterTrackedCost
      };
    });
    const outboxRows = safeAll(`
      SELECT eventKey, eventType, status, businessDate, journalEntryId, createdAt
      FROM glOutbox
      WHERE tenantId=@tenantId AND branchId=@branchId
        AND (businessDate=@asOfDate OR substr(createdAt, 1, 10)=@asOfDate)
      ORDER BY createdAt DESC LIMIT 20
    `, { tenantId, branchId, asOfDate });
    const purchasePayables = {
      total: rupees(purchasePayablePaise),
      inventory: rupees(purchaseInventoryPaise),
      gst: rupees(purchaseTaxPaise),
      bills: purchaseRows.length,
      recent: purchaseRows.slice(0, 12).map((row) => {
        const status = outboxRows.find((event) => String(event.eventKey || "").includes(row.sourceId))?.status
          || (purchaseOutboxExists(tenantId, row) ? "queued" : "not_queued");
        return {
          id: row.sourceId,
          sourceType: row.sourceType,
          billNo: row.billNo,
          supplierName: row.supplierName,
          total: rupees(row.totalPaise),
          inventory: rupees(row.inventoryPaise),
          gst: rupees(row.taxPaise),
          glStatus: status
        };
      })
    };
    const purchaseInputGstStatuses = purchaseInputGstRowsToday.map((row) => {
      const status = outboxRows.find((event) => String(event.eventKey || "").includes(row.sourceId))?.status
        || (purchaseOutboxExists(tenantId, row) ? "queued" : "not_queued");
      return { row, status };
    });
    const purchaseInputGst = {
      total: rupees(purchaseInputGstPaise),
      bills: purchaseInputGstRowsToday.length,
      postedOrQueued: purchaseInputGstStatuses.filter((item) => !["not_queued", "failed"].includes(item.status)).length,
      pending: purchaseInputGstStatuses.filter((item) => item.status === "not_queued").length,
      recent: purchaseInputGstStatuses.slice(0, 12).map(({ row, status }) => ({
        id: row.sourceId,
        sourceType: row.sourceType,
        billNo: row.billNo,
        supplierName: row.supplierName,
        inputGst: rupees(row.taxPaise),
        inventory: rupees(row.inventoryPaise),
        total: rupees(row.totalPaise),
        glStatus: status
      }))
    };
    const prepaidAdvances = {
      total: rupees(prepaidAdvancePaise),
      balance: rupees(prepaidBalancePaise),
      schedules: prepaidRows.length,
      membership: rupees(prepaidRows.filter((row) => row.sourceType === "membership").reduce((sum, row) => sum + row.balancePaise, 0)),
      packageAdvance: rupees(prepaidRows.filter((row) => row.sourceType === "package").reduce((sum, row) => sum + row.balancePaise, 0)),
      giftCard: rupees(prepaidRows.filter((row) => row.sourceType === "giftcard").reduce((sum, row) => sum + row.balancePaise, 0)),
      recent: prepaidRows.slice(0, 12).map((row) => ({
        id: row.id,
        sourceType: row.sourceType,
        sourceId: row.sourceId,
        total: rupees(row.totalPaise),
        recognized: rupees(row.recognizedPaise),
        balance: rupees(row.balancePaise),
        method: row.method,
        status: row.status
      }))
    };
    const walletCredits = {
      total: rupees(walletBalancePaise + storeCreditBalancePaise),
      wallet: rupees(walletBalancePaise),
      storeCredit: rupees(storeCreditBalancePaise),
      clients: walletBalances.length,
      storeCredits: storeCreditBalances.length,
      transactions: walletTransactionRowsToday.length + storeCreditTransactionsToday.length,
      todayIssued: rupees([...walletTransactionRowsToday, ...storeCreditTransactionsToday]
        .filter((row) => !isWalletOutflow(row))
        .reduce((sum, row) => sum + Math.abs(row.amountPaise), 0)),
      todayRedeemed: rupees([...walletTransactionRowsToday, ...storeCreditTransactionsToday]
        .filter((row) => isWalletOutflow(row))
        .reduce((sum, row) => sum + Math.abs(row.amountPaise), 0)),
      recent: [
        ...walletBalances.slice(0, 8).map((row) => ({
          id: row.id,
          sourceType: "wallet",
          customerId: row.id,
          reference: row.name,
          balance: rupees(row.balancePaise),
          status: "active"
        })),
        ...storeCreditBalances.slice(0, 8).map((row) => ({
          id: row.id,
          sourceType: "store_credit",
          customerId: row.customerId,
          reference: row.sourceInvoiceId || row.sourceRefundId || row.reason,
          balance: rupees(row.balancePaise),
          status: row.status
        }))
      ].slice(0, 12)
    };
    const payrollStatutory = {
      month: financeMonth,
      total: rupees(statutoryLiabilityPaise),
      pf: rupees(openStatutoryRows.filter((row) => row.category === "pf").reduce((sum, row) => sum + row.amountPaise, 0)),
      esi: rupees(openStatutoryRows.filter((row) => row.category === "esi").reduce((sum, row) => sum + row.amountPaise, 0)),
      pt: rupees(openStatutoryRows.filter((row) => row.category === "pt").reduce((sum, row) => sum + row.amountPaise, 0)),
      tds: rupees(openStatutoryRows.filter((row) => row.category === "tds").reduce((sum, row) => sum + row.amountPaise, 0)),
      rows: statutoryRows.length,
      pending: openStatutoryRows.length,
      recent: openStatutoryRows.slice(0, 12).map((row) => ({
        id: row.id,
        category: row.category,
        staffId: row.staffId,
        payrollId: row.payrollId,
        wageMonth: row.wageMonth,
        amount: rupees(row.amountPaise),
        status: row.status
      }))
    };
    const fixedAssetControl = {
      month: financeMonth,
      grossBlock: rupees(fixedAssetGrossPaise),
      accumulatedDepreciation: rupees(fixedAssetAccumulatedPaise),
      netBlock: rupees(Math.max(0, fixedAssetGrossPaise - fixedAssetAccumulatedPaise)),
      purchases: rupees(fixedAssetPurchasePaise),
      depreciation: rupees(depreciationPaise),
      assets: fixedAssetAllRows.length,
      depreciationEntries: depreciationRows.length,
      recent: [
        ...fixedAssetPurchaseRows.slice(0, 8).map((row) => ({
          id: row.id,
          type: "purchase",
          code: row.code,
          name: row.name,
          date: row.acquisitionDate,
          amount: rupees(row.costPaise),
          status: row.status
        })),
        ...depreciationRows.slice(0, 8).map((row) => ({
          id: row.id,
          type: "depreciation",
          code: row.code,
          name: row.name,
          date: row.period,
          amount: rupees(row.amountPaise),
          status: row.journalEntryId ? "posted" : "pending"
        }))
      ].slice(0, 12)
    };
    const invoiceDrilldown = invoiceRows.slice(0, 12).map((invoice) => {
      const invoiceId = String(invoice.id || "");
      const linkedRows = outboxRows.filter((row) => String(row.eventKey || "").includes(invoiceId));
      const paymentStatus = linkedRows.find((row) => row.eventType === "invoice.paid")?.status || "";
      const receivableStatus = linkedRows.find((row) => row.eventType === "invoice.receivable")?.status || "";
      return {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber || invoiceId,
        revenue: rupees(invoiceTotalPaise(invoice)),
        paid: rupees(invoicePaidPaise(invoice)),
        due: rupees(invoiceDuePaise(invoice)),
        gst: rupees(invoiceGstPaise(invoice)),
        glStatus: receivableStatus || paymentStatus || "not_queued",
        receivableStatus: receivableStatus || (invoiceDuePaise(invoice) > 0 ? "not_queued" : "none")
      };
    });
    const timeline = [
      ...invoiceRows.slice(0, 10).map((row) => ({ at: row.createdAt || asOfDate, type: "invoice", title: row.invoiceNumber || row.id, amount: rupees(invoiceTotalPaise(row)) })),
      ...paymentRows.slice(0, 10).map((row) => ({ at: row.createdAt || asOfDate, type: "payment", title: `${row.mode || "payment"} received`, amount: rupees(paymentAmountPaise(row)) })),
      ...outgoingRows.slice(0, 10).map((row) => ({ at: row.entry_date, type: "outgoing", title: row.paid_to_account_name || row.transaction_type || row.entry_no, amount: Number(row.amount || 0) })),
      ...daily.products.slice(0, 8).map((row) => ({ at: asOfDate, type: "inventory", title: `Inventory consumed ${row.sku}`, amount: row.cost })),
      ...outboxRows.slice(0, 10).map((row) => ({ at: row.createdAt || row.businessDate, type: "gl", title: `${row.eventType} ${row.status}`, amount: 0 }))
    ].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 20);
    const gstPayablePaise = daily.gst * 100;
    const month = financeMonth;
    const [monthYear, monthNumber] = month.split("-").map((part) => Number(part));
    const monthEnd = monthYear && monthNumber ? new Date(Date.UTC(monthYear, monthNumber, 0)).toISOString().slice(0, 10) : `${month}-31`;
    const monthInvoiceRows = posInvoiceRows({ tenantId, branchId, fromDate: `${month}-01`, toDate: monthEnd, limit: 10000 });
    const monthGstPaise = monthInvoiceRows.reduce((sum, row) => sum + invoiceGstPaise(row), 0);
    const checklist = [
      { key: "salary_accrual", label: "Salary accrual", done: daily.salary > 0, amount: daily.salary },
      { key: "rent_accrual", label: "Rent accrual", done: daily.dailyRent > 0, amount: daily.dailyRent },
      { key: "commission_accrual", label: "Commission accrual", done: daily.commission > 0, amount: daily.commission },
      { key: "gst_payable", label: "GST payable review", done: daily.gst > 0, amount: daily.gst },
      { key: "payroll_statutory", label: "Payroll statutory liability", done: payrollStatutory.pending > 0 || statutoryRows.length === 0, amount: payrollStatutory.total },
      { key: "depreciation", label: "Depreciation run", done: costs.lines.some((line) => String(line.category || "").includes("depreciation")), amount: 0 },
      { key: "deferred_revenue", label: "Deferred revenue recognition", done: sheet.sections.liabilities.some((row) => String(row.accountSubType || "").includes("deferred")), amount: prepaidAdvances.balance }
    ];
    const suggestions = [
      revenueDiffPaise !== 0 ? { severity: "warn", title: "POS to GL sync pending", text: `POS sales aur GL revenue me ${rupees(revenueDiffPaise)} ka gap hai.`, action: "Process GL outbox / invoice sync check karo." } : null,
      Number(outbox.failed || 0) > 0 ? { severity: "critical", title: "Failed journal events", text: `${outbox.failed} GL outbox events failed hain.`, action: "Hardening tab me Process GL outbox chalao." } : null,
      inventoryDiffPaise !== 0 ? { severity: "warn", title: "Inventory reconciliation gap", text: `WMA inventory aur GL inventory me ${rupees(inventoryDiffPaise)} ka gap hai.`, action: "Inventory issue/purchase posting verify karo." } : null,
      daily.salary === 0 ? { severity: "warn", title: "Salary allocation missing", text: "Aaj staff salary allocation 0 aa raha hai.", action: "Attendance salary profile/payroll component check karo." } : null,
      daily.productConsumption === 0 ? { severity: "ok", title: "Product consumption not posted", text: "Aaj inventory consume/issue entry nahi mili.", action: "Service recipe consume flow verify karo." } : null,
      cashBankReconciliation.expectedCash < 0 ? { severity: "critical", title: "Cash short warning", text: `Expected cash ${rupeesToText(cashBankReconciliation.expectedCash)} aa raha hai.`, action: "Cash drawer aur outgoing cash entries reconcile karo." } : null,
      operatingOutgoingPaise > money(daily.sales * 100) ? { severity: "warn", title: "Expense sales se high", text: `Operating outgoing ${rupeesToText(rupees(operatingOutgoingPaise))} aaj ki sales se zyada hai.`, action: "Owner approval se expense check karo." } : null
    ].filter(Boolean);
    const dailyClose = {
      ready: revenueDiffPaise === 0 && inventoryDiffPaise === 0 && Number(outbox.failed || 0) === 0,
      warnings: suggestions.filter((item) => item.severity !== "ok").length,
      checklist: [
        { key: "pos_gl", label: "POS sales GL me queued/posted", done: revenueDiffPaise === 0 },
        { key: "cash_bank", label: "Cash/Bank expected calculated", done: cashBankReconciliation.paymentRows > 0 || daily.sales === 0 },
        { key: "outgoing", label: "Outgoing fund impact included", done: true },
        { key: "inventory", label: "Inventory COGS reconciled", done: inventoryDiffPaise === 0 },
        { key: "gst", label: "GST payable estimated", done: daily.gst >= 0 },
        { key: "staff", label: "Staff salary/commission checked", done: daily.staffProfitability?.length ? true : daily.staff.length > 0 }
      ]
    };
    return {
      asOfDate,
      month,
      outgoingImpact: {
        total: rupees(outgoingPaise),
        cash: rupees(cashOutgoingPaise),
        bank: rupees(bankOutgoingPaise),
        operating: rupees(operatingOutgoingPaise),
        nonOperating: rupees(nonOperatingOutgoingPaise),
        profitAfterOutgoing: rupees(money(daily.netAfterTrackedCost * 100) - operatingOutgoingPaise),
        recent: outgoingRows.map((row) => {
          const line = outgoingLineBreakdown(row)[0] || {};
          return {
            id: row.id,
            entryNo: row.entry_no,
            category: line.label || row.transaction_type || "Outgoing",
            categoryKey: line.category || "",
            bucket: line.bucket || "",
            impact: line.impact || "",
            payee: row.paid_to_account_name || row.paid_from_account_name || "",
            mode: row.payment_mode || "",
            amount: Number(row.amount || 0),
            gstAmount: Number(row.gst_amount || 0),
            billUrl: row.bill_url || "",
            linkedPartyType: row.linked_party_type || "none",
            linkedPartyName: row.linked_party_name || "",
            approvalStatus: row.approval_status || "pending",
            status: row.status || ""
          };
        })
      },
      outgoingCoverage,
      purchasePayables,
      purchaseInputGst,
      prepaidAdvances,
      walletCredits,
      payrollStatutory,
      fixedAssetControl,
      todayTimeline: timeline,
      ownerDailyClose: dailyClose,
      cashBankReconciliation,
      expenseCategoryProfit,
      branchWiseBalanceSheet: branchWise,
      invoiceDrilldown,
      gstPayableControl: {
        todayCollected: daily.gst,
        monthEstimate: rupees(monthGstPaise),
        postedOrQueued: outboxRows.filter((row) => String(row.eventType || "").includes("invoice")).length,
        payablePaise: gstPayablePaise
      },
      livePosToGl: {
        posSales: daily.sales,
        glRevenue: rupees(glRevenuePaise),
        difference: rupees(revenueDiffPaise),
        outboxPending: Number(outbox.pending || 0),
        outboxFailed: Number(outbox.failed || 0),
        outboxPosted: Number(outbox.posted || 0)
      },
      dailyProfit: {
        sales: daily.sales,
        gst: daily.gst,
        discount: daily.discount,
        salary: daily.salary,
        commission: daily.commission,
        rent: daily.dailyRent,
        productConsumption: daily.productConsumption,
        netAfterTrackedCost: daily.netAfterTrackedCost
      },
      staffProfitability: daily.staff,
      serviceMargins,
      inventoryConsumption: {
        total: daily.productConsumption,
        products: daily.products,
        wmaInventory: rupees(wmaValue.value),
        glInventory: rupees(inventoryValuePaise),
        difference: rupees(inventoryDiffPaise)
      },
      fixedCostAllocation: {
        dailyRent: daily.dailyRent,
        dailySalary: daily.salary,
        fixedCostMonth: costs.fixedCost,
        salaryCostMonth: costs.salaryCost
      },
      journalSuggestions: suggestions,
      reconciliation: {
        posVsGlRevenueDifference: rupees(revenueDiffPaise),
        inventoryDifference: rupees(inventoryDiffPaise),
        balanced: sheet.balanced,
        accountingEquationDifference: sheet.totals.accountingEquationDifference
      },
      copilotPrompts: [
        "Aaj profit kam kyu hai?",
        "Kaunsa staff profitable hai?",
        "Kaunsa service loss me hai?",
        "POS sale GL me post hui ya nahi?"
      ],
      monthEndClose: { month, checklist }
    };
  },

  ownerDailyClose(payload = {}, access = {}) {
    const branchId = payload.branchId || access.requestedBranchId || "";
    const asOfDate = normalizeBusinessDate(payload.asOfDate || today(), { allowFuture: true });
    const posToGl = this.syncPosToGl({ branchId, asOfDate }, access);
    const purchases = this.syncPurchasesToGl({ branchId, asOfDate }, access);
    const wallets = this.syncWalletCreditsToGl({ branchId, asOfDate }, access);
    const payrollStatutory = this.syncPayrollStatutoryToGl({ branchId, asOfDate }, access);
    const fixedAssetPurchases = this.syncFixedAssetPurchasesToGl({ branchId, asOfDate }, access);
    const cogs = this.syncInventoryCogs({ branchId, asOfDate }, access);
    const accruals = this.postDailyAccruals({ branchId, asOfDate }, access);
    const report = this.financeOs({ branchId, asOfDate }, access);
    return { asOfDate, posToGl, purchases, wallets, payrollStatutory, fixedAssetPurchases, cogs, accruals, report, ready: report.ownerDailyClose.ready, warnings: report.ownerDailyClose.warnings };
  },

  syncPosToGl(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    ensureHardeningSchema();
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || businessDate).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const invoices = posInvoiceRows({ tenantId, branchId, fromDate, toDate, limit: 10000 });
    const paymentsByInvoice = new Map();
    for (const payment of posPaymentRows({ tenantId, branchId, fromDate, toDate, limit: 10000 })) {
      const invoiceId = String(payment.invoiceId || "");
      if (!invoiceId) continue;
      const current = paymentsByInvoice.get(invoiceId) || { totalPaise: 0, settlementPaise: 0, cashPaise: 0, walletPaise: 0, modes: new Set() };
      const amountPaise = paymentAmountPaise(payment);
      const mode = normalizedPaymentMode(payment.mode);
      current.totalPaise += amountPaise;
      if (isWalletPaymentMode(payment.mode)) {
        current.walletPaise += amountPaise;
      } else {
        current.settlementPaise += amountPaise;
        if (mode === "cash") current.cashPaise += amountPaise;
      }
      current.modes.add(mode);
      paymentsByInvoice.set(invoiceId, current);
    }
    const insert = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, @eventType, @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `);
    const summary = { fromDate, toDate, scanned: invoices.length, enqueued: 0, duplicate: 0, skipped: 0, receivable: 0, paid: 0, events: [] };
    for (const invoice of invoices) {
      const invoiceDate = String(invoice.createdAt || businessDate).slice(0, 10);
      const eventBranchId = String(invoice.branchId || branchId || "");
      const duePaise = invoiceDuePaise(invoice);
      let invoiceQueued = false;
      if (duePaise > 0) {
        if (invoiceReceivableOutboxExists(tenantId, invoice.id)) {
          summary.duplicate += 1;
        } else {
          const totalPaise = invoiceTotalPaise(invoice);
          const taxPaise = totalPaise > 0 ? Math.min(duePaise, Math.round((invoiceGstPaise(invoice) * duePaise) / totalPaise)) : 0;
          const result = insert.run({
            id: id("obx"),
            tenantId,
            branchId: eventBranchId,
            eventType: "invoice.receivable",
            eventKey: `invoice.receivable:${tenantId}:${eventBranchId}:${invoice.id}`,
            businessDate: invoiceDate,
            payloadJson: JSON.stringify({
              invoiceId: invoice.id,
              invoiceNumber: invoice.invoiceNumber || "",
              amountPaise: duePaise,
              taxPaise,
              revenueCode: payload.revenueCode || "4000",
              memo: `POS invoice due ${invoice.invoiceNumber || invoice.id}`
            })
          });
          if (result.changes === 1) {
            invoiceQueued = true;
            summary.enqueued += 1;
            summary.receivable += 1;
            summary.events.push({ invoiceId: invoice.id, status: "receivable_queued", amount: rupees(duePaise) });
          } else {
            summary.duplicate += 1;
          }
        }
      }
      if (invoicePaymentOutboxExists(tenantId, invoice.id)) {
        summary.duplicate += 1;
        continue;
      }
      const invoicePayments = paymentsByInvoice.get(String(invoice.id || ""));
      const paidPaise = invoicePayments?.totalPaise > 0 ? invoicePayments.settlementPaise : invoicePaidPaise(invoice);
      const amountPaise = Math.max(0, paidPaise - invoiceDeferredPaise(tenantId, invoice.id));
      if (amountPaise <= 0) {
        if (!invoiceQueued) summary.skipped += 1;
        continue;
      }
      const eventMode = payload.mode || (invoicePayments?.cashPaise === paidPaise ? "cash" : "bank");
      const eventKey = `invoice.paid:${tenantId}:${eventBranchId}:${invoice.id}`;
      const row = {
        id: id("obx"),
        tenantId,
        branchId: eventBranchId,
        eventType: "invoice.paid",
        eventKey,
        businessDate: invoiceDate,
        payloadJson: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || "",
          amountPaise,
          mode: eventMode,
          revenueCode: payload.revenueCode || "4000",
          memo: `POS invoice ${invoice.invoiceNumber || invoice.id}`
        })
      };
      const result = insert.run(row);
      if (result.changes === 1) {
        summary.enqueued += 1;
        summary.paid += 1;
        summary.events.push({ invoiceId: invoice.id, status: "paid_queued", amount: rupees(amountPaise) });
      } else {
        summary.duplicate += 1;
      }
    }
    return summary;
  },

  enqueueInvoicePaymentEvent({ invoice = {}, amount = 0, mode = "bank", access = {} } = {}) {
    const tenantId = access.tenantId;
    if (!tenantId || !invoice.id) return { enqueued: false, skipped: true };
    ensureHardeningSchema();
    const branchId = invoice.branch_id || invoice.branchId || access.requestedBranchId || "";
    const businessDate = String(invoice.paid_at || invoice.finalized_at || invoice.created_at || invoice.createdAt || today()).slice(0, 10);
    const deferredPaise = invoiceDeferredPaise(tenantId, invoice.id);
    const amountPaise = Math.max(0, money(amount * 100) - Math.min(money(amount * 100), deferredPaise));
    if (amountPaise <= 0) return { enqueued: false, skipped: true };
    const eventKey = `invoice.paid:${tenantId}:${branchId}:${invoice.id}:${money(invoice.paid_amount || invoice.paid || amount)}`;
    const result = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'invoice.paid', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `).run({
      id: id("obx"),
      tenantId,
      branchId,
      eventKey,
      businessDate,
      payloadJson: JSON.stringify({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_no || invoice.invoiceNumber || "",
        amountPaise,
        mode,
        revenueCode: "4000",
        memo: `Invoice payment ${invoice.invoice_no || invoice.invoiceNumber || invoice.id}`
      })
    });
    return { enqueued: result.changes === 1, duplicate: result.changes === 0, eventKey };
  },

  enqueueInvoiceRefundEvent({ invoice = {}, refund = {}, mode = "bank", access = {} } = {}) {
    const tenantId = access.tenantId;
    if (!tenantId || !invoice.id || !refund.refundId) return { enqueued: false, skipped: true };
    ensureHardeningSchema();
    const branchId = invoice.branch_id || invoice.branchId || access.requestedBranchId || "";
    const businessDate = String(refund.processedAt || invoice.updated_at || today()).slice(0, 10);
    const amountPaise = money(Number(refund.amount || 0) * 100);
    if (amountPaise <= 0) return { enqueued: false, skipped: true };
    const eventKey = `invoice.refund:${tenantId}:${branchId}:${refund.refundId}`;
    const result = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'invoice.refund', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `).run({
      id: id("obx"),
      tenantId,
      branchId,
      eventKey,
      businessDate,
      payloadJson: JSON.stringify({
        invoiceId: invoice.id,
        refundId: refund.refundId,
        refundNo: refund.refundNo || "",
        amountPaise,
        taxReversalPaise: money(Number(refund.taxReversal || 0) * 100),
        mode,
        memo: `Invoice refund ${refund.refundNo || refund.refundId}`
      })
    });
    return { enqueued: result.changes === 1, duplicate: result.changes === 0, eventKey };
  },

  enqueueInvoiceCreditNoteEvent({ invoice = {}, creditNote = {}, amount = 0, access = {} } = {}) {
    const tenantId = access.tenantId;
    if (!tenantId || !invoice.id || !creditNote.id) return { enqueued: false, skipped: true };
    ensureHardeningSchema();
    const branchId = invoice.branch_id || invoice.branchId || creditNote.branch_id || access.requestedBranchId || "";
    const businessDate = String(creditNote.created_at || invoice.updated_at || today()).slice(0, 10);
    const amountPaise = money(Number(amount || creditNote.grand_total || invoice.grand_total || 0) * 100);
    if (amountPaise <= 0) return { enqueued: false, skipped: true };
    const invoiceTotal = Math.max(Number(invoice.grand_total || 0), 1);
    const taxReversalPaise = money(Math.min(Number(invoice.tax_total || 0), (amountPaise / 100) * (Number(invoice.tax_total || 0) / invoiceTotal)) * 100);
    const eventKey = `invoice.credit_note:${tenantId}:${branchId}:${creditNote.id}`;
    const result = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'invoice.credit_note', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `).run({
      id: id("obx"),
      tenantId,
      branchId,
      eventKey,
      businessDate,
      payloadJson: JSON.stringify({
        invoiceId: invoice.id,
        creditNoteId: creditNote.id,
        amountPaise,
        taxReversalPaise,
        revenueCode: "4000",
        liabilityCode: "2000",
        memo: `Credit note ${creditNote.invoice_no || creditNote.id} against ${invoice.invoice_no || invoice.id}`
      })
    });
    return { enqueued: result.changes === 1, duplicate: result.changes === 0, eventKey };
  },

  enqueueInvoiceVoidEvent({ invoice = {}, reason = "", mode = "", access = {} } = {}) {
    const tenantId = access.tenantId;
    if (!tenantId || !invoice.id) return { enqueued: false, skipped: true };
    ensureHardeningSchema();
    const branchId = invoice.branch_id || invoice.branchId || access.requestedBranchId || "";
    const amount = Number(invoice.paid_amount || invoice.paid || 0);
    const amountPaise = money(amount * 100);
    if (amountPaise <= 0) return { enqueued: false, skipped: true };
    const payment = db.prepare(`
      SELECT payment_mode FROM invoice_payments
      WHERE tenant_id = ? AND invoice_id = ? AND status = 'paid'
      ORDER BY created_at DESC, id DESC
      LIMIT 1
    `).get(tenantId, invoice.id);
    const invoiceTotal = Math.max(Number(invoice.grand_total || 0), 1);
    const taxReversalPaise = money(Math.min(Number(invoice.tax_total || 0), amount * (Number(invoice.tax_total || 0) / invoiceTotal)) * 100);
    const paymentMode = mode || payment?.payment_mode || "bank";
    const eventKey = `invoice.void:${tenantId}:${branchId}:${invoice.id}`;
    const result = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'invoice.void', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `).run({
      id: id("obx"),
      tenantId,
      branchId,
      eventKey,
      businessDate: String(invoice.voided_at || invoice.updated_at || today()).slice(0, 10),
      payloadJson: JSON.stringify({
        invoiceId: invoice.id,
        amountPaise,
        taxReversalPaise,
        mode: paymentMode,
        revenueCode: "4000",
        reason,
        memo: `Void invoice ${invoice.invoice_no || invoice.id}`
      })
    });
    return { enqueued: result.changes === 1, duplicate: result.changes === 0, eventKey };
  },

  syncPurchasesToGl(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    ensureHardeningSchema();
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || businessDate).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const rows = purchasePayableRows({ tenantId, branchId, fromDate, toDate, limit: 10000 });
    const insert = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'inventory.purchase', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `);
    const summary = { fromDate, toDate, scanned: rows.length, enqueued: 0, duplicate: 0, skipped: 0, payable: 0, gst: 0, events: [] };
    for (const row of rows) {
      if (purchaseOutboxExists(tenantId, row)) {
        summary.duplicate += 1;
        continue;
      }
      if (row.totalPaise <= 0 || row.inventoryPaise <= 0) {
        summary.skipped += 1;
        continue;
      }
      const eventKey = `purchase.bill:${tenantId}:${row.branchId || branchId}:${row.sourceType}:${row.sourceId}`;
      const result = insert.run({
        id: id("obx"),
        tenantId,
        branchId: row.branchId || branchId,
        eventKey,
        businessDate: row.businessDate || businessDate,
        payloadJson: JSON.stringify({
          sourceType: row.sourceType,
          sourceId: row.sourceId,
          billNo: row.billNo,
          supplierId: row.supplierId,
          supplierName: row.supplierName,
          totalCostPaise: row.inventoryPaise,
          taxPaise: row.taxPaise,
          payablePaise: row.totalPaise,
          settled: false,
          memo: `Purchase bill ${row.billNo || row.sourceId}`
        })
      });
      if (result.changes === 1) {
        summary.enqueued += 1;
        summary.payable += rupees(row.totalPaise);
        summary.gst += rupees(row.taxPaise);
        summary.events.push({ sourceId: row.sourceId, billNo: row.billNo, status: "queued", payable: rupees(row.totalPaise) });
      } else {
        summary.duplicate += 1;
      }
    }
    return summary;
  },

  syncPurchaseInputGstToGl(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || businessDate).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const rows = purchaseInputGstRows({ tenantId, branchId, fromDate, toDate, limit: 10000 });
    const result = this.syncPurchasesToGl({ ...payload, branchId, fromDate, toDate }, access);
    return {
      ...result,
      inputGst: rupees(rows.reduce((sum, row) => sum + row.taxPaise, 0)),
      inputGstBills: rows.length
    };
  },

  syncWalletCreditsToGl(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || businessDate).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const rows = [
      ...walletTransactionRows({ tenantId, branchId, fromDate, toDate, limit: 10000 }),
      ...storeCreditTransactionRows({ tenantId, branchId, fromDate, toDate, limit: 10000 })
    ];
    const walletLiabilityPaise = walletBalanceRows({ tenantId, branchId, limit: 10000 }).reduce((sum, row) => sum + row.balancePaise, 0);
    const storeCreditLiabilityPaise = storeCreditBalanceRows({ tenantId, branchId, limit: 10000 }).reduce((sum, row) => sum + row.balancePaise, 0);
    const summary = {
      fromDate,
      toDate,
      scanned: rows.length,
      posted: 0,
      duplicate: 0,
      skipped: 0,
      credited: 0,
      redeemed: 0,
      liability: rupees(walletLiabilityPaise + storeCreditLiabilityPaise),
      events: []
    };
    for (const row of rows) {
      const amountPaise = Math.abs(money(row.amountPaise));
      if (!row.id || amountPaise <= 0) {
        summary.skipped += 1;
        continue;
      }
      const eventBranchId = row.branchId || branchId || "";
      const sourceType = row.sourceType === "store_credit" ? "store_credit" : "wallet";
      const sourceId = sourceType === "store_credit" ? (row.storeCreditId || row.id) : row.id;
      const idempotencyKey = `customer-credit:${tenantId}:${eventBranchId}:${sourceType}:${row.id}`;
      if (journalExists(tenantId, idempotencyKey)) {
        summary.duplicate += 1;
        continue;
      }
      const outflow = isWalletOutflow(row);
      const offsetCode = sourceType === "store_credit" || row.type === "refund" ? "4000" : "1010";
      const lines = outflow
        ? [
            { accountId: accountIdByCode(tenantId, eventBranchId, "2300"), debitPaise: amountPaise, memo: "Wallet/store credit redeemed" },
            { accountId: accountIdByCode(tenantId, eventBranchId, "4000"), creditPaise: amountPaise, memo: "Revenue settled by wallet/store credit" }
          ]
        : [
            { accountId: accountIdByCode(tenantId, eventBranchId, offsetCode), debitPaise: amountPaise, memo: sourceType === "store_credit" ? "Store credit issued" : "Wallet credited" },
            { accountId: accountIdByCode(tenantId, eventBranchId, "2300"), creditPaise: amountPaise, memo: "Customer credit liability" }
          ];
      const entry = this.createJournal({
        branchId: eventBranchId,
        businessDate: String(row.createdAt || businessDate).slice(0, 10),
        sourceType: `customer_credit.${sourceType}`,
        sourceId,
        memo: `${sourceType === "store_credit" ? "Store credit" : "Wallet"} ${outflow ? "redeemed" : "credited"} ${row.customerId || ""}`.trim(),
        idempotencyKey,
        lines
      }, access);
      summary.posted += 1;
      if (outflow) summary.redeemed += rupees(amountPaise);
      else summary.credited += rupees(amountPaise);
      summary.events.push({
        sourceType,
        sourceId,
        customerId: row.customerId,
        status: outflow ? "redeemed_posted" : "credit_posted",
        amount: rupees(amountPaise),
        journalEntryId: entry.id
      });
    }
    return summary;
  },

  syncPayrollStatutoryToGl(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const month = String(payload.month || periodOf(businessDate)).slice(0, 7);
    const rows = payrollStatutoryRows({ tenantId, branchId, month, limit: 10000 });
    const openRows = rows.filter((row) => isOpenStatutoryStatus(row.status));
    const summary = {
      month,
      scanned: rows.length,
      posted: 0,
      duplicate: 0,
      skipped: 0,
      liability: 0,
      pf: 0,
      esi: 0,
      pt: 0,
      tds: 0,
      events: []
    };
    for (const row of openRows) {
      const amountPaise = money(row.amountPaise);
      if (!row.id || amountPaise <= 0) {
        summary.skipped += 1;
        continue;
      }
      const eventBranchId = row.branchId || branchId || "";
      const idempotencyKey = `payroll-statutory:${tenantId}:${eventBranchId}:${row.category}:${row.id}`;
      if (journalExists(tenantId, idempotencyKey)) {
        summary.duplicate += 1;
        continue;
      }
      const entry = this.createJournal({
        branchId: eventBranchId,
        businessDate,
        sourceType: `payroll.statutory.${row.category}`,
        sourceId: row.id,
        memo: `Payroll statutory ${row.category.toUpperCase()} ${row.wageMonth}`,
        idempotencyKey,
        lines: [
          { accountId: accountIdByCode(tenantId, eventBranchId, "5100"), debitPaise: amountPaise, memo: `Payroll statutory ${row.category.toUpperCase()} expense/accrual` },
          { accountId: accountIdByCode(tenantId, eventBranchId, "2100"), creditPaise: amountPaise, memo: `Payroll statutory ${row.category.toUpperCase()} payable` }
        ]
      }, access);
      summary.posted += 1;
      summary.liability += rupees(amountPaise);
      summary[row.category] = rupees(money(Number(summary[row.category] || 0) * 100) + amountPaise);
      summary.events.push({
        id: row.id,
        category: row.category,
        staffId: row.staffId,
        payrollId: row.payrollId,
        amount: rupees(amountPaise),
        status: "posted",
        journalEntryId: entry.id
      });
    }
    summary.skipped += rows.length - openRows.length;
    return summary;
  },

  syncFixedAssetPurchasesToGl(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || `${periodOf(businessDate)}-01`).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const rows = fixedAssetRows({ tenantId, branchId, fromDate, toDate, limit: 10000 });
    const summary = { fromDate, toDate, scanned: rows.length, posted: 0, duplicate: 0, skipped: 0, purchases: 0, events: [] };
    for (const row of rows) {
      const amountPaise = money(row.costPaise);
      if (!row.code || amountPaise <= 0) {
        summary.skipped += 1;
        continue;
      }
      const eventBranchId = row.branchId || branchId || "";
      const idempotencyKey = `asset-buy:${tenantId}:${eventBranchId}:${row.code}`;
      if (journalExists(tenantId, idempotencyKey)) {
        summary.duplicate += 1;
        continue;
      }
      const entry = this.createJournal({
        branchId: eventBranchId,
        businessDate: row.acquisitionDate || businessDate,
        sourceType: "asset.acquisition",
        sourceId: row.code,
        memo: `Fixed asset purchase: ${row.name}`,
        idempotencyKey,
        lines: [
          { accountId: accountIdByCode(tenantId, eventBranchId, "1500"), debitPaise: amountPaise, memo: "Fixed asset capitalized" },
          { accountId: accountIdByCode(tenantId, eventBranchId, "2000"), creditPaise: amountPaise, memo: "Asset vendor payable" }
        ]
      }, access);
      summary.posted += 1;
      summary.purchases += rupees(amountPaise);
      summary.events.push({
        code: row.code,
        name: row.name,
        amount: rupees(amountPaise),
        status: "posted",
        journalEntryId: entry.id
      });
    }
    return summary;
  },

  syncInventoryCogs(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    ensureHardeningSchema();
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || businessDate).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const movements = safeAll(`
      SELECT sku, businessDate, sourceType, sourceId, SUM(qty) AS qty, SUM(totalCostPaise) AS cogsPaise
      FROM inventoryMovements
      WHERE tenantId=@tenantId AND branchId=@branchId AND movementType='out'
        AND businessDate BETWEEN @fromDate AND @toDate
      GROUP BY sku, businessDate, sourceType, sourceId
      ORDER BY businessDate ASC
    `, { tenantId, branchId, fromDate, toDate });
    const insert = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'inventory.cogs', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `);
    const summary = { fromDate, toDate, scanned: movements.length, enqueued: 0, duplicate: 0, skipped: 0, cogs: 0, events: [] };
    for (const movement of movements) {
      const cogsPaise = money(movement.cogsPaise);
      if (cogsPaise <= 0) {
        summary.skipped += 1;
        continue;
      }
      const eventKey = `inventory.cogs:${tenantId}:${branchId}:${movement.businessDate}:${movement.sku}:${movement.sourceType || "manual"}:${movement.sourceId || "none"}`;
      const result = insert.run({
        id: id("obx"),
        tenantId,
        branchId,
        eventKey,
        businessDate: movement.businessDate,
        payloadJson: JSON.stringify({
          sku: movement.sku,
          qty: Number(movement.qty || 0),
          cogsPaise,
          sourceType: movement.sourceType || "inventory",
          sourceId: movement.sourceId || "",
          memo: `COGS ${movement.sku}`
        })
      });
      if (result.changes === 1) {
        summary.enqueued += 1;
        summary.cogs += rupees(cogsPaise);
        summary.events.push({ sku: movement.sku, status: "enqueued", cogs: rupees(cogsPaise) });
      } else {
        summary.duplicate += 1;
      }
    }
    return summary;
  },

  postDailyAccruals(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const daily = this.dailyOperations({ branchId, asOfDate: businessDate }, access);
    const sourceId = `${tenantId}:${branchId}:${businessDate}`;
    const entries = [];
    const post = (key, memo, lines) => {
      const amount = lines.reduce((sum, line) => sum + money(line.debitPaise), 0);
      if (amount <= 0) return null;
      const entry = this.createJournal({
        branchId,
        businessDate,
        sourceType: key,
        sourceId,
        memo,
        idempotencyKey: `${key}:${sourceId}`,
        lines: lines.map((line) => ({ ...line, accountId: accountIdByCode(tenantId, branchId, line.code) }))
      }, access);
      entries.push({ key, memo, amount: rupees(amount), journalEntryId: entry.id });
      return entry;
    };
    post("salary.accrual", "Daily salary accrual", [
      { code: "5100", debitPaise: money(daily.salary * 100), memo: "Staff salary accrued" },
      { code: "2000", creditPaise: money(daily.salary * 100), memo: "Salary payable" }
    ]);
    post("rent.accrual", "Daily rent accrual", [
      { code: "5200", debitPaise: money(daily.dailyRent * 100), memo: "Daily rent allocated" },
      { code: "2000", creditPaise: money(daily.dailyRent * 100), memo: "Rent payable" }
    ]);
    post("commission.accrual", "Daily staff commission accrual", [
      { code: "5100", debitPaise: money(daily.commission * 100), memo: "Staff commission accrued" },
      { code: "2000", creditPaise: money(daily.commission * 100), memo: "Commission payable" }
    ]);
    post("gst.payable.accrual", "GST payable reclass from POS sales", [
      { code: "4000", debitPaise: money(daily.gst * 100), memo: "GST separated from sales" },
      { code: "2100", creditPaise: money(daily.gst * 100), memo: "GST payable" }
    ]);
    return { businessDate, posted: entries.length, entries };
  },

  runMonthCloseAutomation(payload = {}, access = {}) {
    const { branchId } = scope(access, payload.branchId || "");
    const period = String(payload.period || periodOf(payload.asOfDate || today())).slice(0, 7);
    const periodStart = new Date(`${period}-01T00:00:00Z`);
    const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const endDate = normalizeBusinessDate(payload.asOfDate || periodEnd, { allowFuture: true });
    const fromDate = `${period}-01`;
    const pos = this.syncPosToGl({ branchId, fromDate, toDate: endDate }, access);
    const purchases = this.syncPurchasesToGl({ branchId, fromDate, toDate: endDate }, access);
    const wallets = this.syncWalletCreditsToGl({ branchId, fromDate, toDate: endDate }, access);
    const payrollStatutory = this.syncPayrollStatutoryToGl({ branchId, asOfDate: endDate, month: period }, access);
    const fixedAssetPurchases = this.syncFixedAssetPurchasesToGl({ branchId, fromDate, toDate: endDate }, access);
    const cogs = this.syncInventoryCogs({ branchId, fromDate, toDate: endDate }, access);
    const accruals = this.postDailyAccruals({ branchId, asOfDate: endDate }, access);
    const snapshot = this.createSnapshot({ branchId, asOfDate: endDate }, access);
    return {
      period,
      fromDate,
      toDate: endDate,
      posToGl: pos,
      purchases,
      wallets,
      payrollStatutory,
      fixedAssetPurchases,
      inventoryCogs: cogs,
      accruals,
      snapshotId: snapshot.id,
      nextSteps: [
        "Process GL outbox chalao taaki queued POS/purchase/COGS journals post ho.",
        "Reconciliation run karo.",
        "Hardening tab se period lock karo jab checks clean ho."
      ]
    };
  },

  financeCopilot(payload = {}, access = {}) {
    const question = String(payload.question || "").trim();
    if (!question) throw badRequest("question is required");
    const branchId = payload.branchId || "";
    const asOfDate = normalizeBusinessDate(payload.asOfDate || today(), { allowFuture: true });
    const report = this.financeOs({ branchId, asOfDate }, access);
    const q = question.toLowerCase();
    let answer = "";
    const actions = [];
    if (q.includes("profit") || q.includes("kam") || q.includes("loss")) {
      answer = `Aaj sale ${rupeesToText(report.dailyProfit.sales)} hai aur tracked cost ke baad net ${rupeesToText(report.dailyProfit.netAfterTrackedCost)} hai. Major cost: salary ${rupeesToText(report.dailyProfit.salary)}, commission ${rupeesToText(report.dailyProfit.commission)}, product ${rupeesToText(report.dailyProfit.productConsumption)}, rent ${rupeesToText(report.dailyProfit.rent)}.`;
      if (report.dailyProfit.productConsumption === 0) actions.push("Service recipe/product consumption posting verify karo.");
      if (report.livePosToGl.difference !== 0) actions.push("POS to GL sync run karo.");
    } else if (q.includes("staff")) {
      const ranked = [...report.staffProfitability].sort((a, b) => b.netContribution - a.netContribution);
      const best = ranked[0];
      const weak = ranked[ranked.length - 1];
      answer = best
        ? `Best staff contribution ${best.name}: ${rupeesToText(best.netContribution)}. Lowest contribution ${weak?.name || best.name}: ${rupeesToText(weak?.netContribution || 0)}. Attendance aur salary allocation ko staff table me compare karo.`
        : "Aaj staff profitability ke liye invoice/staff/attendance data nahi mila.";
      actions.push("Staff attendance, salary profile aur commission rule complete rakho.");
    } else if (q.includes("service") || q.includes("loss")) {
      const weak = [...report.serviceMargins].sort((a, b) => a.marginPct - b.marginPct)[0];
      answer = weak
        ? `${weak.name} ka estimated margin ${weak.marginPct}% hai. Revenue ${rupeesToText(weak.revenue)}, product ${rupeesToText(weak.productCost)}, commission ${rupeesToText(weak.staffCommission)}.`
        : "Aaj service margin ke liye invoice line items nahi mile.";
      actions.push("Exact margin ke liye service recipe cost aur staff time-cost connect karo.");
    } else if (q.includes("gl") || q.includes("post") || q.includes("sync")) {
      answer = `POS sales ${rupeesToText(report.livePosToGl.posSales)} aur GL revenue ${rupeesToText(report.livePosToGl.glRevenue)} hai. Difference ${rupeesToText(report.livePosToGl.difference)}. Pending outbox ${report.livePosToGl.outboxPending}, failed ${report.livePosToGl.outboxFailed}.`;
      actions.push("Sync POS to GL chalao, phir Process GL outbox.");
    } else {
      answer = `Aaj ka finance snapshot: sale ${rupeesToText(report.dailyProfit.sales)}, tracked net ${rupeesToText(report.dailyProfit.netAfterTrackedCost)}, POS-GL gap ${rupeesToText(report.livePosToGl.difference)}, inventory gap ${rupeesToText(report.inventoryConsumption.difference)}.`;
      actions.push(...report.journalSuggestions.slice(0, 3).map((item) => item.action));
    }
    return { question, answer, actions, asOfDate, reportVersion: "finance-os-v2" };
  },

  ledger(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const accountId = String(query.accountId || "");
    if (!accountId) throw badRequest("accountId is required");
    const account = db.prepare("SELECT * FROM chartOfAccounts WHERE tenantId = ? AND branchId = ? AND id = ?").get(tenantId, branchId, accountId);
    if (!account) throw notFound("Account not found");
    const fromDate = String(query.fromDate || `${periodOf(today())}-01`).slice(0, 10);
    const toDate = normalizeBusinessDate(query.toDate, { allowFuture: true });
    let running = 0;
    const lines = db.prepare(`
      SELECT e.businessDate, e.sourceType, e.sourceId, e.memo, l.debitPaise, l.creditPaise, l.lineMemo
      FROM journalEntryLines l
      JOIN journalEntries e ON e.id = l.journalEntryId AND e.tenantId = l.tenantId
      WHERE l.tenantId = @tenantId AND l.branchId = @branchId AND l.accountId = @accountId
        AND e.status = 'posted' AND e.businessDate BETWEEN @fromDate AND @toDate
      ORDER BY e.businessDate ASC, e.createdAt ASC
    `).all({ tenantId, branchId, accountId, fromDate, toDate });
    return {
      account: rowAccount(account),
      fromDate,
      toDate,
      rows: lines.map((line) => {
        const movement = account.normalBalance === "credit"
          ? Number(line.creditPaise || 0) - Number(line.debitPaise || 0)
          : Number(line.debitPaise || 0) - Number(line.creditPaise || 0);
        running += movement;
        return {
          businessDate: line.businessDate,
          sourceType: line.sourceType,
          sourceId: line.sourceId,
          memo: line.lineMemo || line.memo,
          debit: rupees(line.debitPaise),
          credit: rupees(line.creditPaise),
          balance: rupees(running)
        };
      })
    };
  },

  createSnapshot(payload = {}, access = {}) {
    const sheet = this.live(payload, access);
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const snapshotId = id("bss");
    // Use authoritative paise totals — no rupees->paise round-trip rounding loss.
    db.prepare(`
      INSERT OR REPLACE INTO balanceSheetSnapshots
        (id, tenantId, branchId, asOfDate, totalAssetsPaise, totalLiabilitiesPaise, totalEquityPaise, payloadJson, createdAt)
      VALUES
        (@id, @tenantId, @branchId, @asOfDate, @totalAssetsPaise, @totalLiabilitiesPaise, @totalEquityPaise, @payloadJson, CURRENT_TIMESTAMP)
    `).run({
      id: snapshotId,
      tenantId,
      branchId,
      asOfDate: sheet.asOfDate,
      totalAssetsPaise: sheet.totalsPaise.assets,
      totalLiabilitiesPaise: sheet.totalsPaise.liabilities,
      totalEquityPaise: sheet.totalsPaise.equity,
      payloadJson: JSON.stringify(sheet)
    });
    return { id: snapshotId, ...sheet };
  },

  assertPeriodOpen(tenantId, branchId, date) {
    const locked = db.prepare("SELECT * FROM periodLocks WHERE tenantId = ? AND branchId = ? AND period = ?").get(tenantId, branchId, periodOf(date));
    if (locked) throw badRequest(`Accounting period ${periodOf(date)} is locked`);
  },

  accountBalances(tenantId, branchId, asOfDate) {
    seedChartOfAccounts(tenantId, branchId);
    if (!branchId) {
      return db.prepare(`
        SELECT MIN(a.id) AS id, a.code, MIN(a.name) AS name, a.accountType, a.accountSubType, a.normalBalance,
          COALESCE(SUM(l.debitPaise), 0) AS debitPaise,
          COALESCE(SUM(l.creditPaise), 0) AS creditPaise
        FROM chartOfAccounts a
        LEFT JOIN (
          journalEntryLines l
          JOIN journalEntries e
            ON e.id = l.journalEntryId
            AND e.tenantId = l.tenantId
            AND e.branchId = l.branchId
            AND e.status = 'posted'
            AND e.businessDate <= @asOfDate
        ) ON l.accountId = a.id AND l.tenantId = a.tenantId
        WHERE a.tenantId = @tenantId AND a.active = 1
        GROUP BY a.code, a.accountType, a.accountSubType, a.normalBalance
        ORDER BY a.code ASC
      `).all({ tenantId, asOfDate });
    }
    return db.prepare(`
      SELECT a.id, a.code, a.name, a.accountType, a.accountSubType, a.normalBalance,
        COALESCE(SUM(l.debitPaise), 0) AS debitPaise,
        COALESCE(SUM(l.creditPaise), 0) AS creditPaise
      FROM chartOfAccounts a
      LEFT JOIN (
        journalEntryLines l
        JOIN journalEntries e
          ON e.id = l.journalEntryId
          AND e.tenantId = l.tenantId
          AND e.branchId = l.branchId
          AND e.status = 'posted'
          AND e.businessDate <= @asOfDate
      ) ON l.accountId = a.id AND l.tenantId = a.tenantId AND l.branchId = a.branchId
      WHERE a.tenantId = @tenantId AND a.branchId = @branchId AND a.active = 1
      GROUP BY a.id
      ORDER BY a.code ASC
    `).all({ tenantId, branchId, asOfDate });
  },

  statementRow(row) {
    return {
      code: row.code,
      name: row.name,
      accountSubType: row.accountSubType,
      balance: rupees(row.balancePaise),
      balancePaise: row.balancePaise
    };
  },

  balanceAlerts(assets, liabilities, equity, difference) {
    const alerts = [];
    if (difference !== 0) alerts.push({ severity: "critical", title: "Balance sheet not balanced", message: "Assets must equal liabilities plus equity." });
    if (assets <= 0) alerts.push({ severity: "warning", title: "No asset balance", message: "Opening balance or journal sync may be pending." });
    if (liabilities > assets) alerts.push({ severity: "warning", title: "High liability pressure", message: "Liabilities are greater than assets." });
    return alerts;
  }
};
