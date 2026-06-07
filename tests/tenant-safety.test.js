import test from "node:test";
import assert from "node:assert/strict";
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

function headers(tenantId) {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": "owner"
  };
}

async function request(baseUrl, path, tenantId, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(tenantId),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

test("clients are isolated by tenant", async () => {
  const stamp = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants
    (id, name, slug, status, planId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(
    "tenant_other",
    "Other Salon",
    "other",
    "active",
    plan?.id || null,
    stamp,
    stamp
  );

  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  let clientId = "";
  try {
    const created = await request(baseUrl, "/clients", "tenant_aura", {
      method: "POST",
      body: {
        name: "Tenant A Client",
        phone: "+91 90000 00099",
        createdAt: "2000-01-01T00:00:00.000Z",
        updatedAt: "2000-01-01T00:00:00.000Z"
      }
    });
    assert.equal(created.response.status, 201);
    clientId = created.body.id;
    assert.ok(clientId);

    const otherList = await request(baseUrl, "/clients", "tenant_other");
    assert.equal(otherList.response.status, 200);
    assert.ok(Array.isArray(otherList.body));
    assert.equal(otherList.body.some((client) => client.id === clientId), false);

    const otherRead = await request(baseUrl, `/clients/${clientId}`, "tenant_other");
    assert.equal(otherRead.response.status, 404);
  } finally {
    if (clientId) {
      await request(baseUrl, `/clients/${clientId}`, "tenant_aura", { method: "DELETE" });
    }
    await close(server);
  }
});
