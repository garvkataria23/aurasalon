import { db } from "../db.js";
import { badRequest, conflict } from "../utils/app-error.js";

export class LoyaltyService {
  balance(customerId, access = {}) {
    const row = db
      .prepare(
        `SELECT balance_after
           FROM loyalty_transactions
          WHERE tenant_id = ? AND customer_id = ?
          ORDER BY created_at DESC, id DESC
          LIMIT 1`
      )
      .get(access.tenantId, customerId);
    return Number(row?.balance_after || 0);
  }

  transact({ customerId, invoiceId = "", type, points, description = "" }, access = {}) {
    if (!customerId || !type) throw badRequest("customerId and type are required");
    const signedPoints = ["redeem", "reverse_earn"].includes(type) ? -Math.abs(Number(points || 0)) : Math.abs(Number(points || 0));
    const nextBalance = this.balance(customerId, access) + signedPoints;
    if (nextBalance < 0) throw conflict("Loyalty balance cannot go negative");
    const id = `loy_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO loyalty_transactions
        (id, tenant_id, customer_id, invoice_id, type, points, balance_after, description, created_at)
       VALUES
        (@id, @tenantId, @customerId, @invoiceId, @type, @points, @balanceAfter, @description, CURRENT_TIMESTAMP)`
    ).run({ id, tenantId: access.tenantId, customerId, invoiceId, type, points: signedPoints, balanceAfter: nextBalance, description });
    return { id, customerId, type, points: signedPoints, balanceAfter: nextBalance };
  }

  earn(customerId, invoiceId, invoiceAmount, access = {}) {
    return this.transact({ customerId, invoiceId, type: "earn", points: Math.floor(Number(invoiceAmount || 0) / 100), description: "Invoice loyalty earn" }, access);
  }

  redeem(customerId, invoiceId, points, access = {}) {
    return this.transact({ customerId, invoiceId, type: "redeem", points, description: "Invoice loyalty redemption" }, access);
  }

  reverse(customerId, invoiceId, points, access = {}) {
    return this.transact({ customerId, invoiceId, type: "reverse_earn", points, description: "Invoice loyalty reversal" }, access);
  }
}

export const loyaltyService = new LoyaltyService();
