import { createHash, createHmac, randomUUID, timingSafeEqual } from "node:crypto";
import { badRequest } from "../../utils/app-error.js";
import { PaymentProvider } from "./payment-provider.interface.js";

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function publicBase() {
  return (process.env.PUBLIC_APP_URL || "http://127.0.0.1:4300").replace(/\/$/, "");
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

function safeTimingEqual(left, right) {
  const leftBuffer = Buffer.from(String(left || ""));
  const rightBuffer = Buffer.from(String(right || ""));
  return leftBuffer.length === rightBuffer.length && timingSafeEqual(leftBuffer, rightBuffer);
}

export class RazorpayProvider extends PaymentProvider {
  constructor() {
    super("razorpay");
  }

  createPaymentLink({ invoice, amount, expiresAt, customer = {}, notes = {} }) {
    const providerLinkId = `plink_${randomUUID().replace(/-/g, "").slice(0, 16)}`;
    const shortUrl = `${publicBase()}/payment/razorpay/${providerLinkId}`;
    return {
      provider: this.name,
      providerLinkId,
      paymentLink: shortUrl,
      amount: money(amount),
      currency: invoice.currency || "INR",
      expiresAt,
      providerPayload: {
        mode: process.env.RAZORPAY_KEY_ID && process.env.RAZORPAY_KEY_SECRET ? "razorpay_ready" : "local_provider_stub",
        amountPaise: Math.round(money(amount) * 100),
        currency: invoice.currency || "INR",
        customer,
        notes
      }
    };
  }

  verifyWebhook(rawBody, signature) {
    const rawText = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "dev-razorpay-webhook-secret";
    if (!signature) throw badRequest("Missing Razorpay signature");
    const expected = createHmac("sha256", secret).update(rawText).digest("hex");
    if (!safeTimingEqual(expected, signature)) throw badRequest("Invalid Razorpay webhook signature");
    return {
      verified: true,
      mode: process.env.RAZORPAY_WEBHOOK_SECRET ? "hmac" : "dev_hmac",
      payloadHash: createHash("sha256").update(rawText).digest("hex")
    };
  }

  parseWebhookEvent(rawBody) {
    const body = parseBody(rawBody);
    const payment = body.payload?.payment?.entity || {};
    const paymentLink = body.payload?.payment_link?.entity || {};
    const order = body.payload?.order?.entity || {};
    const statusText = String(payment.status || paymentLink.status || body.status || "").toLowerCase();
    const eventText = String(body.event || "").toLowerCase();
    const amountPaise = Number(payment.amount ?? paymentLink.amount ?? body.amount ?? 0);
    const providerLinkId = paymentLink.id || payment.notes?.payment_link_id || body.providerLinkId || body.paymentLinkId || "";

    return {
      provider: this.name,
      eventId: body.id || `${body.event || "razorpay"}:${payment.id || providerLinkId || Date.now()}`,
      eventType: body.event || "razorpay.webhook",
      providerPaymentId: payment.id || body.providerPaymentId || "",
      providerOrderId: order.id || payment.order_id || body.providerOrderId || "",
      providerLinkId,
      status: statusText || eventText,
      amount: money(amountPaise / 100),
      paid: eventText.includes("paid") || eventText.includes("captured") || statusText === "paid" || statusText === "captured",
      failed: eventText.includes("failed") || statusText === "failed",
      expired: eventText.includes("expired") || statusText === "expired",
      raw: body
    };
  }

  fetchLinkStatus(link) {
    const isExpired = link.expires_at && new Date(link.expires_at).getTime() < Date.now();
    return {
      provider: this.name,
      providerLinkId: link.provider_link_id,
      status: isExpired && link.status === "pending" ? "expired" : link.status,
      amount: money(link.amount),
      fetchedAt: new Date().toISOString(),
      source: "local_gateway_cache"
    };
  }
}

export const razorpayProvider = new RazorpayProvider();
