import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { paymentService } from "./payment.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class StoreCreditService {
  create(payload = {}, access = {}) {
    const customerId = payload.customer_id || payload.customerId;
    const amount = money(payload.amount || 0);
    if (!customerId || amount <= 0) throw badRequest("customer_id and amount are required");
    if (!payload.source_invoice_id && !payload.sourceInvoiceId && !payload.source_refund_id && !payload.sourceRefundId) {
      throw badRequest("Store credit must link original invoice or refund");
    }
    const id = `sc_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO store_credits
        (id, tenant_id, customer_id, source_invoice_id, source_refund_id, amount, balance, expiry_date, reason, status, created_at)
       VALUES
        (@id, @tenantId, @customerId, @sourceInvoiceId, @sourceRefundId, @amount, @amount, @expiryDate, @reason, 'active', CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      customerId,
      sourceInvoiceId: payload.source_invoice_id || payload.sourceInvoiceId || "",
      sourceRefundId: payload.source_refund_id || payload.sourceRefundId || "",
      amount,
      expiryDate: payload.expiry_date || payload.expiryDate || "",
      reason: payload.reason || "store_credit"
    });
    this.tx(id, "", "issue", amount, amount, access);
    return { id, customerId, amount, balance: amount };
  }

  listCustomer(customerId, access = {}) {
    return db.prepare("SELECT * FROM store_credits WHERE tenant_id = ? AND customer_id = ? ORDER BY created_at DESC").all(access.tenantId, customerId);
  }

  redeem(payload = {}, access = {}) {
    const credit = db.prepare("SELECT * FROM store_credits WHERE tenant_id = ? AND id = ?").get(access.tenantId, payload.store_credit_id || payload.storeCreditId);
    if (!credit) throw notFound("Store credit not found");
    if (credit.status !== "active") throw conflict("Store credit is not active");
    if (credit.expiry_date && credit.expiry_date < new Date().toISOString().slice(0, 10)) throw conflict("Store credit is expired");
    const amount = money(payload.amount || 0);
    if (amount > Number(credit.balance || 0)) throw conflict("Store credit balance cannot go negative");
    const balance = money(Number(credit.balance || 0) - amount);
    db.prepare("UPDATE store_credits SET balance = ?, status = ? WHERE tenant_id = ? AND id = ?")
      .run(balance, balance <= 0 ? "redeemed" : "active", access.tenantId, credit.id);
    this.tx(credit.id, payload.invoice_id || payload.invoiceId || "", "redeem", -amount, balance, access);
    if (payload.invoice_id || payload.invoiceId) paymentService.pay(payload.invoice_id || payload.invoiceId, "wallet", { amount, reference_no: credit.id }, access);
    return { storeCreditId: credit.id, amount, balanceAfter: balance };
  }

  tx(storeCreditId, invoiceId, type, amount, balanceAfter, access = {}) {
    db.prepare(
      `INSERT INTO store_credit_transactions
        (id, tenant_id, store_credit_id, invoice_id, type, amount, balance_after, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(`sctx_${crypto.randomUUID().slice(0, 12)}`, access.tenantId, storeCreditId, invoiceId, type, amount, balanceAfter, access.userId || "");
  }
}

export const storeCreditService = new StoreCreditService();
