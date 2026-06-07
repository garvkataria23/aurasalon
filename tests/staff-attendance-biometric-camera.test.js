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

test("biometric queue and camera punch create real attendance with evidence", async () => {
  ensureTenant("tenant_attendance_other", "attendance-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_att_${Date.now()}`;
  try {
    const staff = await api(baseUrl, "/staff-os/staff", {
      method: "POST",
      branchId,
      body: { branchId, firstName: "Nirali", lastName: "Mehta", employeeCode: `ATT-${Date.now()}`, designation: "Stylist" }
    });
    assert.equal(staff.response.status, 201);

    const device = await api(baseUrl, "/staff-os/biometric/devices", {
      method: "POST",
      branchId,
      body: { branchId, provider: "zkteco", deviceCode: `ZK-ATT-${Date.now()}`, deviceName: "Main door biometric" }
    });
    assert.equal(device.response.status, 201);

    const mapping = await api(baseUrl, "/staff-os/biometric/mappings", {
      method: "POST",
      branchId,
      body: { branchId, deviceId: device.payload.id, staffId: staff.payload.id, externalUserId: "zk-nirali" }
    });
    assert.equal(mapping.response.status, 201);

    const approved = await api(baseUrl, `/staff-os/biometric/mappings/${mapping.payload.id}/approve`, {
      method: "PATCH",
      branchId,
      body: { version: mapping.payload.version }
    });
    assert.equal(approved.payload.status, "approved");

    const eventId = `evt-${branchId}-clock-in`;
    const sync = await api(baseUrl, `/staff-os/biometric/devices/${device.payload.id}/sync`, {
      method: "POST",
      branchId,
      body: { punches: [{ externalUserId: "zk-nirali", externalEventId: eventId, punchAt: "2026-06-02T04:30:00.000Z", punchType: "clock_in" }] }
    });
    assert.equal(sync.response.status, 200);
    assert.equal(sync.payload.run.acceptedEvents, 1);

    const processed = await api(baseUrl, "/staff-os/biometric/process-queue", {
      method: "POST",
      branchId,
      body: { branchId, limit: 20 }
    });
    assert.equal(processed.response.status, 200);
    assert.equal(processed.payload.processed, 1);

    const consent = await api(baseUrl, "/staff-os/biometric/consents", {
      method: "POST",
      branchId,
      body: {
        branchId,
        staffId: staff.payload.id,
        consentStatus: "granted",
        consentChannel: "digital",
        retentionDays: 365,
        consentText: "Camera attendance consent captured"
      }
    });
    assert.equal(consent.response.status, 201);

    const clockOut = await api(baseUrl, "/staff-os/attendance/camera-punch", {
      method: "POST",
      branchId,
      body: {
        branchId,
        staffId: staff.payload.id,
        punchType: "clock_out",
        businessDate: "2026-06-02",
        capturedAt: "2026-06-02T13:30:00.000Z",
        imageDataUrl: "data:image/jpeg;base64,/9j/4AAQSkZJRgABAQAAAQABAAD",
        livenessScore: 0.91,
        matchScore: 0.88,
        notes: "Front desk camera"
      }
    });
    assert.equal(clockOut.response.status, 201);
    assert.equal(clockOut.payload.attendance.status, "clocked_out");
    assert.equal(clockOut.payload.evidence.reviewStatus, "auto_accepted");

    const center = await api(baseUrl, "/staff-os/attendance/biometric-center?branchId=" + encodeURIComponent(branchId) + "&date=2026-06-02", { branchId });
    assert.equal(center.response.status, 200);
    assert.equal(center.payload.summary.attendanceEvents >= 1, true);
    assert.equal(center.payload.summary.cameraCaptures, 1);
    assert.equal(center.payload.summary.suspiciousEvents, 0);
  } finally {
    await close(server);
  }
});
