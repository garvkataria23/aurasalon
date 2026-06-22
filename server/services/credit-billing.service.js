import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";
import { corporateAccountService } from "./corporate-account.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

export class CreditBillingService {
  convertInvoice(invoiceId, payload = {}, access = {}) {
    const invoice = billingService.requireInvoice(invoiceId, access);
    const accountId = payload.corporate_account_id || payload.corporateAccountId || invoice.corporate_account_id;
    if (!accountId) throw badRequest("corporate_account_id is required");
    const amount = money(payload.amount || invoice.due_amount || invoice.grand_total);
    const account = corporateAccountService.assertCanIssueCredit(accountId, amount, access);
    const due = new Date(Date.now() + Number(account.payment_terms_days || 30) * 86_400_000).toISOString().slice(0, 10);
    const id = `crinv_${crypto.randomUUID().slice(0, 12)}`;
    const txn = db.transaction(() => {
      db.prepare(
        `INSERT INTO credit_invoices
          (id, tenant_id, corporate_account_id, invoice_id, due_date, credit_amount, paid_amount, outstanding_amount, status, created_at)
         VALUES
          (@id, @tenantId, @accountId, @invoiceId, @dueDate, @amount, 0, @amount, 'open', CURRENT_TIMESTAMP)`
      ).run({ id, tenantId: access.tenantId, accountId, invoiceId, dueDate: due, amount });
      db.prepare("UPDATE corporate_accounts SET current_outstanding = current_outstanding + ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
        .run(amount, access.tenantId, accountId);
      db.prepare("UPDATE invoices SET payment_status = 'credit', status = 'pending_payment', credit_account_id = ?, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
        .run(accountId, access.tenantId, invoiceId);
      billingService.writeEvent({ tenantId: access.tenantId, invoiceId, eventType: "invoice.converted_to_credit", actorUserId: access.userId || "", payload: { accountId, amount, due } });
      return { id, accountId, invoiceId, amount, dueDate: due };
    });
    return txn();
  }

  recordPayment(accountId, payload = {}, access = {}) {
    corporateAccountService.get(accountId, access);
    const amount = money(payload.amount || 0);
    if (amount <= 0) throw badRequest("amount is required");
    const open = db.prepare("SELECT * FROM credit_invoices WHERE tenant_id = ? AND corporate_account_id = ? AND status = 'open' ORDER BY due_date").all(access.tenantId, accountId);
    if (!open.length) throw notFound("No open credit invoices");
    let remaining = amount;
    const allocations = [];
    const txn = db.transaction(() => {
      for (const invoice of open) {
        if (remaining <= 0) break;
        const apply = Math.min(remaining, Number(invoice.outstanding_amount || 0));
        remaining = money(remaining - apply);
        const outstanding = money(Number(invoice.outstanding_amount || 0) - apply);
        db.prepare("UPDATE credit_invoices SET paid_amount = paid_amount + ?, outstanding_amount = ?, status = ? WHERE tenant_id = ? AND id = ?")
          .run(apply, outstanding, outstanding <= 0 ? "paid" : "open", access.tenantId, invoice.id);
        allocations.push({ creditInvoiceId: invoice.id, invoiceId: invoice.invoice_id, amount: apply });
      }
      db.prepare(
        `INSERT INTO credit_payments
          (id, tenant_id, corporate_account_id, amount, payment_mode, reference_no, allocated_invoice_ids_json, received_by, received_at, created_at)
         VALUES
          (@id, @tenantId, @accountId, @amount, @mode, @reference, @allocations, @receivedBy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
      ).run({
        id: `crpay_${crypto.randomUUID().slice(0, 12)}`,
        tenantId: access.tenantId,
        accountId,
        amount,
        mode: payload.payment_mode || payload.paymentMode || "bank_transfer",
        reference: payload.reference_no || payload.referenceNo || "",
        allocations: JSON.stringify(allocations),
        receivedBy: access.userId || ""
      });
      db.prepare("UPDATE corporate_accounts SET current_outstanding = MAX(0, current_outstanding - ?), updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
        .run(amount, access.tenantId, accountId);
      return { accountId, amount, allocations };
    });
    return txn();
  }

  statement(accountId, query = {}, access = {}) {
    corporateAccountService.get(accountId, access);
    return db.prepare("SELECT * FROM credit_invoices WHERE tenant_id = ? AND corporate_account_id = ? ORDER BY due_date DESC").all(access.tenantId, accountId);
  }

  outstanding(query = {}, access = {}) {
    return db.prepare(
      `SELECT ca.*, SUM(ci.outstanding_amount) AS outstanding
         FROM corporate_accounts ca
    LEFT JOIN credit_invoices ci ON ci.tenant_id = ca.tenant_id AND ci.corporate_account_id = ca.id
        WHERE ca.tenant_id = ?
        GROUP BY ca.id
        ORDER BY outstanding DESC`
    ).all(access.tenantId);
  }
}

export const creditBillingService = new CreditBillingService();
