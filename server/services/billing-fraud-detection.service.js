import { db } from "../db.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class BillingFraudDetectionService {
  alerts(query = {}, access = {}) {
    const alerts = [];
    const from = query.from || new Date(Date.now() - 30 * 86_400_000).toISOString().slice(0, 10);
    const to = query.to || new Date().toISOString().slice(0, 10);
    const params = { tenantId: access.tenantId, from, to };
    const discounts = db.prepare(
      `SELECT created_by AS userId, COUNT(*) AS count, SUM(discount_total) AS amount
         FROM invoices
        WHERE tenant_id = @tenantId AND substr(created_at, 1, 10) BETWEEN @from AND @to
        GROUP BY created_by HAVING amount > 10000 OR count > 20`
    ).all(params);
    discounts.forEach((row) => alerts.push({ type: "excessive_discounts", severity: "warning", userId: row.userId, amount: money(row.amount), count: row.count }));
    const voids = db.prepare(
      `SELECT voided_by AS userId, COUNT(*) AS count
         FROM invoice_voids
        WHERE tenant_id = @tenantId AND substr(created_at, 1, 10) BETWEEN @from AND @to
        GROUP BY voided_by HAVING count >= 3`
    ).all(params);
    voids.forEach((row) => alerts.push({ type: "excessive_voids", severity: "warning", userId: row.userId, count: row.count }));
    const refunds = db.prepare(
      `SELECT processed_by AS userId, COUNT(*) AS count, SUM(amount) AS amount
         FROM invoice_refunds
        WHERE tenant_id = @tenantId AND substr(created_at, 1, 10) BETWEEN @from AND @to
        GROUP BY processed_by HAVING amount > 15000 OR count > 5`
    ).all(params);
    refunds.forEach((row) => alerts.push({ type: "refund_abuse", severity: "warning", userId: row.userId, amount: money(row.amount), count: row.count }));
    const cashMismatch = db.prepare(
      `SELECT id, branch_id, closing_date, difference
         FROM daily_closing
        WHERE tenant_id = @tenantId AND ABS(difference) > 0 AND closing_date BETWEEN @from AND @to`
    ).all(params);
    cashMismatch.forEach((row) => alerts.push({ type: "cash_mismatch", severity: "critical", ...row }));
    return alerts;
  }

  resolve(id, payload = {}, access = {}) {
    return { id, resolved: true, resolvedBy: access.userId || "", note: payload.note || "" };
  }
}

export const billingFraudDetectionService = new BillingFraudDetectionService();
