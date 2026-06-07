import { db } from "../db.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function filters(query = {}, access = {}) {
  const where = ["tenant_id = @tenantId"];
  const params = { tenantId: access.tenantId };
  if (query.branchId || query.branch_id || access.branchId) {
    where.push("branch_id = @branchId");
    params.branchId = query.branchId || query.branch_id || access.branchId;
  }
  if (query.from) {
    where.push("substr(created_at, 1, 10) >= @from");
    params.from = query.from;
  }
  if (query.to) {
    where.push("substr(created_at, 1, 10) <= @to");
    params.to = query.to;
  }
  return { where, params };
}

export class BillingAnalyticsService {
  summary(query = {}, access = {}) {
    const { where, params } = filters(query, access);
    const row = db.prepare(
      `SELECT COUNT(*) AS invoiceCount, SUM(grand_total) AS revenue, AVG(grand_total) AS avgBill,
              SUM(refund_amount) AS refunds, SUM(discount_total) AS discounts, SUM(tax_total) AS taxes,
              SUM(tip_total) AS tips, SUM(due_amount) AS due
         FROM invoices
        WHERE ${where.join(" AND ")} AND status NOT IN ('draft', 'voided', 'cancelled')`
    ).get(params);
    return {
      invoiceCount: Number(row?.invoiceCount || 0),
      revenue: money(row?.revenue),
      avgBill: money(row?.avgBill),
      refundRate: row?.revenue ? money((Number(row.refunds || 0) / Number(row.revenue || 1)) * 100) : 0,
      discountPct: row?.revenue ? money((Number(row.discounts || 0) / Number(row.revenue || 1)) * 100) : 0,
      taxCollected: money(row?.taxes),
      tips: money(row?.tips),
      dueAmount: money(row?.due)
    };
  }

  paymentSplit(query = {}, access = {}) {
    const { where, params } = filters(query, access);
    return db.prepare(
      `SELECT ip.payment_mode AS mode, SUM(ip.amount) AS amount, COUNT(*) AS count
         FROM invoice_payments ip
         JOIN invoices i ON i.tenant_id = ip.tenant_id AND i.id = ip.invoice_id
        WHERE ${where.map((clause) => clause.replace(/^tenant_id/, "i.tenant_id").replace(/^branch_id/, "i.branch_id").replace(/^substr\(created_at/, "substr(i.created_at")).join(" AND ")}
          AND ip.status = 'paid'
        GROUP BY ip.payment_mode
        ORDER BY amount DESC`
    ).all(params).map((row) => ({ ...row, amount: money(row.amount) }));
  }

  margin(query = {}, access = {}) {
    const { where, params } = filters(query, access);
    return db.prepare(
      `SELECT SUM(m.revenue) AS revenue, SUM(m.product_cost) AS productCost,
              SUM(m.service_consumable_cost) AS serviceConsumableCost,
              SUM(m.staff_commission) AS staffCommission, SUM(m.gross_margin) AS grossMargin
         FROM invoice_item_margins m
         JOIN invoices i ON i.tenant_id = m.tenant_id AND i.id = m.invoice_id
        WHERE ${where.map((clause) => clause.replace(/^tenant_id/, "i.tenant_id").replace(/^branch_id/, "i.branch_id").replace(/^substr\(created_at/, "substr(i.created_at")).join(" AND ")}`
    ).get(params);
  }
}

export const billingAnalyticsService = new BillingAnalyticsService();
