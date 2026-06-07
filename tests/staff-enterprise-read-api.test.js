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

function headers(role = "owner", tenantId = "tenant_aura") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role
  };
}

async function api(baseUrl, path, { role = "owner", tenantId = "tenant_aura" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, { headers: headers(role, tenantId) });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function countRows(table) {
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

test("staff enterprise read APIs return calculated read-only data", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const beforeAudit = countRows("staff_zero_trust_audit");
  const beforeCommandCenter = countRows("staff_ai_command_center");
  try {
    const endpoints = [
      "/staff-enterprise/command-center",
      "/staff-enterprise/digital-twins",
      "/staff-enterprise/skill-matrix",
      "/staff-enterprise/risk-signals",
      "/staff-enterprise/floor-control",
      "/staff-enterprise/payroll-intelligence",
      "/staff-enterprise/audit-trail",
      "/staff-enterprise/training",
      "/staff-enterprise/approvals"
    ];

    const results = [];
    for (const endpoint of endpoints) {
      const result = await api(baseUrl, endpoint);
      assert.equal(result.response.status, 200, endpoint);
      assert.ok(result.payload && typeof result.payload === "object", endpoint);
      assert.equal(typeof result.payload.empty, "boolean", endpoint);
      results.push({ endpoint, payload: result.payload });
    }

    const command = results.find((item) => item.endpoint === "/staff-enterprise/command-center").payload;
    assert.ok(command.kpis);
    assert.ok(command.sourceCounts);
    assert.ok(Array.isArray(command.attentionQueue));

    const twins = results.find((item) => item.endpoint === "/staff-enterprise/digital-twins").payload;
    assert.ok(Array.isArray(twins.items));
    if (twins.items.length) {
      const detail = await api(baseUrl, `/staff-enterprise/digital-twins/${twins.items[0].staffId}`);
      assert.equal(detail.response.status, 200);
      assert.equal(detail.payload.staffId, twins.items[0].staffId);
    }

    const riskSignals = results.find((item) => item.endpoint === "/staff-enterprise/risk-signals").payload;
    const expectedDetectors = [
      "burnout_risk",
      "attrition_risk",
      "low_utilization",
      "overbooking_risk",
      "revenue_leakage",
      "discount_misuse",
      "cash_handling_risk",
      "commission_anomaly",
      "attendance_manipulation",
      "repeated_client_complaints",
      "staff_client_mismatch",
      "uncertified_service_assignment"
    ];
    assert.deepEqual(riskSignals.detectors.map((detector) => detector.type), expectedDetectors);
    assert.ok(Array.isArray(riskSignals.items));
    for (const signal of riskSignals.items) {
      assert.ok(["low", "medium", "high", "critical"].includes(signal.riskLevel));
      assert.equal(typeof signal.riskScore, "number");
      assert.ok(Array.isArray(signal.reasons));
      assert.ok(signal.evidence && typeof signal.evidence === "object");
      assert.equal(typeof signal.suggestedAction, "string");
      assert.equal(typeof signal.reviewStatus, "string");
    }

    assert.equal(countRows("staff_zero_trust_audit"), beforeAudit);
    assert.equal(countRows("staff_ai_command_center"), beforeCommandCenter);
  } finally {
    await close(server);
  }
});
