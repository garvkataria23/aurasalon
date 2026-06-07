import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";
import { realtimeService } from "./realtime.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class RefundService {
  refundInvoice(invoiceId, payload = {}, access = {}) {
    const invoice = billingService.requireInvoice(invoiceId, access);
    const amount = money(payload.amount || invoice.paid_amount || 0);
    if (!payload.reason) throw badRequest("Refund reason is required");
    if (amount <= 0) throw badRequest("Refund amount must be greater than zero");
    const refundable = money(Number(invoice.paid_amount || 0) - Number(invoice.refund_amount || 0));
    if (amount > refundable) throw conflict("Refund amount exceeds refundable paid amount");

    const refundNo = `RF-${String(Date.now()).slice(-8)}`;
    const taxReversal = money(Math.min(Number(invoice.tax_total || 0), amount * (Number(invoice.tax_total || 0) / Math.max(Number(invoice.grand_total || 1), 1))));
    const txn = db.transaction(() => {
      const refundId = `rfnd_${crypto.randomUUID().slice(0, 12)}`;
      const approved = Boolean(payload.approved_by || payload.approvedBy || ["owner", "admin", "manager"].includes(access.role));
      db.prepare(
        `INSERT INTO invoice_refunds
          (id, tenant_id, invoice_id, payment_id, refund_no, refund_type, amount, tax_reversal_amount,
           reason, provider_refund_id, status, approved_by, processed_by, processed_at, created_at)
         VALUES
          (@id, @tenantId, @invoiceId, @paymentId, @refundNo, @refundType, @amount, @taxReversal,
           @reason, @providerRefundId, @status, @approvedBy, @processedBy, @processedAt, CURRENT_TIMESTAMP)`
      ).run({
        id: refundId,
        tenantId: access.tenantId,
        invoiceId,
        paymentId: payload.payment_id || payload.paymentId || "",
        refundNo,
        refundType: payload.refund_type || payload.refundType || "original_payment",
        amount,
        taxReversal,
        reason: payload.reason,
        providerRefundId: payload.provider_refund_id || payload.providerRefundId || "",
        status: approved ? "processed" : "pending_approval",
        approvedBy: payload.approved_by || payload.approvedBy || (["owner", "admin", "manager"].includes(access.role) ? access.userId : ""),
        processedBy: access.userId || "",
        processedAt: new Date().toISOString()
      });
      const refundAmount = money(Number(invoice.refund_amount || 0) + amount);
      const status = refundAmount >= Number(invoice.paid_amount || 0) - 0.01 ? "refunded" : "partially_refunded";
      db.prepare(
        `UPDATE invoices
            SET refund_amount = @refundAmount,
                status = @status,
                updated_at = CURRENT_TIMESTAMP
          WHERE tenant_id = @tenantId AND id = @invoiceId`
      ).run({ refundAmount, status, tenantId: access.tenantId, invoiceId });
      billingService.writeEvent({
        tenantId: access.tenantId,
        invoiceId,
        eventType: "invoice.refunded",
        actorUserId: access.userId || "",
        payload: { refundId, amount, taxReversal, reason: payload.reason, status }
      });
      realtimeService.broadcast("invoice:refunded", { invoiceId, amount, status }, { tenantId: access.tenantId, branchId: invoice.branch_id });
      return { refundId, refundNo, amount, taxReversal, status };
    });
    return txn();
  }
}

export const refundService = new RefundService();
