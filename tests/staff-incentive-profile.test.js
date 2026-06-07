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

async function api(baseUrl, path, { method = "GET", body } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: {
      "content-type": "application/json",
      "x-tenant-id": "tenant_aura",
      "x-branch-id": "branch_hyd",
      "x-user-role": "owner"
    },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

test("staff advanced incentive profile persists with rules, slabs, payroll, approval and attendance guard", async () => {
  const server = await listen(createApp());
  const port = server.address().port;
  const baseUrl = `http://127.0.0.1:${port}/api`;
  const stamp = Date.now();

  try {
    const result = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      body: {
        branchId: "branch_hyd",
        firstName: "Incentive",
        lastName: "Pilot",
        employeeCode: `INC-${stamp}`,
        designation: "Senior stylist",
        employeeDetails: {
          shortName: `INC${String(stamp).slice(-4)}`,
          incentive: {
            fixedIncentivePercent: 8,
            fixedIncentiveAmount: 500,
            ruleBuilder: [
              { type: "service_category", targetId: "Hair", targetName: "Hair", calcMode: "percent", value: 8, minAmount: 0, active: true },
              { type: "product", targetId: "prod-demo", targetName: "Retail product", calcMode: "fixed", value: 50, minAmount: 1000, active: true }
            ],
            targetSlabs: [
              { sNo: 1, fromAmount: 0, toAmount: 25000, incentivePercent: 5, incentiveAmount: 0 },
              { sNo: 2, fromAmount: 25001, toAmount: 50000, incentivePercent: 8, incentiveAmount: 0 }
            ],
            cycle: "monthly",
            validity: { startDate: "2026-06-01", endDate: "2026-06-30" },
            capAmount: 15000,
            payrollSync: true,
            approval: { required: true, role: "owner", payoutStatus: "ready" },
            attendanceRule: { holdAfterAbsentDays: 2, reduceAfterLateCount: 3, reductionPercent: 10 },
            notes: "Advanced incentive QA"
          }
        }
      }
    });

    assert.equal(result.response.status, 201);
    const incentive = result.payload.employeeDetails.incentive;
    assert.equal(incentive.fixedIncentivePercent, 8);
    assert.equal(incentive.ruleBuilder.length, 2);
    assert.equal(incentive.targetSlabs[1].incentivePercent, 8);
    assert.equal(incentive.payrollSync, true);
    assert.equal(incentive.approval.role, "owner");
    assert.equal(incentive.attendanceRule.reduceAfterLateCount, 3);
  } finally {
    await close(server);
  }
});
