import { db } from "../db.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function monthRange(month) {
  const safe = /^\d{4}-\d{2}$/.test(String(month || "")) ? month : new Date().toISOString().slice(0, 7);
  const from = `${safe}-01`;
  const end = new Date(`${from}T00:00:00.000Z`);
  end.setUTCMonth(end.getUTCMonth() + 1);
  end.setUTCDate(end.getUTCDate() - 1);
  return { month: safe, from, to: end.toISOString().slice(0, 10) };
}

function invoiceRows(tenantId, from, to) {
  return db
    .prepare(
      `SELECT *
         FROM invoices
        WHERE tenant_id = @tenantId
          AND status NOT IN ('draft', 'voided', 'cancelled')
          AND substr(created_at, 1, 10) BETWEEN @from AND @to
        ORDER BY created_at`
    )
    .all({ tenantId, from, to });
}

function taxRows(tenantId, from, to) {
  return db
    .prepare(
      `SELECT ii.hsn_sac_code, ii.item_name, ii.tax_rate,
              SUM(ii.taxable_amount) AS taxable_amount,
              SUM(CASE WHEN it.tax_type = 'CGST' THEN it.tax_amount ELSE 0 END) AS cgst,
              SUM(CASE WHEN it.tax_type = 'SGST' THEN it.tax_amount ELSE 0 END) AS sgst,
              SUM(CASE WHEN it.tax_type = 'IGST' THEN it.tax_amount ELSE 0 END) AS igst,
              SUM(CASE WHEN it.tax_type = 'CESS' THEN it.tax_amount ELSE 0 END) AS cess
         FROM invoice_items ii
         JOIN invoices i ON i.tenant_id = ii.tenant_id AND i.id = ii.invoice_id
    LEFT JOIN invoice_taxes it ON it.tenant_id = ii.tenant_id AND it.invoice_item_id = ii.id
        WHERE ii.tenant_id = @tenantId
          AND i.status NOT IN ('draft', 'voided', 'cancelled')
          AND substr(i.created_at, 1, 10) BETWEEN @from AND @to
        GROUP BY ii.hsn_sac_code, ii.item_name, ii.tax_rate
        ORDER BY ii.hsn_sac_code`
    )
    .all({ tenantId, from, to });
}

function tableHtml(rows, title) {
  const safeRows = rows.length ? rows : [{ status: "No rows" }];
  const headers = Object.keys(safeRows[0]);
  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;");
  return `<!doctype html><html><body><table><caption>${esc(title)}</caption><thead><tr>${headers.map((h) => `<th>${esc(h)}</th>`).join("")}</tr></thead><tbody>${safeRows.map((r) => `<tr>${headers.map((h) => `<td>${esc(r[h])}</td>`).join("")}</tr>`).join("")}</tbody></table></body></html>`;
}

export class GstReportService {
  gstr1(tenantId, month) {
    const range = monthRange(month);
    const invoices = invoiceRows(tenantId, range.from, range.to);
    const mapInvoice = (invoice, section) => ({
      section,
      invoiceNo: invoice.invoice_no,
      invoiceDate: String(invoice.created_at || "").slice(0, 10),
      gstin: invoice.gstin || "",
      taxableValue: money(Number(invoice.subtotal || 0) - Number(invoice.discount_total || 0)),
      taxAmount: money(invoice.tax_total),
      totalValue: money(invoice.grand_total),
      placeOfSupply: invoice.place_of_supply || ""
    });
    const b2b = invoices.filter((invoice) => invoice.gstin).map((invoice) => mapInvoice(invoice, "B2B"));
    const b2cLarge = invoices.filter((invoice) => !invoice.gstin && Number(invoice.grand_total || 0) > 250000).map((invoice) => mapInvoice(invoice, "B2C-Large"));
    const b2cSmallRows = invoices.filter((invoice) => !invoice.gstin && Number(invoice.grand_total || 0) <= 250000);
    return {
      month: range.month,
      note: "Export-ready GST report. Direct GST portal filing is not performed.",
      b2b,
      b2cLarge,
      b2cSmall: [{
        section: "B2C-Small",
        invoiceCount: b2cSmallRows.length,
        taxableValue: money(b2cSmallRows.reduce((sum, invoice) => sum + Number(invoice.subtotal || 0) - Number(invoice.discount_total || 0), 0)),
        taxAmount: money(b2cSmallRows.reduce((sum, invoice) => sum + Number(invoice.tax_total || 0), 0)),
        totalValue: money(b2cSmallRows.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0))
      }],
      creditDebitNotes: invoices.filter((invoice) => ["credit_note", "debit_note"].includes(invoice.invoice_type)).map((invoice) => mapInvoice(invoice, "CDN")),
      hsnSummary: this.hsnSummary(tenantId, range.from, range.to).rows,
      documentsIssued: {
        from: invoices[0]?.invoice_no || "",
        to: invoices[invoices.length - 1]?.invoice_no || "",
        count: invoices.length
      }
    };
  }

  gstr3b(tenantId, month) {
    const range = monthRange(month);
    const rows = taxRows(tenantId, range.from, range.to);
    const taxableValue = money(rows.reduce((sum, row) => sum + Number(row.taxable_amount || 0), 0));
    const cgst = money(rows.reduce((sum, row) => sum + Number(row.cgst || 0), 0));
    const sgst = money(rows.reduce((sum, row) => sum + Number(row.sgst || 0), 0));
    const igst = money(rows.reduce((sum, row) => sum + Number(row.igst || 0), 0));
    const cess = money(rows.reduce((sum, row) => sum + Number(row.cess || 0), 0));
    return {
      month: range.month,
      note: "Export-ready GSTR-3B data. Direct GST portal filing is not performed.",
      outwardTaxableSupplies: { taxableValue, igst, cgst, sgst, cess },
      eligibleItc: { igst: 0, cgst: 0, sgst: 0, cess: 0 },
      reverseCharge: { taxableValue: 0, igst: 0, cgst: 0, sgst: 0, cess: 0 },
      taxPayable: { total: money(igst + cgst + sgst + cess) }
    };
  }

  hsnSummary(tenantId, from, to) {
    return {
      from,
      to,
      rows: taxRows(tenantId, from, to).map((row) => ({
        hsnSac: row.hsn_sac_code || "999729",
        description: row.item_name || "Salon service",
        gstRate: row.tax_rate,
        taxableValue: money(row.taxable_amount),
        igst: money(row.igst),
        cgst: money(row.cgst),
        sgst: money(row.sgst),
        cess: money(row.cess),
        taxAmount: money(Number(row.igst || 0) + Number(row.cgst || 0) + Number(row.sgst || 0) + Number(row.cess || 0))
      }))
    };
  }

  toExcel(report, title) {
    const rows = report.rows || report.b2b || [report.outwardTaxableSupplies || report];
    return tableHtml(Array.isArray(rows) ? rows : [rows], title);
  }
}

export const gstReportService = new GstReportService();
