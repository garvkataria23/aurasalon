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

test("purchase orders support Flexi-style GST, supplier terms and GRN variances", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const headers = {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner"
  };
  try {
    const [products, branches] = await Promise.all([
      fetch(`${baseUrl}/products?limit=1`, { headers }).then((response) => response.json()),
      fetch(`${baseUrl}/branches?limit=1`, { headers }).then((response) => response.json())
    ]);
    assert.ok(products[0]?.id);
    assert.ok(branches[0]?.id);
    const supplier = await fetch(`${baseUrl}/inventory-intelligence/suppliers`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `PO Supplier ${Date.now()}`,
        gstin: "27ABCDE1234F1Z5",
        phone: "+91 90000 00000",
        preferredPaymentTerms: "7 days",
        leadTimeDays: 3
      })
    }).then((response) => response.json());

    const poResponse = await fetch(`${baseUrl}/inventory-intelligence/purchase-orders`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        branchId: products[0].branchId || branches[0].id,
        supplierId: supplier.id,
        expectedDeliveryDate: "2026-06-05",
        paymentTerms: "7 days",
        deliveryTerms: "Branch delivery",
        approvalNote: "Owner approval required",
        items: [{
          productId: products[0].id,
          quantity: 2,
          unit: "pcs",
          hsnSac: "3305",
          mrp: 500,
          discountPercent: 10,
          unitCost: 100,
          gstPercent: 18
        }]
      })
    });
    const poText = await poResponse.text();
    assert.equal(poResponse.status, 201, poText);
    const po = JSON.parse(poText);
    assert.equal(po.items[0].hsnSac, "3305");
    assert.equal(Number(po.taxableAmount), 180);
    assert.equal(Number(po.gstAmount), 32.4);
    assert.equal(Number(po.grandTotal), 212.4);
    assert.equal(po.supplier.gstin, "27ABCDE1234F1Z5");

    const approved = await fetch(`${baseUrl}/inventory-intelligence/purchase-orders/${po.id}/approve`, {
      method: "POST",
      headers,
      body: JSON.stringify({ approvalNote: "Approved for test" })
    }).then((response) => response.json());
    assert.equal(approved.status, "approved");
    assert.equal(approved.approvalStatus, "approved");

    const billDraftResponse = await fetch(`${baseUrl}/inventory-intelligence/purchase-bill-drafts/upload`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        branchId: products[0].branchId || branches[0].id,
        supplierId: supplier.id,
        supplierName: supplier.name,
        supplierGstin: supplier.gstin,
        billNo: "INV-PO-TEST",
        billDate: "2026-06-05",
        subtotal: 120,
        gstAmount: 21.6,
        totalAmount: 141.6,
        items: [{
          productId: products[0].id,
          productName: products[0].name,
          rawName: products[0].name,
          qty: 1,
          stockQty: 1,
          purchaseUnit: "pcs",
          stockUnit: "pcs",
          unitCost: 120,
          gstPercent: 18,
          hsnSac: "3305",
          lineTotal: 141.6,
          taxableAmount: 120,
          gstAmount: 21.6
        }]
      })
    });
    const billDraftText = await billDraftResponse.text();
    assert.equal(billDraftResponse.status, 201, billDraftText);
    const billDraft = JSON.parse(billDraftText);

    const matchedDraftResponse = await fetch(`${baseUrl}/inventory-intelligence/purchase-bill-drafts/${billDraft.id}/match-po`, {
      method: "POST",
      headers,
      body: JSON.stringify({ purchaseOrderId: po.id })
    });
    const matchedDraftText = await matchedDraftResponse.text();
    assert.equal(matchedDraftResponse.status, 200, matchedDraftText);
    const matchedDraft = JSON.parse(matchedDraftText);
    assert.equal(matchedDraft.purchaseOrderId, po.id);
    assert.equal(matchedDraft.poMatch.linkedPurchaseOrderId, po.id);

    const confirmResponse = await fetch(`${baseUrl}/inventory-intelligence/purchase-bill-drafts/${billDraft.id}/confirm`, {
      method: "POST",
      headers,
      body: JSON.stringify({ challanNo: "CH-1", grnNumber: "GRN-PO-TEST", receivedBy: "Owner" })
    });
    const confirmText = await confirmResponse.text();
    assert.equal(confirmResponse.status, 200, confirmText);
    const confirmed = JSON.parse(confirmText);
    assert.equal(confirmed.status, "confirmed");
    assert.equal(confirmed.poMatch.confirmedViaPurchaseOrder, true);

    const received = await fetch(`${baseUrl}/inventory-intelligence/purchase-orders/${po.id}`, { headers }).then((response) => response.json());
    assert.equal(received.status, "partial_receive");
    assert.equal(received.grnNumber, "GRN-PO-TEST");
    assert.ok(received.variances.some((variance) => variance.type === "rate_changed"));
    assert.ok(received.variances.some((variance) => variance.type === "short_qty"));
    assert.ok(Array.isArray(received.billMatches));
    assert.ok(received.inventoryImpact);
  } finally {
    await close(server);
  }
});

test("client beauty and safety profile saves nested preferences safely", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  let clientId = "";
  let authHeaders = null;
  try {
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant_aura", email: "owner@aurasalon.example", password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026" })
    }).then((response) => response.json());
    const headers = { authorization: `Bearer ${login.data.accessToken}`, "x-tenant-id": "tenant_aura", "content-type": "application/json" };
    authHeaders = headers;

    const createdResponse = await fetch(`${baseUrl}/clients`, {
      method: "POST",
      headers,
      body: JSON.stringify({
        name: `Beauty Profile Test ${Date.now()}`,
        phone: `9${Date.now().toString().slice(-9)}`,
        tags: ["profile-test"]
      })
    });
    const createdText = await createdResponse.text();
    assert.equal(createdResponse.status, 201, createdText);
    clientId = JSON.parse(createdText).data.id;

    const profileResponse = await fetch(`${baseUrl}/clients/${clientId}`, {
      method: "PATCH",
      headers,
      body: JSON.stringify({
        allergies: ["BLEACH", "AMONIA"],
        preferences: {
          skinType: "Oily",
          skinConcerns: "ACNE,PIGMENTATION,TANNING",
          hairType: "Wavy",
          scalpCondition: "Dry",
          chemicalHistory: "HAIR STRAIGHTNING",
          nailShadePreference: "NUDE",
          nailShapePreference: "Square",
          preferredStylistId: "staff_aftab",
          preferredServiceNotes: "WITH SMILE",
          productsUsed: "WELLA",
          productsToAvoid: "AMONIA",
          brandPreference: "WELLA",
          appointmentPreference: "MORNING",
          comfortNotes: "COFFEE",
          lifestyleNotes: "GYM"
        },
        safetyFlags: {
          allergySeverity: "clear",
          patchTestDate: "2026-05-22",
          patchTestResult: "passed",
          productsToAvoid: "AMONIA"
        },
        communicationPreferences: {
          preferredChannel: "whatsapp",
          preferredLanguage: "en-IN",
          appointmentPreference: "MORNING"
        },
        notes: { frontDesk: "Object notes should not break SQLite binding" }
      })
    });
    const profileText = await profileResponse.text();
    assert.equal(profileResponse.status, 200, profileText);
    const profile = JSON.parse(profileText).data;
    assert.deepEqual(profile.allergies, ["BLEACH", "AMONIA"]);
    assert.equal(profile.preferences.skinType, "Oily");
    assert.equal(profile.preferences.productsUsed, "WELLA");
    assert.equal(profile.safetyFlags.patchTestResult, "passed");
    assert.equal(profile.communicationPreferences.preferredChannel, "whatsapp");
    assert.equal(profile.notes, JSON.stringify({ frontDesk: "Object notes should not break SQLite binding" }));
  } finally {
    if (clientId && authHeaders) {
      await fetch(`${baseUrl}/clients/${clientId}`, {
        method: "DELETE",
        headers: authHeaders
      });
    }
    await close(server);
  }
});

test("versioned API requires JWT and accepts password-backed login", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const blocked = await fetch(`${baseUrl}/clients`, { headers: { "x-tenant-id": "tenant_aura" } });
    assert.equal(blocked.status, 401);
    const blockedBody = await blocked.json();
    assert.equal(blockedBody.success, false);

    const badLogin = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant_aura", email: "owner@aurasalon.example", password: "wrong-password" })
    });
    assert.equal(badLogin.status, 401);

    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant_aura", email: "owner@aurasalon.example", password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026" })
    });
    assert.equal(login.status, 201);
    const loginBody = await login.json();
    assert.equal(loginBody.success, true);
    assert.ok(loginBody.data.accessToken);
    assert.ok(loginBody.data.refreshToken);

    const clients = await fetch(`${baseUrl}/clients?limit=1`, {
      headers: { authorization: `Bearer ${loginBody.data.accessToken}`, "x-tenant-id": "tenant_aura" }
    });
    assert.equal(clients.status, 200);
    const clientsBody = await clients.json();
    assert.equal(clientsBody.success, true);
    assert.ok(Array.isArray(clientsBody.data));
  } finally {
    await close(server);
  }
});

test("level 27-50 ecosystem exposes persisted coverage resources", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const login = await fetch(`${baseUrl}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ tenantId: "tenant_aura", email: "owner@aurasalon.example", password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026" })
    }).then((response) => response.json());
    const headers = { authorization: `Bearer ${login.data.accessToken}`, "x-tenant-id": "tenant_aura", "content-type": "application/json" };

    const coverage = await fetch(`${baseUrl}/ecosystem/level-coverage`, { headers });
    assert.equal(coverage.status, 200);
    const body = await coverage.json();
    assert.equal(body.success, true);
    assert.equal(body.data.levels.length, 24);
    assert.equal(body.data.levels[0].level, 27);
    assert.equal(body.data.levels.at(-1).level, 50);
    assert.equal(body.data.missing.length, 0);

    const pricingRule = await fetch(`${baseUrl}/dynamicPricingRules`, { headers }).then((response) => response.json());
    assert.equal(pricingRule.success, true);
    assert.ok(pricingRule.data.some((rule) => rule.id === "price_peak_weekend"));

    const franchise = await fetch(`${baseUrl}/franchises`, { headers }).then((response) => response.json());
    assert.equal(franchise.success, true);
    assert.ok(franchise.data.some((row) => row.id === "franchise_pune_001"));
  } finally {
    await close(server);
  }
});
