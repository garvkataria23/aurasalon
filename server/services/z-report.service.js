import { randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";

const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function requireTable(table) {
  if (!safeColumns(table).length) throw badRequest(`${table} migration is not applied`);
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

export class ZReportService {
  generate(payload = {}, access = {}) {
    requireTable("z_reports");
    const branchId = payload.branch_id || payload.branchId || access.branchId;
    const businessDate = payload.business_date || payload.businessDate || payload.date;
    if (!branchId || !businessDate) throw badRequest("branch_id and business_date are required");
    const invoices = db
      .prepare("SELECT * FROM invoices WHERE tenant_id = ? AND branch_id = ? AND date(created_at) = date(?)")
      .all(access.tenantId, branchId, businessDate);
    const payments = db
      .prepare(
        `SELECT ip.payment_mode, SUM(ip.amount) AS amount
           FROM invoice_payments ip
           JOIN invoices i ON i.tenant_id = ip.tenant_id AND i.id = ip.invoice_id
          WHERE ip.tenant_id = ? AND i.branch_id = ? AND date(COALESCE(ip.paid_at, ip.created_at)) = date(?)
          GROUP BY ip.payment_mode`
      )
      .all(access.tenantId, branchId, businessDate);
    const paymentMap = Object.fromEntries(payments.map((row) => [row.payment_mode, money(row.amount)]));
    const salesTotal = money(invoices.reduce((sum, invoice) => sum + Number(invoice.grand_total || 0), 0));
    const refundTotal = money(invoices.reduce((sum, invoice) => sum + Number(invoice.refund_amount || 0), 0));
    const openingCash = Number(payload.opening_cash || payload.openingCash || 0);
    const closingCash = Number(payload.closing_cash || payload.closingCash || 0);
    const reportJson = {
      invoices,
      payments,
      generatedAt: new Date().toISOString(),
      revised: Boolean(payload.revised)
    };
    const existing = db
      .prepare("SELECT * FROM z_reports WHERE tenant_id = ? AND branch_id = ? AND business_date = ? ORDER BY generated_at DESC LIMIT 1")
      .get(access.tenantId, branchId, businessDate);
    const reportNo = existing ? `${existing.report_no}-R${Date.now().toString().slice(-4)}` : `ZR-${businessDate.replace(/-/g, "")}-${branchId.slice(-4)}`;
    const id = makeId("zrep");
    db.prepare(
      `INSERT INTO z_reports
        (id, tenant_id, branch_id, business_date, report_no, sales_total, refund_total, net_sales, tax_total,
         discount_total, cash_total, upi_total, card_total, wallet_total, razorpay_total, tips_total,
         invoice_count, void_count, refund_count, opening_cash, closing_cash, cash_difference, generated_by,
         generated_at, report_json)
       VALUES
        (@id, @tenantId, @branchId, @businessDate, @reportNo, @salesTotal, @refundTotal, @netSales, @taxTotal,
         @discountTotal, @cashTotal, @upiTotal, @cardTotal, @walletTotal, @razorpayTotal, @tipsTotal,
         @invoiceCount, @voidCount, @refundCount, @openingCash, @closingCash, @cashDifference, @generatedBy,
         CURRENT_TIMESTAMP, @reportJson)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId,
      businessDate,
      reportNo,
      salesTotal,
      refundTotal,
      netSales: money(salesTotal - refundTotal),
      taxTotal: money(invoices.reduce((sum, invoice) => sum + Number(invoice.tax_total || 0), 0)),
      discountTotal: money(invoices.reduce((sum, invoice) => sum + Number(invoice.discount_total || 0), 0)),
      cashTotal: paymentMap.cash || 0,
      upiTotal: paymentMap.upi || 0,
      cardTotal: paymentMap.card || 0,
      walletTotal: paymentMap.wallet || 0,
      razorpayTotal: paymentMap.razorpay || 0,
      tipsTotal: money(invoices.reduce((sum, invoice) => sum + Number(invoice.tip_total || 0), 0)),
      invoiceCount: invoices.length,
      voidCount: invoices.filter((invoice) => invoice.status === "voided").length,
      refundCount: invoices.filter((invoice) => Number(invoice.refund_amount || 0) > 0).length,
      openingCash,
      closingCash,
      cashDifference: money(closingCash - (openingCash + (paymentMap.cash || 0))),
      generatedBy: access.userId || "",
      reportJson: JSON.stringify(reportJson)
    });
    return this.get(branchId, businessDate, access);
  }

  get(branchId, businessDate, access = {}) {
    requireTable("z_reports");
    const row = db
      .prepare("SELECT * FROM z_reports WHERE tenant_id = ? AND branch_id = ? AND business_date = ? ORDER BY generated_at DESC LIMIT 1")
      .get(access.tenantId, branchId, businessDate);
    if (!row) throw notFound("Z report not found");
    return row;
  }

  export(branchId, businessDate, format = "json", access = {}) {
    const report = this.get(branchId, businessDate, access);
    if (format === "excel") {
      return { format, filename: `${report.report_no}.csv`, contentType: "text/csv", body: this.toCsv(report) };
    }
    if (format === "pdf") {
      return { format, filename: `${report.report_no}.html`, contentType: "text/html", body: this.toHtml(report) };
    }
    return { format: "json", report };
  }

  toCsv(report) {
    return [
      "Metric,Value",
      `Report No,${report.report_no}`,
      `Sales Total,${report.sales_total}`,
      `Refund Total,${report.refund_total}`,
      `Net Sales,${report.net_sales}`,
      `Tax Total,${report.tax_total}`,
      `Cash Total,${report.cash_total}`,
      `Invoice Count,${report.invoice_count}`
    ].join("\n");
  }

  toHtml(report) {
    return `<!doctype html><html><body><h1>Z Report ${report.report_no}</h1><p>Business date: ${report.business_date}</p><p>Net sales: ${report.net_sales}</p><p>Invoices: ${report.invoice_count}</p></body></html>`;
  }
}

export const zReportService = new ZReportService();
