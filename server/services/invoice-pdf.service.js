import { invoicePrintService } from "./invoice-print.service.js";

export class InvoicePdfService {
  renderPdfPlaceholder(invoiceId, access = {}) {
    return {
      contentType: "text/html; charset=utf-8",
      body: invoicePrintService.a4Html(invoiceId, access),
      note: "HTML invoice is PDF-ready; attach a PDF renderer in production."
    };
  }
}

export const invoicePdfService = new InvoicePdfService();
