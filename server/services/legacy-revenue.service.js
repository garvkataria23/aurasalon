import * as XLSX from "xlsx";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { assertBranch, branchFrom, makeId, now, number, requireTenant } from "./enterprise-command-utils.js";

const REQUIRED_HEADERS = ["SS/ Inv No", "Doc Date", "Service/Product"];
const HEADER_ALIASES = {
  sourceBranch: ["Branch"],
  docType: ["Doc Type"],
  docDate: ["Doc Date"],
  invoiceNo: ["SS/ Inv No", "Inv. No", "Invoice No"],
  clientBranch: ["Client Branch"],
  membership: ["MShip", "Membership"],
  membershipNo: ["MShip No", "Membership No"],
  clientName: ["Client Name"],
  mobileNo: ["Mobile No", "Contact"],
  person: ["Person"],
  gstin: ["GSTIN"],
  gender: ["Gender"],
  homeService: ["Home Service"],
  serviceProduct: ["Service/Product", "Service Name", "Product"],
  operator: ["Operator"],
  assistantOperator: ["Ass. Operator"],
  quantity: ["Qty"],
  discountPercent: ["Disc. (%)", "Disc. %"],
  discountAmount: ["Disc. Amt."],
  itemAmount: ["Amt", "Amt."],
  amount: ["Amount"],
  invoiceAmount: ["Amount"],
  freeAmount: ["Free (-)"],
  giftAmount: ["Gift (-)"],
  deductedDiscountPercent: ["Ded. Disc (%)"],
  deductedDiscountAmount: ["Ded. Disc (-)"],
  nonDeductedDiscountPercent: ["nDed. Disc (%)"],
  nonDeductedDiscountAmount: ["nDed. Disc (-)"],
  schemeDiscountPercent: ["FS Disc (%)", "Scheme Disc. %"],
  schemeDiscountAmount: ["FS Disc (-)", "Scheme Disc. Amt."],
  totalDeduction: ["Total Ded"],
  taxableAmount: ["Taxable"],
  taxCode: ["Tax Code"],
  cgstAmount: ["CGST Amt", "CGST Amt."],
  sgstAmount: ["SGST Amt", "SGST Amt."],
  totalGstAmount: ["Total GST", "Total GST Amt."],
  netAmount: ["Net Amt"],
  roundOffAmount: ["RoundOff", "R/O Amt."],
  totalAmount: ["Total"],
  previousBalanceAmount: ["Prev. Bal. (+)", "Prev. Bal. Amt."],
  advanceAmount: ["Adv. Amt. (-)", "Adv. Bal. Amt."],
  totalDueAmount: ["Total Amt.", "Total Amt"],
  totalBusinessAmount: ["Total Business"],
  receivedAmount: ["Recd.", "Recived Amt.", "Received Amt."],
  cashAmount: ["Cash", "Cash Amt."],
  cardAmount: ["Card", "Card Amt."],
  onlineAmount: ["eWallet / Online", "EWallet", "E-Wallet"],
  chequeAmount: ["Cheque", "Cheque Amt."],
  ewalletName: ["eWallet Name", "E-Wallet Name"],
  unpaidAmount: ["Un Paid", "Un Paid Amt."],
  balancePaidAmount: ["Bal. Paid", "Bal. Paid Amt."],
  preparedBy: ["Prepared By"],
  remarks: ["Remarks"],
  tipAmount: ["Tip Amt."]
};

const INVOICE_COLUMNS = [
  "amount",
  "discountAmount",
  "totalDeduction",
  "taxableAmount",
  "cgstAmount",
  "sgstAmount",
  "totalGstAmount",
  "netAmount",
  "roundOffAmount",
  "totalAmount",
  "previousBalanceAmount",
  "advanceAmount",
  "totalDueAmount",
  "totalBusinessAmount",
  "receivedAmount",
  "cashAmount",
  "cardAmount",
  "onlineAmount",
  "chequeAmount",
  "unpaidAmount",
  "balancePaidAmount",
  "tipAmount"
];

const LINE_COLUMNS = [
  "quantity",
  "discountPercent",
  "discountAmount",
  "itemAmount",
  "invoiceAmount",
  "freeAmount",
  "giftAmount",
  "deductedDiscountPercent",
  "deductedDiscountAmount",
  "nonDeductedDiscountPercent",
  "nonDeductedDiscountAmount",
  "schemeDiscountPercent",
  "schemeDiscountAmount",
  "totalDeduction",
  "taxableAmount",
  "cgstAmount",
  "sgstAmount",
  "totalGstAmount",
  "netAmount",
  "totalAmount",
  "totalBusinessAmount",
  "receivedAmount",
  "unpaidAmount",
  "balancePaidAmount"
];

function clean(value) {
  if (value === null || value === undefined) return "";
  return String(value).trim();
}

function money(value) {
  if (value === null || value === undefined || value === "") return 0;
  if (typeof value === "number") return Number.isFinite(value) ? Math.round(value * 100) / 100 : 0;
  const parsed = Number(String(value).replace(/[^0-9.-]/g, ""));
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function dateText(value) {
  if (!value) return "";
  if (value instanceof Date && !Number.isNaN(value.getTime())) {
    return `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(value.getDate()).padStart(2, "0")}`;
  }
  if (typeof value === "number") {
    const date = new Date(Date.UTC(1899, 11, 30) + Math.floor(value) * 86400000);
    return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}-${String(date.getUTCDate()).padStart(2, "0")}`;
  }
  const text = clean(value);
  const parsed = new Date(text);
  return Number.isNaN(parsed.getTime()) ? text : parsed.toISOString().slice(0, 10);
}

function normalizeHeader(value) {
  return clean(value).replace(/\s+/g, " ").toLowerCase();
}

function decodeWorkbook(payload = {}) {
  const base64 = clean(payload.base64 || payload.fileBase64 || "");
  if (!base64) throw badRequest("Excel base64 file content is required");
  const data = base64.includes(",") ? base64.split(",").pop() : base64;
  try {
    const buffer = Buffer.from(data, "base64");
    return XLSX.read(buffer, { type: "buffer", cellDates: false });
  } catch {
    throw badRequest("Unable to read Excel workbook. Please upload a valid .xlsx export.");
  }
}

function findHeaderRow(rows) {
  const index = rows.findIndex((row) => {
    const headers = new Set(row.map(normalizeHeader));
    return REQUIRED_HEADERS.every((header) => headers.has(normalizeHeader(header)));
  });
  if (index < 0) throw badRequest("FlexiSalon Inward Revenue headers were not found. Expected SS/ Inv No, Doc Date and Service/Product.");
  return index;
}

function headerLookup(headerRow) {
  const byName = new Map();
  headerRow.forEach((header, index) => {
    const key = normalizeHeader(header);
    if (key) byName.set(key, index);
  });
  const lookup = {};
  for (const [field, aliases] of Object.entries(HEADER_ALIASES)) {
    const alias = aliases.map(normalizeHeader).find((item) => byName.has(item));
    lookup[field] = alias === undefined ? -1 : byName.get(alias);
  }
  return lookup;
}

function valueFrom(row, lookup, field) {
  const index = lookup[field];
  return index >= 0 ? row[index] : "";
}

function rawObject(headerRow, row) {
  const object = {};
  headerRow.forEach((header, index) => {
    const key = clean(header);
    if (key) object[key] = row[index] ?? "";
  });
  return object;
}

function extractReportPeriod(title) {
  const match = clean(title).match(/Period\s*:\s*(\d{2}\/\d{2}\/\d{4})\s*-\s*(\d{2}\/\d{2}\/\d{4})/i);
  if (!match) return { reportFrom: "", reportTo: "" };
  return { reportFrom: indianDate(match[1]), reportTo: indianDate(match[2]) };
}

function indianDate(value) {
  const [day, month, year] = String(value).split("/");
  return `${year}-${month}-${day}`;
}

function parseWorkbook(payload = {}) {
  const workbook = decodeWorkbook(payload);
  const sheetName = workbook.SheetNames[0];
  const sheet = workbook.Sheets[sheetName];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", raw: true });
  const title = clean(rows[0]?.find((cell) => clean(cell)) || "");
  const headerIndex = findHeaderRow(rows);
  const headerRow = rows[headerIndex].map(clean);
  const lookup = headerLookup(headerRow);
  const dataRows = rows.slice(headerIndex + 1);
  const parsedLines = [];
  const invoiceMap = new Map();

  dataRows.forEach((row, offset) => {
    const invoiceNo = clean(valueFrom(row, lookup, "invoiceNo"));
    const docDate = dateText(valueFrom(row, lookup, "docDate"));
    if (!invoiceNo || !docDate) return;
    const line = {
      sourceBranch: clean(valueFrom(row, lookup, "sourceBranch")),
      docType: clean(valueFrom(row, lookup, "docType")),
      docDate,
      invoiceNo,
      clientBranch: clean(valueFrom(row, lookup, "clientBranch")),
      membership: clean(valueFrom(row, lookup, "membership")),
      membershipNo: clean(valueFrom(row, lookup, "membershipNo")),
      clientName: clean(valueFrom(row, lookup, "clientName")),
      mobileNo: clean(valueFrom(row, lookup, "mobileNo")),
      person: clean(valueFrom(row, lookup, "person")),
      gstin: clean(valueFrom(row, lookup, "gstin")),
      gender: clean(valueFrom(row, lookup, "gender")),
      homeService: clean(valueFrom(row, lookup, "homeService")),
      serviceProduct: clean(valueFrom(row, lookup, "serviceProduct")),
      operator: clean(valueFrom(row, lookup, "operator")),
      assistantOperator: clean(valueFrom(row, lookup, "assistantOperator")),
      taxCode: clean(valueFrom(row, lookup, "taxCode")),
      ewalletName: clean(valueFrom(row, lookup, "ewalletName")),
      preparedBy: clean(valueFrom(row, lookup, "preparedBy")),
      remarks: clean(valueFrom(row, lookup, "remarks")),
      sourceRowNumber: headerIndex + offset + 2,
      raw: rawObject(headerRow, row)
    };
    for (const column of [...INVOICE_COLUMNS, ...LINE_COLUMNS]) {
      line[column] = money(valueFrom(row, lookup, column));
    }
    parsedLines.push(line);
    if (!invoiceMap.has(invoiceNo)) {
      invoiceMap.set(invoiceNo, {
        ...line,
        lineCount: 0,
        services: []
      });
    }
    const invoice = invoiceMap.get(invoiceNo);
    invoice.lineCount += 1;
    if (line.serviceProduct) invoice.services.push(line.serviceProduct);
  });

  const invoices = [...invoiceMap.values()];
  const dates = parsedLines.map((line) => line.docDate).filter(Boolean).sort();
  const period = extractReportPeriod(title);
  const summary = summarize(invoices, parsedLines);
  const warnings = [];
  if (period.reportTo && dates.at(-1) && period.reportTo > dates.at(-1)) {
    warnings.push(`Report title goes to ${period.reportTo}, but workbook data ends at ${dates.at(-1)}.`);
  }
  if (!parsedLines.length) warnings.push("No importable revenue lines were found after the header row.");

  return {
    title,
    sheetName,
    headerRow,
    dataFrom: dates[0] || "",
    dataTo: dates.at(-1) || "",
    ...period,
    rowCount: dataRows.length,
    lineCount: parsedLines.length,
    invoiceCount: invoices.length,
    summary,
    warnings,
    invoices,
    lines: parsedLines
  };
}

function summarize(invoices, lines) {
  const totals = {
    totalAmount: 0,
    receivedAmount: 0,
    unpaidAmount: 0,
    balancePaidAmount: 0,
    cashAmount: 0,
    cardAmount: 0,
    onlineAmount: 0,
    chequeAmount: 0,
    tipAmount: 0,
    taxableAmount: 0,
    totalGstAmount: 0,
    discountAmount: 0
  };
  for (const invoice of invoices) {
    for (const key of Object.keys(totals)) totals[key] += number(invoice[key], 0);
  }
  for (const key of Object.keys(totals)) totals[key] = money(totals[key]);
  const docTypes = groupCount(invoices, "docType");
  const topOperators = groupSum(lines, "operator", "itemAmount", 10);
  const topServices = groupSum(lines, "serviceProduct", "itemAmount", 10);
  return { ...totals, docTypes, topOperators, topServices };
}

function groupCount(rows, field) {
  const map = new Map();
  for (const row of rows) {
    const key = row[field] || "Blank";
    const item = map.get(key) || { key, count: 0, totalAmount: 0 };
    item.count += 1;
    item.totalAmount += number(row.totalAmount, 0);
    map.set(key, item);
  }
  return [...map.values()].map((item) => ({ ...item, totalAmount: money(item.totalAmount) })).sort((a, b) => b.totalAmount - a.totalAmount);
}

function groupSum(rows, field, amountField, limit) {
  const map = new Map();
  for (const row of rows) {
    const key = row[field] || "Unassigned";
    const item = map.get(key) || { key, count: 0, amount: 0 };
    item.count += 1;
    item.amount += number(row[amountField], 0);
    map.set(key, item);
  }
  return [...map.values()].map((item) => ({ ...item, amount: money(item.amount) })).sort((a, b) => b.amount - a.amount).slice(0, limit);
}

function sqlParams(access, query = {}) {
  requireTenant(access);
  const params = {
    tenant_id: access.tenantId,
    branch_id: clean(query.branchId || query.branch_id || access.branchId || ""),
    import_id: clean(query.importId || query.import_id || ""),
    from: clean(query.from || ""),
    to: clean(query.to || ""),
    doc_type: clean(query.docType || query.doc_type || ""),
    operator: clean(query.operator || ""),
    service: clean(query.service || ""),
    search: clean(query.search || ""),
    payment_mode: clean(query.paymentMode || query.payment_mode || ""),
    unpaid_only: String(query.unpaidOnly || query.unpaid_only || "") === "true" ? 1 : 0,
    limit: Math.min(Math.max(number(query.limit, 150), 1), 500)
  };
  if (params.branch_id) assertBranch(access, params.branch_id);
  return params;
}

function invoiceWhere(params, alias = "i") {
  const filters = [`${alias}.tenant_id = @tenant_id`];
  if (params.branch_id) filters.push(`${alias}.branch_id = @branch_id`);
  if (params.import_id) filters.push(`${alias}.import_id = @import_id`);
  if (params.from) filters.push(`${alias}.doc_date >= @from`);
  if (params.to) filters.push(`${alias}.doc_date <= @to`);
  if (params.doc_type) filters.push(`${alias}.doc_type = @doc_type`);
  if (params.unpaid_only) filters.push(`${alias}.unpaid_amount > 0`);
  if (params.payment_mode === "cash") filters.push(`${alias}.cash_amount > 0`);
  if (params.payment_mode === "card") filters.push(`${alias}.card_amount > 0`);
  if (params.payment_mode === "online") filters.push(`${alias}.online_amount > 0`);
  if (params.payment_mode === "cheque") filters.push(`${alias}.cheque_amount > 0`);
  if (params.search) {
    filters.push(`(${alias}.invoice_no LIKE '%' || @search || '%' OR ${alias}.client_name LIKE '%' || @search || '%' OR ${alias}.mobile_no LIKE '%' || @search || '%')`);
  }
  if (params.operator || params.service) {
    const lineFilters = [`l.tenant_id = ${alias}.tenant_id`, `l.invoice_id = ${alias}.id`];
    if (params.operator) lineFilters.push("l.operator = @operator");
    if (params.service) lineFilters.push("l.service_product LIKE '%' || @service || '%'");
    filters.push(`EXISTS (SELECT 1 FROM legacy_revenue_lines l WHERE ${lineFilters.join(" AND ")})`);
  }
  return filters.join(" AND ");
}

function rowToImport(row) {
  return {
    id: row.id,
    branchId: row.branch_id,
    sourceSystem: row.source_system,
    fileName: row.file_name,
    reportTitle: row.report_title,
    reportFrom: row.report_from,
    reportTo: row.report_to,
    dataFrom: row.data_from,
    dataTo: row.data_to,
    rowCount: row.row_count,
    invoiceCount: row.invoice_count,
    lineCount: row.line_count,
    totalAmount: row.total_amount,
    receivedAmount: row.received_amount,
    unpaidAmount: row.unpaid_amount,
    balancePaidAmount: row.balance_paid_amount,
    createdAt: row.created_at
  };
}

function rowToInvoice(row) {
  return {
    id: row.id,
    importId: row.import_id,
    branchId: row.branch_id,
    sourceBranch: row.source_branch,
    docType: row.doc_type,
    docDate: row.doc_date,
    invoiceNo: row.invoice_no,
    clientName: row.client_name,
    mobileNo: row.mobile_no,
    operator: row.operator,
    lineCount: row.line_count,
    totalAmount: row.total_amount,
    receivedAmount: row.received_amount,
    unpaidAmount: row.unpaid_amount,
    balancePaidAmount: row.balance_paid_amount,
    cashAmount: row.cash_amount,
    cardAmount: row.card_amount,
    onlineAmount: row.online_amount,
    chequeAmount: row.cheque_amount,
    tipAmount: row.tip_amount
  };
}

function rowToLine(row) {
  return {
    id: row.line_id || row.id,
    invoiceId: row.invoice_id,
    importId: row.import_id,
    docType: row.doc_type,
    docDate: row.doc_date,
    invoiceNo: row.invoice_no,
    clientName: row.client_name,
    mobileNo: row.mobile_no,
    serviceProduct: row.service_product,
    operator: row.operator,
    assistantOperator: row.assistant_operator,
    quantity: row.quantity,
    itemAmount: row.item_amount,
    invoiceAmount: row.invoice_amount,
    discountAmount: row.discount_amount,
    taxableAmount: row.taxable_amount,
    totalGstAmount: row.total_gst_amount,
    totalAmount: row.total_amount,
    receivedAmount: row.received_amount,
    unpaidAmount: row.unpaid_amount,
    balancePaidAmount: row.balance_paid_amount
  };
}

export class LegacyRevenueService {
  preview(payload, access) {
    requireTenant(access);
    const parsed = parseWorkbook(payload);
    return {
      fileName: clean(payload.fileName || payload.name || ""),
      title: parsed.title,
      columns: parsed.headerRow.filter(Boolean),
      rowCount: parsed.rowCount,
      lineCount: parsed.lineCount,
      invoiceCount: parsed.invoiceCount,
      dataFrom: parsed.dataFrom,
      dataTo: parsed.dataTo,
      reportFrom: parsed.reportFrom,
      reportTo: parsed.reportTo,
      summary: parsed.summary,
      warnings: parsed.warnings,
      sampleRows: parsed.lines.slice(0, 10).map((line) => ({
        invoiceNo: line.invoiceNo,
        docDate: line.docDate,
        clientName: line.clientName,
        serviceProduct: line.serviceProduct,
        operator: line.operator,
        itemAmount: line.itemAmount,
        invoiceTotal: line.totalAmount,
        receivedAmount: line.receivedAmount,
        unpaidAmount: line.unpaidAmount
      }))
    };
  }

  import(payload, access) {
    requireTenant(access);
    const branchId = branchFrom(payload, access);
    if (branchId) assertBranch(access, branchId);
    const parsed = parseWorkbook(payload);
    if (!parsed.lines.length) throw badRequest("No revenue rows found to import");
    const stamp = now();
    const importId = makeId("legacy_rev");
    const summary = parsed.summary;
    const importRow = {
      id: importId,
      tenant_id: access.tenantId,
      branch_id: branchId,
      source_system: "FlexiSalonERP",
      file_name: clean(payload.fileName || payload.name || ""),
      report_title: parsed.title,
      report_from: parsed.reportFrom,
      report_to: parsed.reportTo,
      data_from: parsed.dataFrom,
      data_to: parsed.dataTo,
      row_count: parsed.rowCount,
      invoice_count: parsed.invoiceCount,
      line_count: parsed.lineCount,
      total_amount: summary.totalAmount,
      received_amount: summary.receivedAmount,
      unpaid_amount: summary.unpaidAmount,
      balance_paid_amount: summary.balancePaidAmount,
      cash_amount: summary.cashAmount,
      card_amount: summary.cardAmount,
      online_amount: summary.onlineAmount,
      cheque_amount: summary.chequeAmount,
      tip_amount: summary.tipAmount,
      summary_json: JSON.stringify({ ...summary, warnings: parsed.warnings }),
      imported_by: access.userId || access.role || "",
      created_at: stamp,
      updated_at: stamp
    };

    const run = db.transaction(() => {
      db.prepare(`INSERT INTO legacy_revenue_imports
        (id, tenant_id, branch_id, source_system, file_name, report_title, report_from, report_to, data_from, data_to, row_count, invoice_count, line_count, total_amount, received_amount, unpaid_amount, balance_paid_amount, cash_amount, card_amount, online_amount, cheque_amount, tip_amount, summary_json, imported_by, created_at, updated_at)
        VALUES (@id, @tenant_id, @branch_id, @source_system, @file_name, @report_title, @report_from, @report_to, @data_from, @data_to, @row_count, @invoice_count, @line_count, @total_amount, @received_amount, @unpaid_amount, @balance_paid_amount, @cash_amount, @card_amount, @online_amount, @cheque_amount, @tip_amount, @summary_json, @imported_by, @created_at, @updated_at)`).run(importRow);

      const invoiceInsert = db.prepare(`INSERT INTO legacy_revenue_invoices
        (id, tenant_id, branch_id, import_id, source_branch, doc_type, doc_date, invoice_no, client_branch, membership, membership_no, client_name, mobile_no, person, gstin, gender, home_service, line_count, amount, discount_amount, total_deduction, taxable_amount, cgst_amount, sgst_amount, total_gst_amount, net_amount, round_off_amount, total_amount, previous_balance_amount, advance_amount, total_due_amount, total_business_amount, received_amount, cash_amount, card_amount, online_amount, cheque_amount, ewallet_name, unpaid_amount, balance_paid_amount, prepared_by, remarks, tip_amount, raw_json, created_at, updated_at)
        VALUES (@id, @tenant_id, @branch_id, @import_id, @source_branch, @doc_type, @doc_date, @invoice_no, @client_branch, @membership, @membership_no, @client_name, @mobile_no, @person, @gstin, @gender, @home_service, @line_count, @amount, @discount_amount, @total_deduction, @taxable_amount, @cgst_amount, @sgst_amount, @total_gst_amount, @net_amount, @round_off_amount, @total_amount, @previous_balance_amount, @advance_amount, @total_due_amount, @total_business_amount, @received_amount, @cash_amount, @card_amount, @online_amount, @cheque_amount, @ewallet_name, @unpaid_amount, @balance_paid_amount, @prepared_by, @remarks, @tip_amount, @raw_json, @created_at, @updated_at)`);
      const lineInsert = db.prepare(`INSERT INTO legacy_revenue_lines
        (id, tenant_id, branch_id, import_id, invoice_id, source_branch, doc_type, doc_date, invoice_no, line_no, service_product, operator, assistant_operator, quantity, discount_percent, discount_amount, item_amount, invoice_amount, free_amount, gift_amount, deducted_discount_percent, deducted_discount_amount, non_deducted_discount_percent, non_deducted_discount_amount, scheme_discount_percent, scheme_discount_amount, total_deduction, taxable_amount, tax_code, cgst_amount, sgst_amount, total_gst_amount, net_amount, total_amount, total_business_amount, received_amount, unpaid_amount, balance_paid_amount, raw_json, created_at, updated_at)
        VALUES (@id, @tenant_id, @branch_id, @import_id, @invoice_id, @source_branch, @doc_type, @doc_date, @invoice_no, @line_no, @service_product, @operator, @assistant_operator, @quantity, @discount_percent, @discount_amount, @item_amount, @invoice_amount, @free_amount, @gift_amount, @deducted_discount_percent, @deducted_discount_amount, @non_deducted_discount_percent, @non_deducted_discount_amount, @scheme_discount_percent, @scheme_discount_amount, @total_deduction, @taxable_amount, @tax_code, @cgst_amount, @sgst_amount, @total_gst_amount, @net_amount, @total_amount, @total_business_amount, @received_amount, @unpaid_amount, @balance_paid_amount, @raw_json, @created_at, @updated_at)`);

      const invoiceIds = new Map();
      for (const invoice of parsed.invoices) {
        const invoiceId = makeId("legacy_inv");
        invoiceIds.set(invoice.invoiceNo, invoiceId);
        invoiceInsert.run(this.invoiceDbRow(invoice, invoiceId, importId, branchId, access.tenantId, stamp));
      }
      parsed.lines.forEach((line, index) => {
        lineInsert.run(this.lineDbRow(line, index + 1, invoiceIds.get(line.invoiceNo), importId, branchId, access.tenantId, stamp));
      });
    });
    run();

    return {
      import: rowToImport(importRow),
      summary,
      warnings: parsed.warnings
    };
  }

  imports(access, query = {}) {
    const params = sqlParams(access, query);
    const filters = ["tenant_id = @tenant_id"];
    if (params.branch_id) filters.push("branch_id = @branch_id");
    return db.prepare(`SELECT * FROM legacy_revenue_imports WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params).map(rowToImport);
  }

  report(access, query = {}) {
    const params = sqlParams(access, query);
    const where = invoiceWhere(params, "i");
    const invoiceRows = db.prepare(`SELECT i.* FROM legacy_revenue_invoices i WHERE ${where} ORDER BY i.doc_date DESC, i.invoice_no DESC LIMIT 5000`).all(params);
    const summary = this.summaryFromInvoiceRows(invoiceRows);
    const lineFilters = ["l.tenant_id = @tenant_id", `l.invoice_id IN (SELECT i.id FROM legacy_revenue_invoices i WHERE ${where})`];
    if (params.operator) lineFilters.push("l.operator = @operator");
    if (params.service) lineFilters.push("l.service_product LIKE '%' || @service || '%'");
    const rows = db.prepare(`SELECT l.id AS line_id, l.*, i.client_name, i.mobile_no
       FROM legacy_revenue_lines l
       JOIN legacy_revenue_invoices i ON i.id = l.invoice_id AND i.tenant_id = l.tenant_id
      WHERE ${lineFilters.join(" AND ")}
      ORDER BY l.doc_date DESC, l.invoice_no DESC, l.line_no ASC
      LIMIT @limit`).all(params).map(rowToLine);
    return {
      filters: query,
      summary,
      rows,
      invoices: invoiceRows.slice(0, 100).map(rowToInvoice),
      imports: this.imports(access, { branchId: params.branch_id, limit: 20 }),
      docTypes: groupCount(invoiceRows.map((row) => ({ docType: row.doc_type, totalAmount: row.total_amount })), "docType"),
      topOperators: groupSum(rows.map((row) => ({ operator: row.operator, itemAmount: row.itemAmount })), "operator", "itemAmount", 12),
      topServices: groupSum(rows.map((row) => ({ serviceProduct: row.serviceProduct, itemAmount: row.itemAmount })), "serviceProduct", "itemAmount", 12)
    };
  }

  invoice(id, access) {
    requireTenant(access);
    const invoice = db.prepare("SELECT * FROM legacy_revenue_invoices WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!invoice) throw notFound("Legacy invoice not found");
    if (invoice.branch_id) assertBranch(access, invoice.branch_id);
    const lines = db.prepare("SELECT * FROM legacy_revenue_lines WHERE invoice_id = ? AND tenant_id = ? ORDER BY line_no").all(id, access.tenantId).map(rowToLine);
    return { invoice: rowToInvoice(invoice), lines };
  }

  summaryFromInvoiceRows(rows) {
    const summary = {
      invoiceCount: rows.length,
      totalAmount: 0,
      receivedAmount: 0,
      unpaidAmount: 0,
      balancePaidAmount: 0,
      cashAmount: 0,
      cardAmount: 0,
      onlineAmount: 0,
      chequeAmount: 0,
      tipAmount: 0,
      taxableAmount: 0,
      totalGstAmount: 0,
      discountAmount: 0
    };
    for (const row of rows) {
      summary.totalAmount += number(row.total_amount, 0);
      summary.receivedAmount += number(row.received_amount, 0);
      summary.unpaidAmount += number(row.unpaid_amount, 0);
      summary.balancePaidAmount += number(row.balance_paid_amount, 0);
      summary.cashAmount += number(row.cash_amount, 0);
      summary.cardAmount += number(row.card_amount, 0);
      summary.onlineAmount += number(row.online_amount, 0);
      summary.chequeAmount += number(row.cheque_amount, 0);
      summary.tipAmount += number(row.tip_amount, 0);
      summary.taxableAmount += number(row.taxable_amount, 0);
      summary.totalGstAmount += number(row.total_gst_amount, 0);
      summary.discountAmount += number(row.discount_amount, 0);
    }
    for (const key of Object.keys(summary)) {
      if (key !== "invoiceCount") summary[key] = money(summary[key]);
    }
    return summary;
  }

  invoiceDbRow(invoice, id, importId, branchId, tenantId, stamp) {
    return {
      id,
      tenant_id: tenantId,
      branch_id: branchId,
      import_id: importId,
      source_branch: invoice.sourceBranch,
      doc_type: invoice.docType,
      doc_date: invoice.docDate,
      invoice_no: invoice.invoiceNo,
      client_branch: invoice.clientBranch,
      membership: invoice.membership,
      membership_no: invoice.membershipNo,
      client_name: invoice.clientName,
      mobile_no: invoice.mobileNo,
      person: invoice.person,
      gstin: invoice.gstin,
      gender: invoice.gender,
      home_service: invoice.homeService,
      line_count: invoice.lineCount,
      amount: invoice.amount,
      discount_amount: invoice.discountAmount,
      total_deduction: invoice.totalDeduction,
      taxable_amount: invoice.taxableAmount,
      cgst_amount: invoice.cgstAmount,
      sgst_amount: invoice.sgstAmount,
      total_gst_amount: invoice.totalGstAmount,
      net_amount: invoice.netAmount,
      round_off_amount: invoice.roundOffAmount,
      total_amount: invoice.totalAmount,
      previous_balance_amount: invoice.previousBalanceAmount,
      advance_amount: invoice.advanceAmount,
      total_due_amount: invoice.totalDueAmount,
      total_business_amount: invoice.totalBusinessAmount,
      received_amount: invoice.receivedAmount,
      cash_amount: invoice.cashAmount,
      card_amount: invoice.cardAmount,
      online_amount: invoice.onlineAmount,
      cheque_amount: invoice.chequeAmount,
      ewallet_name: invoice.ewalletName,
      unpaid_amount: invoice.unpaidAmount,
      balance_paid_amount: invoice.balancePaidAmount,
      prepared_by: invoice.preparedBy,
      remarks: invoice.remarks,
      tip_amount: invoice.tipAmount,
      raw_json: JSON.stringify({ raw: invoice.raw, services: invoice.services }),
      created_at: stamp,
      updated_at: stamp
    };
  }

  lineDbRow(line, index, invoiceId, importId, branchId, tenantId, stamp) {
    return {
      id: makeId("legacy_line"),
      tenant_id: tenantId,
      branch_id: branchId,
      import_id: importId,
      invoice_id: invoiceId,
      source_branch: line.sourceBranch,
      doc_type: line.docType,
      doc_date: line.docDate,
      invoice_no: line.invoiceNo,
      line_no: index,
      service_product: line.serviceProduct,
      operator: line.operator,
      assistant_operator: line.assistantOperator,
      quantity: line.quantity,
      discount_percent: line.discountPercent,
      discount_amount: line.discountAmount,
      item_amount: line.itemAmount,
      invoice_amount: line.invoiceAmount,
      free_amount: line.freeAmount,
      gift_amount: line.giftAmount,
      deducted_discount_percent: line.deductedDiscountPercent,
      deducted_discount_amount: line.deductedDiscountAmount,
      non_deducted_discount_percent: line.nonDeductedDiscountPercent,
      non_deducted_discount_amount: line.nonDeductedDiscountAmount,
      scheme_discount_percent: line.schemeDiscountPercent,
      scheme_discount_amount: line.schemeDiscountAmount,
      total_deduction: line.totalDeduction,
      taxable_amount: line.taxableAmount,
      tax_code: line.taxCode,
      cgst_amount: line.cgstAmount,
      sgst_amount: line.sgstAmount,
      total_gst_amount: line.totalGstAmount,
      net_amount: line.netAmount,
      total_amount: line.totalAmount,
      total_business_amount: line.totalBusinessAmount,
      received_amount: line.receivedAmount,
      unpaid_amount: line.unpaidAmount,
      balance_paid_amount: line.balancePaidAmount,
      raw_json: JSON.stringify(line.raw),
      created_at: stamp,
      updated_at: stamp
    };
  }
}

export const legacyRevenueService = new LegacyRevenueService();
