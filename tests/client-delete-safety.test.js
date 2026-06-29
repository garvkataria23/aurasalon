import assert from "node:assert/strict";
import test from "node:test";
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

const headers = {
  "content-type": "application/json",
  "x-tenant-id": "tenant_aura",
  "x-user-role": "owner"
};

test("client delete archives backend row and hides it from default lists", async () => {
  const server = await listen(createApp());
  const origin = `http://127.0.0.1:${server.address().port}`;
  const baseUrl = `${origin}/api`;
  let clientId = "";

  try {
    const login = await fetch(`${origin}/api/v1/auth/login`, {
      method: "POST",
      headers,
      body: JSON.stringify({ tenantId: "tenant_aura", email: "owner@aurasalon.example", password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026" })
    }).then((response) => response.json());
    const authHeaders = { ...headers, authorization: `Bearer ${login.data.accessToken}` };

    const createdResponse = await fetch(`${baseUrl}/clients`, {
      method: "POST",
      headers: authHeaders,
      body: JSON.stringify({ name: "Delete Safety Client", phone: "+91 90000 00123", branchId: "branch_hyd" })
    });
    assert.equal(createdResponse.status, 201);
    const created = await createdResponse.json();
    clientId = created.id;
    assert.ok(clientId);

    const deleteResponse = await fetch(`${baseUrl}/clients/${clientId}`, { method: "DELETE", headers: authHeaders });
    assert.equal(deleteResponse.status, 200);
    const deleteBody = await deleteResponse.json();
    assert.equal(deleteBody.deleted.archived, true);

    const stored = db.prepare("SELECT id, deletedAt, deletedBy, deletedReason FROM clients WHERE id = @id").get({ id: clientId });
    assert.equal(stored.id, clientId);
    assert.ok(stored.deletedAt);
    assert.match(stored.deletedReason, /Backend row retained/);

    const visibleClients = await fetch(`${baseUrl}/clients?includeAllBranches=true&limit=10000`, { headers: authHeaders }).then((response) => response.json());
    assert.equal(visibleClients.some((client) => client.id === clientId), false);

    const allClients = await fetch(`${baseUrl}/clients?includeAllBranches=true&includeDeleted=true&limit=10000`, { headers: authHeaders }).then((response) => response.json());
    assert.equal(allClients.some((client) => client.id === clientId && client.deletedAt), true);
  } finally {
    await close(server);
  }
});