import { billingService } from "./billing.service.js";

function esc(value) {
  return String(value ?? "").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export class InvoicePrintService {
  invoiceData(invoiceId, access = {}) {
    return billingService.getInvoice(invoiceId, access);
  }

  thermal(invoiceId, access = {}) {
    const invoice = this.invoiceData(invoiceId, access);
    const lines = [
      "AURASHINE SALON",
      `GSTIN: ${invoice.gstin || "N/A"}`,
      `Invoice: ${invoice.invoice_no}`,
      `Customer: ${invoice.customer_id || "Walk-in"}`,
      "------------------------------",
      ...invoice.items.map((item) => `${item.item_name} x${item.quantity} INR ${Number(item.total_amount || 0).toFixed(2)}`),
      "------------------------------",
      `Discount: INR ${Number(invoice.discount_total || 0).toFixed(2)}`,
      `Tax: INR ${Number(invoice.tax_total || 0).toFixed(2)}`,
      `Tips: INR ${Number(invoice.tip_total || 0).toFixed(2)}`,
      `Total: INR ${Number(invoice.grand_total || 0).toFixed(2)}`,
      `Paid: INR ${Number(invoice.paid_amount || 0).toFixed(2)}`,
      "Refund terms apply as per salon policy.",
      `IRN: ${invoice.irn || "Pending"}`
    ];
    return lines.join("\n");
  }

  a4Html(invoiceId, access = {}) {
    const invoice = this.invoiceData(invoiceId, access);
    const rows = invoice.items.map((item) => `<tr><td>${esc(item.item_name)}</td><td>${esc(item.staff_id)}</td><td>${item.quantity}</td><td>${Number(item.unit_price || 0).toFixed(2)}</td><td>${Number(item.tax_amount || 0).toFixed(2)}</td><td>${Number(item.total_amount || 0).toFixed(2)}</td></tr>`).join("");
    const payments = invoice.payments.map((payment) => `${payment.payment_mode}: INR ${Number(payment.amount || 0).toFixed(2)}`).join(", ") || "Pending";
    return `<!doctype html><html><head><meta charset="utf-8"><title>${esc(invoice.invoice_no)}</title></head><body>
      <h1>AuraShine Salon OS</h1>
      <p>Branch GSTIN: ${esc(invoice.gstin || "N/A")} | IRN: ${esc(invoice.irn || "Pending")}</p>
      <h2>Invoice ${esc(invoice.invoice_no)}</h2>
      <p>Customer: ${esc(invoice.customer_id || "Walk-in")}</p>
      <table border="1" cellspacing="0" cellpadding="6"><thead><tr><th>Item</th><th>Staff</th><th>Qty</th><th>Rate</th><th>Tax</th><th>Total</th></tr></thead><tbody>${rows}</tbody></table>
      <p>Discount: INR ${Number(invoice.discount_total || 0).toFixed(2)}</p>
      <p>Tax: INR ${Number(invoice.tax_total || 0).toFixed(2)} | Tips: INR ${Number(invoice.tip_total || 0).toFixed(2)}</p>
      <h3>Grand total: INR ${Number(invoice.grand_total || 0).toFixed(2)}</h3>
      <p>Payment modes: ${esc(payments)}</p>
      <p>QR/payment link: ${esc(invoice.payment_link || "Available on request")}</p>
      <p>Refund terms: Refunds and credit notes follow salon policy and approval workflow.</p>
    </body></html>`;
  }
}

export const invoicePrintService = new InvoicePrintService();
