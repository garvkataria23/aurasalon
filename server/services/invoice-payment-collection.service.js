import { createHash, randomUUID } from "node:crypto";
import { DEFAULT_TENANT_ID, columnsFor, db, updateInvoiceStatus } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";
import { billingService } from "./billing.service.js";
import { paymentProviderFor } from "./payment-providers/payment-provider.registry.js";

const now = () => new Date().toISOString();
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function json(value) {
  return JSON.stringify(value || {});
}

function parseJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function firstText(...values) {
  return values.find((value) => value !== undefined && value !== null && String(value).trim() !== "") || "";
}

function invoiceTenantWhere(alias = "invoices") {
  const columns = safeColumns(alias);
  if (columns.includes("tenant_id") && columns.includes("tenantId")) return "(tenant_id = @tenantId OR tenantId = @tenantId)";
  if (columns.includes("tenant_id")) return "tenant_id = @tenantId";
  if (columns.includes("tenantId")) return "tenantId = @tenantId";
  return "1 = 1";
}

function invoiceBranchId(invoice = {}) {
  if (invoice.branch_id || invoice.branchId) return firstText(invoice.branch_id, invoice.branchId);
  if (!invoice.saleId) return "";
  return db.prepare("SELECT branchId FROM sales WHERE id = ?").get(invoice.saleId)?.branchId || "";
}

function invoiceClientId(invoice = {}) {
  return firstText(invoice.clientId, invoice.customer_id, invoice.customerId);
}

function invoiceAppointmentId(invoice = {}) {
  if (invoice.appointment_id || invoice.appointmentId) return firstText(invoice.appointment_id, invoice.appointmentId);
  if (!invoice.saleId) return "";
  return db.prepare("SELECT appointmentId FROM sales WHERE id = ?").get(invoice.saleId)?.appointmentId || "";
}

function invoiceNumber(invoice = {}) {
  return firstText(invoice.invoiceNumber, invoice.invoice_no, invoice.id);
}

function invoiceTotal(invoice = {}) {
  const enterpriseTotal = Number(invoice.grand_total);
  const legacyTotal = Number(invoice.total);
  if (enterpriseTotal > 0) return money(enterpriseTotal);
  if (legacyTotal > 0) return money(legacyTotal);
  return 0;
}

function invoicePaid(invoice = {}) {
  if (invoice.saleId || invoice.clientId) return money(invoice.paid ?? invoice.paid_amount ?? 0);
  return money(invoice.paid_amount ?? invoice.paid ?? 0);
}

function invoiceDue(invoice = {}) {
  const total = invoiceTotal(invoice);
  const paid = invoicePaid(invoice);
  if (invoice.saleId || invoice.clientId) {
    const legacyBalance = Number(invoice.balance);
    if (Number.isFinite(legacyBalance) && legacyBalance >= 0) return money(legacyBalance);
  }
  const dueAmount = Number(invoice.due_amount);
  if (Number.isFinite(dueAmount) && dueAmount > 0) return money(dueAmount);
  const balanceDue = Number(invoice.balance_due);
  if (Number.isFinite(balanceDue) && balanceDue > 0) return money(balanceDue);
  const balance = Number(invoice.balance);
  if (Number.isFinite(balance) && balance > 0) return money(balance);
  return money(Math.max(0, total - paid));
}

function assertBranchAllowed(access = {}, branchId = "") {
  if (!branchId) return;
  if (["owner", "admin", "superAdmin"].includes(access.role)) return;
  const allowed = access.branchIds || [];
  if (allowed.length && !allowed.includes(branchId)) throw forbidden("Branch access denied for invoice payment collection");
}

function selectInvoice(invoiceId, tenantId) {
  const row = db
    .prepare(`SELECT * FROM invoices WHERE id = @invoiceId AND ${invoiceTenantWhere()} LIMIT 1`)
    .get({ invoiceId, tenantId });
  return row || null;
}

function updateInvoiceFields(invoiceId, tenantId, fields) {
  const columns = safeColumns("invoices");
  const sets = [];
  const params = { invoiceId, tenantId };
  let index = 0;
  for (const [column, value] of Object.entries(fields)) {
    if (!columns.includes(column)) continue;
    const param = `value${index}`;
    sets.push(`${column} = @${param}`);
    params[param] = value;
    index += 1;
  }
  if (!sets.length) return;
  db.prepare(`UPDATE invoices SET ${sets.join(", ")} WHERE id = @invoiceId AND ${invoiceTenantWhere()}`).run(params);
}

function insertDynamic(table, values) {
  const columns = safeColumns(table).filter((column) => Object.prototype.hasOwnProperty.call(values, column));
  const params = {};
  columns.forEach((column, index) => {
    params[`v${index}`] = values[column];
  });
  db.prepare(
    `INSERT INTO ${table} (${columns.join(", ")}) VALUES (${columns.map((_, index) => `@v${index}`).join(", ")})`
  ).run(params);
}

function legacyPaymentSum(invoiceId, tenantId) {
  const columns = safeColumns("payments");
  if (!columns.includes("invoiceId")) return 0;
  const tenantClause = columns.includes("tenantId") ? " AND tenantId = @tenantId" : "";
  return money(db.prepare(`SELECT COALESCE(SUM(amount), 0) AS amount FROM payments WHERE invoiceId = @invoiceId${tenantClause}`).get({ invoiceId, tenantId }).amount);
}

function enterprisePaidSum(invoiceId, tenantId) {
  const columns = safeColumns("invoice_payments");
  if (!columns.includes("tenant_id")) return 0;
  return money(
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS amount FROM invoice_payments WHERE tenant_id = ? AND invoice_id = ? AND status = 'paid'")
      .get(tenantId, invoiceId).amount
  );
}

function onlinePaidSum(invoiceId, tenantId) {
  const columns = safeColumns("invoice_payments");
  if (!columns.includes("tenant_id")) return 0;
  return money(
    db
      .prepare("SELECT COALESCE(SUM(amount), 0) AS amount FROM invoice_payments WHERE tenant_id = ? AND invoice_id = ? AND status = 'paid' AND provider <> ''")
      .get(tenantId, invoiceId).amount
  );
}

function syncInvoiceState(invoiceId, tenantId, { paymentLinkId = "", paidAt = "" } = {}) {
  const invoice = selectInvoice(invoiceId, tenantId);
  if (!invoice) return null;
  const total = invoiceTotal(invoice);
  const paid = money(Math.max(legacyPaymentSum(invoiceId, tenantId), enterprisePaidSum(invoiceId, tenantId), Number(invoice.paid || 0), Number(invoice.paid_amount || 0)));
  const due = money(Math.max(0, total - paid));
  const status = due <= 0.01 ? "paid" : paid > 0 ? "partial" : "unpaid";
  const enterprisePaymentStatus = due <= 0.01 ? "paid" : paid > 0 ? "partially_paid" : "unpaid";
  updateInvoiceFields(invoiceId, tenantId, {
    paid,
    balance: due,
    status,
    paid_amount: paid,
    due_amount: due,
    payment_status: enterprisePaymentStatus,
    online_paid_amount: onlinePaidSum(invoiceId, tenantId),
    balance_due: due,
    payment_link_id: paymentLinkId || invoice.payment_link_id || "",
    paid_at: status === "paid" ? paidAt || invoice.paid_at || now() : invoice.paid_at || "",
    updatedAt: now(),
    updated_at: now()
  });
  return selectInvoice(invoiceId, tenantId);
}

function clientFor(invoice = {}, tenantId = DEFAULT_TENANT_ID) {
  const clientId = invoiceClientId(invoice);
  if (!clientId || !safeColumns("clients").includes("id")) return {};
  const tenantClause = safeColumns("clients").includes("tenantId") ? " AND tenantId = @tenantId" : "";
  return db.prepare(`SELECT * FROM clients WHERE id = @clientId${tenantClause}`).get({ clientId, tenantId }) || {};
}

function branchFor(branchId = "", tenantId = DEFAULT_TENANT_ID) {
  if (!branchId || !safeColumns("branches").includes("id")) return {};
  const tenantClause = safeColumns("branches").includes("tenantId") ? " AND tenantId = @tenantId" : "";
  return db.prepare(`SELECT * FROM branches WHERE id = @branchId${tenantClause}`).get({ branchId, tenantId }) || {};
}

function bookingAdvanceSummary(invoice = {}, tenantId = DEFAULT_TENANT_ID) {
  const appointmentId = invoiceAppointmentId(invoice);
  if (!appointmentId) {
    return {
      appointmentId: "",
      bookingAdvanceStatus: "not_required",
      bookingAdvancePaid: 0,
      bookingAdvancePending: 0,
      bookingAdvanceLinkId: ""
    };
  }
  const rows = db.prepare(
    `SELECT id, amount, status, providerPaymentId
       FROM booking_payment_links
      WHERE tenantId = ?
        AND appointmentId = ?
      ORDER BY datetime(createdAt) DESC, id DESC`
  ).all(tenantId, appointmentId);
  const paid = money(rows
    .filter((row) => String(row.status || "").toLowerCase() === "paid" || row.providerPaymentId)
    .reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const pending = money(rows
    .filter((row) => ["pending", "sent"].includes(String(row.status || "").toLowerCase()))
    .reduce((sum, row) => sum + Number(row.amount || 0), 0));
  const latestStatus = String(invoice.depositStatus || rows[0]?.status || "not_required").toLowerCase();
  return {
    appointmentId,
    bookingAdvanceStatus: latestStatus || "not_required",
    bookingAdvancePaid: paid,
    bookingAdvancePending: pending,
    bookingAdvanceLinkId: rows[0]?.id || ""
  };
}

export class InvoicePaymentCollectionService {
  invoice(invoiceId, access = {}) {
    const tenantId = access.tenantId || DEFAULT_TENANT_ID;
    const invoice = selectInvoice(invoiceId, tenantId);
    if (!invoice) throw notFound("Invoice not found");
    const branchId = invoiceBranchId(invoice);
    assertBranchAllowed(access, branchId);
    return { ...invoice, branch_id: invoice.branch_id || branchId, branchId: invoice.branchId || branchId };
  }

  createLink(invoiceId, payload = {}, access = {}) {
    const tenantId = access.tenantId || DEFAULT_TENANT_ID;
    const invoice = this.invoice(invoiceId, access);
    const branchId = invoiceBranchId(invoice) || access.branchId || "";
    const due = invoiceDue(invoice);
    if (due <= 0.01) throw conflict("Invoice is already paid. Payment link is not required.");
    if (["voided", "cancelled", "deleted"].includes(String(invoice.status || "").toLowerCase())) {
      throw conflict("Payment link cannot be created for cancelled invoice");
    }

    const existing = db
      .prepare(
        `SELECT *
           FROM invoice_payment_links
          WHERE tenant_id = @tenantId
            AND invoice_id = @invoiceId
            AND provider = @provider
            AND status IN ('pending', 'sent')
            AND (expires_at = '' OR expires_at IS NULL OR expires_at > @now)
          ORDER BY created_at DESC
          LIMIT 1`
      )
      .get({ tenantId, invoiceId, provider: payload.provider || "razorpay", now: now() });
    if (existing && !payload.regenerate) {
      return { ...this.linkDto(existing), invoice: this.invoiceSummary(invoice), timeline: this.timeline(invoiceId, access) };
    }

    db.prepare(
      "UPDATE invoice_payment_links SET status = 'expired', updated_at = @updatedAt WHERE tenant_id = @tenantId AND invoice_id = @invoiceId AND status IN ('pending', 'sent') AND expires_at <= @now"
    ).run({ tenantId, invoiceId, updatedAt: now(), now: now() });

    const amount = money(payload.amount || due);
    if (amount <= 0 || amount > due + 0.01) throw conflict("Payment link amount must be within invoice due amount");
    const expiresAt = payload.expiresAt || new Date(Date.now() + Number(payload.expiryHours || 72) * 60 * 60 * 1000).toISOString();
    const provider = paymentProviderFor(payload.provider || "razorpay");
    const client = clientFor(invoice, tenantId);
    const providerResult = provider.createPaymentLink({
      invoice,
      amount,
      expiresAt,
      customer: {
        name: client.name || invoice.clientName || "",
        phone: client.phone || invoice.clientPhone || "",
        email: client.email || invoice.clientEmail || ""
      },
      notes: {
        tenant_id: tenantId,
        branch_id: branchId,
        invoice_id: invoiceId,
        invoice_no: invoiceNumber(invoice)
      }
    });
    const linkId = makeId("ipl");
    db.prepare(
      `INSERT INTO invoice_payment_links
        (id, tenant_id, branch_id, invoice_id, provider, provider_link_id, link_url, amount,
         balance_due_at_creation, currency, status, expires_at, provider_payload_json, metadata_json,
         created_by, created_at, updated_at)
       VALUES
        (@id, @tenantId, @branchId, @invoiceId, @provider, @providerLinkId, @linkUrl, @amount,
         @balanceDue, @currency, 'pending', @expiresAt, @providerPayloadJson, @metadataJson,
         @createdBy, @createdAt, @updatedAt)`
    ).run({
      id: linkId,
      tenantId,
      branchId,
      invoiceId,
      provider: providerResult.provider,
      providerLinkId: providerResult.providerLinkId,
      linkUrl: providerResult.paymentLink,
      amount,
      balanceDue: due,
      currency: providerResult.currency || invoice.currency || "INR",
      expiresAt,
      providerPayloadJson: json(providerResult.providerPayload),
      metadataJson: json({ createdFrom: "invoice_payment_collection", requestedAmount: payload.amount || null }),
      createdBy: access.userId || "",
      createdAt: now(),
      updatedAt: now()
    });
    updateInvoiceFields(invoiceId, tenantId, { payment_link_id: linkId, balance_due: due, updatedAt: now(), updated_at: now() });
    this.writeEvent({
      tenantId,
      branchId,
      invoiceId,
      linkId,
      provider: providerResult.provider,
      eventType: "payment.link_created",
      eventSource: "backend",
      amount,
      status: "pending",
      message: "Secure payment link created",
      payload: { providerLinkId: providerResult.providerLinkId, expiresAt },
      createdBy: access.userId || ""
    });
    return { ...this.linkDto(selectLinkById(linkId, tenantId)), invoice: this.invoiceSummary(invoice), timeline: this.timeline(invoiceId, access) };
  }

  reminder(invoiceId, payload = {}, access = {}) {
    const tenantId = access.tenantId || DEFAULT_TENANT_ID;
    const invoice = this.invoice(invoiceId, access);
    const due = invoiceDue(invoice);
    if (due <= 0.01) throw conflict("Invoice is already paid. Reminder was not sent.");
    const link = this.createLink(invoiceId, { provider: payload.provider || "razorpay", regenerate: false }, access);
    const branchId = invoiceBranchId(invoice) || access.branchId || "";
    const client = clientFor(invoice, tenantId);
    const branch = branchFor(branchId, tenantId);
    const channel = payload.channel || "whatsapp";
    const message = [
      `Hi ${client.name || invoice.clientName || "there"},`,
      `your ${branch.name || "AuraShine"} invoice ${invoiceNumber(invoice)} has ₹${due.toFixed(2)} pending.`,
      `Pay securely here: ${link.paymentLink}`,
      `Link expires on ${new Date(link.expiresAt).toLocaleString("en-IN")}.`,
      `For support, contact ${branch.phone || branch.contact || "the front desk"}.`
    ].join(" ");

    db.prepare(
      `UPDATE invoice_payment_links
          SET sent_at = @sentAt,
              sent_channel = @channel,
              reminder_count = COALESCE(reminder_count, 0) + 1,
              status = CASE WHEN status = 'pending' THEN 'sent' ELSE status END,
              updated_at = @updatedAt
        WHERE tenant_id = @tenantId AND id = @linkId`
    ).run({ tenantId, linkId: link.linkId, channel, sentAt: now(), updatedAt: now() });

    this.writeEvent({
      tenantId,
      branchId,
      invoiceId,
      linkId: link.linkId,
      provider: link.provider,
      eventType: "payment.reminder_queued",
      eventSource: channel,
      amount: due,
      status: "queued",
      message: "Payment reminder queued after fresh due check",
      payload: { channel, message },
      createdBy: access.userId || ""
    });
    return { invoiceId, channel, status: "queued", message, link: this.linkDto(selectLinkById(link.linkId, tenantId)) };
  }

  timeline(invoiceId, access = {}) {
    const tenantId = access.tenantId || DEFAULT_TENANT_ID;
    const invoice = this.invoice(invoiceId, access);
    const links = db
      .prepare("SELECT * FROM invoice_payment_links WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at DESC")
      .all(tenantId, invoiceId)
      .map((link) => this.linkDto(link));
    const events = db
      .prepare("SELECT * FROM invoice_payment_events WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at DESC, id DESC")
      .all(tenantId, invoiceId)
      .map((event) => ({ ...event, payload: parseJson(event.payload_json, {}) }));
    const webhooks = db
      .prepare("SELECT * FROM payment_webhook_events WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at DESC, id DESC")
      .all(tenantId, invoiceId)
      .map((event) => ({ ...event, rawPayload: parseJson(event.raw_payload, {}) }));
    return { invoice: this.invoiceSummary(invoice), links, events, webhooks };
  }

  handleRazorpayWebhook(rawBody = "", signature = "") {
    const provider = paymentProviderFor("razorpay");
    const rawText = typeof rawBody === "string" ? rawBody : JSON.stringify(rawBody || {});
    const signatureResult = provider.verifyWebhook(rawText, signature);
    const event = provider.parseWebhookEvent(rawText);
    const link = event.providerLinkId
      ? db.prepare("SELECT * FROM invoice_payment_links WHERE provider = 'razorpay' AND provider_link_id = ? ORDER BY created_at DESC LIMIT 1").get(event.providerLinkId)
      : null;
    if (!link) throw notFound("Razorpay payment link not found");
    const invoice = selectInvoice(link.invoice_id, link.tenant_id);
    if (!invoice) throw notFound("Linked invoice not found");
    const duplicate = db
      .prepare("SELECT id, status FROM payment_webhook_events WHERE tenant_id = ? AND provider = 'razorpay' AND event_id = ?")
      .get(link.tenant_id, event.eventId);
    if (duplicate) {
      return { duplicate: true, eventId: event.eventId, status: duplicate.status, signature: signatureResult };
    }

    const webhookId = makeId("wh");
    const txn = db.transaction(() => {
      db.prepare(
        `INSERT INTO payment_webhook_events
          (id, tenant_id, branch_id, invoice_id, link_id, provider, event_id, event_type, signature,
           payload_hash, raw_payload, provider_payment_id, provider_link_id, amount, signature_verified,
           status, processed_at, processing_error, created_at, updated_at)
         VALUES
          (@id, @tenantId, @branchId, @invoiceId, @linkId, 'razorpay', @eventId, @eventType, @signature,
           @payloadHash, @rawPayload, @providerPaymentId, @providerLinkId, @amount, @signatureVerified,
           'received', @processedAt, '', @createdAt, @updatedAt)`
      ).run({
        id: webhookId,
        tenantId: link.tenant_id,
        branchId: link.branch_id || invoiceBranchId(invoice),
        invoiceId: link.invoice_id,
        linkId: link.id,
        eventId: event.eventId,
        eventType: event.eventType,
        signature,
        payloadHash: signatureResult.payloadHash || createHash("sha256").update(rawText).digest("hex"),
        rawPayload: rawText,
        providerPaymentId: event.providerPaymentId,
        providerLinkId: event.providerLinkId,
        amount: event.amount,
        signatureVerified: signatureResult.verified ? 1 : 0,
        processedAt: now(),
        createdAt: now(),
        updatedAt: now()
      });

      if (event.paid) return this.applyPaidWebhook({ link, invoice, event, webhookId, signatureResult });
      if (event.failed || event.expired) return this.applyNonPaidWebhook({ link, invoice, event, webhookId, status: event.expired ? "expired" : "failed" });
      this.writeEvent({
        tenantId: link.tenant_id,
        branchId: link.branch_id || invoiceBranchId(invoice),
        invoiceId: link.invoice_id,
        linkId: link.id,
        provider: "razorpay",
        eventType: "payment.webhook_received",
        eventSource: "webhook",
        providerEventId: event.eventId,
        amount: event.amount,
        status: event.status,
        signatureVerified: 1,
        message: "Webhook received with no payable state change",
        payload: event.raw,
        createdBy: "razorpay-webhook"
      });
      return { duplicate: false, eventId: event.eventId, status: event.status || "received", signature: signatureResult };
    });
    return txn();
  }

  applyPaidWebhook({ link, invoice, event, webhookId, signatureResult }) {
    const due = invoiceDue(invoice);
    const amount = money(event.amount || link.amount);
    const expected = money(link.amount);
    if (Math.abs(amount - expected) > 0.01) {
      return this.blockWebhook({ link, invoice, event, webhookId, status: "amount_mismatch", error: `Gateway amount ${amount} does not match link amount ${expected}` });
    }
    if (due <= 0.01) {
      return this.blockWebhook({ link, invoice, event, webhookId, status: "manual_conflict", error: "Invoice was already settled before webhook processing" });
    }
    if (amount > due + 0.01) {
      return this.blockWebhook({ link, invoice, event, webhookId, status: "amount_mismatch", error: `Gateway amount ${amount} exceeds invoice due ${due}` });
    }

    const existingProviderPayment = event.providerPaymentId
      ? db.prepare("SELECT id FROM invoice_payments WHERE tenant_id = ? AND provider = 'razorpay' AND provider_payment_id = ? LIMIT 1").get(link.tenant_id, event.providerPaymentId)
      : null;
    if (!existingProviderPayment) {
      db.prepare(
        `INSERT INTO invoice_payments
          (id, tenant_id, invoice_id, payment_mode, provider, provider_payment_id, provider_order_id,
           provider_link_id, amount, status, paid_at, reference_no, notes, created_by, created_at)
         VALUES
          (@id, @tenantId, @invoiceId, 'razorpay', 'razorpay', @providerPaymentId, @providerOrderId,
           @providerLinkId, @amount, 'paid', @paidAt, @referenceNo, @notes, @createdBy, @createdAt)`
      ).run({
        id: makeId("ipay"),
        tenantId: link.tenant_id,
        invoiceId: link.invoice_id,
        providerPaymentId: event.providerPaymentId,
        providerOrderId: event.providerOrderId,
        providerLinkId: event.providerLinkId,
        amount,
        paidAt: now(),
        referenceNo: event.providerPaymentId || event.eventId,
        notes: "Verified Razorpay webhook payment",
        createdBy: "razorpay-webhook",
        createdAt: now()
      });
    }
    this.insertLegacyPayment(link.invoice_id, link.tenant_id, {
      mode: "razorpay",
      amount,
      reference: event.providerPaymentId || event.eventId,
      createdAt: now()
    });
    const updated = syncInvoiceState(link.invoice_id, link.tenant_id, { paymentLinkId: link.id, paidAt: now() });
    const dueAfter = invoiceDue(updated);
    const linkStatus = dueAfter <= 0.01 ? "paid" : "partial";
    db.prepare("UPDATE invoice_payment_links SET status = @status, updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id").run({
      status: linkStatus,
      updatedAt: now(),
      tenantId: link.tenant_id,
      id: link.id
    });
    db.prepare("UPDATE payment_webhook_events SET status = 'processed', updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id").run({
      updatedAt: now(),
      tenantId: link.tenant_id,
      id: webhookId
    });
    this.writeEvent({
      tenantId: link.tenant_id,
      branchId: link.branch_id || invoiceBranchId(invoice),
      invoiceId: link.invoice_id,
      linkId: link.id,
      provider: "razorpay",
      eventType: "payment.webhook_paid",
      eventSource: "webhook",
      providerEventId: event.eventId,
      providerPaymentId: event.providerPaymentId,
      providerOrderId: event.providerOrderId,
      amount,
      status: linkStatus,
      signatureVerified: signatureResult.verified ? 1 : 0,
      message: "Verified online payment applied to invoice",
      payload: { dueBefore: due, dueAfter, event: event.raw },
      createdBy: "razorpay-webhook"
    });
    return { duplicate: false, eventId: event.eventId, status: linkStatus, invoice: this.invoiceSummary(updated), signature: signatureResult };
  }

  applyNonPaidWebhook({ link, invoice, event, webhookId, status }) {
    db.prepare("UPDATE invoice_payment_links SET status = @status, updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id").run({
      status,
      updatedAt: now(),
      tenantId: link.tenant_id,
      id: link.id
    });
    db.prepare("UPDATE payment_webhook_events SET status = @status, updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id").run({
      status,
      updatedAt: now(),
      tenantId: link.tenant_id,
      id: webhookId
    });
    this.writeEvent({
      tenantId: link.tenant_id,
      branchId: link.branch_id || invoiceBranchId(invoice),
      invoiceId: link.invoice_id,
      linkId: link.id,
      provider: "razorpay",
      eventType: `payment.webhook_${status}`,
      eventSource: "webhook",
      providerEventId: event.eventId,
      amount: event.amount,
      status,
      signatureVerified: 1,
      message: `Razorpay webhook marked link ${status}`,
      payload: event.raw,
      createdBy: "razorpay-webhook"
    });
    return { duplicate: false, eventId: event.eventId, status };
  }

  blockWebhook({ link, invoice, event, webhookId, status, error }) {
    db.prepare(
      "UPDATE payment_webhook_events SET status = @status, processing_error = @error, updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id"
    ).run({ status, error, updatedAt: now(), tenantId: link.tenant_id, id: webhookId });
    db.prepare("UPDATE invoice_payment_links SET status = @status, updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id").run({
      status,
      updatedAt: now(),
      tenantId: link.tenant_id,
      id: link.id
    });
    this.writeEvent({
      tenantId: link.tenant_id,
      branchId: link.branch_id || invoiceBranchId(invoice),
      invoiceId: link.invoice_id,
      linkId: link.id,
      provider: "razorpay",
      eventType: `payment.webhook_${status}`,
      eventSource: "webhook",
      providerEventId: event.eventId,
      providerPaymentId: event.providerPaymentId,
      amount: event.amount,
      status,
      signatureVerified: 1,
      message: error,
      payload: event.raw,
      createdBy: "razorpay-webhook"
    });
    return { duplicate: false, eventId: event.eventId, status, blocked: true, error };
  }

  reconcile(invoiceId, payload = {}, access = {}) {
    const tenantId = access.tenantId || DEFAULT_TENANT_ID;
    const invoice = this.invoice(invoiceId, access);
    const links = db
      .prepare("SELECT * FROM invoice_payment_links WHERE tenant_id = ? AND invoice_id = ? ORDER BY created_at DESC")
      .all(tenantId, invoiceId);
    let checked = 0;
    let fixed = 0;
    let mismatches = 0;
    const results = [];
    for (const link of links) {
      checked += 1;
      const provider = paymentProviderFor(link.provider);
      const status = provider.fetchLinkStatus ? provider.fetchLinkStatus(link) : { status: link.status };
      const resolved = status instanceof Promise ? { status: link.status, source: "async-provider-skipped" } : status;
      const due = invoiceDue(selectInvoice(invoiceId, tenantId));
      if (resolved.status === "expired" && ["pending", "sent"].includes(link.status)) {
        db.prepare("UPDATE invoice_payment_links SET status = 'expired', updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id")
          .run({ updatedAt: now(), tenantId, id: link.id });
        fixed += 1;
      }
      if (due <= 0.01 && ["pending", "sent", "partial"].includes(link.status)) {
        db.prepare("UPDATE invoice_payment_links SET status = 'paid', updated_at = @updatedAt WHERE tenant_id = @tenantId AND id = @id")
          .run({ updatedAt: now(), tenantId, id: link.id });
        fixed += 1;
      }
      if (["amount_mismatch", "manual_conflict"].includes(link.status)) mismatches += 1;
      results.push({ linkId: link.id, provider: link.provider, before: link.status, providerStatus: resolved.status, due });
    }
    const runId = makeId("recon");
    db.prepare(
      `INSERT INTO payment_reconciliation_runs
        (id, tenant_id, branch_id, provider, run_type, invoice_id, link_id, checked_count, fixed_count,
         mismatch_count, status, summary_json, created_by, created_at)
       VALUES
        (@id, @tenantId, @branchId, @provider, @runType, @invoiceId, @linkId, @checked, @fixed,
         @mismatches, 'completed', @summaryJson, @createdBy, @createdAt)`
    ).run({
      id: runId,
      tenantId,
      branchId: invoiceBranchId(invoice),
      provider: payload.provider || "razorpay",
      runType: payload.runType || "manual",
      invoiceId,
      linkId: payload.linkId || "",
      checked,
      fixed,
      mismatches,
      summaryJson: json({ results }),
      createdBy: access.userId || "",
      createdAt: now()
    });
    this.writeEvent({
      tenantId,
      branchId: invoiceBranchId(invoice),
      invoiceId,
      provider: payload.provider || "razorpay",
      eventType: "payment.reconciliation_run",
      eventSource: "reconciliation",
      status: "completed",
      message: "Payment reconciliation completed",
      payload: { checked, fixed, mismatches },
      createdBy: access.userId || ""
    });
    return { id: runId, invoiceId, checked, fixed, mismatches, results, timeline: this.timeline(invoiceId, access) };
  }

  runs(query = {}, access = {}) {
    const tenantId = access.tenantId || DEFAULT_TENANT_ID;
    const limit = Math.min(200, Math.max(1, Number(query.limit || 50)));
    return db
      .prepare("SELECT * FROM payment_reconciliation_runs WHERE tenant_id = ? ORDER BY created_at DESC, id DESC LIMIT ?")
      .all(tenantId, limit)
      .map((run) => ({ ...run, summary: parseJson(run.summary_json, {}) }));
  }

  insertLegacyPayment(invoiceId, tenantId, payment) {
    const columns = safeColumns("payments");
    if (!columns.includes("invoiceId")) return;
    const duplicate = db
      .prepare(`SELECT id FROM payments WHERE invoiceId = @invoiceId AND reference = @reference${columns.includes("tenantId") ? " AND tenantId = @tenantId" : ""} LIMIT 1`)
      .get({ invoiceId, reference: payment.reference, tenantId });
    if (duplicate) return;
    insertDynamic("payments", {
      id: makeId("pay"),
      tenantId,
      invoiceId,
      mode: payment.mode,
      amount: money(payment.amount),
      reference: payment.reference,
      createdAt: payment.createdAt || now()
    });
    try {
      updateInvoiceStatus(invoiceId, tenantId);
    } catch {
      // Enterprise-only invoices may not have legacy totals; syncInvoiceState handles them.
    }
  }

  writeEvent({
    tenantId,
    branchId = "",
    invoiceId,
    linkId = "",
    provider = "",
    eventType,
    eventSource = "system",
    providerEventId = "",
    providerPaymentId = "",
    providerOrderId = "",
    amount = 0,
    status = "",
    idempotencyKey = "",
    signatureVerified = 0,
    message = "",
    payload = {},
    createdBy = ""
  }) {
    db.prepare(
      `INSERT OR IGNORE INTO invoice_payment_events
        (id, tenant_id, branch_id, invoice_id, link_id, provider, event_type, event_source,
         provider_event_id, provider_payment_id, provider_order_id, amount, status,
         idempotency_key, signature_verified, message, payload_json, created_by, created_at)
       VALUES
        (@id, @tenantId, @branchId, @invoiceId, @linkId, @provider, @eventType, @eventSource,
         @providerEventId, @providerPaymentId, @providerOrderId, @amount, @status,
         @idempotencyKey, @signatureVerified, @message, @payloadJson, @createdBy, @createdAt)`
    ).run({
      id: makeId("ipev"),
      tenantId,
      branchId,
      invoiceId,
      linkId,
      provider,
      eventType,
      eventSource,
      providerEventId,
      providerPaymentId,
      providerOrderId,
      amount: money(amount),
      status,
      idempotencyKey,
      signatureVerified,
      message,
      payloadJson: json(payload),
      createdBy,
      createdAt: now()
    });
    try {
      billingService.writeEvent({
        tenantId,
        invoiceId,
        eventType,
        actorUserId: createdBy || "payment-collection",
        source: "invoice-payment-collection.service",
        payload: { linkId, provider, amount: money(amount), status, message, payload }
      });
    } catch {
      // Legacy POS-only invoices can still use invoice_payment_events.
    }
  }

  invoiceSummary(invoice = {}) {
    const advance = bookingAdvanceSummary(invoice, firstText(invoice.tenant_id, invoice.tenantId));
    return {
      id: invoice.id,
      invoiceNumber: invoiceNumber(invoice),
      tenantId: firstText(invoice.tenant_id, invoice.tenantId),
      branchId: invoiceBranchId(invoice),
      clientId: invoiceClientId(invoice),
      appointmentId: advance.appointmentId,
      status: invoice.status,
      paymentStatus: invoice.payment_status || invoice.status,
      total: invoiceTotal(invoice),
      paid: invoicePaid(invoice),
      due: invoiceDue(invoice),
      paymentLinkId: invoice.payment_link_id || "",
      bookingAdvanceStatus: advance.bookingAdvanceStatus,
      bookingAdvancePaid: advance.bookingAdvancePaid,
      bookingAdvancePending: advance.bookingAdvancePending,
      bookingAdvanceLinkId: advance.bookingAdvanceLinkId
    };
  }

  linkDto(link = {}) {
    return {
      linkId: link.id,
      provider: link.provider,
      providerLinkId: link.provider_link_id,
      paymentLink: link.link_url,
      amount: money(link.amount),
      balanceDueAtCreation: money(link.balance_due_at_creation),
      currency: link.currency || "INR",
      status: link.status,
      expiresAt: link.expires_at,
      sentAt: link.sent_at,
      sentChannel: link.sent_channel,
      reminderCount: Number(link.reminder_count || 0),
      providerPayload: parseJson(link.provider_payload_json, {}),
      metadata: parseJson(link.metadata_json, {})
    };
  }
}

function selectLinkById(linkId, tenantId) {
  return db.prepare("SELECT * FROM invoice_payment_links WHERE tenant_id = ? AND id = ?").get(tenantId, linkId);
}

export const invoicePaymentCollectionService = new InvoicePaymentCollectionService();
