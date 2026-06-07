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

function headers() {
  return {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner"
  };
}

async function api(baseUrl, path, { method = "GET", body } = {}) {
  const requestHeaders = headers();
  if (method === "POST" && path === "/appointments") {
    requestHeaders["Idempotency-Key"] = `test-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

async function firstResource(baseUrl, resource, predicate = () => true) {
  const { response, payload } = await api(baseUrl, `/${resource}?limit=1000`);
  assert.equal(response.status, 200);
  const row = payload.find(predicate);
  assert.ok(row?.id, `${resource} seed data is required`);
  return row;
}

test("appointment validation blocks overlaps and lifecycle endpoints create billable flow", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const branch = await firstResource(baseUrl, "branches");
    const service = await firstResource(baseUrl, "services", (item) => (item.status || "active") === "active");
    const stamp = Date.now();
    const staffCreated = await api(baseUrl, "/staff", {
      method: "POST",
      body: {
        name: `Lifecycle Staff ${stamp}`,
        role: "Stylist",
        branchId: branch.id,
        phone: `+91 97${String(stamp).slice(-8)}`,
        status: "active"
      }
    });
    assert.equal(staffCreated.response.status, 201);
    const staff = staffCreated.payload;
    const client = await api(baseUrl, "/clients", {
      method: "POST",
      body: {
        name: `Lifecycle Client ${stamp}`,
        phone: `+91 98${String(stamp).slice(-8)}`,
        branchId: branch.id
      }
    });
    assert.equal(client.response.status, 201);

    const missingIdempotency = await fetch(`${baseUrl}/appointments`, {
      method: "POST",
      headers: headers(),
      body: JSON.stringify({})
    });
    assert.equal(missingIdempotency.status, 400);

    const start = new Date(Date.now() + 45 * 86_400_000 + (stamp % 1000) * 60_000);
    const startAt = start.toISOString();
    const created = await api(baseUrl, "/appointments", {
      method: "POST",
      body: {
        clientId: client.payload.id,
        staffId: staff.id,
        branchId: branch.id,
        serviceIds: [service.id],
        startAt,
        chair: `Test chair ${stamp}`,
        status: "booked"
      }
    });
    assert.equal(created.response.status, 201);

    const missingVersion = await fetch(`${baseUrl}/appointments/${created.payload.id}`, {
      method: "PATCH",
      headers: headers(),
      body: JSON.stringify({ notes: "No lock" })
    });
    assert.equal(missingVersion.status, 428);

    const patched = await fetch(`${baseUrl}/appointments/${created.payload.id}`, {
      method: "PATCH",
      headers: { ...headers(), "If-Match": `W/"${created.payload.version || 1}"` },
      body: JSON.stringify({ notes: "Locked update" })
    });
    assert.equal(patched.status, 200);
    assert.equal(patched.headers.get("etag"), `W/"${Number(created.payload.version || 1) + 1}"`);

    const overlap = await api(baseUrl, "/appointments", {
      method: "POST",
      body: {
        clientId: client.payload.id,
        staffId: staff.id,
        branchId: branch.id,
        serviceIds: [service.id],
        startAt,
        chair: `Other chair ${stamp}`,
        status: "booked"
      }
    });
    assert.equal(overlap.response.status, 409);

    const checkedIn = await api(baseUrl, `/appointments/${created.payload.id}/check-in`, { method: "POST" });
    assert.equal(checkedIn.response.status, 200);
    assert.equal(checkedIn.payload.appointment.status, "arrived");

    const started = await api(baseUrl, `/appointments/${created.payload.id}/start-service`, { method: "POST" });
    assert.equal(started.response.status, 200);
    assert.equal(started.payload.appointment.status, "in-service");

    const completed = await api(baseUrl, `/appointments/${created.payload.id}/complete`, { method: "POST" });
    assert.equal(completed.response.status, 200);
    assert.equal(completed.payload.appointment.status, "completed");

    const converted = await api(baseUrl, `/appointments/${created.payload.id}/convert-to-sale`, { method: "POST" });
    assert.equal(converted.response.status, 201);
    assert.equal(converted.payload.sale.appointmentId, created.payload.id);
    assert.ok(["billed", "paid"].includes(converted.payload.appointment.status));

    const duplicateStart = new Date(start.getTime() + 7 * 86_400_000).toISOString();
    const duplicate = await api(baseUrl, `/appointments/${created.payload.id}/duplicate`, {
      method: "POST",
      body: { startAt: duplicateStart, chair: `Duplicate chair ${stamp}` }
    });
    assert.equal(duplicate.response.status, 201);
    assert.equal(duplicate.payload.sourceAppointmentId, created.payload.id);

    const noShow = await api(baseUrl, `/appointments/${duplicate.payload.appointment.id}/no-show`, {
      method: "POST",
      body: { reason: "Lifecycle test" }
    });
    assert.equal(noShow.response.status, 200);
    assert.equal(noShow.payload.appointment.status, "no-show");
  } finally {
    await close(server);
  }
});
