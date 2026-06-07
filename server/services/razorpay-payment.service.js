import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";
import { paymentService } from "./payment.service.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function publicBase() {
  return process.env.PUBLIC_APP_URL || "http://127.0.0.1:4300";
}

function parseBody(rawBody) {
  if (typeof rawBody === "string") {
    try {
      return JSON.parse(rawBody || "{}");
    } catch {
      return {};
    }
  }
  return rawBody || {};
}

function verifySignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "dev-razorpay-webhook-secret";
  if (!signature) throw badRequest("Missing Razorpay signature");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) throw badRequest("Invalid Razorpay webhook signature");
  return { verified: true, mode: process.env.RAZORPAY_WEBHOOK_SECRET ? "hmac" : "dev_hmac" };
}

function extractEvent(body = {}) {
  const payment = body.payload?.payment?.entity || {};
  const link = body.payload?.payment_link?.entity || {};
  const order = body.payload?.order?.entity || {};
  return {
    eventId: body.id || `${body.event || "razorpay"}:${payment.id || link.id || Date.now()}`,
    eventType: body.event || "",
    providerPaymentId: payment.id || "",
    providerOrderId: order.id || payment.order_id || "",
    providerLinkId: link.id || body.providerLinkId || "",
    status: payment.status || link.status || "",
    amount: money(Number(payment.amount || link.amount || 0) / 100)
  };
}

export class RazorpayPaymentService {
  createPaymentLink(invoiceId, payload = {}, access = {}) {
    const invoice = billingService.requireInvoice(invoiceId, access);
    const amount = money(payload.amount || invoice.due_amount || invoice.grand_total || 0);
    const providerLinkId = `plink_${crypto.randomUUID().slice(0, 12)}`;
    const paymentLink = `${publicBase().replace(/\/$/, "")}/payment/razorpay/${providerLinkId}`;
    const paymentId = `ipay_${crypto.randomUUID().slice(0, 12)}`;
    db.prepare(
      `INSERT INTO invoice_payments
        (id, tenant_id, invoice_id, payment_mode, provider, provider_link_id, amount, status,
         reference_no, notes, created_by, created_at)
       VALUES
        (@id, @tenantId, @invoiceId, 'razorpay', 'razorpay', @providerLinkId, @amount, 'pending',
         @referenceNo, @notes, @createdBy, CURRENT_TIMESTAMP)`
    ).run({
      id: paymentId,
      tenantId: access.tenantId,
      invoiceId,
      providerLinkId,
      amount,
      referenceNo: providerLinkId,
      notes: payload.notes || "Razorpay payment link",
      createdBy: access.userId || ""
    });
    billingService.writeEvent({ tenantId: access.tenantId, invoiceId, eventType: "payment.link_created", actorUserId: access.userId || "", payload: { provider: "razorpay", providerLinkId, amount } });
    return { paymentId, provider: "razorpay", providerLinkId, paymentLink, amount, currency: invoice.currency || "INR" };
  }

  handleWebhook(rawBody = "", signature = "") {
    const rawText = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
    const signatureResult = verifySignature(rawText, signature);
    const event = extractEvent(parseBody(rawText));
    const payment = event.providerLinkId
      ? db.prepare("SELECT * FROM invoice_payments WHERE provider = 'razorpay' AND provider_link_id = ? ORDER BY created_at DESC LIMIT 1").get(event.providerLinkId)
      : event.providerPaymentId
        ? db.prepare("SELECT * FROM invoice_payments WHERE provider = 'razorpay' AND provider_payment_id = ? ORDER BY created_at DESC LIMIT 1").get(event.providerPaymentId)
        : null;
    if (!payment) throw notFound("Razorpay invoice payment not found");

    const duplicate = db
      .prepare("SELECT id FROM payment_webhook_events WHERE tenant_id = ? AND provider = 'razorpay' AND event_id = ?")
      .get(payment.tenant_id, event.eventId);
    if (duplicate) return { duplicate: true, eventId: event.eventId, signature: signatureResult };

    db.prepare(
      `INSERT INTO payment_webhook_events
        (id, tenant_id, provider, event_id, event_type, signature, payload_hash, raw_payload, status, processed_at, created_at)
       VALUES
        (@id, @tenantId, 'razorpay', @eventId, @eventType, @signature, @payloadHash, @rawPayload, 'received', CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run({
      id: `wh_${crypto.randomUUID().slice(0, 12)}`,
      tenantId: payment.tenant_id,
      eventId: event.eventId,
      eventType: event.eventType,
      signature,
      payloadHash: createHmac("sha256", "payload").update(rawText).digest("hex"),
      rawPayload: rawText
    });

    const paid = `${event.eventType} ${event.status}`.toLowerCase().includes("paid") || `${event.eventType} ${event.status}`.toLowerCase().includes("captured");
    if (paid) {
      return {
        duplicate: false,
        eventId: event.eventId,
        result: paymentService.markProviderPaymentPaid(payment.id, {
          eventId: event.eventId,
          providerPaymentId: event.providerPaymentId,
          providerOrderId: event.providerOrderId,
          amount: event.amount || payment.amount
        }, { tenantId: payment.tenant_id, role: "owner", userId: "razorpay-webhook", branchIds: [] }),
        signature: signatureResult
      };
    }
    return { duplicate: false, eventId: event.eventId, status: event.status || event.eventType, signature: signatureResult };
  }
}

export const razorpayPaymentService = new RazorpayPaymentService();
