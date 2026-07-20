import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { realtimeService } from "./realtime.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const PROVIDER_MODES = {
  razorpay: ["razorpay"],
  upi: ["upi", "gpay", "googlepay", "paytm", "phonepe"],
  card: ["card", "credit_card", "debit_card", "credit", "debit"],
  bank: ["bank", "bank_transfer", "neft", "rtgs", "imps"]
};

function day(value = "") {
  return /^\d{4}-\d{2}-\d{2}$/.test(String(value)) ? value : new Date(Date.now() - 86_400_000).toISOString().slice(0, 10);
}

export class RazorpayReconciliationService {
  fetchSettlement({ date, branchId = "" } = {}, access = {}) {
    return this.matchSettlement({ provider: "razorpay", date, branchId }, access);
  }

  matchSettlement(payload = {}, access = {}) {
    const provider = String(payload.provider || "razorpay").trim().toLowerCase();
    const modes = PROVIDER_MODES[provider] || PROVIDER_MODES.razorpay;
    const settlementDate = day(payload.date || payload.settlementDate || payload.settlement_date);
    const branchId = payload.branchId || access.requestedBranchId || access.branchId || "";
    const modeParams = Object.fromEntries(modes.map((mode, index) => [`mode${index}`, mode]));
    const modeWhere = modes.map((_, index) => `@mode${index}`).join(", ");
    const payments = db.prepare(
      `SELECT ip.*, i.branch_id
         FROM invoice_payments ip
         JOIN invoices i ON i.tenant_id = ip.tenant_id AND i.id = ip.invoice_id
        WHERE ip.tenant_id = @tenantId
          AND (
            lower(COALESCE(NULLIF(ip.provider, ''), ip.payment_mode)) IN (${modeWhere})
            OR lower(ip.payment_mode) IN (${modeWhere})
          )
          AND ip.status = 'paid'
          AND substr(ip.paid_at, 1, 10) = @settlementDate
          ${branchId ? "AND i.branch_id = @branchId" : ""}`
    ).all({ tenantId: access.tenantId, settlementDate, branchId, ...modeParams });
    const captured = money(payments.reduce((sum, payment) => sum + Number(payment.amount || 0), 0));
    const feePercent = Number(payload.feePercent ?? payload.fee_percent ?? 2);
    const taxPercent = Number(payload.taxPercent ?? payload.tax_percent ?? 18);
    const fees = payload.fees !== undefined ? money(payload.fees) : money(captured * (feePercent / 100));
    const taxOnFees = payload.taxOnFees !== undefined || payload.tax_on_fees !== undefined
      ? money(payload.taxOnFees ?? payload.tax_on_fees)
      : money(fees * (taxPercent / 100));
    const refunds = db.prepare(
      `SELECT SUM(ir.amount) AS amount
         FROM invoice_refunds ir
         JOIN invoices i ON i.tenant_id = ir.tenant_id AND i.id = ir.invoice_id
        WHERE ir.tenant_id = @tenantId
          AND substr(ir.created_at, 1, 10) = @settlementDate
          ${branchId ? "AND i.branch_id = @branchId" : ""}
          AND EXISTS (
            SELECT 1 FROM invoice_payments ip
             WHERE ip.tenant_id = ir.tenant_id
               AND ip.invoice_id = ir.invoice_id
               AND (
                 lower(COALESCE(NULLIF(ip.provider, ''), ip.payment_mode)) IN (${modeWhere})
                 OR lower(ip.payment_mode) IN (${modeWhere})
               )
          )`
    ).get({ tenantId: access.tenantId, settlementDate, branchId, ...modeParams });
    const refundTotal = money(refunds?.amount || 0);
    const adjustments = money(payload.adjustments ?? payload.adjustmentAmount ?? payload.adjustment_amount ?? 0);
    const expected = money(captured - fees - taxOnFees - refundTotal + adjustments);
    const settled = money(payload.settledAmount ?? payload.settled_amount ?? (provider === "razorpay" ? process.env.RAZORPAY_SETTLEMENT_OVERRIDE : expected) ?? expected);
    const difference = money(settled - expected);
    const status = Math.abs(difference) <= 0.01 ? "matched" : "mismatch";
    const id = `recon_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO payment_reconciliation
        (id, tenant_id, branch_id, provider, provider_settlement_id, settlement_date, expected_amount,
         settled_amount, fees, tax_on_fees, refunds, adjustments, difference, status, raw_payload, created_at)
       VALUES
        (@id, @tenantId, @branchId, @provider, @providerSettlementId, @settlementDate, @expectedAmount,
          @settledAmount, @fees, @taxOnFees, @refunds, @adjustments, @difference, @status, @rawPayload, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId,
      provider,
      providerSettlementId: payload.providerSettlementId || payload.provider_settlement_id || `${provider}_${settlementDate}_${Date.now()}`,
      settlementDate,
      expectedAmount: expected,
      settledAmount: settled,
      fees,
      taxOnFees,
      refunds: refundTotal,
      adjustments,
      difference,
      status,
      rawPayload: JSON.stringify({
        mode: "local_reconciliation",
        provider,
        paymentCount: payments.length,
        paymentIds: payments.map((payment) => payment.id),
        invoiceIds: [...new Set(payments.map((payment) => payment.invoice_id).filter(Boolean))],
        feePercent,
        taxPercent
      })
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
