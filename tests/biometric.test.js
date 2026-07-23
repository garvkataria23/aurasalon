import assert from "node:assert/strict";
import { randomUUID } from "node:crypto";
import test from "node:test";
import { db } from "../server/db.js";
import { ensureStaffOsSchema } from "../server/services/staff-os-schema.service.js";
import { StaffBiometricService } from "../server/services/staff-biometric.service.js";

ensureStaffOsSchema();
const service = new StaffBiometricService();

function fixture() {
  const suffix = randomUUID();
  const tenantId = `bio_tenant_${suffix}`;
  const branchId = `bio_branch_${suffix}`;
  const staffId = `bio_staff_${suffix}`;
  const userIdManager = `bio_user_mgr_${suffix}`;
  const stamp = new Date().toISOString();

  db.prepare(`INSERT INTO tenants (id,name,slug,createdAt,updatedAt) VALUES (@id,'Bio Test',@slug,@stamp,@stamp)`)
    .run({ id: tenantId, slug: `bio-test-${suffix}`, stamp });
  db.prepare(`INSERT INTO staff_master (id, tenant_id, branch_id, employee_code, first_name, full_name, status)
    VALUES (@id, @tenantId, @branchId, @code, 'Test', 'Test Staff', 'active')`)
    .run({ id: staffId, tenantId, branchId, code: `EMP_BIO_${suffix.slice(0, 8)}` });
  db.prepare(`INSERT INTO tenant_users (id, tenantId, email, name, role, branchIds, staffId, status, createdAt, updatedAt)
    VALUES (@id,@tenantId,@email,@name,'owner',@branchIds,'','active',@stamp,@stamp)`)
    .run({ id: userIdManager, tenantId, email: `${userIdManager}@test.com`, name: "Manager", branchIds: JSON.stringify([branchId]), stamp });

  const managerAccess = { tenantId, branchId, branchIds: [branchId], userId: userIdManager, role: "owner" };
  return { tenantId, branchId, staffId, userIdManager, managerAccess };
}

function registerTestDevice(f, deviceCode = `dev_${Date.now()}`) {
  return service.registerDevice({
    branchId: f.branchId,
    provider: "zkteco",
    deviceCode,
    deviceName: "Test ZKTeco",
    deviceType: "biometric",
    locationLabel: "Front door"
  }, f.managerAccess);
}

test("register a biometric device", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  assert.ok(device.id);
  assert.equal(device.provider, "zkteco");
  assert.equal(device.branchId, f.branchId);
  assert.equal(device.status, "active");
});

test("list devices", () => {
  const f = fixture();
  registerTestDevice(f, "dev_list_1");
  registerTestDevice(f, "dev_list_2");
  const list = service.listDevices({ branchId: f.branchId }, f.managerAccess);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 2);
});

test("get device by id", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  const got = service.getDevice(device.id, f.managerAccess);
  assert.equal(got.id, device.id);
  assert.equal(got.provider, "zkteco");
});

test("get non-existent device throws", () => {
  const f = fixture();
  assert.throws(() => service.getDevice("nonexistent", f.managerAccess), { message: /not found/ });
});

test("update device", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  const updated = service.updateDevice(device.id, {
    deviceName: "Updated Name",
    locationLabel: "Back office",
    version: device.version
  }, f.managerAccess);
  assert.equal(updated.deviceName, "Updated Name");
  assert.equal(updated.locationLabel, "Back office");
  assert.equal(updated.version, 2);
});

test("update device with wrong version throws conflict", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  assert.throws(() => service.updateDevice(device.id, { deviceName: "X", version: 999 }, f.managerAccess), { message: /updated by another request/ });
});

test("create staff mapping", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  const mapping = service.createMapping({
    deviceId: device.id,
    staffId: f.staffId,
    externalUserId: "ZK_001"
  }, f.managerAccess);
  assert.ok(mapping.id);
  assert.equal(mapping.status, "pending");
  assert.equal(mapping.externalUserId, "ZK_001");
});

test("approve staff mapping", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  const mapping = service.createMapping({
    deviceId: device.id,
    staffId: f.staffId,
    externalUserId: "ZK_002"
  }, f.managerAccess);
  const approved = service.approveMapping(mapping.id, {}, f.managerAccess);
  assert.equal(approved.status, "approved");
  assert.ok(approved.approvedAt);
});

test("list mappings", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  service.createMapping({ deviceId: device.id, staffId: f.staffId, externalUserId: "ZK_LIST" }, f.managerAccess);
  const list = service.listMappings({ branchId: f.branchId }, f.managerAccess);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
  assert.ok(list.some((m) => m.externalUserId === "ZK_LIST"));
});

test("sync device with punches", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  service.createMapping({ deviceId: device.id, staffId: f.staffId, externalUserId: "ZK_SYNC_1" }, f.managerAccess);
  service.approveMapping(
    db.prepare("SELECT id FROM biometric_staff_mappings WHERE tenant_id = ? AND device_id = ? AND external_user_id = ?")
      .get(f.tenantId, device.id, "ZK_SYNC_1")?.id,
    {}, f.managerAccess
  );
  const result = service.syncDevice(device.id, {
    punches: [
      { externalUserId: "ZK_SYNC_1", punchAt: new Date().toISOString(), punchType: "clock_in", externalEventId: `evt_${Date.now()}_1` },
      { externalUserId: "ZK_UNMAPPED", punchAt: new Date().toISOString(), punchType: "clock_in", externalEventId: `evt_${Date.now()}_2` }
    ]
  }, f.managerAccess);
  assert.ok(result.run);
  assert.equal(result.run.status, "completed");
  assert.equal(result.run.acceptedEvents, 2);
  assert.equal(result.punches.length, 2);
  assert.ok(result.punches.some((p) => p.suspicious === 1));
  assert.ok(result.punches.some((p) => p.staffId === f.staffId));
});

test("sync rejects duplicate events", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  service.createMapping({ deviceId: device.id, staffId: f.staffId, externalUserId: "ZK_DUP" }, f.managerAccess);
  service.approveMapping(
    db.prepare("SELECT id FROM biometric_staff_mappings WHERE tenant_id = ? AND device_id = ? AND external_user_id = ?")
      .get(f.tenantId, device.id, "ZK_DUP")?.id,
    {}, f.managerAccess
  );
  const eventId = `evt_dup_${Date.now()}`;
  service.syncDevice(device.id, { punches: [{ externalUserId: "ZK_DUP", punchAt: new Date().toISOString(), punchType: "clock_in", externalEventId: eventId }] }, f.managerAccess);
  const result = service.syncDevice(device.id, { punches: [{ externalUserId: "ZK_DUP", punchAt: new Date().toISOString(), punchType: "clock_in", externalEventId: eventId }] }, f.managerAccess);
  assert.equal(result.duplicateEvents, 1);
  assert.equal(result.run.acceptedEvents, 0);
});

test("logs returned for sync punches", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  service.createMapping({ deviceId: device.id, staffId: f.staffId, externalUserId: "ZK_LOG" }, f.managerAccess);
  service.approveMapping(
    db.prepare("SELECT id FROM biometric_staff_mappings WHERE tenant_id = ? AND device_id = ? AND external_user_id = ?")
      .get(f.tenantId, device.id, "ZK_LOG")?.id,
    {}, f.managerAccess
  );
  service.syncDevice(device.id, { punches: [{ externalUserId: "ZK_LOG", punchAt: new Date().toISOString(), punchType: "clock_in", externalEventId: `evt_log_${Date.now()}` }] }, f.managerAccess);
  const logs = service.logs({ branchId: f.branchId }, f.managerAccess);
  assert.ok(Array.isArray(logs));
  assert.ok(logs.length >= 1);
  assert.ok(logs.some((l) => l.externalUserId === "ZK_LOG"));
});

test("register gateway", () => {
  const f = fixture();
  const gw = service.registerGateway({
    branchId: f.branchId,
    gatewayCode: `GW_${Date.now()}`,
    displayName: "Test Gateway"
  }, f.managerAccess);
  assert.ok(gw.id);
  assert.equal(gw.status, "active");
  assert.ok(gw.gatewayApiKey);
  assert.equal(gw.apiKeyHash, "[stored]");
});

test("gateway heartbeat updates health", () => {
  const f = fixture();
  const gw = service.registerGateway({
    branchId: f.branchId,
    gatewayCode: `GW_HB_${Date.now()}`,
    displayName: "HB Gateway"
  }, f.managerAccess);
  const updated = service.gatewayHeartbeat(gw.id, {
    healthStatus: "online",
    lastIp: "192.168.1.100",
    apiKey: gw.gatewayApiKey
  }, f.managerAccess);
  assert.equal(updated.healthStatus, "online");
  assert.equal(updated.lastIp, "192.168.1.100");
});

test("upsert consent", () => {
  const f = fixture();
  const consent = service.upsertConsent({
    staffId: f.staffId,
    consentType: "biometric_attendance",
    consentStatus: "granted",
    consentChannel: "app",
    retentionDays: 180
  }, f.managerAccess);
  assert.ok(consent.id);
  assert.equal(consent.consentStatus, "granted");
  assert.equal(consent.retentionDays, 180);
});

test("list consents", () => {
  const f = fixture();
  service.upsertConsent({ staffId: f.staffId, consentStatus: "granted" }, f.managerAccess);
  const list = service.listConsents({ branchId: f.branchId }, f.managerAccess);
  assert.ok(Array.isArray(list));
  assert.ok(list.length >= 1);
});

test("request consent deletion", () => {
  const f = fixture();
  const consent = service.upsertConsent({ staffId: f.staffId, consentStatus: "granted" }, f.managerAccess);
  const updated = service.requestConsentDeletion(consent.id, { reason: "GDPR request" }, f.managerAccess);
  assert.equal(updated.deleteRequested, 1);
  assert.ok(updated.deleteRequestedAt);
});

test("hasConsent checks correctly", () => {
  const f = fixture();
  assert.equal(service.hasConsent(f.staffId, f.managerAccess), false);
  service.upsertConsent({ staffId: f.staffId, consentStatus: "granted" }, f.managerAccess);
  assert.equal(service.hasConsent(f.staffId, f.managerAccess), true);
  service.upsertConsent({ staffId: f.staffId, consentStatus: "revoked" }, f.managerAccess);
  assert.equal(service.hasConsent(f.staffId, f.managerAccess), false);
});

test("attendance center returns aggregated data", () => {
  const f = fixture();
  registerTestDevice(f, "dev_center");
  service.upsertConsent({ staffId: f.staffId, consentStatus: "granted" }, f.managerAccess);
  const center = service.attendanceCenter({ branchId: f.branchId }, f.managerAccess);
  assert.equal(center.branchId, f.branchId);
  assert.ok(center.summary);
  assert.ok(typeof center.summary.devices === "number");
  assert.ok(typeof center.summary.mappedStaff === "number");
  assert.ok(typeof center.summary.consentGranted === "number");
  assert.ok(Array.isArray(center.devices));
  assert.ok(Array.isArray(center.logs));
  assert.ok(Array.isArray(center.consents));
});

test("non-manager cannot register device", () => {
  const f = fixture();
  const staffAccess = { ...f.managerAccess, role: "staff", staffId: f.staffId };
  assert.throws(() => service.registerDevice({
    branchId: f.branchId, provider: "manual", deviceCode: `dev_${Date.now()}`, deviceName: "X"
  }, staffAccess), /manager|manage staff/i);
});

test("unsupported provider throws", () => {
  const f = fixture();
  assert.throws(() => service.registerDevice({
    branchId: f.branchId, provider: "unknown_device", deviceCode: "X", deviceName: "X"
  }, f.managerAccess), { message: /Unsupported biometric provider/ });
});

test("device code is required", () => {
  const f = fixture();
  assert.throws(() => service.registerDevice({
    branchId: f.branchId, provider: "manual", deviceName: "No code"
  }, f.managerAccess), { message: /deviceCode is required/ });
});

test("mapping requires externalUserId", () => {
  const f = fixture();
  const device = registerTestDevice(f);
  assert.throws(() => service.createMapping({
    deviceId: device.id, staffId: f.staffId
  }, f.managerAccess), { message: /externalUserId is required/ });
});

test("mapping staff and device must be same branch", () => {
  const f = fixture();
  const otherBranch = `bio_other_branch_${randomUUID()}`;
  const device = registerTestDevice(f);
  const staffOther = `bio_staff_other_${randomUUID()}`;
  db.prepare(`INSERT INTO staff_master (id, tenant_id, branch_id, employee_code, first_name, full_name, status)
    VALUES (@id, @tenantId, @branchId, @code, 'Other', 'Other Staff', 'active')`)
    .run({ id: staffOther, tenantId: f.tenantId, branchId: otherBranch, code: `EMP_OTH_${Date.now()}` });
  assert.throws(() => service.createMapping({
    deviceId: device.id, staffId: staffOther, externalUserId: "ZK_WRONG"
  }, f.managerAccess), { message: /same branch/ });
});

test("gateway events ingests punches through gateway", () => {
  const f = fixture();
  const gw = service.registerGateway({
    branchId: f.branchId,
    gatewayCode: `GW_EVT_${Date.now()}`,
    displayName: "Event Gateway"
  }, f.managerAccess);
  const device = registerTestDevice(f, "dev_gw_evt");
  service.createMapping({ deviceId: device.id, staffId: f.staffId, externalUserId: "ZK_GW_1" }, f.managerAccess);
  service.approveMapping(
    db.prepare("SELECT id FROM biometric_staff_mappings WHERE tenant_id = ? AND device_id = ? AND external_user_id = ?")
      .get(f.tenantId, device.id, "ZK_GW_1")?.id,
    {}, f.managerAccess
  );
  const result = service.gatewayEvents(gw.id, {
    apiKey: gw.gatewayApiKey,
    events: [
      { deviceId: device.id, externalUserId: "ZK_GW_1", punchAt: new Date().toISOString(), punchType: "clock_in" }
    ]
  }, f.managerAccess);
  assert.ok(result.acceptedEvents >= 1);
  assert.ok(result.gateway);
});

test("duplicate device code throws conflict", () => {
  const f = fixture();
  registerTestDevice(f, "dev_unique_1");
  assert.throws(() => registerTestDevice(f, "dev_unique_1"), { message: /already exists/ });
});
