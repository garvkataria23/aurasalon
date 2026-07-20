import { db } from "../db.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";
import * as XLSX from "xlsx";

const DATE = /^\d{4}-\d{2}-\d{2}$/;
const DAY = 86_400_000;
const SALE_EXCLUSIONS = ["draft", "cancelled", "canceled", "void", "voided", "refunded", "deleted"];
const REPORTS = Object.freeze([
  { key: "sales-summary", category: "sales", title: "Sales summary", description: "Invoice-linked sales, discounts and taxes.", available: true },
  { key: "appointments", category: "appointments", title: "Appointments", description: "Appointment volume and recorded status.", available: true },
  { key: "client-visits", category: "clients", title: "Client visits", description: "Clients with appointments in the selected period.", available: true },
  { key: "staff-contribution", category: "staff", title: "Staff contribution", description: "Sale-level revenue attributed to the recorded sale staff member.", available: true },
  { key: "inventory-history", category: "inventory", title: "Historical inventory valuation", description: "Historical stock value at the selected period.", available: false, reason: "A complete tenant-scoped historical inventory valuation source is not available." },
  { key: "branch-performance", category: "branch", title: "Branch performance", description: "Comparable sales and appointment totals by accessible branch.", available: true },
  { key: "profitability", category: "sales", title: "Profitability", description: "Revenue after complete cost and expense coverage.", available: false, reason: "Complete cost and expense coverage cannot be proven for this period." },
  { key: "service-product-mix", category: "sales", title: "Service & product mix", description: "Revenue split by sold item type.", available: false, reason: "Sale item classification is not an authoritative revenue ledger." }
]);

const text = (value) => String(value ?? "").trim();
const paise = (value) => Math.round(Number(value || 0) * 100);
const dateSql = (column) => `CASE WHEN ${column} GLOB '*Z' OR ${column} GLOB '*[+-][0-9][0-9]:[0-9][0-9]' THEN date(${column}, '+5 hours', '+30 minutes') ELSE substr(${column}, 1, 10) END`;
const columns = (table) => new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
const has = (table, required) => { const available = columns(table); return required.every((name) => available.has(name)); };
const parseArray = (value) => { try { const parsed = Array.isArray(value) ? value : JSON.parse(value || "[]"); return Array.isArray(parsed) ? parsed : []; } catch { return []; } };

function invoiceLayout() {
  const available = columns("invoices");
  const column = (names, fallback = "NULL") => names.find((name) => available.has(name)) ? `i.${names.find((name) => available.has(name))}` : fallback;
  const enterprise = available.has("tenant_id") ? "NULLIF(trim(i.tenant_id),'') IS NOT NULL" : "0";
  const select = (enterpriseName, legacyNames, fallback = "NULL") => available.has(enterpriseName)
    ? `CASE WHEN ${enterprise} THEN i.${enterpriseName} ELSE ${column(legacyNames, fallback)} END`
    : column(legacyNames, fallback);
  return {
    enterprise,
    tenant: select("tenant_id", ["tenantId"]),
    branch: select("branch_id", ["branchId"], "s.branchId"),
    invoiceNumber: select("invoice_no", ["invoiceNumber"]),
    customerId: select("customer_id", ["clientId"], "s.clientId"),
    subtotal: available.has("subtotal") ? `CASE WHEN ${enterprise} THEN i.subtotal ELSE COALESCE(s.subtotal,0) END` : "COALESCE(s.subtotal,0)",
    discount: select("discount_total", ["discount", "discountTotal"], "s.discount"),
    tax: select("tax_total", ["gstAmount", "taxTotal"], "s.gstAmount"),
    tip: select("tip_total", ["tipTotal"], "0"),
    grandTotal: select("grand_total", ["total", "grandTotal"], "s.total"),
    paid: select("paid_amount", ["paid", "paidAmount"], "0"),
    due: select("due_amount", ["balance", "dueAmount"], "0"),
    createdAt: select("created_at", ["createdAt"], "s.createdAt"),
    dueDate: column(["dueDate", "due_date"], "NULL"),
    status: column(["status"], "''"),
    saleJoin: available.has("saleId") ? "LEFT JOIN sales s ON s.id=i.saleId AND s.tenantId=@tenantId" : "LEFT JOIN sales s ON 0"
  };
}

const exclusionParams = () => Object.fromEntries(SALE_EXCLUSIONS.map((value, i) => [`excluded${i}`, value]));
const exclusionSql = (status) => `lower(COALESCE(${status},'')) NOT IN (${SALE_EXCLUSIONS.map((_, i) => `@excluded${i}`).join(",")})`;

function validDate(value, field) {
  const result = text(value);
  if (!DATE.test(result)) throw badRequest(`${field} must use YYYY-MM-DD format`);
  const [year, month, day] = result.split("-").map(Number);
  if (new Date(Date.UTC(year, month - 1, day)).toISOString().slice(0, 10) !== result) throw badRequest(`${field} is not a valid calendar date`);
  return result;
}

function addDays(value, amount) { return new Date(Date.parse(`${value}T00:00:00Z`) + amount * DAY).toISOString().slice(0, 10); }
function scopeList(ids, column, prefix) {
  const params = {};
  const tokens = ids.map((id, index) => { params[`${prefix}${index}`] = id; return `@${prefix}${index}`; });
  return { sql: `${column} IN (${tokens.join(",")})`, params };
}

function ownerContext(access, query) {
  const owner = db.prepare(`SELECT role, status, branchIds FROM tenant_users WHERE tenantId = @tenantId AND id = @userId`).get({ tenantId: text(access?.tenantId), userId: text(access?.userId) });
  if (!owner || text(owner.role).toLowerCase() !== "owner" || text(owner.status).toLowerCase() !== "active") throw forbidden("Active owner access is required");
  const assigned = [...new Set(parseArray(owner.branchIds).map(text).filter(Boolean))];
  if (!assigned.length) throw forbidden("This owner has no assigned branches");
  const branchScope = scopeList(assigned, "id", "assignedBranch");
  if (!columns("branches").has("tenantId")) throw forbidden("Tenant-scoped branch access is unavailable");
  const branches = db.prepare(`SELECT id, name, city FROM branches WHERE tenantId = @tenantId AND ${branchScope.sql} ORDER BY name, id`).all({ tenantId: access.tenantId, ...branchScope.params });
  const requested = text(query.branchId);
  if (!requested) throw badRequest("branchId is required");
  const selected = requested.toLowerCase() === "all" ? branches : branches.filter((branch) => branch.id === requested);
  if (!selected.length || (requested.toLowerCase() !== "all" && selected.length !== 1)) throw forbidden("The selected branch is not assigned to this owner");
  const from = validDate(query.from, "from");
  const to = validDate(query.to, "to");
  if (from > to) throw badRequest("from must be on or before to");
  const days = Math.round((Date.parse(`${to}T00:00:00Z`) - Date.parse(`${from}T00:00:00Z`)) / DAY) + 1;
  if (days > 366) throw badRequest("Date range cannot exceed 366 calendar days");
  return { tenantId: access.tenantId, branches: selected, branchIds: selected.map((branch) => branch.id), branchLabel: requested.toLowerCase() === "all" ? "All assigned branches" : selected[0].name, from, to, previousFrom: addDays(from, -days), previousTo: addDays(from, -1), days };
}

function sourceAvailability() {
  const legacyPayments = has("payments", ["tenantId", "invoiceId", "mode", "amount", "createdAt"])
    && has("invoices", ["id", "tenantId", "saleId", "invoiceNumber"])
    && has("sales", ["id", "tenantId", "branchId"]);
  const enterprisePayments = has("invoice_payments", ["tenant_id", "invoice_id", "payment_mode", "amount", "status", "paid_at", "created_at"])
    && has("invoices", ["id", "tenant_id", "branch_id", "invoice_no"]);
  const invoiceColumns = columns("invoices");
  const invoiceSource = invoiceColumns.has("id") && invoiceColumns.has("status")
    && ((has("invoices", ["tenant_id", "branch_id", "invoice_no", "subtotal", "discount_total", "tax_total", "grand_total", "paid_amount", "due_amount", "created_at"]))
      || has("invoices", ["tenantId", "saleId", "invoiceNumber", "total", "paid", "balance", "createdAt"]));
  const enterpriseRefunds = has("invoice_refunds", ["id", "tenant_id", "invoice_id", "amount", "reason", "status", "created_at"])
    && has("invoices", ["id", "tenant_id", "branch_id", "status"]);
  const tips = has("invoice_tips", ["id", "tenant_id", "invoice_id", "amount", "created_at"])
    && has("invoices", ["id", "tenant_id", "branch_id", "status"]);
  return {
    sales: { available: invoiceSource, reason: null },
    payments: { available: legacyPayments || enterprisePayments, reason: null },
    invoices: { available: invoiceSource, reason: null },
    refunds: { available: enterpriseRefunds || has("finance_refunds", ["tenantId", "branchId", "invoiceId", "amount", "status", "createdAt"]), reason: null },
    expenses: { available: has("finance_expenses", ["tenantId", "branchId", "amount", "taxAmount", "status", "paidAt", "createdAt"]), reason: null },
    creditNotes: { available: has("credit_notes", ["tenantId", "branchId", "creditNoteNumber", "amount", "status", "createdAt"]), reason: null },
    tips: { available: tips, reason: null },
    appointments: { available: has("appointments", ["tenantId", "branchId", "staffId", "clientId", "status", "startAt"]), reason: null }
  };
}

function unavailableReasons(availability) {
  for (const [key, value] of Object.entries(availability)) if (!value.available) value.reason = `The ${key} schema is not compatible with this scoped report.`;
  return availability;
}

function resolvedReports() {
  const availability = unavailableReasons(sourceAvailability());
  return REPORTS.map((report) => {
    if (!report.available) return report;
    const source = report.key === "appointments" || report.key === "client-visits" ? availability.appointments : report.key === "branch-performance" ? { available: availability.sales.available || availability.appointments.available, reason: "Neither sales nor appointment data is available for branch performance." } : availability.sales;
    return source.available ? report : { ...report, available: false, reason: source.reason };
  });
}

function salesRows(ctx, from = ctx.from, to = ctx.to) {
  const layout = invoiceLayout();
  const scope = scopeList(ctx.branchIds, layout.branch, "saleBranch");
  const businessDate = dateSql(layout.createdAt);
  return db.prepare(`SELECT i.id,${layout.branch} AS branchId,b.name AS branchName,${layout.customerId} AS clientId,COALESCE(c.name,'') AS clientName,
    s.staffId,COALESCE(st.name,'') AS staffName,COALESCE(${layout.subtotal},0) AS subtotal,COALESCE(${layout.discount},0) AS discount,
    COALESCE(${layout.tax},0) AS gstAmount,MAX(0,COALESCE(${layout.subtotal},0)-COALESCE(${layout.discount},0)) AS total,${layout.status} AS status,${businessDate} AS businessDate
    FROM invoices i ${layout.saleJoin} LEFT JOIN branches b ON b.id=${layout.branch} AND b.tenantId=@tenantId
    LEFT JOIN clients c ON c.id=${layout.customerId} AND c.tenantId=@tenantId LEFT JOIN staff st ON st.id=s.staffId AND st.tenantId=@tenantId
    WHERE ${layout.tenant}=@tenantId AND ${scope.sql} AND ${businessDate} BETWEEN @from AND @to AND ${exclusionSql(layout.status)}
    ORDER BY ${layout.createdAt} DESC,i.id DESC`).all({ tenantId: ctx.tenantId, ...scope.params, from, to, ...exclusionParams() });
}

function paymentRows(ctx) {
  const rows = [];
  const layout = invoiceLayout();
  const enterpriseAvailable = has("invoice_payments", ["tenant_id", "invoice_id", "payment_mode", "amount", "status", "paid_at", "created_at"])
    && has("invoices", ["id", "tenant_id", "branch_id", "invoice_no"]);
  if (has("payments", ["tenantId", "invoiceId", "mode", "amount", "createdAt"])) {
    const scope = scopeList(ctx.branchIds, layout.branch, "paymentBranch");
    const businessDate = dateSql("p.createdAt");
    const noEnterprisePayment = enterpriseAvailable ? "AND NOT EXISTS (SELECT 1 FROM invoice_payments ep WHERE ep.tenant_id=@tenantId AND ep.invoice_id=i.id)" : "";
    rows.push(...db.prepare(`SELECT p.id,${layout.branch} AS branchId,b.name AS branchName,${layout.invoiceNumber} AS invoiceNumber,p.mode,p.amount,COALESCE(p.reference,'') AS reference,${businessDate} AS businessDate
      FROM payments p JOIN invoices i ON i.id=p.invoiceId ${layout.saleJoin} LEFT JOIN branches b ON b.id=${layout.branch} AND b.tenantId=@tenantId
      WHERE p.tenantId=@tenantId AND ${layout.tenant}=@tenantId AND ${scope.sql} AND ${businessDate} BETWEEN @from AND @to
        AND ${exclusionSql(layout.status)} ${noEnterprisePayment}`).all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to, ...exclusionParams() }));
  }
  if (enterpriseAvailable) {
    const scope = scopeList(ctx.branchIds, "i.branch_id", "enterprisePaymentBranch");
    const businessDate = dateSql("COALESCE(NULLIF(ip.paid_at,''),ip.created_at)");
    rows.push(...db.prepare(`SELECT ip.id, i.branch_id AS branchId, b.name AS branchName, i.invoice_no AS invoiceNumber, ip.payment_mode AS mode,
      COALESCE(ip.amount,0) AS amount, COALESCE(ip.reference_no,'') AS reference, ${businessDate} AS businessDate
      FROM invoice_payments ip JOIN invoices i ON i.id=ip.invoice_id AND i.tenant_id=ip.tenant_id LEFT JOIN branches b ON b.id=i.branch_id AND b.tenantId=ip.tenant_id
      WHERE ip.tenant_id=@tenantId AND ${scope.sql} AND lower(COALESCE(ip.status,'paid'))='paid' AND ${businessDate} BETWEEN @from AND @to
        AND ${exclusionSql("i.status")}`).all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to, ...exclusionParams() }));
  }
  return rows.sort((a, b) => String(b.businessDate).localeCompare(String(a.businessDate)) || String(b.id).localeCompare(String(a.id)));
}

function invoiceRows(ctx) {
  const layout = invoiceLayout();
  const scope = scopeList(ctx.branchIds, layout.branch, "invoiceBranch");
  const businessDate = dateSql(layout.createdAt);
  return db.prepare(`SELECT i.id,${layout.branch} AS branchId,b.name AS branchName,${layout.invoiceNumber} AS invoiceNumber,COALESCE(c.name,'') AS clientName,
    COALESCE(${layout.grandTotal},0) AS total,COALESCE(${layout.paid},0) AS paid,COALESCE(${layout.due},0) AS balance,${layout.status} AS status,${layout.dueDate} AS dueDate,${businessDate} AS businessDate
    FROM invoices i ${layout.saleJoin} LEFT JOIN branches b ON b.id=${layout.branch} AND b.tenantId=@tenantId LEFT JOIN clients c ON c.id=${layout.customerId} AND c.tenantId=@tenantId
    WHERE ${layout.tenant}=@tenantId AND ${scope.sql} AND ${businessDate} BETWEEN @from AND @to AND ${exclusionSql(layout.status)}
    ORDER BY ${layout.createdAt} DESC,i.id DESC`).all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to, ...exclusionParams() });
}

function refundRows(ctx) {
  const rows = [];
  const layout = invoiceLayout();
  const enterpriseAvailable = has("invoice_refunds", ["id", "tenant_id", "invoice_id", "amount", "reason", "status", "created_at"])
    && has("invoices", ["id", "tenant_id", "branch_id", "status"]);
  if (enterpriseAvailable) {
    const refundColumns = columns("invoice_refunds");
    const paymentJoin = refundColumns.has("payment_id") && has("invoice_payments", ["id", "tenant_id", "payment_mode"])
      ? "LEFT JOIN invoice_payments ip ON ip.id=ir.payment_id AND ip.tenant_id=ir.tenant_id" : "";
    const refundType = refundColumns.has("refund_type") ? "ir.refund_type" : "''";
    const mode = paymentJoin ? `COALESCE(ip.payment_mode,${refundType},'')` : `COALESCE(${refundType},'')`;
    const processedAt = refundColumns.has("processed_at") ? "COALESCE(NULLIF(ir.processed_at,''),ir.created_at)" : "ir.created_at";
    const businessDate = dateSql(processedAt);
    const scope = scopeList(ctx.branchIds, "i.branch_id", "enterpriseRefundBranch");
    rows.push(...db.prepare(`SELECT ir.id,i.branch_id AS branchId,b.name AS branchName,ir.invoice_id AS invoiceId,ir.amount,${mode} AS mode,ir.reason,ir.status,${businessDate} AS businessDate
      FROM invoice_refunds ir JOIN invoices i ON i.id=ir.invoice_id AND i.tenant_id=ir.tenant_id ${paymentJoin} LEFT JOIN branches b ON b.id=i.branch_id AND b.tenantId=ir.tenant_id
      WHERE ir.tenant_id=@tenantId AND ${scope.sql} AND ${businessDate} BETWEEN @from AND @to AND ${exclusionSql("i.status")}`)
      .all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to, ...exclusionParams() }));
  }
  if (has("finance_refunds", ["tenantId", "branchId", "invoiceId", "amount", "status", "createdAt"])) {
    const scope = scopeList(ctx.branchIds, "r.branchId", "legacyRefundBranch");
    const businessDate = dateSql("r.createdAt");
    const noEnterpriseRefund = enterpriseAvailable ? "AND NOT EXISTS (SELECT 1 FROM invoice_refunds er WHERE er.tenant_id=@tenantId AND er.invoice_id=r.invoiceId)" : "";
    rows.push(...db.prepare(`SELECT r.id,r.branchId,b.name AS branchName,r.invoiceId,r.amount,r.mode,r.reason,r.status,${businessDate} AS businessDate
      FROM finance_refunds r LEFT JOIN branches b ON b.id=r.branchId AND b.tenantId=r.tenantId
      WHERE r.tenantId=@tenantId AND ${scope.sql} AND ${businessDate} BETWEEN @from AND @to ${noEnterpriseRefund}`)
      .all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to }));
  }
  return rows.sort((a, b) => String(b.businessDate).localeCompare(String(a.businessDate)) || String(b.id).localeCompare(String(a.id)));
}

function tipRows(ctx) {
  if (!sourceAvailability().tips.available) return [];
  const businessDate = dateSql("it.created_at");
  const scope = scopeList(ctx.branchIds, "i.branch_id", "tipBranch");
  return db.prepare(`SELECT it.id,i.branch_id AS branchId,COALESCE(it.amount,0) AS amount,${businessDate} AS businessDate
    FROM invoice_tips it JOIN invoices i ON i.id=it.invoice_id AND i.tenant_id=it.tenant_id
    WHERE it.tenant_id=@tenantId AND ${scope.sql} AND ${businessDate} BETWEEN @from AND @to AND ${exclusionSql("i.status")}`)
    .all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to, ...exclusionParams() });
}

function simpleRows(ctx, table, fields, dateColumn) {
  const scope = scopeList(ctx.branchIds, "r.branchId", `${table}Branch`);
  const businessDate = dateSql(`COALESCE(NULLIF(r.${dateColumn},''),r.createdAt)`);
  return db.prepare(`SELECT ${fields},b.name AS branchName,${businessDate} AS businessDate FROM ${table} r LEFT JOIN branches b ON b.id=r.branchId AND b.tenantId=r.tenantId
    WHERE r.tenantId=@tenantId AND ${scope.sql} AND ${businessDate} BETWEEN @from AND @to ORDER BY businessDate DESC,r.id DESC`).all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to });
}

function metric(current, previous, available, reason = null) {
  if (!available) return { currentPaise: null, previousPaise: null, deltaPercent: null, availability: { available: false, reason } };
  return { currentPaise: current, previousPaise: previous, deltaPercent: previous === null || previous === 0 ? null : Math.round(((current - previous) / previous) * 10000) / 100, availability: { available: true, reason: null } };
}

function financeData(access, query) {
  const ctx = ownerContext(access, query);
  const availability = unavailableReasons(sourceAvailability());
  const sales = availability.sales.available ? salesRows(ctx) : [];
  const priorSales = availability.sales.available ? salesRows(ctx, ctx.previousFrom, ctx.previousTo) : [];
  const invoices = availability.invoices.available ? invoiceRows(ctx) : [];
  const payments = availability.payments.available ? paymentRows(ctx) : [];
  const refunds = availability.refunds.available ? refundRows(ctx) : [];
  const expenses = availability.expenses.available ? simpleRows(ctx, "finance_expenses", "r.id,r.branchId,r.category,r.vendor,r.amount,r.taxAmount,r.paymentMode,r.status", "paidAt") : [];
  const creditNotes = availability.creditNotes.available ? simpleRows(ctx, "credit_notes", "r.id,r.branchId,r.creditNoteNumber,r.amount,r.reason,r.status", "createdAt") : [];
  const tips = availability.tips.available ? tipRows(ctx) : [];
  const gross = sales.reduce((sum, row) => sum + paise(row.subtotal), 0);
  const net = sales.reduce((sum, row) => sum + paise(row.total), 0);
  const priorGross = priorSales.reduce((sum, row) => sum + paise(row.subtotal), 0);
  const priorNet = priorSales.reduce((sum, row) => sum + paise(row.total), 0);
  const collected = payments.filter((row) => Number(row.amount) > 0).reduce((sum, row) => sum + paise(row.amount), 0);
  const outstanding = invoices.reduce((sum, row) => sum + Math.max(0, paise(row.balance)), 0);
  const refundTotal = refunds.filter((row) => !["pending", "pending_approval", "cancelled", "canceled", "void", "voided", "rejected", "failed"].includes(text(row.status).toLowerCase())).reduce((sum, row) => sum + paise(row.amount), 0);
  const expenseTotal = expenses.filter((row) => !["cancelled", "canceled", "void", "rejected"].includes(text(row.status).toLowerCase())).reduce((sum, row) => sum + paise(row.amount), 0);
  const creditNoteTotal = creditNotes.filter((row) => !["draft", "cancelled", "canceled", "void", "voided", "rejected"].includes(text(row.status).toLowerCase())).reduce((sum, row) => sum + paise(row.amount), 0);
  const tipTotal = tips.reduce((sum, row) => sum + paise(row.amount), 0);
  const discounts = sales.reduce((sum, row) => sum + paise(row.discount), 0);
  const taxes = sales.reduce((sum, row) => sum + paise(row.gstAmount), 0);
  const trendMap = new Map();
  for (const row of sales) trendMap.set(row.businessDate, (trendMap.get(row.businessDate) || 0) + paise(row.total));
  const paymentMap = new Map();
  for (const row of payments.filter((item) => Number(item.amount) > 0)) paymentMap.set(text(row.mode).toLowerCase() || "unspecified", (paymentMap.get(text(row.mode).toLowerCase() || "unspecified") || 0) + paise(row.amount));
  const branchRows = ctx.branches.map((branch) => { const own = sales.filter((row) => row.branchId === branch.id); return { branchId: branch.id, branchName: branch.name, grossSalesPaise: own.reduce((sum, row) => sum + paise(row.subtotal), 0), netRevenuePaise: own.reduce((sum, row) => sum + paise(row.total), 0), invoiceCount: own.length }; });
  const warnings = Object.entries(availability).filter(([, value]) => !value.available).map(([source, value]) => ({ source, message: value.reason }));
  return {
    context: { branchId: text(query.branchId), branchLabel: ctx.branchLabel, from: ctx.from, to: ctx.to, timezone: "Asia/Kolkata", generatedAt: new Date().toISOString() },
    kpis: {
      grossSales: metric(gross, priorGross, availability.sales.available, availability.sales.reason),
      netRevenue: metric(net, priorNet, availability.sales.available, availability.sales.reason),
      cashCollected: metric(collected, null, availability.payments.available, availability.payments.reason),
      outstanding: metric(outstanding, null, availability.invoices.available, availability.invoices.reason),
      refunds: metric(refundTotal, null, availability.refunds.available, availability.refunds.reason),
      expenses: metric(expenseTotal, null, availability.expenses.available, availability.expenses.reason),
      taxes: metric(taxes, null, availability.sales.available, availability.sales.reason),
      discounts: metric(discounts, null, availability.sales.available, availability.sales.reason),
      profit: metric(null, null, false, "Complete cost and expense coverage cannot be proven."),
      tips: metric(tipTotal, null, availability.tips.available, availability.tips.reason)
    },
    trend: [...trendMap.entries()].sort(([a], [b]) => a.localeCompare(b)).map(([date, netRevenuePaise]) => ({ date, netRevenuePaise })),
    paymentMethods: [...paymentMap.entries()].sort((a, b) => b[1] - a[1]).map(([method, amountPaise]) => ({ method, amountPaise })),
    breakdown: { grossSalesPaise: gross, discountsPaise: discounts, taxesPaise: taxes, netRevenuePaise: net, cashCollectedPaise: collected, outstandingPaise: outstanding, refundsPaise: refundTotal, expensesPaise: expenseTotal, creditNotesPaise: availability.creditNotes.available ? creditNoteTotal : null, tipsPaise: availability.tips.available ? tipTotal : null, serviceRevenuePaise: null, productRevenuePaise: null, membershipRevenuePaise: null, packageRevenuePaise: null },
    branchComparison: branchRows,
    drilldowns: { grossSales: "sales", netRevenue: "sales", cashCollected: "payments", outstanding: "outstanding", refunds: availability.refunds.available ? "refunds" : null, expenses: availability.expenses.available ? "expenses" : null, creditNotes: availability.creditNotes.available ? "creditNotes" : null, taxes: "sales", discounts: "sales", profit: null, tips: null },
    availability: { ...availability, profit: { available: false, reason: "Complete cost and expense coverage cannot be proven." }, itemRevenueMix: { available: false, reason: "Sale item classification is not an authoritative revenue ledger." } },
    partial: warnings.length > 0,
    warnings
  };
}

const drillColumns = {
  sales: ["businessDate", "branchName", "clientName", "staffName", "status", "subtotalPaise", "discountPaise", "taxPaise", "totalPaise"],
  payments: ["businessDate", "branchName", "invoiceNumber", "mode", "reference", "amountPaise"],
  outstanding: ["businessDate", "branchName", "invoiceNumber", "clientName", "dueDate", "status", "totalPaise", "paidPaise", "balancePaise"],
  refunds: ["businessDate", "branchName", "invoiceId", "mode", "reason", "status", "amountPaise"],
  expenses: ["businessDate", "branchName", "category", "vendor", "paymentMode", "status", "amountPaise", "taxAmountPaise"],
  creditNotes: ["businessDate", "branchName", "creditNoteNumber", "reason", "status", "amountPaise"]
};

function normalizedDrillRows(access, query) {
  const ctx = ownerContext(access, query); const type = text(query.type);
  if (!drillColumns[type]) throw badRequest("Unsupported drill-down type");
  const availability = unavailableReasons(sourceAvailability());
  let rows = [];
  if (type === "sales" && availability.sales.available) rows = salesRows(ctx).map((r) => ({ id: r.id, businessDate: r.businessDate, branchName: r.branchName, clientName: r.clientName, staffName: r.staffName, status: r.status, subtotalPaise: paise(r.subtotal), discountPaise: paise(r.discount), taxPaise: paise(r.gstAmount), totalPaise: paise(r.total) }));
  if (type === "payments" && availability.payments.available) rows = paymentRows(ctx).map((r) => ({ id: r.id, businessDate: r.businessDate, branchName: r.branchName, invoiceNumber: r.invoiceNumber, mode: r.mode, reference: r.reference, amountPaise: paise(r.amount) }));
  if (type === "outstanding" && availability.invoices.available) rows = invoiceRows(ctx).filter((r) => Number(r.balance) > 0).map((r) => ({ id: r.id, businessDate: r.businessDate, branchName: r.branchName, invoiceNumber: r.invoiceNumber, clientName: r.clientName, dueDate: r.dueDate, status: r.status, totalPaise: paise(r.total), paidPaise: paise(r.paid), balancePaise: paise(r.balance) }));
  if (type === "refunds" && availability.refunds.available) rows = refundRows(ctx).map((r) => ({ id: r.id, businessDate: r.businessDate, branchName: r.branchName, invoiceId: r.invoiceId, mode: r.mode, reason: r.reason, status: r.status, amountPaise: paise(r.amount) }));
  if (type === "expenses" && availability.expenses.available) rows = simpleRows(ctx, "finance_expenses", "r.id,r.branchId,r.category,r.vendor,r.amount,r.taxAmount,r.paymentMode,r.status", "paidAt").map((r) => ({ id: r.id, businessDate: r.businessDate, branchName: r.branchName, category: r.category, vendor: r.vendor, paymentMode: r.paymentMode, status: r.status, amountPaise: paise(r.amount), taxAmountPaise: paise(r.taxAmount) }));
  if (type === "creditNotes" && availability.creditNotes.available) rows = simpleRows(ctx, "credit_notes", "r.id,r.branchId,r.creditNoteNumber,r.amount,r.reason,r.status", "createdAt").map((r) => ({ id: r.id, businessDate: r.businessDate, branchName: r.branchName, creditNoteNumber: r.creditNoteNumber, reason: r.reason, status: r.status, amountPaise: paise(r.amount) }));
  const source = type === "outstanding" ? "invoices" : type;
  const sourceState = availability[source] || { available: false, reason: "This report source is unavailable." };
  const status = text(query.status).toLowerCase(), method = text(query.paymentMethod).toLowerCase(), search = text(query.search).toLowerCase();
  rows = rows.filter((row) => (!status || text(row.status).toLowerCase() === status) && (!method || text(row.mode || row.paymentMode).toLowerCase() === method) && (!search || text(row.id).toLowerCase().includes(search) || drillColumns[type].some((key) => text(row[key]).toLowerCase().includes(search))));
  const sortBy = drillColumns[type].includes(text(query.sortBy)) ? text(query.sortBy) : "businessDate"; const direction = text(query.sortDirection).toLowerCase() === "asc" ? 1 : -1;
  rows.sort((a, b) => String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""), "en", { numeric: true }) * direction);
  return { ctx, type, rows, columns: drillColumns[type], availability: sourceState };
}

function paginate(rows, query) { const page = Math.max(1, Number.parseInt(query.page, 10) || 1); const pageSize = Math.min(100, Math.max(10, Number.parseInt(query.pageSize, 10) || 25)); return { rows: rows.slice((page - 1) * pageSize, page * pageSize), pagination: { page, pageSize, total: rows.length, pages: Math.ceil(rows.length / pageSize) } }; }
const typedColumns = (keys) => keys.map((key) => ({ key, label: key.replace(/Paise$/, "").replace(/([A-Z])/g, " $1").replace(/^./, (c) => c.toUpperCase()), type: key.endsWith("Paise") ? "money" : key.toLowerCase().includes("date") ? "date" : /count$|^(appointments|visits|clients|completed)$/i.test(key) ? "number" : "text", sortable: true }));

function filteredReportSummary(key, rows, availability) {
  if (key === "sales-summary") {
    const totals = { grossSalesPaise: rows.reduce((s, r) => s + r.grossSalesPaise, 0), discountsPaise: rows.reduce((s, r) => s + r.discountsPaise, 0), taxesPaise: rows.reduce((s, r) => s + r.taxesPaise, 0), netRevenuePaise: rows.reduce((s, r) => s + r.netRevenuePaise, 0) };
    const grouped = new Map(); for (const row of rows) grouped.set(row.businessDate, (grouped.get(row.businessDate) || 0) + row.netRevenuePaise);
    return { totals, series: [...grouped].sort(([a], [b]) => a.localeCompare(b)).map(([label, value]) => ({ label, value })) };
  }
  if (key === "appointments") return { totals: { appointments: rows.length, completed: rows.filter((r) => ["completed", "billed", "paid"].includes(text(r.status).toLowerCase())).length }, series: [] };
  if (key === "client-visits") return { totals: { clients: rows.length, visits: rows.reduce((s, r) => s + r.visits, 0) }, series: [] };
  if (key === "staff-contribution") return { totals: { saleCount: rows.reduce((s, r) => s + r.saleCount, 0), netRevenuePaise: rows.reduce((s, r) => s + r.netRevenuePaise, 0) }, series: [] };
  if (key === "branch-performance") return { totals: { saleCount: rows.reduce((s, r) => s + r.saleCount, 0), netRevenuePaise: availability.sales.available ? rows.reduce((s, r) => s + r.netRevenuePaise, 0) : null, appointments: availability.appointments.available ? rows.reduce((s, r) => s + r.appointments, 0) : null }, series: [] };
  return { totals: {}, series: [] };
}

function reportData(access, key, query, exportAll = false) {
  const catalogue = resolvedReports().find((item) => item.key === key);
  if (!catalogue) throw notFound("Report not found");
  const ctx = ownerContext(access, query);
  if (!catalogue.available) return { metadata: { ...catalogue, from: ctx.from, to: ctx.to, branchLabel: ctx.branchLabel }, totals: {}, series: [], columns: [], rows: [], pagination: { page: 1, pageSize: 0, total: 0, pages: 0 }, availability: { available: false, reason: catalogue.reason } };
  const availability = unavailableReasons(sourceAvailability()); let rows = []; let keys = []; let totals = {}; let series = [];
  if (key === "sales-summary") {
    if (!availability.sales.available) return unavailableReport(catalogue, ctx, availability.sales.reason);
    rows = salesRows(ctx).map((r) => ({ id: r.id, businessDate: r.businessDate, branchName: r.branchName, clientName: r.clientName, staffName: r.staffName, status: r.status, grossSalesPaise: paise(r.subtotal), discountsPaise: paise(r.discount), taxesPaise: paise(r.gstAmount), netRevenuePaise: paise(r.total) }));
    keys = ["businessDate", "branchName", "clientName", "staffName", "status", "grossSalesPaise", "discountsPaise", "taxesPaise", "netRevenuePaise"];
  } else if (key === "appointments" || key === "client-visits") {
    if (!availability.appointments.available) return unavailableReport(catalogue, ctx, availability.appointments.reason);
    const scope = scopeList(ctx.branchIds, "a.branchId", "appointmentReportBranch"); const day = dateSql("a.startAt");
    const raw = db.prepare(`SELECT a.id,a.branchId,${day} AS businessDate,b.name AS branchName,COALESCE(c.name,'') AS clientName,COALESCE(st.name,'') AS staffName,a.status,a.source,a.clientId FROM appointments a LEFT JOIN branches b ON b.id=a.branchId AND b.tenantId=a.tenantId LEFT JOIN clients c ON c.id=a.clientId AND c.tenantId=a.tenantId LEFT JOIN staff st ON st.id=a.staffId AND st.tenantId=a.tenantId WHERE a.tenantId=@tenantId AND ${scope.sql} AND ${day} BETWEEN @from AND @to ORDER BY a.startAt DESC`).all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to });
    if (key === "appointments") { rows = raw; keys = ["businessDate", "branchName", "clientName", "staffName", "status", "source"]; }
    else { const map = new Map(); for (const row of raw) { const id = `${row.branchId}:${row.clientId || "unknown"}`; const current = map.get(id) || { clientId: row.clientId, clientName: row.clientName, branchName: row.branchName, visits: 0, lastVisitDate: "" }; current.visits++; if (row.businessDate > current.lastVisitDate) current.lastVisitDate = row.businessDate; map.set(id, current); } rows = [...map.values()]; keys = ["clientName", "branchName", "visits", "lastVisitDate"]; }
  } else if (key === "staff-contribution") {
    if (!availability.sales.available) return unavailableReport(catalogue, ctx, availability.sales.reason);
    const map = new Map(); for (const row of salesRows(ctx)) { const staffId = row.staffId || "unassigned"; const id = `${row.branchId}:${staffId}`; const current = map.get(id) || { staffId, staffName: row.staffName || "Unassigned", branchName: row.branchName, saleCount: 0, netRevenuePaise: 0 }; current.saleCount++; current.netRevenuePaise += paise(row.total); map.set(id, current); } rows = [...map.values()]; keys = ["staffName", "branchName", "saleCount", "netRevenuePaise"];
  } else if (key === "branch-performance") {
    const sales = availability.sales.available ? salesRows(ctx) : []; const appointmentsAvailable = availability.appointments.available;
    let appointmentCounts = new Map(); if (appointmentsAvailable) { const scope = scopeList(ctx.branchIds, "branchId", "branchReportAppointment"); const day = dateSql("startAt"); const data = db.prepare(`SELECT branchId,COUNT(*) AS count FROM appointments WHERE tenantId=@tenantId AND ${scope.sql} AND ${day} BETWEEN @from AND @to GROUP BY branchId`).all({ tenantId: ctx.tenantId, ...scope.params, from: ctx.from, to: ctx.to }); appointmentCounts = new Map(data.map((r) => [r.branchId, Number(r.count)])); }
    rows = ctx.branches.map((branch) => { const own = sales.filter((r) => r.branchId === branch.id); return { branchName: branch.name, saleCount: own.length, netRevenuePaise: availability.sales.available ? own.reduce((s, r) => s + paise(r.total), 0) : null, appointments: appointmentsAvailable ? appointmentCounts.get(branch.id) || 0 : null }; }); keys = ["branchName", "saleCount", "netRevenuePaise", "appointments"]; totals = { saleCount: rows.reduce((s, r) => s + r.saleCount, 0), netRevenuePaise: availability.sales.available ? rows.reduce((s, r) => s + r.netRevenuePaise, 0) : null, appointments: appointmentsAvailable ? rows.reduce((s, r) => s + r.appointments, 0) : null };
  }
  const status = text(query.status).toLowerCase(), search = text(query.search).toLowerCase(); rows = rows.filter((row) => (!status || text(row.status).toLowerCase() === status) && (!search || keys.some((column) => text(row[column]).toLowerCase().includes(search))));
  ({ totals, series } = filteredReportSummary(key, rows, availability));
  const sortBy = keys.includes(text(query.sortBy)) ? text(query.sortBy) : keys[0]; const direction = text(query.sortDirection).toLowerCase() === "asc" ? 1 : -1; rows.sort((a, b) => String(a[sortBy] ?? "").localeCompare(String(b[sortBy] ?? ""), "en", { numeric: true }) * direction);
  const page = exportAll ? { rows, pagination: { page: 1, pageSize: rows.length, total: rows.length, pages: rows.length ? 1 : 0 } } : paginate(rows, query);
  return { metadata: { ...catalogue, from: ctx.from, to: ctx.to, branchLabel: ctx.branchLabel, generatedAt: new Date().toISOString(), timezone: "Asia/Kolkata", appliedFilters: { search: text(query.search), status: text(query.status), sortBy, sortDirection: direction === 1 ? "asc" : "desc" } }, totals, series, columns: typedColumns(keys), rows: page.rows, pagination: page.pagination, availability: { available: true, reason: null }, partial: Object.values(availability).some((source) => !source.available) };
}

function unavailableReport(catalogue, ctx, reason) { return { metadata: { ...catalogue, from: ctx.from, to: ctx.to, branchLabel: ctx.branchLabel }, totals: {}, series: [], columns: [], rows: [], pagination: { page: 1, pageSize: 0, total: 0, pages: 0 }, availability: { available: false, reason } }; }
const safeCell = (value) => typeof value === "string" && /^[=+\-@\t\r]/.test(value) ? `'${value}` : value;
const inr = (value) => new Intl.NumberFormat("en-IN", { style: "currency", currency: "INR", maximumFractionDigits: 2 }).format(Number(value || 0) / 100);
const displayCell = (value, type) => type === "money" && value !== null ? inr(value) : value ?? "";
const safeFilename = (value) => text(value).replace(/[^a-z0-9._-]+/gi, "-").replace(/^-+|-+$/g, "").slice(0, 100) || "report";

function csvBuffer(report, businessName) {
  const lines = [[businessName], [report.metadata.title], [`Branch: ${report.metadata.branchLabel}`], [`Period: ${report.metadata.from} to ${report.metadata.to}`], [`Generated: ${istTimestamp(report.metadata.generatedAt)}`], [`Filters: ${activeFilters(report)}`], [], report.columns.map((c) => c.label)];
  for (const row of report.rows) lines.push(report.columns.map((column) => displayCell(row[column.key], column.type)));
  const csv = lines.map((line) => line.map((value) => `"${String(safeCell(value)).replaceAll('"', '""')}"`).join(",")).join("\r\n"); return Buffer.from(`\uFEFF${csv}`, "utf8");
}
function xlsxBuffer(report, businessName) {
  const data = [[businessName], [report.metadata.title], [`Branch: ${report.metadata.branchLabel}`], [`Period: ${report.metadata.from} to ${report.metadata.to}`], [`Generated: ${istTimestamp(report.metadata.generatedAt)}`], [`Filters: ${activeFilters(report)}`], [], report.columns.map((c) => c.label), ...report.rows.map((row) => report.columns.map((column) => safeCell(displayCell(row[column.key], column.type))))];
  const sheet = XLSX.utils.aoa_to_sheet(data); sheet["!cols"] = report.columns.map((column) => ({ wch: Math.max(14, Math.min(34, column.label.length + 6)) })); const workbook = XLSX.utils.book_new(); XLSX.utils.book_append_sheet(workbook, sheet, "Report"); return XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
}
function pdfBuffer(report, businessName) {
  const escape = (value) => String(value ?? "").normalize("NFKD").replace(/[^\x20-\x7E]/g, "?").replaceAll("\\", "\\\\").replaceAll("(", "\\(").replaceAll(")", "\\)");
  const header = [businessName, report.metadata.title, `Branch: ${report.metadata.branchLabel}`, `Period: ${report.metadata.from} to ${report.metadata.to}`, `Generated: ${istTimestamp(report.metadata.generatedAt)}`, `Filters: ${activeFilters(report)}`, "", report.columns.map((c) => c.label).join(" | ")];
  const reportLines = report.rows.map((row) => report.columns.map((column) => displayCell(row[column.key], column.type)).join(" | "));
  const chunks = reportLines.length ? Array.from({ length: Math.ceil(reportLines.length / 45) }, (_, index) => reportLines.slice(index * 45, index * 45 + 45)) : [[]];
  const fontId = 3 + chunks.length * 2;
  const pageIds = chunks.map((_, index) => 3 + index * 2);
  const objects = ["<< /Type /Catalog /Pages 2 0 R >>", `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(" ")}] /Count ${chunks.length} >>`];
  chunks.forEach((chunk, index) => {
    const lines = [...header, ...chunk].map((line) => escape(line).slice(0, 115));
    const stream = `BT /F1 9 Tf 42 800 Td 12 TL ${lines.map((line, lineIndex) => `${lineIndex ? "T* " : ""}(${line}) Tj`).join(" ")} ET`;
    objects.push(`<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Resources << /Font << /F1 ${fontId} 0 R >> >> /Contents ${pageIds[index] + 1} 0 R >>`);
    objects.push(`<< /Length ${Buffer.byteLength(stream)} >>\nstream\n${stream}\nendstream`);
  });
  objects.push("<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>");
  let body = "%PDF-1.4\n"; const offsets = [0]; objects.forEach((object, index) => { offsets.push(Buffer.byteLength(body)); body += `${index + 1} 0 obj\n${object}\nendobj\n`; }); const xref = Buffer.byteLength(body); body += `xref\n0 ${objects.length + 1}\n0000000000 65535 f \n${offsets.slice(1).map((offset) => `${String(offset).padStart(10, "0")} 00000 n `).join("\n")}\ntrailer << /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xref}\n%%EOF`; return Buffer.from(body, "binary");
}
function istTimestamp(value) { return new Intl.DateTimeFormat("en-IN", { dateStyle: "medium", timeStyle: "short", timeZone: "Asia/Kolkata" }).format(new Date(value)); }
function activeFilters(report) { const filters = Object.entries(report.metadata.appliedFilters || {}).filter(([, value]) => text(value)); return filters.length ? filters.map(([key, value]) => `${key}=${value}`).join(", ") : "None"; }
function tenantName(tenantId) { return db.prepare("SELECT name FROM tenants WHERE id=@tenantId").get({ tenantId })?.name || "Aura Salon"; }

export const ownerFinanceReportsService = {
  financeOverview(access, query) { return financeData(access, query); },
  financeDrilldown(access, query) { const result = normalizedDrillRows(access, query); const page = paginate(result.rows, query); return { metadata: { type: result.type, from: result.ctx.from, to: result.ctx.to, branchLabel: result.ctx.branchLabel }, columns: typedColumns(result.columns), ...page, availability: result.availability }; },
  catalogue(access, query) { const ctx = ownerContext(access, query); return { categories: ["sales", "appointments", "clients", "staff", "inventory", "branch"], reports: resolvedReports(), context: { branchLabel: ctx.branchLabel, from: ctx.from, to: ctx.to } }; },
  report(access, key, query) { return reportData(access, key, query); },
  export(access, query) {
    const format = text(query.format).toLowerCase(); if (!new Set(["csv", "xlsx", "pdf"]).has(format)) throw badRequest("format must be csv, xlsx, or pdf");
    const report = reportData(access, text(query.reportKey), query, true); if (!report.availability.available) throw badRequest(report.availability.reason || "This report is unavailable");
    const businessName = tenantName(access.tenantId); const base = safeFilename(`${businessName}-${report.metadata.title}-${report.metadata.from}-${report.metadata.to}`);
    const content = format === "csv" ? csvBuffer(report, businessName) : format === "xlsx" ? xlsxBuffer(report, businessName) : pdfBuffer(report, businessName);
    const contentType = format === "csv" ? "text/csv; charset=utf-8" : format === "xlsx" ? "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" : "application/pdf";
    return { content, contentType, filename: `${base}.${format}` };
  }
};
