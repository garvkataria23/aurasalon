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

function digits(value) {
  return String(value || "").replace(/\D/g, "");
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
        skipApprovalGate: true,
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

test("migration client import does not skip new clients on name-only match", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const stamp = Date.now();
    const sharedName = `Same Name Import ${stamp}`;
    const existing = await request(baseUrl, "/clients", {
      method: "POST",
      body: {
        name: sharedName,
        phone: `+91 97777 ${String(stamp).slice(-5)}`,
        branchId: "branch_hyd"
      }
    });
    assert.equal(existing.response.status, 201);

    const importedPhone = `+91 98888 ${String(stamp).slice(-5)}`;
    const importResult = await request(baseUrl, "/migration/import", {
      method: "POST",
      body: {
        sourceSoftware: "excel",
        resource: "clients",
        skipApprovalGate: true,
        rows: [{
          name: sharedName,
          phone: importedPhone,
          branchId: "branch_hyd",
          originalRecordId: `same-name-${stamp}`
        }]
      }
    });

    assert.equal(importResult.response.status, 201);
    assert.equal(importResult.body.summary.importedRows, 1);
    assert.equal(importResult.body.summary.skippedRows, 0);
    const targetId = importResult.body.details.rows.find((row) => row.action === "created").targetId;
    assert.ok(targetId);

    const created = await request(baseUrl, `/clients/${targetId}`);
    assert.equal(created.response.status, 200);
    assert.equal(created.body.name, sharedName);
    assert.equal(digits(created.body.phone), digits(importedPhone));
  } finally {
    await close(server);
  }
});

test("migration approval workflow submits, lists and approves latest request", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const stamp = Date.now();
    const submitted = await request(baseUrl, "/migration/approvals", {
      method: "POST",
      body: {
        resource: "clients",
        branchId: "branch_hyd",
        note: `Approval smoke ${stamp}`,
        summary: { totalRows: 1, validRows: 1, errorRows: 0 }
      }
    });
    assert.equal(submitted.response.status, 201);
    assert.ok(submitted.body.id);
    assert.equal(submitted.body.status, "pending");

    const pending = await request(baseUrl, "/migration/approvals?status=pending");
    assert.equal(pending.response.status, 200);
    assert.ok(pending.body.some((approval) => approval.id === submitted.body.id));

    const approved = await request(baseUrl, `/migration/approvals/${submitted.body.id}/decide`, {
      method: "POST",
      body: { decision: "approved", note: "Owner approved" }
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.status, "approved");
    assert.ok(approved.body.reviewedAt);
  } finally {
    await close(server);
  }
});
