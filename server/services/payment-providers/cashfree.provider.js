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

export class CashfreeProvider extends PaymentProvider {
  constructor() {
    super("cashfree");
  }

  createPaymentLink({ invoice, amount, expiresAt, customer = {}, notes = {} }) {
    const providerLinkId = `cf_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
    return {
      provider: this.name,
      providerLinkId,
      paymentLink: `${publicBase()}/payment/cashfree/${providerLinkId}`,
      amount: money(amount),
      currency: invoice.currency || "INR",
      expiresAt,
      providerPayload: {
        mode: process.env.CASHFREE_CLIENT_ID && process.env.CASHFREE_CLIENT_SECRET ? "cashfree_ready" : "local_provider",
        orderId: providerLinkId,
        amountPaise: Math.round(money(amount) * 100),
        currency: invoice.currency || "INR",
        customer,
        notes
      }
    };
  }

  verifyWebhook(rawBody, signature) {
    const rawText = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
    const secret = process.env.CASHFREE_WEBHOOK_SECRET || "dev-cashfree-webhook-secret";
    if (!signature) throw badRequest("Missing Cashfree signature");
    const expected = createHmac("sha256", secret).update(rawText).digest("base64");
    if (!safeTimingEqual(expected, signature)) throw badRequest("Invalid Cashfree webhook signature");
    return {
      verified: true,
      mode: process.env.CASHFREE_WEBHOOK_SECRET ? "hmac" : "dev_hmac",
      payloadHash: createHash("sha256").update(rawText).digest("hex")
    };
  }

  parseWebhookEvent(rawBody) {
    const body = parseBody(rawBody);
    const data = body.data || body;
    const payment = data.payment || {};
    const order = data.order || {};
    const statusText = String(payment.payment_status || order.order_status || data.status || body.type || "").toLowerCase();
    const amount = money(Number(payment.payment_amount ?? order.order_amount ?? data.amount ?? 0));
    const providerLinkId = order.order_id || data.orderId || data.providerLinkId || "";
    return {
      provider: this.name,
      eventId: body.event_id || body.id || `${body.type || "cashfree"}:${payment.cf_payment_id || providerLinkId || Date.now()}`,
      eventType: body.type || body.event || "cashfree.webhook",
      providerPaymentId: payment.cf_payment_id || data.providerPaymentId || "",
      providerOrderId: order.cf_order_id || order.order_id || data.providerOrderId || "",
      providerLinkId,
      status: statusText,
      amount,
      paid: ["success", "paid", "captured"].includes(statusText),
      failed: ["failed", "failure", "cancelled", "user_dropped"].includes(statusText),
      expired: statusText === "expired",
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

export const cashfreeProvider = new CashfreeProvider();
