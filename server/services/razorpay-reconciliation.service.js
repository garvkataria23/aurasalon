import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { realtimeService } from "./realtime.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function day(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export class RazorpayReconciliationService {
  fetchSettlement({ date, branchId = "" } = {}, access = {}) {
    const settlementDate = day(date);
    const payments = db.prepare(
      `SELECT ip.*, i.branch_id
         FROM invoice_payments ip
         JOIN invoices i ON i.tenant_id = ip.tenant_id AND i.id = ip.invoice_id
        WHERE ip.tenant_id = @tenantId
          AND ip.provider = 'razorpay'
          AND ip.status = 'paid'
          AND substr(ip.paid_at, 1, 10) = @settlementDate
          ${branchId ? "AND i.branch_id = @branchId" : ""}`
    ).all({ tenantId: access.tenantId, settlementDate, branchId });
    const captured = money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const fees = money(captured * 0.02);
    const taxOnFees = money(fees * 0.18);
    const refunds = db.prepare(
      `SELECT SUM(ir.amount) AS amount
         FROM invoice_refunds ir
         JOIN invoices i ON i.tenant_id = ir.tenant_id AND i.id = ir.invoice_id
        WHERE ir.tenant_id = @tenantId
          AND substr(ir.created_at, 1, 10) = @settlementDate
          ${branchId ? "AND i.branch_id = @branchId" : ""}`
    ).get({ tenantId: access.tenantId, settlementDate, branchId });
    const refundTotal = money(refunds?.amount || 0);
    const expected = money(captured - fees - taxOnFees - refundTotal);
    const settled = money(Number(process.env.RAZORPAY_SETTLEMENT_OVERRIDE || expected));
    const difference = money(settled - expected);
    const status = Math.abs(difference) <= 0.01 ? "matched" : "mismatch";
    const id = `recon_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO payment_reconciliation
        (id, tenant_id, branch_id, provider, provider_settlement_id, settlement_date, expected_amount,
         settled_amount, fees, tax_on_fees, refunds, adjustments, difference, status, raw_payload, created_at)
       VALUES
        (@id, @tenantId, @branchId, 'razorpay', @providerSettlementId, @settlementDate, @expectedAmount,
         @settledAmount, @fees, @taxOnFees, @refunds, 0, @difference, @status, @rawPayload, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId,
      providerSettlementId: `rzp_${settlementDate}_${Date.now()}`,
      settlementDate,
      expectedAmount: expected,
      settledAmount: settled,
      fees,
      taxOnFees,
      refunds: refundTotal,
      difference,
      status,
      rawPayload: JSON.stringify({ mode: "local_reconciliation", payments: payments.length })
    });
    if (status === "mismatch") {
      realtimeService.broadcast("reconciliation:mismatch", { id, settlementDate, difference }, { tenantId: access.tenantId, branchId });
    }
    return this.get(id, access);
  }

  list(query = {}, access = {}) {
    const where = ["tenant_id = @tenantId"];
    const params = { tenantId: access.tenantId };
    if (query.provider) {
      where.push("provider = @provider");
      params.provider = query.provider;
    }
    if (query.status) {
      where.push("status = @status");
      params.status = query.status;
    }
    if (query.from) {
      where.push("settlement_date >= @from");
      params.from = query.from;
    }
    if (query.to) {
      where.push("settlement_date <= @to");
      params.to = query.to;
    }
    return db.prepare(`SELECT * FROM payment_reconciliation WHERE ${where.join(" AND ")} ORDER BY settlement_date DESC`).all(params);
  }

  get(id, access = {}) {
    const row = db.prepare("SELECT * FROM payment_reconciliation WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Reconciliation row not found");
    return row;
  }

  markReviewed(id, payload = {}, access = {}) {
    if (!id) throw badRequest("id is required");
    const row = this.get(id, access);
    db.prepare(
      "UPDATE payment_reconciliation SET status = @status, reviewed_by = @reviewedBy, reviewed_at = CURRENT_TIMESTAMP WHERE tenant_id = @tenantId AND id = @id"
    ).run({ status: payload.status || "reviewed", reviewedBy: access.userId || "", tenantId: access.tenantId, id });
    return { ...row, status: payload.status || "reviewed", reviewed_by: access.userId || "" };
  }
}

export const razorpayReconciliationService = new RazorpayReconciliationService();
