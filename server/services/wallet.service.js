import { db } from "../db.js";
import { badRequest, conflict } from "../utils/app-error.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class WalletService {
  balance(customerId, access = {}) {
    const row = db
      .prepare(
        `SELECT balance_after
           FROM wallet_transactions
          WHERE tenant_id = ? AND customer_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1`
      )
      .get(access.tenantId, customerId);
    return money(row?.balance_after || 0);
  }

  transact({ customerId, invoiceId = "", type, amount, description = "", expiryDate = "" }, access = {}) {
    if (!customerId || !type) throw badRequest("customerId and type are required");
    const signedAmount = ["debit", "use", "refund_reversal"].includes(type) ? -Math.abs(money(amount)) : money(amount);
    const nextBalance = money(this.balance(customerId, access) + signedAmount);
    if (nextBalance < 0) throw conflict("Wallet balance cannot go negative");
    const id = `wlt_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO wallet_transactions
        (id, tenant_id, customer_id, invoice_id, type, amount, balance_after, expiry_date, description, created_at)
       VALUES
        (@id, @tenantId, @customerId, @invoiceId, @type, @amount, @balanceAfter, @expiryDate, @description, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      customerId,
      invoiceId,
      type,
      amount: signedAmount,
      balanceAfter: nextBalance,
      expiryDate,
      description
    });
    return { id, customerId, type, amount: signedAmount, balanceAfter: nextBalance };
  }

  recharge(customerId, amount, access, invoiceId = "") {
    return this.transact({ customerId, invoiceId, type: "recharge", amount, description: "Wallet recharge" }, access);
  }

  use(customerId, amount, access, invoiceId = "") {
    return this.transact({ customerId, invoiceId, type: "use", amount, description: "Wallet used for invoice" }, access);
  }

  refund(customerId, amount, access, invoiceId = "") {
    return this.transact({ customerId, invoiceId, type: "refund", amount, description: "Invoice refund to wallet" }, access);
  }
}

export const walletService = new WalletService();
