import { db } from "../db.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function monthRange(month) {
  const safeMonth = /^\d{4}-\d{2}$/.test(String(month || "")) ? month : new Date().toISOString().slice(0, 7);
  const from = `${safeMonth}-01`;
  const end = new Date(`${from}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { month: safeMonth, from, to: end.toISOString().slice(0, 10) };
}

function safeJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowsToCsv(rows) {
  if (!rows.length) return "";
  const headers = Object.keys(rows[0]);
  const escape = (value) => {
    const text = String(value ?? "");
    return /[",\n]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((key) => escape(row[key])).join(","))].join("\n");
}

function flattenReportRows(report) {
  if (Array.isArray(report)) return report;
  if (report.rows) return report.rows;
  const rows = [];
  for (const [section, value] of Object.entries(report)) {
    if (Array.isArray(value)) rows.push(...value.map((row) => ({ section, ...row })));
    if (value && typeof value === "object" && !Array.isArray(value) && section !== "documentsIssued") {
      rows.push({ section, ...value });
    }
  }
  return rows;
}

function escapeHtml(value) {
  return String(value ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function rowsToExcelHtml(rows, title) {
  const safeRows = rows.length ? rows : [{ status: "No rows for selected period" }];
  const headers = Object.keys(safeRows[0]);
  return `<!doctype html>
<html>
<head>
  <meta charset="utf-8" />
  <meta name="ProgId" content="Excel.Sheet" />
  <style>
    table { border-collapse: collapse; font-family: Arial, sans-serif; font-size: 12px; }
    th { background: #f3f4f6; font-weight: 700; }
    th, td { border: 1px solid #d1d5db; padding: 6px 8px; }
  </style>
</head>
<body>
  <table>
    <caption>${escapeHtml(title)}</caption>
    <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join("")}</tr></thead>
    <tbody>
      ${safeRows.map((row) => `<tr>${headers.map((header) => `<td>${escapeHtml(row[header])}</td>`).join("")}</tr>`).join("")}
    </tbody>
  </table>
</body>
</html>`;
}

function invoiceRows(tenantId, from, to) {
  return db.prepare(
    `SELECT i.*, c.name AS customerName, c.phone AS customerPhone, c.email AS customerEmail,
            b.name AS branchName, b.gstin AS branchGstin, b.city AS branchState
     FROM invoices i
     LEFT JOIN clients c ON c.id = i.clientId AND c.tenantId = i.tenantId
     LEFT JOIN branches b ON b.id = i.branchId AND b.tenantId = i.tenantId
     WHERE i.tenantId = @tenantId AND substr(i.createdAt, 1, 10) BETWEEN @from AND @to
     ORDER BY i.createdAt`
  ).all({ tenantId, from, to });
}

function hsnRows(tenantId, from, to) {
  const sales = db.prepare(
    `SELECT s.items, s.createdAt
     FROM sales s
     WHERE s.tenantId = @tenantId AND substr(s.createdAt, 1, 10) BETWEEN @from AND @to`
  ).all({ tenantId, from, to });
  const services = new Map(db.prepare("SELECT id, name, gstRate FROM services WHERE tenantId = ?").all(tenantId).map((row) => [row.id, row]));
  const grouped = new Map();
  for (const sale of sales) {
    const items = safeJson(sale.items, []);
    if (!Array.isArray(items)) continue;
    for (const item of items) {
      const service = services.get(item.id || item.serviceId) || {};
      const rate = Number(item.gstRate || service.gstRate || 18);
      const taxable = Number(item.total || item.price || service.price || 0) * Number(item.quantity || 1);
      const key = `999729:${rate}`;
      const current = grouped.get(key) || { hsnSac: "999729", description: service.name || item.name || "Salon service", gstRate: rate, taxableValue: 0, taxAmount: 0 };
      current.taxableValue += taxable;
      current.taxAmount += taxable * (rate / 100);
      grouped.set(key, current);
    }
  }
  return [...grouped.values()].map((row) => ({
    ...row,
    taxableValue: money(row.taxableValue),
    taxAmount: money(row.taxAmount)
  }));
}

export class GstReportsService {
  gstr1(tenantId, month) {
    const range = monthRange(month);
    const invoices = invoiceRows(tenantId, range.from, range.to);
    const b2b = invoices.filter((invoice) => invoice.customerGstin).map((invoice) => this.invoiceLine(invoice, "B2B"));
    const b2cLarge = invoices.filter((invoice) => !invoice.customerGstin && Number(invoice.total || 0) > 250000).map((invoice) => this.invoiceLine(invoice, "B2C-Large"));
    const b2cSmall = invoices.filter((invoice) => !invoice.customerGstin && Number(invoice.total || 0) <= 250000);
    const b2cSummary = [{
      section: "B2C-Small",
      invoiceCount: b2cSmall.length,
      taxableValue: money(b2cSmall.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0) - Number(invoice.discount || 0), 0)),
      taxAmount: money(b2cSmall.reduce((sum, invoice) => sum + Number(invoice.gstAmount || 0), 0)),
      totalValue: money(b2cSmall.reduce((sum, invoice) => sum + Number(invoice.total || 0), 0))
    }];
    return {
      month: range.month,
      b2b,
      b2cLarge,
      b2cSmall: b2cSummary,
      hsnSummary: hsnRows(tenantId, range.from, range.to),
      documentsIssued: {
        from: invoices[0]?.invoiceNumber || "",
        to: invoices[invoices.length - 1]?.invoiceNumber || "",
        count: invoices.length
      }
    };
  }

  gstr3b(tenantId, month) {
    const range = monthRange(month);
    const invoices = invoiceRows(tenantId, range.from, range.to);
    const taxableValue = invoices.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0) - Number(invoice.discount || 0), 0);
    const gstAmount = invoices.reduce((sum, invoice) => sum + Number(invoice.gstAmount || 0), 0);
    return {
      month: range.month,
      outwardTaxableSupplies: {
        taxableValue: money(taxableValue),
        igst: 0,
        cgst: money(gstAmount / 2),
        sgst: money(gstAmount / 2),
        cess: 0
      },
      eligibleItc: {
        igst: 0,
        cgst: 0,
        sgst: 0,
        cess: 0
      },
      taxPayable: {
        total: money(gstAmount),
        note: "CGST/SGST split assumes intra-state salon billing unless customer GST state is connected."
      }
    };
  }

  hsnSummary(tenantId, from, to) {
    return {
      from,
      to,
      rows: hsnRows(tenantId, from, to)
    };
  }

  invoiceLine(invoice, section) {
    const taxableValue = Number(invoice.subtotal || 0) - Number(invoice.discount || 0);
    return {
      section,
      invoiceNumber: invoice.invoiceNumber,
      invoiceDate: String(invoice.createdAt || "").slice(0, 10),
      customer: invoice.customerName || invoice.clientId,
      gstin: invoice.customerGstin || "",
      taxableValue: money(taxableValue),
      taxAmount: money(invoice.gstAmount),
      totalValue: money(invoice.total),
      placeOfSupply: invoice.branchState || ""
    };
  }

  toCsv(report) {
    return rowsToCsv(flattenReportRows(report));
  }

  toExcel(report, title = "GST Report") {
    return rowsToExcelHtml(flattenReportRows(report), title);
  }
}

export const gstReportsService = new GstReportsService();
