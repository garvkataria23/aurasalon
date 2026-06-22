import test from "node:test";
import assert from "node:assert/strict";

process.env.AI_PROVIDER = "openai";
delete process.env.OPENAI_API_KEY;

const { createApp } = await import("../server/app.js");
const { env } = await import("../server/config/env.js");
const { db } = await import("../server/db.js");
const { redactAiInput } = await import("../server/services/ai/piiRedactor.js");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function ownerHeaders(extra = {}) {
  return {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner",
    ...extra
  };
}

let uniqueClientPhoneCounter = 0;

function uniquePhone() {
  uniqueClientPhoneCounter += 1;
  return `+91 8${String(Date.now()).slice(-8)}${uniqueClientPhoneCounter % 10}`;
}

async function postAi(baseUrl, type, body, headers = {}) {
  const response = await fetch(`${baseUrl}/ai/${type}`, {
    method: "POST",
    headers: ownerHeaders(headers),
    body: JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

async function postReviewReply(baseUrl, body) {
  return postAi(baseUrl, "review-reply", body);
}

async function createClient(baseUrl, body = {}, headers = {}) {
  const response = await fetch(`${baseUrl}/clients`, {
    method: "POST",
    headers: ownerHeaders(headers),
    body: JSON.stringify({
      name: `AI Client ${Date.now()} ${Math.random()}`,
      phone: uniquePhone(),
      branchId: "branch_hyd",
      ...body
    })
  });
  const payload = await response.json();
  assert.equal(response.status, 201);
  return payload;
}

function seedCacheRow({ tenantId = "tenant_aura", taskKey = "review.reply", key = "" } = {}) {
  const stamp = new Date().toISOString();
  const cacheKey = key || `test_cache_${tenantId}_${taskKey}_${Date.now()}_${Math.random()}`;
  db.prepare(`
    INSERT OR REPLACE INTO ai_response_cache
      (cache_key, task_key, tenantId, output, usage, model, provider, prompt_version, created_at, expires_at, hit_count)
    VALUES
      (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `).run(
    cacheKey,
    taskKey,
    tenantId,
    JSON.stringify({ test: cacheKey }),
    JSON.stringify({ inputTokens: 1, outputTokens: 1 }),
    "local-business-rules",
    "local",
    "v1",
    stamp,
    new Date(Date.now() + 3600000).toISOString(),
    0
  );
  return cacheKey;
}

test("PII redactor redacts sensitive values without mutating the original input", () => {
  const original = {
    name: "Riya",
    phone: "+91 98765 43210",
    email: "riya@example.com",
    nested: {
      token: "api_key=sk-test-secret-1234567890",
      recordId: "1778982909310"
    },
    list: ["Call 9988776655", "plain text"]
  };
  const copyBefore = JSON.stringify(original);
  const redacted = redactAiInput(original);

  assert.equal(JSON.stringify(original), copyBefore);
  assert.notEqual(redacted, original);
  assert.equal(redacted.phone, "[redacted-phone]");
  assert.equal(redacted.email, "[redacted-email]");
  assert.equal(redacted.nested.token, "[redacted-token]");
  assert.equal(redacted.nested.recordId, "[redacted-id]");
  assert.equal(redacted.list[0], "Call [redacted-phone]");
});

test("review-reply keeps response shape, persists interaction and records local AI cost ledger", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = `phase1-local-${Date.now()}-${Math.random()}`;

  try {
    const { response, payload } = await postReviewReply(baseUrl, {
      rating: 2,
      reviewText: `The haircut wait was too long ${stamp}`
    });

    assert.equal(response.status, 201);
    assert.deepEqual(Object.keys(payload).sort(), ["interaction", "output"]);
    assert.ok(payload.interaction?.id);
    assert.ok(payload.output?.reply);
    assert.equal(payload.output.model, "local-business-rules");
    assert.equal(payload.output.ai.provider, "local");
    assert.equal(payload.output.ai.cached, false);

    const interaction = db.prepare("SELECT * FROM ai_interactions WHERE id = ?").get(payload.interaction.id);
    assert.ok(interaction);
    assert.equal(interaction.type, "review-reply");

    const ledger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(payload.output.ai.requestId);
    assert.ok(ledger);
    assert.equal(ledger.tenantId, "tenant_aura");
    assert.equal(ledger.task_key, "review.reply");
    assert.equal(ledger.provider, "local");
    assert.equal(ledger.cached, 0);
  } finally {
    await close(server);
  }
});

test("marketing-caption keeps response shape, persists interaction, records ledger and can reuse cache", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = `phase12-marketing-${Date.now()}-${Math.random()}`;
  const body = {
    offer: `Keratin care weekend package ${stamp}`,
    channel: "Instagram",
    audience: "VIP clients",
    branchName: "Aura Indiranagar"
  };

  try {
    const first = await postAi(baseUrl, "marketing-caption", body);
    assert.equal(first.response.status, 201);
    assert.deepEqual(Object.keys(first.payload).sort(), ["interaction", "output"]);
    assert.ok(first.payload.interaction?.id);
    assert.equal(first.payload.output.model, "local-business-rules");
    assert.equal(first.payload.output.ai.taskKey, "marketing.caption");
    assert.equal(first.payload.output.ai.cached, false);
    assert.ok(first.payload.output.captions?.length);

    const interaction = db.prepare("SELECT * FROM ai_interactions WHERE id = ?").get(first.payload.interaction.id);
    assert.ok(interaction);
    assert.equal(interaction.type, "marketing-caption");

    const ledger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(first.payload.output.ai.requestId);
    assert.ok(ledger);
    assert.equal(ledger.task_key, "marketing.caption");

    const second = await postAi(baseUrl, "marketing-caption", body);
    assert.equal(second.response.status, 201);
    assert.equal(second.payload.output.ai.cached, true);

    const cacheRow = db.prepare(`
      SELECT * FROM ai_response_cache
      WHERE tenantId = ? AND task_key = ? AND output LIKE ?
      ORDER BY created_at DESC
    `).get("tenant_aura", "marketing.caption", `%${stamp}%`);
    assert.ok(cacheRow);
    assert.ok(Number(cacheRow.hit_count) >= 1);
  } finally {
    await close(server);
  }
});

test("analytics-summary keeps response shape, persists interaction and records ledger", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const { response, payload } = await postAi(baseUrl, "analytics-summary", {
      branchId: "branch_hyd"
    });

    assert.equal(response.status, 201);
    assert.deepEqual(Object.keys(payload).sort(), ["interaction", "output"]);
    assert.ok(payload.interaction?.id);
    assert.equal(payload.output.model, "local-business-rules");
    assert.equal(payload.output.ai.taskKey, "analytics.summary");
    assert.ok(payload.output.summary?.length);
    assert.ok(payload.output.actions?.length);

    const interaction = db.prepare("SELECT * FROM ai_interactions WHERE id = ?").get(payload.interaction.id);
    assert.ok(interaction);
    assert.equal(interaction.type, "analytics-summary");

    const ledger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(payload.output.ai.requestId);
    assert.ok(ledger);
    assert.equal(ledger.task_key, "analytics.summary");
  } finally {
    await close(server);
  }
});

test("customer360 health, churn and next-best-action work with local fallback and persist AI records", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const client = await createClient(baseUrl, {
      name: `Customer AI Health ${Date.now()}`,
      phone: uniquePhone(),
      totalSpend: 7200,
      visitCount: 3,
      lastVisitAt: "2026-03-01T10:00:00.000Z"
    });

    for (const type of ["customer-health-score", "customer-churn-risk", "customer-next-best-action"]) {
      const { response, payload } = await postAi(baseUrl, type, { clientId: client.id });
      assert.equal(response.status, 201);
      assert.deepEqual(Object.keys(payload).sort(), ["interaction", "output"]);
      assert.ok(payload.interaction?.id);
      assert.ok(payload.output?.result);
      assert.equal(payload.output.model, "local-business-rules");
      assert.equal(payload.output.ai.provider, "local");
      assert.equal(payload.output.ai.cached, false);

      const interaction = db.prepare("SELECT * FROM ai_interactions WHERE id = ?").get(payload.interaction.id);
      assert.ok(interaction);
      assert.equal(interaction.clientId, client.id);

      const ledger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(payload.output.ai.requestId);
      assert.ok(ledger);
      assert.equal(ledger.tenantId, "tenant_aura");
      assert.match(ledger.task_key, /^customer360\./);
    }
  } finally {
    await close(server);
  }
});

test("customer360 AI enforces tenant isolation, role policy and clientId validation", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO tenants
    (id, name, slug, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    "tenant_other",
    "Other Salon",
    "other",
    "active",
    stamp,
    stamp
  );

  try {
    const client = await createClient(baseUrl, {
      name: `Customer AI Policy ${Date.now()}`,
      phone: uniquePhone()
    });

    const staffNext = await postAi(baseUrl, "customer-next-best-action", { clientId: client.id }, { "x-user-role": "staff" });
    assert.equal(staffNext.response.status, 201);
    assert.equal(staffNext.payload.output.ai.taskKey, "customer360.next_best_action");

    const staffUpsell = await postAi(baseUrl, "customer-upsell-recommendation", { clientId: client.id }, { "x-user-role": "staff" });
    assert.equal(staffUpsell.response.status, 403);

    const otherTenant = await postAi(baseUrl, "customer-next-best-action", { clientId: client.id }, { "x-tenant-id": "tenant_other" });
    assert.equal(otherTenant.response.status, 404);

    const missingClientId = await postAi(baseUrl, "customer-health-score", {});
    assert.equal(missingClientId.response.status, 400);

    const unknownClient = await postAi(baseUrl, "customer-health-score", { clientId: "client_missing_for_ai" });
    assert.equal(unknownClient.response.status, 404);
  } finally {
    await close(server);
  }
});

test("customer360 repeated next-best-action can reuse tenant-scoped cache", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const client = await createClient(baseUrl, {
      name: `Customer AI Cache ${Date.now()}`,
      phone: uniquePhone(),
      totalSpend: 9000,
      visitCount: 4
    });
    const body = { clientId: client.id };

    const first = await postAi(baseUrl, "customer-next-best-action", body);
    assert.equal(first.response.status, 201);
    assert.equal(first.payload.output.ai.cached, false);

    const second = await postAi(baseUrl, "customer-next-best-action", body);
    assert.equal(second.response.status, 201);
    assert.equal(second.payload.output.ai.cached, true);
    assert.equal(second.payload.output.ai.provider, "local");

    const cachedLedger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(second.payload.output.ai.requestId);
    assert.ok(cachedLedger);
    assert.equal(cachedLedger.task_key, "customer360.next_best_action");
    assert.equal(cachedLedger.cached, 1);
  } finally {
    await close(server);
  }
});

test("completion AI endpoints return the standard response shape and ledger rows", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const client = await createClient(baseUrl, {
      name: `Completion AI Client ${Date.now()}`,
      phone: uniquePhone()
    });
    const serviceItem = {
      id: "svc_haircut",
      type: "service",
      name: "Signature Haircut",
      quantity: 1,
      price: 1200
    };
    const scenarios = [
      ["calendar-smart-slot-score", "calendar.smart_slot_score", { branchId: "branch_hyd", serviceId: "svc_haircut", startAt: new Date().toISOString() }],
      ["calendar-no-show-risk", "calendar.no_show_risk", { branchId: "branch_hyd", serviceId: "svc_haircut", startAt: new Date().toISOString() }],
      ["calendar-conflict-doctor", "calendar.conflict_doctor", { branchId: "branch_hyd", serviceId: "svc_haircut", startAt: new Date().toISOString() }],
      ["calendar-revenue-gap-filler", "calendar.revenue_gap_filler", { branchId: "branch_hyd", serviceId: "svc_haircut", startAt: new Date().toISOString() }],
      ["calendar-staff-load-signal", "calendar.staff_load_signal", { branchId: "branch_hyd", serviceId: "svc_haircut", startAt: new Date().toISOString() }],
      ["calendar-delay-prediction", "calendar.delay_prediction", { branchId: "branch_hyd", serviceId: "svc_haircut", startAt: new Date().toISOString() }],
      ["calendar-booking-quality-score", "calendar.booking_quality_score", { branchId: "branch_hyd", serviceId: "svc_haircut", startAt: new Date().toISOString() }],
      ["pos-smart-upsell", "pos.smart_upsell", { branchId: "branch_hyd", clientId: client.id, items: [serviceItem] }],
      ["pos-membership-suggestion", "pos.membership_suggestion", { branchId: "branch_hyd", clientId: client.id, items: [serviceItem] }],
      ["pos-discount-guard", "pos.discount_guard", { branchId: "branch_hyd", clientId: client.id, items: [serviceItem], discount: 50 }],
      ["pos-payment-recovery", "pos.payment_recovery", { branchId: "branch_hyd", clientId: client.id, items: [serviceItem] }],
      ["pos-cart-profitability", "pos.cart_profitability", { branchId: "branch_hyd", clientId: client.id, items: [serviceItem] }],
      ["inventory-reorder-prediction", "inventory.reorder_prediction", { branchId: "branch_hyd" }],
      ["inventory-expiry-waste-risk", "inventory.expiry_waste_risk", { branchId: "branch_hyd" }],
      ["inventory-service-stock-readiness", "inventory.service_stock_readiness", { branchId: "branch_hyd" }],
      ["inventory-low-stock-reason", "inventory.low_stock_reason", { branchId: "branch_hyd" }],
      ["inventory-purchase-plan", "inventory.purchase_plan", { branchId: "branch_hyd" }],
      ["whatsapp-intent-detection", "whatsapp.intent_detection", { branchId: "branch_hyd", clientId: client.id, message: "Can I book hair color tomorrow?" }],
      ["whatsapp-reply-generation", "whatsapp.reply_generation", { branchId: "branch_hyd", clientId: client.id, message: "Can I book hair color tomorrow?" }],
      ["whatsapp-followup-draft", "whatsapp.followup_draft", { branchId: "branch_hyd", clientId: client.id, message: "Thanks for the service" }],
      ["whatsapp-rebooking-draft", "whatsapp.rebooking_draft", { branchId: "branch_hyd", clientId: client.id, message: "Need next appointment" }],
      ["whatsapp-payment-reminder-draft", "whatsapp.payment_reminder_draft", { branchId: "branch_hyd", clientId: client.id, message: "Payment details please" }],
      ["dashboard-executive-summary", "dashboard.executive_summary", { branchId: "branch_hyd" }],
      ["dashboard-risk-briefing", "dashboard.risk_briefing", { branchId: "branch_hyd" }],
      ["dashboard-revenue-actions", "dashboard.revenue_actions", { branchId: "branch_hyd" }],
      ["dashboard-owner-daily-brief", "dashboard.owner_daily_brief", { branchId: "branch_hyd" }]
    ];

    for (const [type, taskKey, body] of scenarios) {
      const { response, payload } = await postAi(baseUrl, type, body);
      assert.equal(response.status, 201, type);
      assert.deepEqual(Object.keys(payload).sort(), ["interaction", "output"], type);
      assert.ok(payload.interaction?.id, type);
      assert.ok(payload.output?.result || payload.output?.messageDraft || payload.output?.title, type);
      assert.equal(payload.output.ai.taskKey, taskKey, type);
      assert.equal(payload.output.ai.provider, "local", type);

      const interaction = db.prepare("SELECT * FROM ai_interactions WHERE id = ?").get(payload.interaction.id);
      assert.ok(interaction, type);

      const ledger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(payload.output.ai.requestId);
      assert.ok(ledger, type);
      assert.equal(ledger.tenantId, "tenant_aura", type);
      assert.equal(ledger.task_key, taskKey, type);
    }
  } finally {
    await close(server);
  }
});

test("completion AI enforces role policy, validation, unknown records and tenant isolation", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO tenants
    (id, name, slug, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    "tenant_other",
    "Other Salon",
    "other",
    "active",
    stamp,
    stamp
  );

  try {
    const client = await createClient(baseUrl, {
      name: `Completion AI Policy ${Date.now()}`,
      phone: uniquePhone()
    });
    const serviceItem = {
      id: "svc_haircut",
      type: "service",
      name: "Signature Haircut",
      quantity: 1,
      price: 1200
    };

    const frontDeskCalendar = await postAi(baseUrl, "calendar-smart-slot-score", {
      branchId: "branch_hyd",
      serviceId: "svc_haircut",
      startAt: new Date().toISOString()
    }, { "x-user-role": "frontDesk" });
    assert.equal(frontDeskCalendar.response.status, 201);

    const inventoryManager = await postAi(baseUrl, "inventory-reorder-prediction", {
      branchId: "branch_hyd"
    }, { "x-user-role": "inventoryManager" });
    assert.equal(inventoryManager.response.status, 201);

    const accountantPayment = await postAi(baseUrl, "pos-payment-recovery", {
      branchId: "branch_hyd",
      clientId: client.id,
      items: [serviceItem]
    }, { "x-user-role": "accountant" });
    assert.equal(accountantPayment.response.status, 201);

    const staffOwnerBrief = await postAi(baseUrl, "dashboard-owner-daily-brief", {
      branchId: "branch_hyd"
    }, { "x-user-role": "staff" });
    assert.equal(staffOwnerBrief.response.status, 403);

    const missingWhatsappInput = await postAi(baseUrl, "whatsapp-intent-detection", {});
    assert.equal(missingWhatsappInput.response.status, 400);

    const emptyCart = await postAi(baseUrl, "pos-cart-profitability", {
      branchId: "branch_hyd",
      clientId: client.id,
      items: []
    });
    assert.equal(emptyCart.response.status, 400);

    const unknownAppointment = await postAi(baseUrl, "calendar-no-show-risk", {
      branchId: "branch_hyd",
      appointmentId: "appt_missing_for_ai"
    });
    assert.equal(unknownAppointment.response.status, 404);

    const otherTenantClient = await postAi(baseUrl, "pos-smart-upsell", {
      branchId: "branch_hyd",
      clientId: client.id,
      items: [serviceItem]
    }, { "x-tenant-id": "tenant_other" });
    assert.equal(otherTenantClient.response.status, 404);
  } finally {
    await close(server);
  }
});

test("completion AI cache can be reused for WhatsApp rebooking draft", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const body = { branchId: "branch_hyd", message: `Cache rebooking ${Date.now()}-${Math.random()}` };

  try {
    const first = await postAi(baseUrl, "whatsapp-rebooking-draft", body);
    assert.equal(first.response.status, 201);
    assert.equal(first.payload.output.ai.cached, false);

    const second = await postAi(baseUrl, "whatsapp-rebooking-draft", body);
    assert.equal(second.response.status, 201);
    assert.equal(second.payload.output.ai.cached, true);

    const cachedLedger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(second.payload.output.ai.requestId);
    assert.ok(cachedLedger);
    assert.equal(cachedLedger.task_key, "whatsapp.rebooking_draft");
    assert.equal(cachedLedger.cached, 1);
  } finally {
    await close(server);
  }
});

test("AI task policy allows content staff but blocks staff analytics while analyst can summarize", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const staffReview = await postAi(baseUrl, "review-reply", {
      rating: 5,
      reviewText: `Staff reply allowed ${Date.now()}-${Math.random()}`
    }, { "x-user-role": "staff" });
    assert.equal(staffReview.response.status, 201);
    assert.equal(staffReview.payload.output.ai.taskKey, "review.reply");

    const staffAnalytics = await postAi(baseUrl, "analytics-summary", {}, { "x-user-role": "staff" });
    assert.equal(staffAnalytics.response.status, 403);

    const analystAnalytics = await postAi(baseUrl, "analytics-summary", {}, { "x-user-role": "analyst" });
    assert.equal(analystAnalytics.response.status, 201);
    assert.equal(analystAnalytics.payload.output.ai.taskKey, "analytics.summary");
  } finally {
    await close(server);
  }
});

test("provider prompt is PII-redacted before external OpenAI call", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const originalProvider = env.aiProvider;
  const originalApiKey = env.openaiApiKey;
  const originalFetch = globalThis.fetch;
  const originalRetries = process.env.AI_MAX_RETRIES;
  let capturedBody = "";

  try {
    env.aiProvider = "openai";
    env.openaiApiKey = "test-key";
    process.env.AI_MAX_RETRIES = "0";
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("api.openai.com")) {
        capturedBody = String(options?.body || "");
        return {
          ok: true,
          status: 200,
          json: async () => ({
            output_text: JSON.stringify({
              captions: ["A privacy-safe salon campaign is ready."],
              segmentIdeas: ["VIP clients"],
              actions: ["copy-caption"]
            }),
            usage: { input_tokens: 10, output_tokens: 8 }
          })
        };
      }
      return originalFetch(url, options);
    };

    const { response, payload } = await postAi(baseUrl, "marketing-caption", {
      offer: "Call +91 98765 43210 or riya@example.com with api_key=sk-test-secret-1234567890 and record 1778982909310",
      channel: "WhatsApp"
    });

    assert.equal(response.status, 201);
    assert.equal(payload.output.ai.provider, "openai");
    assert.equal(payload.output.providerWarning, "PII redacted before provider call");
    assert.ok(capturedBody);
    assert.doesNotMatch(capturedBody, /98765|43210|riya@example\.com|sk-test-secret|1778982909310/);
    assert.match(capturedBody, /\[redacted-phone\]|\[redacted-email\]|\[redacted-token\]|\[redacted-id\]/);
  } finally {
    env.aiProvider = originalProvider;
    env.openaiApiKey = originalApiKey;
    globalThis.fetch = originalFetch;
    if (originalRetries === undefined) {
      delete process.env.AI_MAX_RETRIES;
    } else {
      process.env.AI_MAX_RETRIES = originalRetries;
    }
    await close(server);
  }
});

test("prompt length safety guard falls back locally without calling external provider", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const originalProvider = env.aiProvider;
  const originalApiKey = env.openaiApiKey;
  const originalFetch = globalThis.fetch;
  const originalMaxPromptChars = process.env.AI_MAX_PROMPT_CHARS;
  let openAiCalls = 0;

  try {
    env.aiProvider = "openai";
    env.openaiApiKey = "test-key";
    process.env.AI_MAX_PROMPT_CHARS = "200";
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("api.openai.com")) {
        openAiCalls += 1;
        return {
          ok: false,
          status: 500,
          json: async () => ({ error: { message: "unexpected provider call" } })
        };
      }
      return originalFetch(url, options);
    };

    const { response, payload } = await postAi(baseUrl, "marketing-caption", {
      offer: `Long safe prompt ${"x".repeat(800)}`
    });

    assert.equal(response.status, 201);
    assert.equal(openAiCalls, 0);
    assert.equal(payload.output.ai.provider, "local");
    assert.equal(payload.output.model, "local-business-rules");
    assert.equal(payload.output.providerWarning, "AI prompt exceeded safe length");

    const ledger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(payload.output.ai.requestId);
    assert.ok(ledger);
    assert.equal(ledger.provider, "local");
    assert.equal(ledger.cached, 0);
  } finally {
    env.aiProvider = originalProvider;
    env.openaiApiKey = originalApiKey;
    globalThis.fetch = originalFetch;
    if (originalMaxPromptChars === undefined) {
      delete process.env.AI_MAX_PROMPT_CHARS;
    } else {
      process.env.AI_MAX_PROMPT_CHARS = originalMaxPromptChars;
    }
    await close(server);
  }
});

test("AI observability returns tenant-scoped metrics and is admin-only", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;

  try {
    const seed = await postAi(baseUrl, "marketing-caption", {
      offer: `Observability smoke ${Date.now()}-${Math.random()}`
    });
    assert.equal(seed.response.status, 201);

    const ownerResponse = await fetch(`${baseUrl}/ai/observability`, {
      headers: ownerHeaders()
    });
    assert.equal(ownerResponse.status, 200);
    const body = await ownerResponse.json();
    assert.ok(body.callsToday >= 1);
    assert.ok(body.byTask.some((item) => item.taskKey === "marketing.caption"));
    assert.ok("cacheHitRate" in body);
    assert.ok("fallbackCallsToday" in body);

    const staffResponse = await fetch(`${baseUrl}/ai/observability`, {
      headers: ownerHeaders({ "x-user-role": "staff" })
    });
    assert.equal(staffResponse.status, 403);
  } finally {
    await close(server);
  }
});

test("review-reply can reuse cache for repeated matching reviews", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = `phase1-cache-${Date.now()}-${Math.random()}`;
  const body = {
    rating: 5,
    reviewText: `Beautiful service and very clean salon ${stamp}`
  };

  try {
    const first = await postReviewReply(baseUrl, body);
    assert.equal(first.response.status, 201);
    assert.equal(first.payload.output.ai.cached, false);

    const second = await postReviewReply(baseUrl, body);
    assert.equal(second.response.status, 201);
    assert.equal(second.payload.output.ai.cached, true);
    assert.equal(second.payload.output.ai.provider, "local");

    const cacheRow = db.prepare(`
      SELECT * FROM ai_response_cache
      WHERE tenantId = ? AND task_key = ? AND output LIKE ?
      ORDER BY created_at DESC
    `).get("tenant_aura", "review.reply", `%${stamp}%`);
    assert.ok(cacheRow);
    assert.ok(Number(cacheRow.hit_count) >= 1);

    const cachedLedger = db.prepare("SELECT * FROM ai_cost_ledger WHERE request_id = ?").get(second.payload.output.ai.requestId);
    assert.ok(cachedLedger);
    assert.equal(cachedLedger.cached, 1);
  } finally {
    await close(server);
  }
});

test("AI cache clear is tenant-scoped and can target one task", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO tenants
    (id, name, slug, status, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?)`).run(
    "tenant_other",
    "Other Salon",
    "other",
    "active",
    stamp,
    stamp
  );

  try {
    const auraReview = seedCacheRow({ tenantId: "tenant_aura", taskKey: "review.reply" });
    const auraMarketing = seedCacheRow({ tenantId: "tenant_aura", taskKey: "marketing.caption" });
    const otherReview = seedCacheRow({ tenantId: "tenant_other", taskKey: "review.reply" });

    const taskClear = await fetch(`${baseUrl}/ai/cache/clear`, {
      method: "POST",
      headers: ownerHeaders(),
      body: JSON.stringify({ taskKey: "review.reply" })
    });
    assert.equal(taskClear.status, 200);
    assert.equal((await taskClear.json()).cleared >= 1, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM ai_response_cache WHERE cache_key = ?").get(auraReview).count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM ai_response_cache WHERE cache_key = ?").get(auraMarketing).count, 1);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM ai_response_cache WHERE cache_key = ?").get(otherReview).count, 1);

    const auraAnalytics = seedCacheRow({ tenantId: "tenant_aura", taskKey: "analytics.summary" });
    const fullClear = await fetch(`${baseUrl}/ai/cache/clear`, {
      method: "POST",
      headers: ownerHeaders(),
      body: JSON.stringify({})
    });
    assert.equal(fullClear.status, 200);
    assert.equal((await fullClear.json()).cleared >= 2, true);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM ai_response_cache WHERE cache_key IN (?, ?)").get(auraMarketing, auraAnalytics).count, 0);
    assert.equal(db.prepare("SELECT COUNT(*) AS count FROM ai_response_cache WHERE cache_key = ?").get(otherReview).count, 1);
  } finally {
    await close(server);
  }
});

test("review-reply does not crash without an API key and provider failures fall back locally", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const originalProvider = env.aiProvider;
  const originalApiKey = env.openaiApiKey;
  const originalFetch = globalThis.fetch;
  const originalRetries = process.env.AI_MAX_RETRIES;

  try {
    env.aiProvider = "openai";
    env.openaiApiKey = "";
    const noKey = await postReviewReply(baseUrl, {
      rating: 4,
      reviewText: `No key smoke ${Date.now()}-${Math.random()}`
    });
    assert.equal(noKey.response.status, 201);
    assert.equal(noKey.payload.output.ai.provider, "local");
    assert.equal(noKey.payload.output.model, "local-business-rules");

    env.openaiApiKey = "test-key";
    process.env.AI_MAX_RETRIES = "0";
    globalThis.fetch = async (url, options) => {
      if (String(url).includes("api.openai.com")) {
        return {
          ok: false,
          status: 503,
          json: async () => ({ error: { message: "provider unavailable" } })
        };
      }
      return originalFetch(url, options);
    };

    const failedProvider = await postReviewReply(baseUrl, {
      rating: 1,
      reviewText: `Provider failure fallback ${Date.now()}-${Math.random()}`
    });
    assert.equal(failedProvider.response.status, 201);
    assert.equal(failedProvider.payload.output.ai.provider, "local");
    assert.equal(failedProvider.payload.output.model, "local-business-rules");
    assert.match(failedProvider.payload.output.providerWarning, /AI provider returned 503/);
  } finally {
    env.aiProvider = originalProvider;
    env.openaiApiKey = originalApiKey;
    globalThis.fetch = originalFetch;
    if (originalRetries === undefined) {
      delete process.env.AI_MAX_RETRIES;
    } else {
      process.env.AI_MAX_RETRIES = originalRetries;
    }
    await close(server);
  }
});
