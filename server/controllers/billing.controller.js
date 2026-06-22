import { billingService } from "../services/billing.service.js";
import { refundService } from "../services/refund.service.js";
import { invoiceVoidService } from "../services/invoice-void.service.js";
import { creditNoteService } from "../services/credit-note.service.js";
import { paymentService } from "../services/payment.service.js";
import { realtimeService } from "../services/realtime.service.js";
import { invoicePdfService } from "../services/invoice-pdf.service.js";
import { invoicePrintService } from "../services/invoice-print.service.js";
import { invoiceWhatsappService } from "../services/invoice-whatsapp.service.js";
import { invoiceNotificationService } from "../services/invoice-notification.service.js";
import { reputationService } from "../services/reputation/reputation.service.js";

function emitInvoice(req, type, invoice) {
  const branchId = invoice?.branch_id || invoice?.branchId || "";
  realtimeService.broadcast(type, { invoice }, { tenantId: req.access?.tenantId, branchId });
}

function renderInvoiceHtml(invoice) {
  const esc = (value) => String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
  const rows = (invoice.items || []).map((item) => `
    <tr>
      <td>${esc(item.item_name)}</td>
      <td>${esc(item.quantity)}</td>
      <td>${Number(item.unit_price || 0).toFixed(2)}</td>
      <td>${Number(item.tax_amount || 0).toFixed(2)}</td>
      <td>${Number(item.total_amount || 0).toFixed(2)}</td>
    </tr>`).join("");
  return `<!doctype html>
<html>
<head><meta charset="utf-8"><title>${esc(invoice.invoice_no)}</title></head>
<body>
  <h1>AuraShine Salon OS</h1>
  <h2>Invoice ${esc(invoice.invoice_no)}</h2>
  <p>Status: ${esc(invoice.status)} | Payment: ${esc(invoice.payment_status)}</p>
  <table border="1" cellspacing="0" cellpadding="6">
    <thead><tr><th>Item</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Total</th></tr></thead>
    <tbody>${rows}</tbody>
  </table>
  <p>Subtotal: INR ${Number(invoice.subtotal || 0).toFixed(2)}</p>
  <p>Discount: INR ${Number(invoice.discount_total || 0).toFixed(2)}</p>
  <p>Tax: INR ${Number(invoice.tax_total || 0).toFixed(2)}</p>
  <h3>Grand Total: INR ${Number(invoice.grand_total || 0).toFixed(2)}</h3>
</body>
</html>`;
}

export const billingController = {
  list(req, res) {
    res.json(billingService.listInvoices(req.query, req.access));
  },

  createDraft(req, res) {
    const invoice = req.body?.appointmentId || req.body?.appointment_id
      ? billingService.createFromAppointment(req.body.appointmentId || req.body.appointment_id, req.body, req.access)
      : billingService.createDraft(req.body, req.access);
    emitInvoice(req, "invoice:created", invoice);
    res.status(201).json(invoice);
  },

  get(req, res) {
    res.json(billingService.getInvoice(req.params.id, req.access));
  },

  update(req, res) {
    const invoice = billingService.updateDraft(req.params.id, req.body, req.access);
    emitInvoice(req, "invoice:updated", invoice);
    res.json(invoice);
  },

  addItem(req, res) {
    const invoice = billingService.addItem(req.params.id, req.body, req.access);
    emitInvoice(req, "invoice:updated", invoice);
    res.status(201).json(invoice);
  },

  updateItem(req, res) {
    const invoice = billingService.updateItem(req.params.id, req.params.itemId, req.body, req.access);
    emitInvoice(req, "invoice:updated", invoice);
    res.json(invoice);
  },

  deleteItem(req, res) {
    const invoice = billingService.deleteItem(req.params.id, req.params.itemId, req.access);
    emitInvoice(req, "invoice:updated", invoice);
    res.json(invoice);
  },

  applyDiscount(req, res) {
    const invoice = billingService.applyBillDiscount(req.params.id, req.body, req.access);
    emitInvoice(req, "invoice:updated", invoice);
    res.json(invoice);
  },

  payment(req, res) {
    const mode = req.body?.payment_mode || req.body?.paymentMode || req.body?.mode;
    const invoice = paymentService.pay(req.params.id, mode, req.body, req.access);
    emitInvoice(req, invoice.payment_status === "paid" ? "invoice:paid" : "payment:received", invoice);
    res.status(201).json(invoice);
  },

  finalize(req, res) {
    const invoice = billingService.finalizeInvoice(req.params.id, req.access);
    try {
      invoice.invoiceNotifications = invoiceNotificationService.queueForInvoice(invoice, req.access);
    } catch (error) {
      invoice.invoiceNotifications = { invoiceId: invoice.id, queued: 0, skipped: true, error: error.message };
    }
    try {
      const appointmentId = invoice.appointment_id || invoice.appointmentId || "";
      invoice.reviewRequest = appointmentId
        ? reputationService.sendReviewRequest(appointmentId, { invoiceId: invoice.id, force: true, channel: "auto" }, req.access)
        : { status: "skipped", reason: "missing_appointment" };
    } catch (error) {
      invoice.reviewRequest = { status: "skipped", reason: "review_request_failed", error: error.message };
    }
    emitInvoice(req, invoice.payment_status === "paid" ? "invoice:paid" : "invoice:finalized", invoice);
    res.json(invoice);
  },

  void(req, res) {
    const invoice = invoiceVoidService.voidInvoice(req.params.id, req.body, req.access);
    emitInvoice(req, "invoice:voided", invoice);
    res.json(invoice);
  },

  refund(req, res) {
    res.status(201).json(refundService.refundInvoice(req.params.id, req.body, req.access));
  },

  creditNote(req, res) {
    const invoice = creditNoteService.createCreditNote(req.params.id, req.body, req.access);
    emitInvoice(req, "invoice:credit_note_created", invoice);
    res.status(201).json(invoice);
  },

  pdf(req, res) {
    const rendered = invoicePdfService.renderPdfPlaceholder(req.params.id, req.access);
    res.setHeader("content-type", rendered.contentType);
    res.send(rendered.body);
  },

  print(req, res) {
    const format = req.query.format || "thermal";
    if (format === "a4") {
      res.setHeader("content-type", "text/html; charset=utf-8");
      res.send(invoicePrintService.a4Html(req.params.id, req.access));
      return;
    }
    res.setHeader("content-type", "text/plain; charset=utf-8");
    res.send(invoicePrintService.thermal(req.params.id, req.access));
  },

  sendWhatsapp(req, res) {
    res.json(invoiceWhatsappService.send(req.params.id, req.access, req.body || {}));
  },

  sendEmail(req, res) {
    const invoice = billingService.getInvoice(req.params.id, req.access);
    billingService.writeEvent({ tenantId: req.access.tenantId, invoiceId: req.params.id, eventType: "invoice.email_summary_created", actorUserId: req.access.userId || "", payload: { invoiceNo: invoice.invoice_no } });
    res.json({ invoiceId: req.params.id, queued: true, channel: "email", invoiceNo: invoice.invoice_no });
  },

  legacyPdf(req, res) {
    const invoice = billingService.getInvoice(req.params.id, req.access);
    res.setHeader("content-type", "text/html; charset=utf-8");
    res.send(renderInvoiceHtml(invoice));
  },

  customerHistory(req, res) {
    res.json(billingService.listInvoices({ ...req.query, customerId: req.params.customerId }, req.access));
  },

  appointmentDraft(req, res) {
    res.json(billingService.previewFromAppointment(req.params.appointmentId, req.query, req.access));
  }
};
