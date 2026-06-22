import { createHash } from "node:crypto";
import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { paymentService } from "./payment.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const hashCode = (code) => createHash("sha256").update(String(code || "").trim().toUpperCase()).digest("hex");

export class GiftCardService {
  sell(payload = {}, access = {}) {
    const code = payload.code || crypto.randomUUID().replace(/-/g, "").slice(0, 16).toUpperCase();
    const amount = money(payload.amount || payload.initial_value || payload.initialValue || 0);
    if (amount <= 0) throw badRequest("Gift card amount must be greater than zero");
    const id = `gc_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO gift_cards
        (id, tenant_id, branch_id, code_hash, display_code_last4, customer_id, purchaser_customer_id,
         initial_value, balance, currency, expiry_date, status, created_invoice_id, created_at)
       VALUES
        (@id, @tenantId, @branchId, @codeHash, @last4, @customerId, @purchaserCustomerId,
         @amount, @amount, 'INR', @expiryDate, 'active', @invoiceId, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId: payload.branch_id || payload.branchId || access.branchId || "",
      codeHash: hashCode(code),
      last4: code.slice(-4),
      customerId: payload.customer_id || payload.customerId || "",
      purchaserCustomerId: payload.purchaser_customer_id || payload.purchaserCustomerId || "",
      amount,
      expiryDate: payload.expiry_date || payload.expiryDate || "",
      invoiceId: payload.invoice_id || payload.invoiceId || ""
    });
    this.tx(id, "", "issue", amount, amount, "Gift card issued", access);
    return { giftCardId: id, displayCodeLast4: code.slice(-4), code, amount };
  }

  findByCode(code, access = {}) {
    const card = db.prepare("SELECT * FROM gift_cards WHERE tenant_id = ? AND code_hash = ?").get(access.tenantId, hashCode(code));
    if (!card) throw notFound("Gift card not found");
    return card;
  }

  status(code, access = {}) {
    const card = this.findByCode(code, access);
    return { status: card.status, balance: card.balance, displayCodeLast4: card.display_code_last4, expiryDate: card.expiry_date };
  }

  redeem(payload = {}, access = {}) {
    const card = this.findByCode(payload.code, access);
    if (card.status !== "active") throw conflict("Gift card is not active");
    if (card.expiry_date && card.expiry_date < new Date().toISOString().slice(0, 10)) throw conflict("Gift card is expired");
    const amount = money(payload.amount || 0);
    if (amount <= 0) throw badRequest("Redemption amount is required");
    if (amount > Number(card.balance || 0)) throw conflict("Gift card balance cannot go negative");
    const balance = money(Number(card.balance || 0) - amount);
    db.prepare("UPDATE gift_cards SET balance = ?, status = ? WHERE tenant_id = ? AND id = ?")
      .run(balance, balance <= 0 ? "redeemed" : "active", access.tenantId, card.id);
    this.tx(card.id, payload.invoice_id || payload.invoiceId || "", "redeem", -amount, balance, "Gift card redeemed", access);
    if (payload.invoice_id || payload.invoiceId) paymentService.pay(payload.invoice_id || payload.invoiceId, "gift_card", { amount, reference_no: card.display_code_last4 }, access);
    return { giftCardId: card.id, amount, balanceAfter: balance };
  }

  tx(giftCardId, invoiceId, type, amount, balanceAfter, description, access = {}) {
    db.prepare(
      `INSERT INTO gift_card_transactions
        (id, tenant_id, gift_card_id, invoice_id, type, amount, balance_after, description, created_by, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(`gctx_${crypto.randomUUID().slice(0, 12)}`, access.tenantId, giftCardId, invoiceId, type, amount, balanceAfter, description, access.userId || "");
  }
}

export const giftCardService = new GiftCardService();
