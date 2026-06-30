import { billingService } from "./billing.service.js";

function money(value) {
  return Number(value || 0).toFixed(2);
}

function safe(value) {
  return String(value ?? "").replace(/[()\\]/g, " ").replace(/[^\x20-\x7E]/g, " ");
}

function paymentMode(p = {}) {
  return String(p.payment_mode || p.mode || p.paymentMode || "").toLowerCase();
}

function bookingAdvance(payments = []) {
  return payments.filter((p) => paymentMode(p) === "booking_advance").reduce((s, p) => s + Number(p.amount || p.paidAmount || 0), 0);
}

function buildPdf(blocks) {
  // blocks: array of { x, y, size, lines[] }
  const streamParts = ["BT"];
  for (const block of blocks) {
    streamParts.push(`/F1 ${block.size} Tf`);
    streamParts.push(`${block.x} ${block.y} Td`);
    streamParts.push(`${block.size + 3} TL`);
    for (const line of block.lines) {
      streamParts.push(`(${safe(line)}) Tj`);
      streamParts.push("T*");
    }
    // reset position for next block using absolute coords via matrix
    streamParts.push(`1 0 0 1 ${block.x} ${block.y} Tm`);
  }
  streamParts.push("ET");
  const stream = streamParts.join("\n");

  const objects = [
    "<< /Type /Catalog /Pages 2 0 R >>\n",
    "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n",
    "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R /F2 6 0 R >> >> >>\n",
    `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\n`,
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n",
    "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold >>\n"
  ];

  let pdf = "%PDF-1.4\n";
  const offsets = [];
  objects.forEach((obj, i) => {
    offsets.push(pdf.length);
    pdf += `${i + 1} 0 obj\n${obj}endobj\n`;
  });
  const xrefOffset = pdf.length;
  pdf += `xref\n0 ${objects.length + 1}\n`;
  pdf += "0000000000 65535 f \n";
  pdf += offsets.map((o) => `${String(o).padStart(10, "0")} 00000 n \n`).join("");
  pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
  return pdf;
}

export class InvoicePdfService {
  renderPdf(invoiceId, access = {}) {
    const invoice = billingService.getInvoice(invoiceId, access);
    const payments = invoice.payments || [];
    const advance = bookingAdvance(payments);
    const paid = Number(invoice.paid_amount || 0);
    const counterPaid = Math.max(0, paid - advance);
    const due = Math.max(0, Number(invoice.due_amount || invoice.balance || 0));
    const paymentModes = payments.map((p) => `${p.payment_mode || p.mode || "cash"}: INR ${money(p.amount || p.paidAmount)}`).join("  ") || "Pending";

    const itemLines = (invoice.items || []).slice(0, 20).map(
      (item) => `${String(item.item_name || "").slice(0, 28).padEnd(28)} x${item.quantity}  INR ${money(item.total_amount)}`
    );

    const blocks = [
      // Header
      { x: 50, y: 800, size: 14, lines: ["AURA SALON OS"] },
      { x: 50, y: 778, size: 9, lines: [`GSTIN: ${invoice.gstin || "N/A"}   IRN: ${invoice.irn || "Pending"}`] },
      // Divider
      { x: 50, y: 762, size: 9, lines: ["---------------------------------------------------------------"] },
      // Invoice meta
      { x: 50, y: 748, size: 10, lines: [`Invoice: ${invoice.invoice_no || invoiceId}`] },
      { x: 50, y: 732, size: 9, lines: [`Customer: ${invoice.customer_id || "Walk-in"}   Date: ${(invoice.created_at || "").slice(0, 10)}`] },
      // Items header
      { x: 50, y: 712, size: 9, lines: ["Item                            Qty    Amount"] },
      { x: 50, y: 700, size: 9, lines: ["---------------------------------------------------------------"] },
      // Items
      { x: 50, y: 688, size: 9, lines: itemLines },
      // Totals
      { x: 50, y: Math.max(300, 688 - itemLines.length * 12 - 16), size: 9, lines: [
        "---------------------------------------------------------------",
        `Discount:      INR ${money(invoice.discount_total)}`,
        `Tax (GST):     INR ${money(invoice.tax_total)}`,
        `Tips:          INR ${money(invoice.tip_total)}`,
        "---------------------------------------------------------------"
      ]},
      { x: 50, y: Math.max(220, 688 - itemLines.length * 12 - 80), size: 11, lines: [`Grand Total:   INR ${money(invoice.grand_total)}`] },
      { x: 50, y: Math.max(180, 688 - itemLines.length * 12 - 100), size: 9, lines: [
        `Advance adj:   INR ${money(advance)}`,
        `Counter paid:  INR ${money(counterPaid)}`,
        `Balance due:   INR ${money(due)}`,
        `Payment:       ${paymentModes}`,
        "",
        "Refunds and credit notes follow salon policy.",
        `Payment link: ${invoice.payment_link || "Available on request"}`
      ]}
    ];

    const pdfBody = buildPdf(blocks);
    return { contentType: "application/pdf", body: Buffer.from(pdfBody, "binary"), filename: `invoice-${invoice.invoice_no || invoiceId}.pdf` };
  }

  // kept for backward compatibility — now returns real PDF
  renderPdfPlaceholder(invoiceId, access = {}) {
    return this.renderPdf(invoiceId, access);
  }
}

export const invoicePdfService = new InvoicePdfService();
