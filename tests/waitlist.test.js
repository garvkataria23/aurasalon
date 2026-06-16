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

function headers({ tenantId = "tenant_aura", token = "" } = {}) {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": "owner",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, tenantId = "tenant_aura", token = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers({ tenantId, token }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function data(payload) {
  return payload?.data ?? payload;
}

test("waitlist endpoint creates and lists entries scoped by tenant", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const login = await api(baseUrl, "/auth/login", {
      method: "POST",
      body: {
        tenantId: "tenant_aura",
        email: "owner@aurasalon.example",
        password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026"
      }
    });
    assert.equal(login.response.status, 201);
    const token = data(login.payload).accessToken;
    assert.ok(token);

    const stamp = Date.now();
    const start = new Date(Date.now() + 2 * 86_400_000).toISOString();
    const end = new Date(Date.now() + 2 * 86_400_000 + 60 * 60_000).toISOString();
    const created = await api(baseUrl, "/waitlist", {
      method: "POST",
      token,
      body: {
        clientId: `wait_client_${stamp}`,
        serviceId: `wait_service_${stamp}`,
        preferredDate: start.slice(0, 10),
        windowStart: start,
        windowEnd: end,
        priority: 3
      }
    });
    assert.equal(created.response.status, 201);
    const createdRow = data(created.payload);
    assert.equal(createdRow.clientId, `wait_client_${stamp}`);
    assert.equal(createdRow.status, "waiting");

    const listed = await api(baseUrl, "/waitlist?status=waiting&limit=100", { token });
    assert.equal(listed.response.status, 200);
    const rows = data(listed.payload);
    assert.ok(rows.some((row) => row.id === createdRow.id));
    assert.ok(rows.every((row) => row.tenantId === "tenant_aura"));

  } finally {
    await close(server);
  }
});
