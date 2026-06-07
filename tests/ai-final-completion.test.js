import test from "node:test";
import assert from "node:assert/strict";

delete process.env.OPENAI_API_KEY;

const { createApp } = await import("../server/app.js");
const { db } = await import("../server/db.js");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function headers(role = "owner", tenantId = "tenant_aura") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role
  };
}

async function requestJson(url, options = {}) {
  const response = await fetch(url, options);
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureOtherTenant() {
  const stamp = new Date().toISOString();
  db.prepare(`
    INSERT OR IGNORE INTO tenants (id, name, slug, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)
  `).run("tenant_other", "Other Salon", "other", "active", stamp, stamp);
}

function seedLowStockProduct() {
  const stamp = new Date().toISOString();
  const id = `ai_final_product_${Date.now()}_${Math.random().toString(16).slice(2)}`;
  db.prepare(`
    INSERT INTO products
      (id, tenantId, name, sku, category, usageType, branchId, stock, lowStockThreshold, unitCost, price, status, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, "tenant_aura", "AI Final Low Stock Serum", id, "Hair", "professional", "branch_hyd", 0, 5, 100, 400, "active", stamp, stamp);
  return id;
}

test("AI knowledge base supports tenant-scoped CRUD and search citations", async () => {
  ensureOtherTenant();
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const title = `Cancellation Policy ${Date.now()}`;

  try {
    const created = await requestJson(`${baseUrl}/ai/knowledge/documents`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({
        title,
        category: "policy",
        content: "Cancellation requires four hours notice. Late cancellation may need front desk approval.",
        branchId: "branch_hyd"
      })
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.document.title, title);
    assert.ok(created.payload.chunks >= 1);

    const search = await requestJson(`${baseUrl}/ai/knowledge/search`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({ query: "What is cancellation notice?", branchId: "branch_hyd" })
    });
    assert.equal(search.response.status, 200);
    assert.ok(search.payload.sources.includes(title));

    const otherTenantSearch = await requestJson(`${baseUrl}/ai/knowledge/search`, {
      method: "POST",
      headers: headers("owner", "tenant_other"),
      body: JSON.stringify({ query: "cancellation notice" })
    });
    assert.equal(otherTenantSearch.response.status, 200);
    assert.ok(!otherTenantSearch.payload.sources.includes(title));

    const denied = await requestJson(`${baseUrl}/ai/knowledge/documents`, {
      method: "POST",
      headers: headers("staff"),
      body: JSON.stringify({ title: "Staff blocked", content: "Should not save" })
    });
    assert.equal(denied.response.status, 403);

    const deleted = await requestJson(`${baseUrl}/ai/knowledge/documents/${created.payload.document.id}`, {
      method: "DELETE",
      headers: headers("owner")
    });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.payload.deleted, true);
  } finally {
    await close(server);
  }
});

test("WhatsApp AI agent creates approval-first drafts and never auto-sends", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const draft = await requestJson(`${baseUrl}/ai/whatsapp-agent/draft`, {
      method: "POST",
      headers: headers("frontDesk"),
      body: JSON.stringify({
        phone: "+91 98765 43210",
        message: "Can I book hair spa tomorrow and what is the price?",
        branchId: "branch_hyd"
      })
    });
    assert.equal(draft.response.status, 201);
    assert.equal(draft.payload.sent, false);
    assert.equal(draft.payload.approvalRequired, true);
    assert.equal(draft.payload.detectedIntent.intent, "booking_request");
    assert.ok(draft.payload.suggestedReply);
    assert.ok(draft.payload.suggestedAction.type);

    const approved = await requestJson(`${baseUrl}/ai/whatsapp-agent/drafts/${draft.payload.draft.id}/approve`, {
      method: "POST",
      headers: headers("frontDesk"),
      body: JSON.stringify({})
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.payload.sent, false);
    assert.equal(approved.payload.draft.status, "approved");

    const handoff = await requestJson(`${baseUrl}/ai/whatsapp-agent/drafts/${draft.payload.draft.id}/handoff`, {
      method: "POST",
      headers: headers("frontDesk"),
      body: JSON.stringify({})
    });
    assert.equal(handoff.response.status, 200);
    assert.equal(handoff.payload.sent, false);
    assert.equal(handoff.payload.draft.status, "handoff");
  } finally {
    await close(server);
  }
});

test("AI automation run creates suggestions only and observability reports governance counts", async () => {
  seedLowStockProduct();
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const run = await requestJson(`${baseUrl}/ai/automation/run`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({ type: "low_stock_reorder", branchId: "branch_hyd" })
    });
    assert.equal(run.response.status, 201);
    assert.equal(run.payload.autoSend, false);
    assert.ok(run.payload.suggestions.length >= 1);
    assert.equal(run.payload.run.summary.executionMode, "suggestions_only");

    const suggestions = await requestJson(`${baseUrl}/ai/automation/suggestions`, {
      method: "GET",
      headers: headers("owner")
    });
    assert.equal(suggestions.response.status, 200);
    assert.ok(suggestions.payload.some((item) => item.runId === run.payload.run.id));

    const obs = await requestJson(`${baseUrl}/ai/observability`, {
      method: "GET",
      headers: headers("owner")
    });
    assert.equal(obs.response.status, 200);
    assert.ok(obs.payload.automationSuggestionsCount >= 1);
    assert.ok(Array.isArray(obs.payload.recentInteractions));
  } finally {
    await close(server);
  }
});

test("Predictive intelligence endpoints return tenant-scoped risk rows", async () => {
  seedLowStockProduct();
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    for (const path of [
      "clients",
      "appointments",
      "demand",
      "inventory",
      "revenue"
    ]) {
      const result = await requestJson(`${baseUrl}/ai/predictions/${path}`, {
        method: "GET",
        headers: headers("owner")
      });
      assert.equal(result.response.status, 200);
      assert.ok(Array.isArray(result.payload.predictions));
      assert.ok(result.payload.generatedAt);
      if (result.payload.predictions.length) {
        assert.ok(["low", "medium", "high"].includes(result.payload.predictions[0].riskLevel));
        assert.ok(result.payload.predictions[0].recommendedAction);
      }
    }

    const staffRevenue = await requestJson(`${baseUrl}/ai/predictions/revenue`, {
      method: "GET",
      headers: headers("staff")
    });
    assert.equal(staffRevenue.response.status, 403);
  } finally {
    await close(server);
  }
});
