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

function ensureTenant(id) {
  const stamp = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`
    INSERT OR IGNORE INTO tenants
      (id, name, slug, status, planId, subscriptionStatus, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?)
  `).run(id, `AI Tenant ${id}`, id.replace(/_/g, "-"), "active", plan?.id || "", "active", stamp, stamp);
}

test("WhatsApp AI approval workflow supports copy/manual statuses without auto-send", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const draft = await requestJson(`${baseUrl}/ai/whatsapp-agent/draft`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({
        phone: "+91 98888 77777",
        message: "Please book facial tomorrow and tell me price",
        branchId: "branch_hyd"
      })
    });
    assert.equal(draft.response.status, 201);
    assert.equal(draft.payload.sent, false);
    assert.equal(draft.payload.draft.status, "draft");

    const copied = await requestJson(`${baseUrl}/ai/whatsapp-agent/drafts/${draft.payload.draft.id}/copy`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({})
    });
    assert.equal(copied.response.status, 200);
    assert.equal(copied.payload.sent, false);
    assert.equal(copied.payload.draft.status, "copied");
    assert.ok(copied.payload.draft.auditTrail.some((event) => event.event === "draft_copied"));

    const sent = await requestJson(`${baseUrl}/ai/whatsapp-agent/drafts/${draft.payload.draft.id}/mark-sent-manually`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({})
    });
    assert.equal(sent.response.status, 200);
    assert.equal(sent.payload.sent, false);
    assert.equal(sent.payload.manuallyMarkedSent, true);
    assert.equal(sent.payload.draft.status, "sent_manually");

    const staffDenied = await requestJson(`${baseUrl}/ai/whatsapp-agent/drafts/${draft.payload.draft.id}/mark-sent-manually`, {
      method: "POST",
      headers: headers("staff"),
      body: JSON.stringify({})
    });
    assert.equal(staffDenied.response.status, 403);
  } finally {
    await close(server);
  }
});

test("WhatsApp DND clients cannot be marked as sent manually", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const phone = `+91 90000 ${String(Date.now()).slice(-5)}`;
  try {
    const client = await requestJson(`${baseUrl}/clients`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({
        name: "AI DND Test Client",
        phone,
        branchId: "branch_hyd",
        tags: ["dnd"]
      })
    });
    assert.equal(client.response.status, 201);

    const draft = await requestJson(`${baseUrl}/ai/whatsapp-agent/draft`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({
        clientId: client.payload.id,
        phone,
        message: "Can you remind me about my booking?",
        branchId: "branch_hyd"
      })
    });
    assert.equal(draft.response.status, 201);
    assert.equal(draft.payload.draft.status, "needs_review");
    assert.match(draft.payload.actionRequired, /DND|opt-out/i);

    const blocked = await requestJson(`${baseUrl}/ai/whatsapp-agent/drafts/${draft.payload.draft.id}/mark-sent-manually`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({})
    });
    assert.equal(blocked.response.status, 400);
  } finally {
    await close(server);
  }
});

test("Knowledge search ranks branch title matches and exposes confidence/unmatched terms", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = Date.now();
  try {
    const globalDoc = await requestJson(`${baseUrl}/ai/knowledge/documents`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({
        title: `Generic Policy ${stamp}`,
        category: "policy",
        content: "Hydra cancellation is allowed only after front desk approval."
      })
    });
    assert.equal(globalDoc.response.status, 201);

    const branchDoc = await requestJson(`${baseUrl}/ai/knowledge/documents`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({
        title: `Hydra Cancellation Prime ${stamp}`,
        category: "policy",
        content: "Branch-specific hydra cancellation rule: collect reason before changing the slot.",
        branchId: "branch_hyd"
      })
    });
    assert.equal(branchDoc.response.status, 201);

    const search = await requestJson(`${baseUrl}/ai/knowledge/search`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({ query: "hydra cancellation prime", branchId: "branch_hyd" })
    });
    assert.equal(search.response.status, 200);
    assert.equal(search.payload.matches[0].title, branchDoc.payload.document.title);
    assert.ok(search.payload.confidence > 0.6);
    assert.ok(Array.isArray(search.payload.unmatchedTerms));

    const low = await requestJson(`${baseUrl}/ai/knowledge/search`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({ query: "zzzzzz qqqqqq xxyyzz", branchId: "branch_hyd" })
    });
    assert.equal(low.response.status, 200);
    assert.equal(low.payload.matches.length, 0);
    assert.equal(low.payload.confidence, 0);
  } finally {
    await close(server);
  }
});

test("AI governance settings, task overrides and denials are tenant scoped", async () => {
  const tenantId = `tenant_ai_prod_${Date.now()}`;
  const otherTenantId = `${tenantId}_other`;
  ensureTenant(tenantId);
  ensureTenant(otherTenantId);
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const settings = await requestJson(`${baseUrl}/ai/governance/settings`, {
      method: "GET",
      headers: headers("owner", tenantId)
    });
    assert.equal(settings.response.status, 200);
    assert.equal(settings.payload.tenantId, tenantId);

    const staffPatch = await requestJson(`${baseUrl}/ai/governance/settings`, {
      method: "PATCH",
      headers: headers("staff", tenantId),
      body: JSON.stringify({ dailyCallLimit: 1 })
    });
    assert.equal(staffPatch.response.status, 403);

    const disabled = await requestJson(`${baseUrl}/ai/governance/task-overrides/analytics.summary`, {
      method: "PATCH",
      headers: headers("owner", tenantId),
      body: JSON.stringify({ enabled: false })
    });
    assert.equal(disabled.response.status, 200);
    assert.equal(disabled.payload.task.enabled, false);

    const blockedTask = await requestJson(`${baseUrl}/ai/analytics-summary`, {
      method: "POST",
      headers: headers("owner", tenantId),
      body: JSON.stringify({ prompt: "Summarize today" })
    });
    assert.equal(blockedTask.response.status, 403);

    const denials = await requestJson(`${baseUrl}/ai/governance/denials`, {
      method: "GET",
      headers: headers("owner", tenantId)
    });
    assert.equal(denials.response.status, 200);
    assert.ok(denials.payload.denials.some((denial) => denial.taskKey === "analytics.summary"));

    const otherOverrides = await requestJson(`${baseUrl}/ai/governance/task-overrides`, {
      method: "GET",
      headers: headers("owner", otherTenantId)
    });
    assert.equal(otherOverrides.response.status, 200);
    assert.ok(otherOverrides.payload.tasks.find((task) => task.taskKey === "analytics.summary")?.enabled);
  } finally {
    await close(server);
  }
});

test("AI daily call limits block tasks safely and log denials", async () => {
  const tenantId = `tenant_ai_limit_${Date.now()}`;
  ensureTenant(tenantId);
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const limited = await requestJson(`${baseUrl}/ai/governance/settings`, {
      method: "PATCH",
      headers: headers("owner", tenantId),
      body: JSON.stringify({ dailyCallLimit: 0, dailyCostLimitUsd: 5, enabled: true })
    });
    assert.equal(limited.response.status, 200);

    const blocked = await requestJson(`${baseUrl}/ai/review-reply`, {
      method: "POST",
      headers: headers("owner", tenantId),
      body: JSON.stringify({ rating: 5, reviewText: "Great salon" })
    });
    assert.equal(blocked.response.status, 403);

    const denials = await requestJson(`${baseUrl}/ai/governance/denials`, {
      method: "GET",
      headers: headers("owner", tenantId)
    });
    assert.ok(denials.payload.denials.some((denial) => denial.reason.includes("daily call limit")));
  } finally {
    await close(server);
  }
});

test("Predictive inventory scores react to source metrics and include confidence", async () => {
  const stamp = new Date().toISOString();
  const lowId = `ai_pred_low_${Date.now()}`;
  const highId = `ai_pred_high_${Date.now()}`;
  db.prepare(`
    INSERT INTO products
      (id, tenantId, name, sku, category, usageType, branchId, stock, lowStockThreshold, unitCost, price, status, createdAt, updatedAt)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?),
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    lowId, "tenant_aura", "AI Pred Low Stock", lowId, "Hair", "professional", "branch_hyd", 0, 5, 100, 300, "active", stamp, stamp,
    highId, "tenant_aura", "AI Pred Full Stock", highId, "Hair", "professional", "branch_hyd", 80, 5, 100, 300, "active", stamp, stamp
  );
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const result = await requestJson(`${baseUrl}/ai/predictions/inventory?branchId=branch_hyd`, {
      method: "GET",
      headers: headers("owner")
    });
    assert.equal(result.response.status, 200);
    const low = result.payload.predictions.find((item) => item.id === lowId);
    const high = result.payload.predictions.find((item) => item.id === highId);
    assert.ok(low);
    assert.ok(high);
    assert.ok(low.score > high.score);
    assert.ok(low.confidence > 0);
    assert.ok(low.sourceMetrics.daysToStockout !== undefined);
  } finally {
    await close(server);
  }
});
