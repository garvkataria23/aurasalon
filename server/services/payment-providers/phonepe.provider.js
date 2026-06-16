import { createHash, randomUUID, timingSafeEqual } from "node:crypto";
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

export class PhonePeProvider extends PaymentProvider {
  constructor() {
    super("phonepe");
  }

  createPaymentLink({ invoice, amount, expiresAt, customer = {}, notes = {} }) {
    const providerLinkId = `pp_${randomUUID().replace(/-/g, "").slice(0, 18)}`;
    return {
      provider: this.name,
      providerLinkId,
      paymentLink: `${publicBase()}/payment/phonepe/${providerLinkId}`,
      amount: money(amount),
      currency: invoice.currency || "INR",
      expiresAt,
      providerPayload: {
        mode: process.env.PHONEPE_MERCHANT_ID && process.env.PHONEPE_SALT_KEY ? "phonepe_ready" : "local_provider",
        merchantTransactionId: providerLinkId,
        amountPaise: Math.round(money(amount) * 100),
        currency: invoice.currency || "INR",
        customer,
        notes
      }
    };
  }

  verifyWebhook(rawBody, signature) {
    const rawText = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
    const saltKey = process.env.PHONEPE_SALT_KEY || "dev-phonepe-salt-key";
    const saltIndex = process.env.PHONEPE_SALT_INDEX || "1";
    if (!signature) throw badRequest("Missing PhonePe X-VERIFY signature");
    const expected = `${createHash("sha256").update(`${rawText}${saltKey}`).digest("hex")}###${saltIndex}`;
    if (!safeTimingEqual(expected, signature)) throw badRequest("Invalid PhonePe X-VERIFY signature");
    return {
      verified: true,
      mode: process.env.PHONEPE_SALT_KEY ? "x_verify" : "dev_x_verify",
      payloadHash: createHash("sha256").update(rawText).digest("hex")
    };
  }

  parseWebhookEvent(rawBody) {
    const body = parseBody(rawBody);
    const data = body.data || body;
    const statusText = String(data.state || data.status || body.code || "").toLowerCase();
    const amountPaise = Number(data.amount ?? data.transactionAmount ?? body.amount ?? 0);
    const providerLinkId = data.merchantTransactionId || data.transactionId || body.providerLinkId || "";
    return {
      provider: this.name,
      eventId: body.eventId || body.id || `${body.code || "phonepe"}:${data.transactionId || providerLinkId || Date.now()}`,
      eventType: body.event || body.code || "phonepe.webhook",
      providerPaymentId: data.transactionId || data.providerPaymentId || "",
      providerOrderId: data.providerReferenceId || data.providerOrderId || "",
      providerLinkId,
      status: statusText,
      amount: money(amountPaise / 100),
      paid: ["completed", "success", "payment_success"].includes(statusText),
      failed: ["failed", "payment_error", "declined"].includes(statusText),
      expired: ["expired", "timed_out"].includes(statusText),
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

export const phonePeProvider = new PhonePeProvider();
