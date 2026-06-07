import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { db } from "../server/db.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function headers(role = "owner", tenantId = "tenant_aura", authToken = "") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role,
    ...(authToken ? { authorization: `Bearer ${authToken}` } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, role = "owner", tenantId = "tenant_aura", authToken = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(role, tenantId, authToken),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureTenant(id, slug) {
  const now = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, status, planId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, `Tenant ${slug}`, slug, "active", plan?.id || null, now, now);
}

test("client masters persist Flexi-style CRM definitions with v1 coverage and tenant isolation", async () => {
  ensureTenant("tenant_client_master_other", "client-master-other");
  const server = await listen(createApp());
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const baseUrlV1 = `http://127.0.0.1:${port}/api/v1`;
  const stamp = Date.now();

  try {
    const category = await api(baseUrl, "/client-masters/categories", {
      method: "POST",
      body: {
        code: `VIP${String(stamp).slice(-5)}`,
        name: `VIP Client ${stamp}`,
        color: "#2563eb",
        discountPercent: 10,
        loyaltyMultiplier: 1.5,
        visitThreshold: 4,
        spendThreshold: 25000
      }
    });
    assert.equal(category.response.status, 201);
    assert.equal(category.payload.discountPercent, 10);
    assert.equal(category.payload.loyaltyMultiplier, 1.5);

    const staleCategory = await api(baseUrl, `/client-masters/categories/${category.payload.id}`, {
      method: "PATCH",
      body: { version: 0, name: "Stale" }
    });
    assert.equal(staleCategory.response.status, 409);

    const updatedCategory = await api(baseUrl, `/client-masters/categories/${category.payload.id}`, {
      method: "PATCH",
      body: {
        version: category.payload.version,
        code: category.payload.code,
        name: category.payload.name,
        color: "#1d4ed8",
        discountPercent: 12,
        loyaltyMultiplier: 2,
        visitThreshold: 5,
        spendThreshold: 30000
      }
    });
    assert.equal(updatedCategory.response.status, 200);
    assert.equal(updatedCategory.payload.version, 2);
    assert.equal(updatedCategory.payload.discountPercent, 12);

    const source = await api(baseUrl, "/client-masters/sources", {
      method: "POST",
      body: {
        code: `IG${String(stamp).slice(-5)}`,
        name: `Instagram Lead ${stamp}`,
        sourceType: "instagram",
        referralRequired: false,
        attributionWindowDays: 14
      }
    });
    assert.equal(source.response.status, 201);
    assert.equal(source.payload.sourceType, "instagram");

    const preference = await api(baseUrl, "/client-masters/preferences", {
      method: "POST",
      body: {
        code: `ALG${String(stamp).slice(-5)}`,
        name: `Hair Color Allergy ${stamp}`,
        preferenceType: "allergy",
        riskLevel: "high",
        consentRequired: true,
        options: ["PPD", "Ammonia", "Fragrance"]
      }
    });
    assert.equal(preference.response.status, 201);
    assert.equal(preference.payload.options[0], "PPD");
    assert.equal(preference.payload.consentRequired, true);

    const consultation = await api(baseUrl, "/client-masters/consultation-templates", {
      method: "POST",
      body: {
        code: `HAIR${String(stamp).slice(-5)}`,
        name: `Hair Consultation ${stamp}`,
        templateType: "hair",
        validityDays: 90,
        sections: [{ title: "Hair History", fields: ["Texture", "Chemical history", "Contra indications"] }]
      }
    });
    assert.equal(consultation.response.status, 201);
    assert.equal(consultation.payload.sections[0].title, "Hair History");

    const feedback = await api(baseUrl, "/client-masters/feedback-definitions", {
      method: "POST",
      body: {
        code: `FDB${String(stamp).slice(-5)}`,
        name: `Service Feedback ${stamp}`,
        feedbackType: "service",
        triggerEvent: "service_completed",
        ratingScale: 5,
        questions: [{ label: "Stylist quality", type: "rating" }],
        scoreRules: { detractorBelow: 3, promoterAbove: 4 }
      }
    });
    assert.equal(feedback.response.status, 201);
    assert.equal(feedback.payload.questions[0].label, "Stylist quality");
    assert.equal(feedback.payload.scoreRules.promoterAbove, 4);

    const summary = await api(baseUrl, "/client-masters/summary");
    assert.equal(summary.response.status, 200);
    assert.ok(summary.payload.categories >= 1);
    assert.ok(summary.payload.sources >= 1);
    assert.ok(summary.payload.preferences >= 1);
    assert.ok(summary.payload.consultationTemplates >= 1);
    assert.ok(summary.payload.feedbackDefinitions >= 1);

    const login = await fetch(`${baseUrlV1}/auth/login`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({
        tenantId: "tenant_aura",
        email: "owner@aurasalon.example",
        password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026"
      })
    });
    assert.equal(login.status, 201);
    const loginBody = await login.json();
    const token = loginBody.data.accessToken;

    const v1Categories = await api(baseUrlV1, "/client-masters/categories", { authToken: token });
    assert.equal(v1Categories.response.status, 200);
    assert.ok(v1Categories.payload.data.some((item) => item.id === category.payload.id));

    const isolated = await api(baseUrl, "/client-masters/categories", {
      tenantId: "tenant_client_master_other"
    });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.some((item) => item.id === category.payload.id), false);
  } finally {
    await close(server);
  }
});
