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

const ownerHeaders = {
  "content-type": "application/json",
  "x-tenant-id": "tenant_aura",
  "x-user-role": "owner"
};

test("client report endpoints expose all seven CRM reports on legacy and v1 APIs", async () => {
  const server = await listen(createApp());
  const port = server.address().port;
  const legacyBase = `http://127.0.0.1:${port}/api`;
  const v1Base = `http://127.0.0.1:${port}/api/v1`;
  try {
    const topRfm = await fetch(`${legacyBase}/reports/clients/top-rfm?limit=3`, { headers: ownerHeaders });
    assert.equal(topRfm.status, 200);
    const topRows = await topRfm.json();
    assert.ok(Array.isArray(topRows));
    assert.ok(topRows.length > 0);
    assert.ok(topRows[0].rfmScore >= 1);

    const revenue = await fetch(`${legacyBase}/reports/clients/revenue?limit=5`, { headers: ownerHeaders });
    assert.equal(revenue.status, 200);
    const revenueBody = await revenue.json();
    assert.ok(revenueBody.summary);
    assert.ok(Array.isArray(revenueBody.rows));
    assert.ok(Number(revenueBody.summary.totalClients || 0) >= revenueBody.rows.length);
    if (revenueBody.rows.length) {
      assert.ok(revenueBody.rows[0].clientName);
      assert.ok("totalVisits" in revenueBody.rows[0]);
      assert.ok("totalRevenue" in revenueBody.rows[0]);
      assert.ok("averageBill" in revenueBody.rows[0]);
      assert.ok("pendingDue" in revenueBody.rows[0]);
      assert.ok("membershipStatus" in revenueBody.rows[0]);
    }

    const reportChecks = await Promise.all([
      fetch(`${legacyBase}/reports/clients/lapsed?minDays=1&maxDays=3650&limit=3`, { headers: ownerHeaders }).then(async (response) => [response.status, await response.json()]),
      fetch(`${legacyBase}/reports/clients/new-vs-returning?months=3`, { headers: ownerHeaders }).then(async (response) => [response.status, await response.json()]),
      fetch(`${legacyBase}/reports/clients/occasions?withinDays=366&limit=3`, { headers: ownerHeaders }).then(async (response) => [response.status, await response.json()]),
      fetch(`${legacyBase}/reports/clients/by-service?limit=3`, { headers: ownerHeaders }).then(async (response) => [response.status, await response.json()])
    ]);
    for (const [status, body] of reportChecks) {
      assert.equal(status, 200);
      assert.ok(Array.isArray(body));
    }

    const client360 = await fetch(`${legacyBase}/reports/clients/${topRows[0].id}/360`, { headers: ownerHeaders });
    assert.equal(client360.status, 200);
    const profile = await client360.json();
    assert.equal(profile.client.id, topRows[0].id);
    assert.ok(profile.metrics.totalSpend >= 0);
    assert.ok(Array.isArray(profile.metricCards));
    assert.ok(profile.metricCards.length >= 31);
    const cardLabels = new Set(profile.metricCards.map((card) => card.label));
    for (const label of [
      "Last visit",
      "Favorite service",
      "Average spend",
      "Preferred staff",
      "Outstanding balance",
      "Loyalty points",
      "Lifetime Value (LTV)",
      "This Month Spend",
      "Highest Single Bill",
      "Discount Availed %",
      "Product vs Service Split",
      "Visit Frequency",
      "No-show Count",
      "Cancellation Rate %",
      "Walk-in vs Booked",
      "Peak Day/Time",
      "Top 3 Services",
      "Services Never Tried",
      "Product purchase history",
      "Avg services per visit",
      "Service category preference",
      "Referral count",
      "Review/rating given",
      "Communication preference",
      "Marketing consent status",
      "Last contacted date",
      "Churn risk score",
      "RFM segment",
      "Inactive days trend",
      "Rebooking rate",
      "Spending trend"
    ]) {
      assert.ok(cardLabels.has(label), label);
    }
    assert.ok(profile.metricCards.every((card) => Array.isArray(card.relatedCardIds) && card.relatedCardIds.length > 0));
    assert.ok(Array.isArray(profile.metricConnections));
    assert.ok(profile.metricConnections.length >= profile.metricCards.length);
    assert.ok(Array.isArray(profile.metricGroups));

    const login = await fetch(`${v1Base}/auth/login`, {
      method: "POST",
      headers: ownerHeaders,
      body: JSON.stringify({
        tenantId: "tenant_aura",
        email: "owner@aurasalon.example",
        password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026"
      })
    });
    assert.equal(login.status, 201);
    const loginBody = await login.json();
    const token = loginBody.data.accessToken;
    assert.ok(token);

    const v1TopRfm = await fetch(`${v1Base}/reports/clients/top-rfm?limit=2`, {
      headers: {
        ...ownerHeaders,
        authorization: `Bearer ${token}`
      }
    });
    assert.equal(v1TopRfm.status, 200);
    const v1TopRowsBody = await v1TopRfm.json();
    const v1TopRows = Array.isArray(v1TopRowsBody) ? v1TopRowsBody : v1TopRowsBody.data || [];
    assert.ok(v1TopRows.length > 0);
  } finally {
    await close(server);
  }
});
