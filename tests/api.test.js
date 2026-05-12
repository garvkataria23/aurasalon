import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

test("API health and permission matrix endpoints respond with live data", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const health = await fetch(`${baseUrl}/health`);
    assert.equal(health.status, 200);
    assert.equal((await health.json()).ok, true);

    const matrix = await fetch(`${baseUrl}/security/permission-matrix`, {
      headers: {
        "x-tenant-id": "tenant_aura",
        "x-user-role": "owner"
      }
    });
    assert.equal(matrix.status, 200);
    const body = await matrix.json();
    assert.ok(body.roles.some((role) => role.role === "owner"));
    assert.ok(body.roles.some((role) => role.role === "accountant"));
    assert.ok(body.resources.includes("finance"));
  } finally {
    await close(server);
  }
});

test("POS finance endpoints validate coupons, create invoice documents and issue credit notes", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const headers = {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner"
  };
  try {
    const [clients, branches] = await Promise.all([
      fetch(`${baseUrl}/clients?limit=1`, { headers }).then((response) => response.json()),
      fetch(`${baseUrl}/branches?limit=1`, { headers }).then((response) => response.json())
    ]);
    assert.ok(clients[0]?.id);
    assert.ok(branches[0]?.id);

    const coupon = await fetch(`${baseUrl}/sales/coupons/validate`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        code: "GLOW10",
        branchId: branches[0].id,
        items: [{ type: "custom", name: "Signature service", quantity: 1, price: 1500, gstRate: 18 }]
      })
    });
    assert.equal(coupon.status, 200);
    assert.equal((await coupon.json()).discountAmount, 150);

    const saleResponse = await fetch(`${baseUrl}/sales/checkout`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        clientId: clients[0].id,
        branchId: branches[0].id,
        items: [{ type: "custom", name: "Signature service", quantity: 1, price: 1500, gstRate: 18 }],
        couponCode: "GLOW10",
        payments: []
      })
    });
    assert.equal(saleResponse.status, 201);
    const saleBody = await saleResponse.json();
    assert.ok(saleBody.invoice?.id);
    assert.equal(saleBody.invoice.couponCode, "GLOW10");
    assert.ok(saleBody.invoiceDocument?.content.includes("Tax Invoice"));

    const documentResponse = await fetch(`${baseUrl}/invoices/${saleBody.invoice.id}/document`, {
      method: "POST",
      headers
    });
    assert.equal(documentResponse.status, 201);
    assert.match((await documentResponse.json()).content, /Signature service/);

    const creditNoteResponse = await fetch(`${baseUrl}/invoices/${saleBody.invoice.id}/credit-note`, {
      method: "POST",
      headers,
      body: JSON.stringify({ amount: 25, reason: "Service recovery credit" })
    });
    assert.equal(creditNoteResponse.status, 201);
    assert.match((await creditNoteResponse.json()).creditNoteNumber, /^CN-/);
  } finally {
    await close(server);
  }
});

test("client wallet endpoint persists ledger-backed balance changes", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const headers = {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner"
  };
  try {
    const clients = await fetch(`${baseUrl}/clients?limit=1`, { headers }).then((response) => response.json());
    const before = Number(clients[0].walletBalance || 0);
    const response = await fetch(`${baseUrl}/clients/${clients[0].id}/wallet`, {
      method: "POST",
      headers,
      body: JSON.stringify({ type: "credit", amount: 25, notes: "Automated quality test credit" })
    });
    assert.equal(response.status, 201);
    const body = await response.json();
    assert.equal(Number(body.transaction.amount), 25);
    assert.equal(Number(body.client.walletBalance), before + 25);
  } finally {
    await close(server);
  }
});
