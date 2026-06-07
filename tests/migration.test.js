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

async function request(baseUrl, path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

test("migration dry-run validates rows without saving live records", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const stamp = Date.now();
    const phone = `+91 95555 ${String(stamp).slice(-5)}`;
    const dryRun = await request(baseUrl, "/migration/dry-run", {
      method: "POST",
      body: {
        sourceSoftware: "excel",
        resource: "clients",
        rows: [{ name: `Dry Run Client ${stamp}`, phone, branchId: "branch_hyd", originalRecordId: `dry-${stamp}` }]
      }
    });
    assert.equal(dryRun.response.status, 201);
    assert.equal(dryRun.body.summary.totalRows, 1);
    assert.equal(dryRun.body.summary.errorRows, 0);

    const clients = await request(baseUrl, `/clients?q=${encodeURIComponent(phone)}`);
    assert.equal(clients.response.status, 200);
    assert.equal(clients.body.some((client) => client.phone === phone), false);
  } finally {
    await close(server);
  }
});

test("migration import stamps metadata and rollback removes imported records", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const stamp = Date.now();
    const phone = `+91 96666 ${String(stamp).slice(-5)}`;
    const importResult = await request(baseUrl, "/migration/import", {
      method: "POST",
      body: {
        sourceSoftware: "salonist",
        resource: "clients",
        rows: [{ name: `Rollback Client ${stamp}`, phone, branchId: "branch_hyd", originalRecordId: `old-${stamp}`, createdAt: "2024-01-15" }]
      }
    });
    assert.equal(importResult.response.status, 201);
    assert.equal(importResult.body.summary.importedRows, 1);
    const targetId = importResult.body.details.rows.find((row) => row.action === "created").targetId;
    assert.ok(targetId);

    const created = await request(baseUrl, `/clients/${targetId}`);
    assert.equal(created.response.status, 200);
    assert.equal(created.body.imported, 1);
    assert.equal(created.body.originalSystem, "salonist");
    assert.equal(created.body.originalRecordId, `old-${stamp}`);
    assert.match(created.body.createdAt, /^2024-01-15/);

    const rollback = await request(baseUrl, `/migration/jobs/${importResult.body.jobId}/rollback`, { method: "POST", body: {} });
    assert.equal(rollback.response.status, 200);
    assert.equal(rollback.body.ok, true);
    assert.equal(rollback.body.deleted.clients, 1);

    const afterRollback = await request(baseUrl, `/clients/${targetId}`);
    assert.equal(afterRollback.response.status, 404);
  } finally {
    await close(server);
  }
});
