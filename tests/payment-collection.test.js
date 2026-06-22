import test from "node:test";
import assert from "node:assert/strict";
import { createHmac } from "node:crypto";
import { createApp } from "../server/app.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function signed(body) {
  const raw = JSON.stringify(body);
  const signature = createHmac("sha256", process.env.RAZORPAY_WEBHOOK_SECRET || "dev-razorpay-webhook-secret").update(raw).digest("hex");
  return { raw, signature };
}

async function json(response) {
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { text };
  }
}

async function createUnpaidInvoice(baseUrl, headers, { price = 1000, gstRate = 0 } = {}) {
  const [clients, branches] = await Promise.all([
    fetch(`${baseUrl}/clients?limit=1`, { headers }).then((response) => response.json()),
    fetch(`${baseUrl}/branches?limit=1`, { headers }).then((response) => response.json())
  ]);
  assert.ok(clients[0]?.id);
  assert.ok(branches[0]?.id);
  const response = await fetch(`${baseUrl}/sales/checkout`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      clientId: clients[0].id,
      branchId: branches[0].id,
      items: [{ type: "custom", name: `Payment collection test ${Date.now()}`, quantity: 1, price, gstRate }],
      payments: []
    })
  });
  const body = await json(response);
  assert.equal(response.status, 201, body.text || JSON.stringify(body));
  return body.invoice;
}

async function createLink(baseUrl, headers, invoiceId, payload = {}) {
  const response = await fetch(`${baseUrl}/payments/invoices/${invoiceId}/link`, {
    method: "POST",
    headers,
    body: JSON.stringify(payload)
  });
  const body = await json(response);
  assert.equal(response.status, 201, body.text || JSON.stringify(body));
  return body;
}

async function sendWebhook(baseUrl, link, overrides = {}) {
  const eventId = overrides.eventId || `evt_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  const amount = Math.round(Number(overrides.amount ?? link.amount) * 100);
  const payload = {
    id: eventId,
    event: overrides.event || "payment_link.paid",
    payload: {
      payment_link: { entity: { id: link.providerLinkId, status: overrides.linkStatus || "paid", amount } },
      payment: { entity: { id: overrides.paymentId || `pay_${Date.now()}`, status: overrides.paymentStatus || "captured", amount } }
    }
  };
  const { raw, signature } = signed(payload);
  const response = await fetch(`${baseUrl}/payments/webhooks/razorpay`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-razorpay-signature": overrides.badSignature || signature },
    body: raw
  });
  return { response, body: await json(response), raw, signature };
}

test("invoice payment collection creates link, sends reminder, verifies webhook, and dedupes events", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { "content-type": "application/json", "x-tenant-id": "tenant_aura", "x-user-role": "owner" };
  try {
    const invoice = await createUnpaidInvoice(baseUrl, headers, { price: 750, gstRate: 18 });
    const link = await createLink(baseUrl, headers, invoice.id);
    assert.match(link.paymentLink, /\/payment\/razorpay\/plink_/);
    assert.equal(link.status, "pending");

    const reminder = await fetch(`${baseUrl}/payments/invoices/${invoice.id}/reminder`, {
      method: "POST",
      headers,
      body: JSON.stringify({ channel: "whatsapp" })
    });
    const reminderBody = await json(reminder);
    assert.equal(reminder.status, 201, JSON.stringify(reminderBody));
    assert.match(reminderBody.message, new RegExp(invoice.invoiceNumber));
    assert.match(reminderBody.message, /Pay securely here/);

    const rejected = await sendWebhook(baseUrl, link, { badSignature: "wrong" });
    assert.equal(rejected.response.status, 400);

    const paid = await sendWebhook(baseUrl, link);
    assert.equal(paid.response.status, 200, JSON.stringify(paid.body));
    assert.equal(paid.body.invoice.due, 0);
    assert.equal(paid.body.invoice.paymentStatus, "paid");

    const duplicate = await fetch(`${baseUrl}/payments/webhooks/razorpay`, {
      method: "POST",
      headers: { "content-type": "application/json", "x-razorpay-signature": paid.signature },
      body: paid.raw
    });
    const duplicateBody = await json(duplicate);
    assert.equal(duplicate.status, 200);
    assert.equal(duplicateBody.duplicate, true);

    const timeline = await fetch(`${baseUrl}/payments/invoices/${invoice.id}/timeline`, { headers }).then((response) => response.json());
    assert.ok(timeline.links.length >= 1);
    assert.ok(timeline.events.some((event) => event.event_type === "payment.webhook_paid"));
  } finally {
    await close(server);
  }
});

test("payment collection blocks amount mismatch and supports partial payments", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { "content-type": "application/json", "x-tenant-id": "tenant_aura", "x-user-role": "owner" };
  try {
    const mismatchInvoice = await createUnpaidInvoice(baseUrl, headers, { price: 500, gstRate: 0 });
    const mismatchLink = await createLink(baseUrl, headers, mismatchInvoice.id);
    const mismatch = await sendWebhook(baseUrl, mismatchLink, { amount: mismatchLink.amount - 1 });
    assert.equal(mismatch.response.status, 200, JSON.stringify(mismatch.body));
    assert.equal(mismatch.body.status, "amount_mismatch");
    assert.equal(mismatch.body.blocked, true);

    const partialInvoice = await createUnpaidInvoice(baseUrl, headers, { price: 500, gstRate: 0 });
    const partialLink = await createLink(baseUrl, headers, partialInvoice.id, { amount: 200 });
    const partial = await sendWebhook(baseUrl, partialLink, { amount: 200 });
    assert.equal(partial.response.status, 200, JSON.stringify(partial.body));
    assert.equal(partial.body.status, "partial");
    assert.equal(partial.body.invoice.due, 300);
  } finally {
    await close(server);
  }
});

test("payment collection handles manual cash conflict, expired regeneration, reconciliation, and branch isolation", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const headers = { "content-type": "application/json", "x-tenant-id": "tenant_aura", "x-user-role": "owner" };
  try {
    const invoice = await createUnpaidInvoice(baseUrl, headers, { price: 400, gstRate: 0 });
    const link = await createLink(baseUrl, headers, invoice.id);
    const cash = await fetch(`${baseUrl}/invoices/${invoice.id}/payments`, {
      method: "POST",
      headers,
      body: JSON.stringify({ mode: "cash", amount: link.amount, reference: "manual before online webhook" })
    });
    assert.equal(cash.status, 201, JSON.stringify(await json(cash)));
    const conflictResult = await sendWebhook(baseUrl, link);
    assert.equal(conflictResult.response.status, 200, JSON.stringify(conflictResult.body));
    assert.equal(conflictResult.body.status, "manual_conflict");

    const expiredInvoice = await createUnpaidInvoice(baseUrl, headers, { price: 350, gstRate: 0 });
    const expiredLink = await createLink(baseUrl, headers, expiredInvoice.id, { expiryHours: -1 });
    const reconciliation = await fetch(`${baseUrl}/payments/invoices/${expiredInvoice.id}/reconcile`, {
      method: "POST",
      headers,
      body: JSON.stringify({ runType: "test" })
    });
    const reconciliationBody = await json(reconciliation);
    assert.equal(reconciliation.status, 201, JSON.stringify(reconciliationBody));
    assert.ok(reconciliationBody.checked >= 1);
    const regenerated = await createLink(baseUrl, headers, expiredInvoice.id, { regenerate: true });
    assert.notEqual(regenerated.linkId, expiredLink.linkId);

    const runs = await fetch(`${baseUrl}/payments/reconciliation/runs`, { headers }).then((response) => response.json());
    assert.ok(runs.length >= 1);

    const isolated = await fetch(`${baseUrl}/payments/invoices/${invoice.id}/timeline`, {
      headers: { ...headers, "x-user-role": "frontDesk", "x-branch-id": "branch_not_allowed" }
    });
    assert.equal(isolated.status, 403);
  } finally {
    await close(server);
  }
});
