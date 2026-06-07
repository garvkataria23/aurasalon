import { billingService } from "./billing.service.js";
import { invoiceNotificationService } from "./invoice-notification.service.js";

export class InvoiceWhatsappService {
  summary(invoiceId, access = {}) {
    const invoice = billingService.getInvoice(invoiceId, access);
    return [
      `AuraShine invoice ${invoice.invoice_no}`,
      `Total: INR ${Number(invoice.grand_total || 0).toFixed(2)}`,
      `Paid: INR ${Number(invoice.paid_amount || 0).toFixed(2)}`,
      `Due: INR ${Number(invoice.due_amount || 0).toFixed(2)}`,
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
