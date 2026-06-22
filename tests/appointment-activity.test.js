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

function headers(extra = {}) {
  return {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner",
    ...extra
  };
}

async function api(baseUrl, path, { method = "GET", body, extraHeaders = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(extraHeaders),
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

test("appointment activity center tracks booking, edits, reschedules, cancellation and client reliability", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const branch = await firstResource(baseUrl, "branches");
    const service = await firstResource(baseUrl, "services", (item) => (item.status || "active") === "active");
    const stamp = Date.now();
    const staffCreated = await api(baseUrl, "/staff", {
      method: "POST",
      body: {
        name: `Activity Staff ${stamp}`,
        role: "Stylist",
        branchId: branch.id,
        phone: `+91 96${String(stamp).slice(-8)}`,
        status: "active"
      }
    });
    assert.equal(staffCreated.response.status, 201);

    const clientCreated = await api(baseUrl, "/clients", {
      method: "POST",
      body: {
        name: `Activity Client ${stamp}`,
        phone: `+91 95${String(stamp).slice(-8)}`,
        branchId: branch.id
      }
    });
    assert.equal(clientCreated.response.status, 201);

    const startAt = new Date(Date.now() + 35 * 86_400_000 + (stamp % 1000) * 60_000).toISOString();
    const created = await api(baseUrl, "/appointments", {
      method: "POST",
      extraHeaders: { "Idempotency-Key": `activity-${stamp}` },
      body: {
        clientId: clientCreated.payload.id,
        staffId: staffCreated.payload.id,
        branchId: branch.id,
        serviceIds: [service.id],
        startAt,
        chair: `Activity chair ${stamp}`,
        status: "booked"
      }
    });
    assert.equal(created.response.status, 201);

    const patched = await api(baseUrl, `/appointments/${created.payload.id}`, {
      method: "PATCH",
      extraHeaders: { "If-Match": `W/"${created.payload.version || 1}"` },
      body: { notes: "Client prefers senior stylist" }
    });
    assert.equal(patched.response.status, 200);

    const nextStart = new Date(new Date(startAt).getTime() + 86_400_000).toISOString();
    const rescheduled = await api(baseUrl, `/appointments/${created.payload.id}/reschedule`, {
      method: "POST",
      body: { startAt: nextStart, reason: "Client requested a later slot" }
    });
    assert.equal(rescheduled.response.status, 200);

    const cancelled = await api(baseUrl, `/appointments/${created.payload.id}/cancel`, {
      method: "POST",
      body: { reason: "Client travel emergency" }
    });
    assert.equal(cancelled.response.status, 200);

    const activity = await api(baseUrl, `/appointment-activity?clientId=${clientCreated.payload.id}&limit=100`);
    assert.equal(activity.response.status, 200);
    const actions = activity.payload.rows.map((row) => row.action);
    assert.ok(actions.includes("BOOKED"));
    assert.ok(actions.includes("MODIFIED"));
    assert.ok(actions.includes("RESCHEDULED"));
    assert.ok(actions.includes("CANCELLED"));
    assert.ok(activity.payload.rows.every((row) => row.clientId === clientCreated.payload.id));

    const history = await api(baseUrl, `/appointment-activity/clients/${clientCreated.payload.id}`);
    assert.equal(history.response.status, 200);
    assert.equal(history.payload.stats.cancellations, 1);
    assert.equal(history.payload.stats.reschedules, 1);
    assert.ok(Number(history.payload.reliability.score) < 100);
    assert.ok(Array.isArray(history.payload.timeline));

    const timeline = await api(baseUrl, `/appointment-activity/appointments/${created.payload.id}/timeline`);
    assert.equal(timeline.response.status, 200);
    assert.ok(timeline.payload.timeline.length >= 4);

    const report = await api(baseUrl, `/appointment-activity/reports?clientId=${clientCreated.payload.id}`);
    assert.equal(report.response.status, 200);
    assert.ok(report.payload.summary.cancellations >= 1);
    assert.ok(Array.isArray(report.payload.clientReliability));

    const legacyAlias = await api(baseUrl, `/appointment-history/client/${clientCreated.payload.id}`);
    assert.equal(legacyAlias.response.status, 200);
    assert.equal(legacyAlias.payload.success, true);

    const otherTenant = await fetch(`${baseUrl}/appointment-activity/clients/${clientCreated.payload.id}`, {
      headers: headers({ "x-tenant-id": "tenant_other" })
    });
    assert.equal(otherTenant.status, 404);
  } finally {
    await close(server);
  }
});
