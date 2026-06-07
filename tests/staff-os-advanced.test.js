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

function headers(role = "owner", tenantId = "tenant_aura", branchId = "") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role,
    ...(branchId ? { "x-branch-id": branchId } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, role = "owner", tenantId = "tenant_aura", branchId = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(role, tenantId, branchId),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureTenant(id, slug) {
  const now = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, status, planId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, `Tenant ${slug}`, slug, "active", plan?.id || null, now, now);
}

test("advanced staff os modules are tenant-safe and explainable", async () => {
  ensureTenant("tenant_staff_os_adv_other", "staff-os-adv-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_adv_${Date.now()}`;
  const biometricEventId = `${branchId}-evt-1001`;
  try {
    const primary = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      branchId,
      body: { branchId, firstName: "Kavya", lastName: "Rao", employeeCode: `ADV-A-${Date.now()}` }
    });
    assert.equal(primary.response.status, 201);
    const backup = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      branchId,
      body: { branchId, firstName: "Manav", lastName: "Sen", employeeCode: `ADV-B-${Date.now()}` }
    });
    assert.equal(backup.response.status, 201);

    const device = await api(baseUrl, "/staff-os/biometric/devices", {
      method: "POST",
      branchId,
      body: { branchId, provider: "zkteco", deviceCode: `ZK-${Date.now()}`, deviceName: "Front desk ZK", credentials: { host: "10.0.0.5", password: "secret" } }
    });
    assert.equal(device.response.status, 201);
    assert.equal(device.payload.credentialsEncrypted, "[encrypted]");

    const mapping = await api(baseUrl, "/staff-os/biometric/mappings", {
      method: "POST",
      branchId,
      body: { deviceId: device.payload.id, staffId: primary.payload.id, externalUserId: "zk-1001" }
    });
    assert.equal(mapping.response.status, 201);
    const approvedMapping = await api(baseUrl, `/staff-os/biometric/mappings/${mapping.payload.id}/approve`, {
      method: "PATCH",
      branchId,
      body: { version: mapping.payload.version }
    });
    assert.equal(approvedMapping.payload.status, "approved");

    const firstSync = await api(baseUrl, `/staff-os/biometric/devices/${device.payload.id}/sync`, {
      method: "POST",
      branchId,
      body: { punches: [{ externalUserId: "zk-1001", externalEventId: biometricEventId, punchAt: "2026-08-01T04:30:00.000Z", punchType: "clock_in" }] }
    });
    assert.equal(firstSync.response.status, 200);
    assert.equal(firstSync.payload.run.acceptedEvents, 1);

    const duplicateSync = await api(baseUrl, `/staff-os/biometric/devices/${device.payload.id}/sync`, {
      method: "POST",
      branchId,
      body: { punches: [{ externalUserId: "zk-1001", externalEventId: biometricEventId, punchAt: "2026-08-01T04:30:00.000Z", punchType: "clock_in" }] }
    });
    assert.equal(duplicateSync.response.status, 200);
    assert.equal(duplicateSync.payload.run.duplicateEvents, 1);

    const template = await api(baseUrl, "/staff-os/notifications/templates", {
      method: "POST",
      branchId,
      body: { branchId, notificationType: "shift_reminder", title: "Shift reminder", bodyTemplate: "Hi {{staff.first_name}}, your shift starts soon." }
    });
    assert.equal(template.response.status, 201);

    const queued = await api(baseUrl, "/staff-os/notifications/queue", {
      method: "POST",
      branchId,
      body: { branchId, staffId: primary.payload.id, notificationType: "shift_reminder", templateId: template.payload.id }
    });
    assert.equal(queued.response.status, 201);
    assert.equal(queued.payload.status, "queued");

    const blockedSalaryMessage = await api(baseUrl, "/staff-os/notifications/queue", {
      method: "POST",
      branchId,
      body: { branchId, staffId: primary.payload.id, notificationType: "payroll_paid", message: "Your payroll net pay is ₹40000" }
    });
    assert.equal(blockedSalaryMessage.response.status, 403);

    const policy = await api(baseUrl, "/staff-os/approvals/policies", {
      method: "POST",
      branchId,
      body: {
        branchId,
        policyKey: `salary-${Date.now()}`,
        policyName: "Salary revision two step",
        appliesTo: "salary_revision",
        steps: [{ order: 1, role: "manager" }, { order: 2, role: "owner" }]
      }
    });
    assert.equal(policy.response.status, 201);

    const approval = await api(baseUrl, "/staff-os/approvals", {
      method: "POST",
      branchId,
      body: { branchId, requestType: "salary_revision", amount: 100000, entityType: "salary_revision_history", entityId: "pending" }
    });
    assert.equal(approval.response.status, 201);
    assert.equal(approval.payload.steps.length, 2);
    const stepOne = await api(baseUrl, `/staff-os/approvals/${approval.payload.id}/approve`, {
      method: "POST",
      role: "manager",
      branchId,
      body: { comments: "Manager checked" }
    });
    assert.equal(stepOne.payload.status, "pending");
    const stepTwo = await api(baseUrl, `/staff-os/approvals/${approval.payload.id}/approve`, {
      method: "POST",
      branchId,
      body: { comments: "Owner approved" }
    });
    assert.equal(stepTwo.payload.status, "approved");

    const salaryRevision = await api(baseUrl, `/staff-os/staff/${primary.payload.id}/salary-revisions`, {
      method: "POST",
      branchId,
      body: {
        branchId,
        effectiveDate: "2026-08-01",
        oldCtc: 360000,
        newCtc: 480000,
        oldComponents: { basic: 180000 },
        newComponents: { basic: 240000 },
        reason: "Promotion"
      }
    });
    assert.equal(salaryRevision.response.status, 201);
    assert.equal(salaryRevision.payload.approvalStatus, "pending");
    assert.ok(salaryRevision.payload.immutableHash);

    const approvedSalary = await api(baseUrl, `/staff-os/salary-revisions/${salaryRevision.payload.id}/approve`, {
      method: "POST",
      branchId
    });
    assert.equal(approvedSalary.response.status, 200);
    assert.equal(approvedSalary.payload.approvalStatus, "approved");

    const correction = await api(baseUrl, `/staff-os/salary-revisions/${salaryRevision.payload.id}/correction`, {
      method: "POST",
      branchId,
      body: { newCtc: 500000, reason: "Correction entry" }
    });
    assert.equal(correction.response.status, 201);
    assert.equal(correction.payload.correctionOfId, salaryRevision.payload.id);

    const statutory = await api(baseUrl, "/staff-os/payroll-compliance/calculate", {
      method: "POST",
      branchId,
      body: { branchId, staffId: primary.payload.id, periodStart: "2026-08-01", periodEnd: "2026-08-31", grossAmount: 40000, freeze: true }
    });
    assert.equal(statutory.response.status, 201);
    assert.equal(statutory.payload.frozen, 1);
    assert.ok(statutory.payload.pfEmployee > 0);

    const replacement = await api(baseUrl, "/staff-os/replacement/recommend", {
      method: "POST",
      branchId,
      body: { branchId, absentStaffId: primary.payload.id, serviceId: "haircut", vip: true }
    });
    assert.equal(replacement.response.status, 201);
    assert.ok(Array.isArray(replacement.payload.rankedOptions));
    assert.equal(replacement.payload.requiresManagerApproval, true);
    assert.ok(replacement.payload.risks.includes("VIP client requires manager approval"));

    const mobileDevice = await api(baseUrl, "/staff-os/mobile/devices/register", {
      method: "POST",
      branchId,
      body: { branchId, staffId: primary.payload.id, deviceUid: `phone-${Date.now()}`, platform: "android" }
    });
    assert.equal(mobileDevice.response.status, 201);
    const offlineKeyOne = `${branchId}-offline-clock-1`;
    const offlineKeyTwo = `${branchId}-offline-clock-2`;

    const sync = await api(baseUrl, "/staff-os/mobile/sync", {
      method: "POST",
      branchId,
      body: {
        deviceId: mobileDevice.payload.id,
        mutations: [
          { idempotencyKey: offlineKeyOne, actionType: "clock_in", payload: { businessDate: "2026-08-02" } },
          { idempotencyKey: offlineKeyOne, actionType: "clock_in", payload: { businessDate: "2026-08-02" } },
          { idempotencyKey: offlineKeyTwo, actionType: "clock_in", payload: { businessDate: "2026-08-02" } }
        ]
      }
    });
    assert.equal(sync.response.status, 200);
    assert.equal(sync.payload.results.some((item) => item.status === "duplicate"), true);
    assert.equal(sync.payload.conflicts.length, 1);

    const resolved = await api(baseUrl, `/staff-os/mobile/conflicts/${sync.payload.conflicts[0].id}/resolve`, {
      method: "POST",
      branchId,
      body: { resolution: "server_wins" }
    });
    assert.equal(resolved.response.status, 200);
    assert.equal(resolved.payload.status, "resolved");

    const roster = await api(baseUrl, "/staff-os/roster/optimize", {
      method: "POST",
      branchId,
      body: { branchId, periodStart: "2026-08-03", periodEnd: "2026-08-03", forecastedDemandHours: 16 }
    });
    assert.equal(roster.response.status, 201);
    assert.ok(Array.isArray(roster.payload.roster));
    assert.ok(roster.payload.coverageScore >= 0);

    const heatmapShape = await api(baseUrl, "/staff-os/roster/coverage", { branchId });
    assert.equal(heatmapShape.response.status, 200);
    assert.equal(heatmapShape.payload.branchId, branchId);
    assert.ok("coverageScore" in heatmapShape.payload);

    const forecast = await api(baseUrl, `/staff-os/manpower/forecast?branchId=${encodeURIComponent(branchId)}&periodStart=2026-08-01&periodEnd=2026-08-07`, { branchId });
    assert.equal(forecast.response.status, 200);
    assert.equal(forecast.payload.branchId, branchId);
    assert.ok(forecast.payload.requiredStaffHours > 0);
    assert.ok(["low", "medium"].includes(forecast.payload.confidenceLevel));

    const otherForecast = await api(baseUrl, `/staff-os/manpower/forecast?branchId=${encodeURIComponent(branchId)}&periodStart=2026-08-01&periodEnd=2026-08-07`, {
      tenantId: "tenant_staff_os_adv_other",
      branchId
    });
    assert.equal(otherForecast.response.status, 200);
    assert.equal(otherForecast.payload.requiredStaffHours >= 4, true);
  } finally {
    await close(server);
  }
});
