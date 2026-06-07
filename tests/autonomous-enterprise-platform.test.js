import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
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

function headers(role = "owner", tenantId = "tenant_aura", branchId = "") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role,
    ...(branchId ? { "x-branch-id": branchId } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, role = "owner", tenantId = "tenant_aura", branchId = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(role, tenantId, branchId),
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

test("Autonomous enterprise platform is tenant-safe, approval-first and provider-ready", async () => {
  ensureTenant("tenant_autonomous_other", "autonomous-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_auto_${Date.now()}`;
  const clientId = `client_auto_${Date.now()}`;

  try {
    const brief = await api(baseUrl, "/ai-ceo/daily-brief", { method: "POST", branchId, body: { branchId } });
    assert.equal(brief.response.status, 201);
    assert.equal(brief.payload.actions.length, 10);
    assert.ok(brief.payload.approvals.every((approval) => approval.status === "pending"));

    const approvals = await api(baseUrl, `/approval-hub/requests?branchId=${branchId}`, { branchId });
    assert.equal(approvals.response.status, 200);
    assert.ok(approvals.payload.length >= 10);
    const approved = await api(baseUrl, `/approval-hub/requests/${approvals.payload[0].id}/approve`, {
      method: "POST",
      branchId,
      body: { comment: "Approved with evidence" }
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.payload.status, "approved");
    const evidenceRequired = await api(baseUrl, `/approval-hub/requests/${approvals.payload[1].id}/require-evidence`, {
      method: "POST",
      branchId,
      body: { evidence: { missing: "cash close sheet" } }
    });
    assert.equal(evidenceRequired.response.status, 200);
    assert.equal(evidenceRequired.payload.status, "evidence_required");

    const providers = await api(baseUrl, "/ai-model-router/providers", { branchId });
    assert.equal(providers.response.status, 200);
    assert.ok(providers.payload.some((provider) => provider.providerKey === "openai"));
    const route = await api(baseUrl, "/ai-model-router/route", {
      method: "POST",
      branchId,
      body: { branchId, taskType: "daily_brief", strategy: "cost", estimatedTokens: 900 }
    });
    assert.equal(route.response.status, 201);
    assert.ok(["local", "gemini", "openai", "claude"].includes(route.payload.provider.providerKey));

    const event = await api(baseUrl, "/event-ledger/events", {
      method: "POST",
      branchId,
      body: { branchId, aggregateType: "invoice", aggregateId: "invoice-auto-1", eventType: "invoice.created", eventPayload: { amount: 1200 } }
    });
    assert.equal(event.response.status, 201);
    const replay = await api(baseUrl, "/event-ledger/replay", {
      method: "POST",
      branchId,
      body: { branchId, aggregateType: "invoice", aggregateId: "invoice-auto-1" }
    });
    assert.equal(replay.response.status, 201);
    assert.equal(replay.payload.replayResult.count, 1);

    const warRoom = await api(baseUrl, "/war-room/snapshot", { method: "POST", branchId, body: { branchId, branchIds: [branchId] } });
    assert.equal(warRoom.response.status, 201);
    assert.ok(warRoom.payload.alerts.some((alert) => alert.alertType === "cash_close"));

    const twin = await api(baseUrl, "/digital-twin-v2/forecast", {
      method: "POST",
      branchId,
      body: { branchId, baseRevenue: 150000, campaignImpact: 0.1, historicalDataSparse: true }
    });
    assert.equal(twin.response.status, 201);
    assert.equal(twin.payload.output.confidence, 0.64);
    assert.ok("projectedProfit" in twin.payload.output);

    const graph = await api(baseUrl, `/customer-super-graph/${clientId}/rebuild`, {
      method: "POST",
      branchId,
      body: { branchId, favoriteService: "Hair spa", walletBalance: 500 }
    });
    assert.equal(graph.response.status, 201);
    assert.ok(graph.payload.nodes.length >= 5);
    const isolatedGraph = await api(baseUrl, `/customer-super-graph/${clientId}`, { tenantId: "tenant_autonomous_other" });
    assert.equal(isolatedGraph.response.status, 200);
    assert.equal(isolatedGraph.payload.nodes.length, 0);

    const voice = await api(baseUrl, "/voice-receptionist/calls", {
      method: "POST",
      branchId,
      body: { branchId, phone: "+919888888888", intent: "booking", transcript: [{ role: "client", text: "Need haircut" }] }
    });
    assert.equal(voice.response.status, 201);
    const handoff = await api(baseUrl, `/voice-receptionist/calls/${voice.payload.call.id}/handoff`, {
      method: "POST",
      branchId,
      body: { reason: "Manager requested transcript review" }
    });
    assert.equal(handoff.response.status, 201);

    const unsafeVision = await api(baseUrl, "/computer-vision/events", {
      method: "POST",
      branchId,
      body: { branchId, eventType: "queue_detection", rawImage: "base64-should-not-store" }
    });
    assert.equal(unsafeVision.response.status, 400);
    const vision = await api(baseUrl, "/computer-vision/events", {
      method: "POST",
      branchId,
      body: { branchId, eventType: "cleanliness_compliance", cleanlinessScore: 91 }
    });
    assert.equal(vision.response.status, 201);
    assert.equal(vision.payload.privacyMode, "metadata_only");

    const commerce = await api(baseUrl, "/whatsapp-commerce/sessions", {
      method: "POST",
      branchId,
      body: { branchId, phone: "+919777777777", totalAmount: 999, items: [{ type: "membership", name: "Gold" }] }
    });
    assert.equal(commerce.response.status, 201);
    const checkout = await api(baseUrl, `/whatsapp-commerce/sessions/${commerce.payload.session.id}/checkout`, {
      method: "POST",
      branchId,
      body: { paymentLink: true }
    });
    assert.equal(checkout.response.status, 201);
    assert.equal(checkout.payload.approvalRequired, true);

    const ownerMobile = await api(baseUrl, `/owner-mobile/brief?branchId=${branchId}`, { branchId });
    assert.equal(ownerMobile.response.status, 200);
    assert.ok(ownerMobile.payload.length >= 1);

    const franchise = await api(baseUrl, "/franchise-os/units", {
      method: "POST",
      branchId,
      body: { branchId, franchiseName: "Aura Franchise Test", ownerName: "Owner", royaltyPercent: 8 }
    });
    assert.equal(franchise.response.status, 201);
    const royalty = await api(baseUrl, "/franchise-os/royalty-runs", {
      method: "POST",
      branchId,
      body: { branchId, franchiseId: franchise.payload.id, grossRevenue: 100000, royaltyPercent: 8 }
    });
    assert.equal(royalty.response.status, 201);
    assert.equal(royalty.payload.royaltyAmount, 8000);

    const finance = await api(baseUrl, "/financial-brain/forecast", {
      method: "POST",
      branchId,
      body: { branchId, revenue: 250000, expenses: 150000, salaryCost: 90000 }
    });
    assert.equal(finance.response.status, 201);
    assert.ok(finance.payload.forecast.confidence >= 0.8);

    const connector = await api(baseUrl, "/marketplace/connectors", {
      method: "POST",
      branchId,
      body: { branchId, providerKey: "razorpay", providerType: "payment", displayName: "Razorpay Draft", capabilities: ["payments"] }
    });
    assert.equal(connector.response.status, 201);
    const plugin = await api(baseUrl, "/marketplace/plugins", {
      method: "POST",
      branchId,
      body: { branchId, pluginKey: "meta-ads", pluginName: "Meta Ads", category: "ads", permissions: ["campaigns:read"] }
    });
    assert.equal(plugin.response.status, 201);
    const install = await api(baseUrl, `/marketplace/plugins/${plugin.payload.id}/install`, { method: "POST", branchId, body: { settings: { sandbox: true } } });
    assert.equal(install.response.status, 201);

    const cloud = await api(baseUrl, "/cloud-hardening/checks", { method: "POST", branchId, body: { branchId } });
    assert.equal(cloud.response.status, 201);
    assert.ok(cloud.payload.findingsJson.length >= 4);
    const backup = await api(baseUrl, "/cloud-hardening/backup-restore-points", { method: "POST", branchId, body: { branchId, storageRef: "vault://backup/test" } });
    assert.equal(backup.response.status, 201);
    const dr = await api(baseUrl, "/cloud-hardening/disaster-recovery/run", { method: "POST", branchId, body: { branchId, backupId: backup.payload.id } });
    assert.equal(dr.response.status, 201);
    assert.equal(dr.payload.status, "completed");

    const routes = readFileSync("src/app/features/command-center/command-center.routes.ts", "utf8");
    assert.match(routes, /ai-ceo-daily-brief/);
    assert.match(routes, /multi-branch-war-room/);
    assert.match(routes, /cloud-hardening/);
  } finally {
    await close(server);
  }
});
