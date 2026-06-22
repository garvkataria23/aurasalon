import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";
import { realtimeService } from "./realtime.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class TipsService {
  addTip(invoiceId, payload = {}, access = {}) {
    const invoice = billingService.requireInvoice(invoiceId, access);
    const staffId = payload.staff_id || payload.staffId;
    const amount = money(payload.amount || 0);
    if (!staffId) throw badRequest("staffId is required for tip");
    if (amount <= 0) throw badRequest("Tip amount must be greater than zero");
    const id = `tip_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO invoice_tips
        (id, tenant_id, invoice_id, staff_id, amount, payment_mode, tip_pool_id, created_at)
       VALUES
        (@id, @tenantId, @invoiceId, @staffId, @amount, @paymentMode, @tipPoolId, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      invoiceId,
      staffId,
      amount,
      paymentMode: payload.payment_mode || payload.paymentMode || "cash",
      tipPoolId: payload.tip_pool_id || payload.tipPoolId || ""
    });
    db.prepare("UPDATE invoices SET tip_total = tip_total + ?, grand_total = grand_total + ?, due_amount = due_amount + ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .run(amount, amount, amount, access.tenantId, invoiceId);
    billingService.writeEvent({ tenantId: access.tenantId, invoiceId, eventType: "tip.added", actorUserId: access.userId || "", payload: { tipId: id, staffId, amount } });
    realtimeService.broadcast("tip:added", { invoiceId, tipId: id, staffId, amount }, { tenantId: access.tenantId, branchId: invoice.branch_id });
    return { id, invoiceId, staffId, amount };
  }

  report(query = {}, access = {}) {
    const where = ["it.tenant_id = @tenantId"];
    const params = { tenantId: access.tenantId };
    if (query.branchId || query.branch_id || access.branchId) {
      where.push("i.branch_id = @branchId");
      params.branchId = query.branchId || query.branch_id || access.branchId;
    }
    if (query.from) {
      where.push("substr(it.created_at, 1, 10) >= @from");
      params.from = query.from;
    }
    if (query.to) {
      where.push("substr(it.created_at, 1, 10) <= @to");
      params.to = query.to;
    }
    const rows = db.prepare(
      `SELECT it.staff_id AS staffId, it.payment_mode AS paymentMode, it.tip_pool_id AS tipPoolId,
              COUNT(*) AS count, SUM(it.amount) AS amount
         FROM invoice_tips it
         JOIN invoices i ON i.tenant_id = it.tenant_id AND i.id = it.invoice_id
        WHERE ${where.join(" AND ")}
        GROUP BY it.staff_id, it.payment_mode, it.tip_pool_id
        ORDER BY amount DESC`
    ).all(params);
    if (!rows) throw notFound("No tips found");
    return {
      rows: rows.map((row) => ({ ...row, amount: money(row.amount) })),
      total: money(rows.reduce((sum, row) => sum + Number(row.amount || 0), 0))
    };
  }
}

export const tipsService = new TipsService();
