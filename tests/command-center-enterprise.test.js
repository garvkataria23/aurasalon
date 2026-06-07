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

test("AI Workforce and command center modules are approval-safe and tenant scoped", async () => {
  ensureTenant("tenant_command_other", "command-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_cmd_${Date.now()}`;
  const clientId = `client_cmd_${Date.now()}`;
  try {
    const agents = await api(baseUrl, "/ai-workforce/agents", { branchId });
    assert.equal(agents.response.status, 200);
    assert.ok(agents.payload.length >= 10);
    const ownerAgent = agents.payload.find((agent) => agent.agentKey === "ai-owner-copilot") || agents.payload[0];

    const run = await api(baseUrl, `/ai-workforce/agents/${ownerAgent.id}/run`, {
      method: "POST",
      branchId,
      body: { branchId, taskType: "payroll_audit", prompt: "prepare payroll audit and salary risk review" }
    });
    assert.equal(run.response.status, 201);
    assert.equal(run.payload.decision.approvalRequired, 1);
    assert.ok(run.payload.decision.reasonsJson.length);

    const leaks = await api(baseUrl, "/revenue-leaks/scan", { method: "POST", branchId, body: { branchId } });
    assert.equal(leaks.response.status, 201);
    assert.ok(leaks.payload.findings.length >= 3);
    const otherTenantLeaks = await api(baseUrl, `/revenue-leaks?branchId=${branchId}`, { tenantId: "tenant_command_other" });
    assert.equal(otherTenantLeaks.response.status, 200);
    assert.equal(otherTenantLeaks.payload.length, 0);

    const twin = await api(baseUrl, "/digital-twin/simulate", {
      method: "POST",
      branchId,
      body: { branchId, scenario: "what if stylist absent", historicalDataSparse: true, staffCount: 2, forecastedDemand: 30 }
    });
    assert.equal(twin.response.status, 201);
    assert.equal(twin.payload.output.confidence, 0.64);
    assert.ok(twin.payload.output.risks.length);

    const command = await api(baseUrl, "/command-center/commands", {
      method: "POST",
      branchId,
      body: { branchId, commandText: "recover unpaid invoices this week" }
    });
    assert.equal(command.response.status, 201);
    assert.ok(command.payload.actions.some((action) => action.requiresApproval === 1));

    const unsafeCampaign = await api(baseUrl, "/whatsapp-campaign-planner/plans", {
      method: "POST",
      branchId,
      body: { branchId, campaignType: "empty_slot_fill", hasOptOut: true }
    });
    assert.equal(unsafeCampaign.response.status, 403);
    const campaign = await api(baseUrl, "/whatsapp-campaign-planner/plans", {
      method: "POST",
      branchId,
      body: { branchId, campaignType: "empty_slot_fill", title: "Fill empty slots", quietHours: { start: "21:00", end: "09:00" } }
    });
    assert.equal(campaign.response.status, 201);
    assert.equal(campaign.payload.message.optOutChecked, 1);
    const approvedCampaign = await api(baseUrl, `/whatsapp-campaign-planner/plans/${campaign.payload.plan.id}/approve`, { method: "POST", branchId, body: {} });
    assert.equal(approvedCampaign.response.status, 200);

    const memory = await api(baseUrl, `/client-memory/${clientId}/rebuild`, {
      method: "POST",
      branchId,
      body: { branchId, favoriteService: "Hair color", lastVisitDays: 55 }
    });
    assert.equal(memory.response.status, 201);
    const isolatedMemory = await api(baseUrl, `/client-memory/${clientId}`, { tenantId: "tenant_command_other" });
    assert.equal(isolatedMemory.response.status, 200);
    assert.equal(isolatedMemory.payload.nodes.length, 0);

    const staff = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      branchId,
      body: { branchId, firstName: "Coach", lastName: "Target", employeeCode: `CMD-${Date.now()}` }
    });
    assert.equal(staff.response.status, 201);
    const coach = await api(baseUrl, "/staff-os/coach/goals", {
      method: "POST",
      branchId,
      body: { branchId, staffId: staff.payload.id, goalType: "rebooking", targetValue: 70 }
    });
    assert.equal(coach.response.status, 201);
    const staffDenied = await api(baseUrl, "/staff-os/coach/insights", { role: "staff", branchId });
    assert.equal(staffDenied.response.status, 403);

    const inventory = await api(baseUrl, "/inventory-autopilot/scan", { method: "POST", branchId, body: { branchId, riskType: "stockout_risk" } });
    assert.equal(inventory.response.status, 201);
    assert.equal(inventory.payload.risk.riskType, "stockout_risk");

    const payment = await api(baseUrl, "/payment-intelligence/scan", { method: "POST", branchId, body: { branchId, riskType: "discount_abuse", amount: 1500 } });
    assert.equal(payment.response.status, 201);
    assert.equal(payment.payload.risk.riskType, "discount_abuse");

    const health = await api(baseUrl, "/observability/snapshot", { method: "POST", branchId, body: { branchId } });
    assert.equal(health.response.status, 201);
    assert.ok("databaseSizeBytes" in health.payload.metrics);

    const security = await api(baseUrl, "/security-hardening/scan", { method: "POST", branchId, body: { branchId, signalType: "sensitive_data_access" } });
    assert.equal(security.response.status, 201);
    assert.equal(security.payload.session.signalType, "sensitive_data_access");

    const warehouse = await api(baseUrl, "/warehouse/refresh", { method: "POST", branchId, body: { branchId } });
    assert.equal(warehouse.response.status, 201);
    const kpis = await api(baseUrl, `/warehouse/kpis?branchId=${branchId}`, { branchId });
    assert.equal(kpis.response.status, 200);
    assert.ok(kpis.payload.length >= 3);

    const routes = readFileSync("src/app/features/command-center/command-center.routes.ts", "utf8");
    assert.match(routes, /ai-workforce-dashboard/);
    assert.match(routes, /data-warehouse/);
  } finally {
    await close(server);
  }
});
