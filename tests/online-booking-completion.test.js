import test from "node:test";
import assert from "node:assert/strict";
import { createApp } from "../server/app.js";
import { publicActionTokenService } from "../server/services/public-action-token.service.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function headers(extra = {}) {
  return {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner",
    ...extra
  };
}

async function request(baseUrl, path, { method = "GET", body, requestHeaders = headers() } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

async function first(baseUrl, resource) {
  const { response, payload } = await request(baseUrl, `/${resource}?limit=1`);
  assert.equal(response.status, 200);
  assert.ok(payload[0]?.id, `${resource} seed data is required`);
  return payload[0];
}

test("public booking action tokens expose masked details, cancel once, and prevent reuse", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const branch = await first(baseUrl, "branches");
    const service = await first(baseUrl, "services");
    const client = await first(baseUrl, "clients");
    const staff = await first(baseUrl, "staff");
    const stamp = Date.now();
    const appointment = await request(baseUrl, "/appointments", {
      method: "POST",
      requestHeaders: headers({ "Idempotency-Key": `public-token-${stamp}` }),
      body: {
        clientId: client.id,
        staffId: staff.id,
        branchId: branch.id,
        serviceIds: [service.id],
        startAt: new Date(Date.now() + 80 * 86_400_000 + (stamp % 1000) * 60_000).toISOString(),
        chair: `Public action chair ${stamp}`,
        status: "booked"
      }
    });
    assert.equal(appointment.response.status, 201);
    const token = publicActionTokenService.generateToken({
      tenantId: "tenant_aura",
      appointmentId: appointment.payload.id,
      actionType: "cancel"
    }).token;

    const details = await request(baseUrl, `/public-booking/${token}/details`, { requestHeaders: {} });
    assert.equal(details.response.status, 200);
    assert.equal(details.payload.bookingRef, appointment.payload.id);
    assert.equal(details.payload.canCancel, true);
    assert.doesNotMatch(details.payload.customer?.phone || "", /\d{8,}/);

    const cancelled = await request(baseUrl, `/public-booking/${token}/cancel`, {
      method: "POST",
      requestHeaders: { "content-type": "application/json" },
      body: { reason: "Customer requested" }
    });
    assert.equal(cancelled.response.status, 200);
    assert.equal(cancelled.payload.cancelled, true);

    const reused = await request(baseUrl, `/public-booking/${token}/cancel`, {
      method: "POST",
      requestHeaders: { "content-type": "application/json" },
      body: { reason: "Double tap" }
    });
    assert.equal(reused.response.status, 410);
  } finally {
    await close(server);
  }
});

test("booking analytics and rule-based intelligence endpoints return explainable live data", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const client = await first(baseUrl, "clients");
    const funnel = await request(baseUrl, "/booking-analytics/funnel");
    assert.equal(funnel.response.status, 200);
    assert.equal(funnel.payload.steps.length, 11);
    assert.ok(Array.isArray(funnel.payload.insights));

    const churn = await request(baseUrl, "/booking-intelligence/churn-risk?limit=5");
    assert.equal(churn.response.status, 200);
    assert.ok(Array.isArray(churn.payload));

    const noShow = await request(baseUrl, `/booking-intelligence/no-show-risk/${client.id}?depositStatus=not_required`);
    assert.equal(noShow.response.status, 200);
    assert.equal(noShow.payload.customerId, client.id);
    assert.ok(Array.isArray(noShow.payload.factors));
    assert.ok(["low", "medium", "high"].includes(noShow.payload.riskLevel));
  } finally {
    await close(server);
  }
});
