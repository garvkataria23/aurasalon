import { billingService } from "./billing.service.js";
import { invoiceNotificationService } from "./invoice-notification.service.js";

function bookingAdvanceAdjustedAmount(payments = []) {
  return payments
    .filter((payment) => String(payment.payment_mode || payment.mode || "").toLowerCase() === "booking_advance")
    .reduce((sum, payment) => sum + Number(payment.amount || 0), 0);
}

export class InvoiceWhatsappService {
  summary(invoiceId, access = {}) {
    const invoice = billingService.getInvoice(invoiceId, access);
    const advanceAdjusted = bookingAdvanceAdjustedAmount(invoice.payments || []);
    const counterPaid = Math.max(0, Number(invoice.paid_amount || 0) - advanceAdjusted);
    const counterDue = Math.max(0, Number(invoice.due_amount || 0));
    return [
      `AuraShine invoice ${invoice.invoice_no}`,
      `Total: INR ${Number(invoice.grand_total || 0).toFixed(2)}`,
      `Paid: INR ${Number(invoice.paid_amount || 0).toFixed(2)}`,
      `Due: INR ${Number(invoice.due_amount || 0).toFixed(2)}`,
      `Advance adjusted: INR ${advanceAdjusted.toFixed(2)} | Counter paid: INR ${counterPaid.toFixed(2)} | Counter due: INR ${counterDue.toFixed(2)}`,
      `Tax: INR ${Number(invoice.tax_total || 0).toFixed(2)}`,
      `IRN: ${invoice.irn || "Pending"}`,
      "Refund terms apply as per salon policy."
    ].join("\n");
  }

  send(invoiceId, access = {}, payload = {}) {
    const result = invoiceNotificationService.queueInvoicePdfWhatsapp(invoiceId, payload, access);
    billingService.writeEvent({
      tenantId: access.tenantId,
      invoiceId,
      eventType: "invoice.whatsapp_pdf_queued",
      actorUserId: access.userId || "",
      payload: {
        queueId: result.row?.id,
        invoiceNo: result.invoiceNo,
        due: result.due,
        walletPaid: result.walletPaid,
        document: result.document
      }
    });
    return result;
  }
}

export const invoiceWhatsappService = new InvoiceWhatsappService();
