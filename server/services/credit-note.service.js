import { billingService } from "./billing.service.js";
import { balanceSheetService } from "./balance-sheet.service.js";
import { badRequest } from "../utils/app-error.js";

export class CreditNoteService {
  createCreditNote(invoiceId, payload = {}, access = {}) {
    const invoice = billingService.requireInvoice(invoiceId, access);
    const amount = Number(payload.amount || invoice.refund_amount || invoice.grand_total || 0);
    if (!payload.reason) throw badRequest("Credit note reason is required");
    if (amount <= 0) throw badRequest("Credit note amount must be greater than zero");
    const creditNote = billingService.createDraft(
      {
        branch_id: invoice.branch_id,
        customer_id: invoice.customer_id,
        invoice_type: "credit_note",
        source: "credit_note",
        notes: `Credit note against ${invoice.invoice_no}. Reason: ${payload.reason}`,
        items: [
          {
            item_type: "credit_note",
            item_id: invoice.id,
            item_name: payload.item_name || `Credit note for ${invoice.invoice_no}`,
            quantity: 1,
            unit_price: amount,
            tax_rate: Number(payload.tax_rate || 0),
            hsn_sac_code: payload.hsn_sac_code || ""
          }
        ]
      },
      access
    );
    billingService.writeEvent({
      tenantId: access.tenantId,
      invoiceId: invoice.id,
      eventType: "invoice.credit_note_created",
      actorUserId: access.userId || "",
      payload: { creditNoteId: creditNote.id, amount, reason: payload.reason }
    });
    try {
      balanceSheetService.enqueueInvoiceCreditNoteEvent({ invoice, creditNote, amount, access });
    } catch {
      billingService.writeEvent({
        tenantId: access.tenantId,
        invoiceId: invoice.id,
        eventType: "finance.gl_enqueue_failed",
        actorUserId: access.userId || "",
        payload: { creditNoteId: creditNote.id, amount }
      });
    }
    return creditNote;
  }
}

export const creditNoteService = new CreditNoteService();
