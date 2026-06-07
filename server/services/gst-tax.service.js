import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function splitTax(taxableAmount, taxRate, placeOfSupply = "", branchState = "") {
  const interState = placeOfSupply && branchState && String(placeOfSupply).toLowerCase() !== String(branchState).toLowerCase();
  if (interState) return { igst: money((taxableAmount * taxRate) / 100), cgst: 0, sgst: 0, cess: 0 };
  return { igst: 0, cgst: money((taxableAmount * taxRate) / 200), sgst: money((taxableAmount * taxRate) / 200), cess: 0 };
}

export class GstTaxService {
  calculateItem({ amount, taxRate = 18, inclusive = false, placeOfSupply = "", branchState = "" }) {
    const gross = money(amount);
    const taxable = inclusive ? money(gross / (1 + Number(taxRate || 0) / 100)) : gross;
    const split = splitTax(taxable, Number(taxRate || 0), placeOfSupply, branchState);
    const taxAmount = money(split.igst + split.cgst + split.sgst + split.cess);
    return { taxableAmount: taxable, taxAmount, total: inclusive ? gross : money(taxable + taxAmount), ...split };
  }

  taxPreview(invoiceId, access = {}) {
    if (!invoiceId) throw badRequest("invoiceId is required");
    const invoice = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND id = ?").get(access.tenantId, invoiceId);
    if (!invoice) throw notFound("Invoice not found");
    const rows = db
      .prepare(
        `SELECT ii.id, ii.item_name, ii.hsn_sac_code, ii.tax_rate, ii.taxable_amount, ii.tax_amount,
                SUM(CASE WHEN it.tax_type = 'CGST' THEN it.tax_amount ELSE 0 END) AS cgst,
                SUM(CASE WHEN it.tax_type = 'SGST' THEN it.tax_amount ELSE 0 END) AS sgst,
                SUM(CASE WHEN it.tax_type = 'IGST' THEN it.tax_amount ELSE 0 END) AS igst,
                SUM(CASE WHEN it.tax_type = 'CESS' THEN it.tax_amount ELSE 0 END) AS cess
           FROM invoice_items ii
           LEFT JOIN invoice_taxes it ON it.tenant_id = ii.tenant_id AND it.invoice_item_id = ii.id
          WHERE ii.tenant_id = ? AND ii.invoice_id = ?
          GROUP BY ii.id
          ORDER BY ii.created_at, ii.id`
      )
      .all(access.tenantId, invoiceId)
      .map((row) => ({
        ...row,
        taxable_amount: money(row.taxable_amount),
        tax_amount: money(row.tax_amount),
        cgst: money(row.cgst),
        sgst: money(row.sgst),
        igst: money(row.igst),
        cess: money(row.cess)
      }));
    return {
      invoiceId,
      invoiceNo: invoice.invoice_no,
      gstin: invoice.gstin || "",
      placeOfSupply: invoice.place_of_supply || "",
      b2b: Boolean(invoice.gstin),
      b2c: !invoice.gstin,
      rows,
      totals: {
        taxableAmount: money(rows.reduce((sum, row) => sum + Number(row.taxable_amount || 0), 0)),
        cgst: money(rows.reduce((sum, row) => sum + Number(row.cgst || 0), 0)),
        sgst: money(rows.reduce((sum, row) => sum + Number(row.sgst || 0), 0)),
        igst: money(rows.reduce((sum, row) => sum + Number(row.igst || 0), 0)),
        cess: money(rows.reduce((sum, row) => sum + Number(row.cess || 0), 0)),
        taxAmount: money(rows.reduce((sum, row) => sum + Number(row.tax_amount || 0), 0))
      }
    };
  }

  eInvoiceJson(invoiceId, access = {}) {
    const preview = this.taxPreview(invoiceId, access);
    const invoice = db.prepare("SELECT * FROM invoices WHERE tenant_id = ? AND id = ?").get(access.tenantId, invoiceId);
    return {
      version: "1.1",
      purpose: "export_ready_not_direct_filing",
      irn: invoice.irn || "",
      signedQRCode: invoice.e_invoice_qr || "",
      acknowledgementNumber: invoice.e_invoice_ack_no || "",
      acknowledgementDate: invoice.e_invoice_ack_date || "",
      document: {
        type: invoice.invoice_type || "tax_invoice",
        number: invoice.invoice_no,
        date: String(invoice.created_at || "").slice(0, 10)
      },
      seller: {
        gstin: invoice.gstin || "",
        placeOfSupply: invoice.place_of_supply || ""
      },
      buyer: {
        customerId: invoice.customer_id || "",
        gstin: invoice.gstin || "",
        type: preview.b2b ? "B2B" : "B2C"
      },
      items: preview.rows,
      totals: preview.totals
    };
  }
}

export const gstTaxService = new GstTaxService();
