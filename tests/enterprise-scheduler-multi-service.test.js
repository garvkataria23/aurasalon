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

function unwrap(payload) {
  return payload?.data ?? payload;
}

async function api(baseUrl, path, { method = "GET", body, token = "", branchId = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_aura",
      "x-user-role": "owner",
      ...(branchId ? { "x-branch-id": branchId } : {}),
      ...(token ? { authorization: `Bearer ${token}` } : {})
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

test("enterprise scheduler creates back-to-back multi-service bookings for same staff", async () => {
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
    const token = unwrap(login.payload).accessToken;
    assert.ok(token);

    const contextResult = await api(baseUrl, "/enterprise-scheduler/context?staffLimit=20&clientLimit=20&serviceLimit=20", { token });
    assert.equal(contextResult.response.status, 200);
    const context = unwrap(contextResult.payload);
    const staff = context.staff.find((row) => row.branchId) || context.staff[0];
    const client = context.clients[0];
    const service = context.services.find((row) => Number(row.durationMinutes || 0) >= 30) || context.services[0];
    assert.ok(staff?.id);
    assert.ok(client?.id);
    assert.ok(service?.id);

    const branchId = staff.branchId || context.branchId;
    const firstStart = new Date("2035-01-02T09:00:00+05:30").toISOString();
    const secondStart = new Date("2035-01-02T10:30:00+05:30").toISOString();
    const created = await api(baseUrl, "/enterprise-scheduler/multi-service-bookings", {
      method: "POST",
      token,
      branchId,
      body: {
        branchId,
        clientId: client.id,
        status: "booked",
        lines: [
          { serviceId: service.id, staffId: staff.id, startAt: firstStart, durationMinutes: 90, chair: "Chair 1" },
          { serviceId: service.id, staffId: staff.id, startAt: secondStart, durationMinutes: 90, chair: "Chair 2" }
        ]
      }
    });
    assert.equal(created.response.status, 201, JSON.stringify(created.payload));
    assert.equal(unwrap(created.payload).appointments.length, 2);
  } finally {
    await close(server);
  }
});
