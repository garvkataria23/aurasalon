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

test("future attendance intelligence links gateway, consent, edge camera, payroll preview and alerts", async () => {
  ensureTenant("tenant_attendance_future", "attendance-future");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_future_${Date.now()}`;
  try {
    const staff = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      branchId,
      body: {
        branchId,
        firstName: "Aftab",
        lastName: "Pathan",
        employeeCode: `FUT-${Date.now()}`,
        designation: "Stylist",
        employeeDetails: {
          attendanceSalary: {
            basicSalary: 30000,
            otExtraRate: 100,
            pfApplicable: true,
            esicApplicable: false,
            ptApplicable: true,
            tdsApplicable: false
          }
        }
      }
    });
    assert.equal(staff.response.status, 201);

    const consent = await api(baseUrl, "/staff-os/biometric/consents", {
      method: "POST",
      branchId,
      body: {
        branchId,
        staffId: staff.payload.id,
        consentStatus: "granted",
        consentChannel: "digital",
        retentionDays: 180,
        consentText: "Digital biometric consent captured"
      }
    });
    assert.equal(consent.response.status, 201);
    assert.equal(consent.payload.consentStatus, "granted");

    const gateway = await api(baseUrl, "/staff-os/biometric/gateway/register", {
      method: "POST",
      branchId,
      body: {
        branchId,
        gatewayCode: `GW-${Date.now()}`,
        displayName: "Front desk Windows gateway",
        machineName: "AURA-FD-01",
        providers: ["zkteco", "essl", "mantra"]
      }
    });
    assert.equal(gateway.response.status, 201);
    assert.ok(gateway.payload.gatewayApiKey);

    const deviceCode = `ZK-FUT-${Date.now()}`;
    const device = await api(baseUrl, "/staff-os/biometric/devices", {
      method: "POST",
      branchId,
      body: { branchId, provider: "zkteco", deviceCode, deviceName: "Main door device" }
    });
    assert.equal(device.response.status, 201);

    const mapping = await api(baseUrl, "/staff-os/biometric/mappings", {
      method: "POST",
      branchId,
      body: { branchId, deviceId: device.payload.id, staffId: staff.payload.id, externalUserId: "zk-aftab" }
    });
    assert.equal(mapping.response.status, 201);

    const approved = await api(baseUrl, `/staff-os/biometric/mappings/${mapping.payload.id}/approve`, {
      method: "PATCH",
      branchId,
      body: { version: mapping.payload.version }
    });
    assert.equal(approved.payload.status, "approved");

    const events = await api(baseUrl, `/staff-os/biometric/gateway/${gateway.payload.id}/events`, {
      method: "POST",
      branchId,
      body: {
        processNow: true,
        events: [{
          deviceCode,
          externalUserId: "zk-aftab",
          externalEventId: `gw-${branchId}-clock-in`,
          punchAt: "2026-06-02T04:30:00.000Z",
          punchType: "clock_in"
        }]
      }
    });
    assert.equal(events.response.status, 202);
    assert.equal(events.payload.acceptedEvents, 1);
    assert.equal(events.payload.processed.processed, 1);

    const edgeClockOut = await api(baseUrl, "/staff-os/attendance/camera-punch", {
      method: "POST",
      branchId,
      body: {
        branchId,
        staffId: staff.payload.id,
        punchType: "clock_out",
        businessDate: "2026-06-02",
        capturedAt: "2026-06-02T13:30:00.000Z",
        edgeVerified: true,
        imageHash: `facehash-${branchId}`,
        signedEvent: "local-edge-signed-payload",
        edgeSignature: "local-edge-signature",
        livenessChecks: { blinkScore: 0.91, motionScore: 0.93, depthScore: 0.9, passiveScore: 0.94 },
        matchScore: 0.92,
        notes: "Edge AI camera punch"
      }
    });
    assert.equal(edgeClockOut.response.status, 201);
    assert.equal(edgeClockOut.payload.evidence.source, "edge_camera");
    assert.equal(edgeClockOut.payload.evidence.reviewStatus, "auto_accepted");

    const payroll = await api(baseUrl, "/staff-os/attendance/payroll-preview", {
      method: "POST",
      branchId,
      body: {
        branchId,
        periodStart: "2026-06-02",
        periodEnd: "2026-06-02",
        defaultShiftStart: "10:00",
        lateGraceMinutes: 15
      }
    });
    assert.equal(payroll.response.status, 201);
    assert.equal(payroll.payload.rows.some((row) => row.staffId === staff.payload.id && row.presentDays === 1), true);

    const scan = await api(baseUrl, "/staff-os/attendance/fraud-scan", {
      method: "POST",
      branchId,
      body: { branchId, date: "2026-06-02" }
    });
    assert.equal(scan.response.status, 200);
    assert.ok(Array.isArray(scan.payload.openRisks));

    const center = await api(baseUrl, `/staff-os/attendance/biometric-center?branchId=${encodeURIComponent(branchId)}&date=2026-06-02`, { branchId });
    assert.equal(center.response.status, 200);
    assert.equal(center.payload.summary.gateways, 1);
    assert.equal(center.payload.summary.mappedStaff, 1);
    assert.equal(center.payload.summary.consentGranted, 1);
    assert.equal(center.payload.summary.payrollPreviewRows, 1);
  } finally {
    await close(server);
  }
});
