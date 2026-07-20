import { createHmac, timingSafeEqual } from "node:crypto";
import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { bookingDepositService } from "./booking-deposit.service.js";
import { onlineBookingWhatsappService } from "./online-booking-whatsapp.service.js";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 12)}`;
}

function money(value) {
  return Math.round((Number(value) || 0) * 100) / 100;
}

function publicPaymentBase() {
  return process.env.RAZORPAY_PAYMENT_LINK_BASE || process.env.PUBLIC_APP_URL || "http://127.0.0.1:4300";
}

function safeJson(value) {
  try {
    return typeof value === "string" ? JSON.parse(value || "{}") : value || {};
  } catch {
    return {};
  }
}

function verifySignature(rawBody, signature) {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET || "";
  if (!secret) return { verified: true, mode: "secret_not_configured" };
  if (!signature) throw badRequest("Missing Razorpay signature");
  const expected = createHmac("sha256", secret).update(rawBody).digest("hex");
  const left = Buffer.from(expected);
  const right = Buffer.from(signature);
  if (left.length !== right.length || !timingSafeEqual(left, right)) {
    throw badRequest("Invalid Razorpay webhook signature");
  }
  return { verified: true, mode: "hmac" };
}

function extractEvent(body = {}) {
  const paymentLink = body.payload?.payment_link?.entity || {};
  const payment = body.payload?.payment?.entity || {};
  const order = body.payload?.order?.entity || {};
  const providerLinkId = paymentLink.id || body.providerLinkId || body.payment_link_id || "";
  const providerPaymentId = payment.id || body.providerPaymentId || body.payment_id || "";
  return {
    eventId: body.id || `${body.event || "razorpay.event"}:${providerLinkId || providerPaymentId}:${body.created_at || Date.now()}`,
    eventName: body.event || body.status || "",
    providerLinkId,
    providerPaymentId,
    providerOrderId: order.id || payment.order_id || "",
    status: paymentLink.status || payment.status || "",
    amount: money((payment.amount || paymentLink.amount || 0) / 100)
  };
}

function statusFor(eventName = "", providerStatus = "") {
  const value = `${eventName} ${providerStatus}`.toLowerCase();
  if (value.includes("paid") || value.includes("captured")) return "paid";
  if (value.includes("expired") || value.includes("cancelled")) return "failed";
  if (value.includes("failed")) return "failed";
  if (value.includes("refund")) return "refunded";
  return "pending";
}

export const razorpayBookingService = {
  createPaymentLink({
    tenantId,
    appointmentId = "",
    sessionId = "",
    amount,
    currency = "INR",
    customerDetails = {},
    notes = {},
    expiresInMinutes = 30
  }) {
    if (!tenantId || !amount) throw badRequest("tenantId and amount are required");
    const id = makeId("paylink");
    const providerLinkId = makeId("plink");
    const expiresAt = new Date(Date.now() + Number(expiresInMinutes || 30) * 60000).toISOString();
    const paymentLink = `${publicPaymentBase().replace(/\/$/, "")}/payment/razorpay/${providerLinkId}`;
    const row = {
      id,
      tenantId,
      appointmentId,
      sessionId,
      provider: "razorpay",
      providerOrderId: notes.orderId || "",
      providerLinkId,
      providerPaymentId: "",
      providerEventId: "",
      paymentLink,
      amount: money(amount),
      currency,
      status: "pending",
      rawEventJson: JSON.stringify({ mode: "local-link", customerDetails, notes }),
      expiresAt
    };
    db.prepare(
      `INSERT INTO booking_payment_links
       (id, tenantId, appointmentId, sessionId, provider, providerOrderId, providerLinkId, providerPaymentId,
        providerEventId, paymentLink, amount, currency, status, rawEventJson, expiresAt)
       VALUES (@id, @tenantId, @appointmentId, @sessionId, @provider, @providerOrderId, @providerLinkId, @providerPaymentId,
        @providerEventId, @paymentLink, @amount, @currency, @status, @rawEventJson, @expiresAt)`
    ).run(row);
    if (appointmentId) {
      db.prepare("UPDATE appointments SET depositStatus = 'pending' WHERE id = ? AND tenantId = ?").run(appointmentId, tenantId);
      onlineBookingWhatsappService.sendDepositLink(tenantId, appointmentId, paymentLink, expiresAt, row.amount);
    }
    return { linkId: id, providerLinkId, shortUrl: paymentLink, expiresAt, amount: row.amount, currency };
  },

  verifyAndProcessWebhook(rawBody = "", signature = "") {
    const bodyText = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
    const signatureResult = verifySignature(bodyText, signature);
    const body = safeJson(bodyText);
    const event = extractEvent(body);
    const link = event.providerLinkId
      ? db.prepare("SELECT * FROM booking_payment_links WHERE provider = 'razorpay' AND providerLinkId = ?").get(event.providerLinkId)
      : event.providerPaymentId
        ? db.prepare("SELECT * FROM booking_payment_links WHERE provider = 'razorpay' AND providerPaymentId = ?").get(event.providerPaymentId)
        : null;
    if (!link) throw notFound("Payment link not found for Razorpay webhook");
    if (link.providerEventId === event.eventId && link.webhookReceivedAt) {
      return { processed: false, duplicate: true, eventId: event.eventId, signature: signatureResult };
    }
    const status = statusFor(event.eventName, event.status);
    db.prepare(
      `UPDATE booking_payment_links
       SET status = ?, providerPaymentId = COALESCE(NULLIF(?, ''), providerPaymentId),
           providerOrderId = COALESCE(NULLIF(?, ''), providerOrderId),
           providerEventId = ?, webhookReceivedAt = CURRENT_TIMESTAMP, rawEventJson = ?, updatedAt = CURRENT_TIMESTAMP
       WHERE id = ? AND tenantId = ?`
    ).run(status, event.providerPaymentId, event.providerOrderId, event.eventId, bodyText, link.id, link.tenantId);
    if (status === "paid") {
      bookingDepositService.markDepositPaid({
        paymentLinkId: link.id,
        transactionId: event.providerPaymentId,
        access: { tenantId: link.tenantId, role: "owner", userId: "razorpay-webhook", branchIds: [] }
      });
    } else if (status === "failed") {
      bookingDepositService.markDepositFailed({
        paymentLinkId: link.id,
        reason: event.eventName || event.status || "razorpay_failed",
        access: { tenantId: link.tenantId, role: "owner", userId: "razorpay-webhook", branchIds: [] }
      });
    }
    return { processed: true, duplicate: false, eventId: event.eventId, status, signature: signatureResult };
  },

  getStatus(appointmentId, access) {
    const row = db.prepare(
      "SELECT * FROM booking_payment_links WHERE tenantId = ? AND appointmentId = ? ORDER BY createdAt DESC LIMIT 1"
    ).get(access.tenantId, appointmentId);
    if (!row) return { appointmentId, status: "not_required" };
    return {
      appointmentId,
      linkId: row.id,
      provider: row.provider,
      status: row.status,
      amount: row.amount,
      currency: row.currency,
      paymentLink: row.paymentLink,
      expiresAt: row.expiresAt
    };
  },

  initiateRefund({ appointmentId, amount, reason = "", access }) {
    if (!appointmentId || !amount) throw badRequest("appointmentId and amount are required");
    const row = db.prepare(
      "SELECT * FROM booking_payment_links WHERE tenantId = ? AND appointmentId = ? AND status = 'paid' ORDER BY createdAt DESC LIMIT 1"
    ).get(access.tenantId, appointmentId);
    if (!row) throw notFound("Paid deposit not found");
    if (money(amount) > money(row.amount)) throw conflict("Refund amount exceeds paid deposit");
    db.prepare("UPDATE booking_payment_links SET status = 'refunded', updatedAt = CURRENT_TIMESTAMP WHERE id = ? AND tenantId = ?").run(row.id, access.tenantId);
    onlineBookingWhatsappService.sendCancellationConfirmation(access.tenantId, appointmentId, { refund_status: "initiated", refundStatus: "initiated", reason });
    return {
      refundId: makeId("rfnd"),
      appointmentId,
      paymentLinkId: row.id,
      amount: money(amount),
      status: "initiated",
      reason,
      settlementNote: "Razorpay refunds usually reach the customer in 5-7 business days."
    };
  }
};
