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

function ownerHeaders(branchId = "") {
  return {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner",
    ...(branchId ? { "x-branch-id": branchId } : {})
  };
}

function staffHeaders(token, branchId = "") {
  return {
    "content-type": "application/json",
    "authorization": `Bearer ${token}`,
    "x-tenant-id": "tenant_aura",
    ...(branchId ? { "x-branch-id": branchId } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, headers = ownerHeaders(), idempotency = false } = {}) {
  const requestHeaders = { ...headers };
  if (idempotency) {
    requestHeaders["Idempotency-Key"] = `staff-login-${Date.now()}-${Math.random().toString(16).slice(2)}`;
  }
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: requestHeaders,
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

async function firstResource(baseUrl, resource, predicate = () => true) {
  const { response, payload } = await api(baseUrl, `/${resource}?limit=1000`);
  assert.equal(response.status, 200);
  const row = payload.find(predicate);
  assert.ok(row?.id, `${resource} seed data is required`);
  return row;
}

test("staff login opens a self-only live appointment and work report", async () => {
  const server = await listen(createApp());
  const legacyBaseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const v1BaseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const branch = await firstResource(legacyBaseUrl, "branches");
    const service = await firstResource(legacyBaseUrl, "services", (item) => (item.status || "active") === "active");
    const stamp = Date.now();
    const loginId = `staff_login_${stamp}`;
    const password = `Staff@${stamp}!`;

    const createdStaff = await api(legacyBaseUrl, "/staff-os/staff", {
      method: "POST",
      headers: ownerHeaders(branch.id),
      body: {
        branchId: branch.id,
        employeeCode: `SELF-${stamp}`,
        firstName: "Self",
        lastName: "Report",
        mobile: `+9198${String(stamp).slice(-8)}`,
        designation: "Stylist",
        staffLogin: {
          enabled: true,
          loginId,
          password,
          role: "staff"
        }
      }
    });
    assert.equal(createdStaff.response.status, 201);
    assert.equal(createdStaff.payload.loginId, loginId);
    assert.equal(createdStaff.payload.loginPasswordSet, true);

    const login = await api(v1BaseUrl, "/auth/login", {
      method: "POST",
      body: {
        tenantId: "tenant_aura",
        loginId,
        password,
        branchId: branch.id
      }
    });
    assert.equal(login.response.status, 201);
    const loginData = login.payload.data;
    assert.equal(loginData.user.staffId, createdStaff.payload.id);

    const client = await api(legacyBaseUrl, "/clients", {
      method: "POST",
      body: {
        name: `Self Report Client ${stamp}`,
        phone: `+9197${String(stamp).slice(-8)}`,
        branchId: branch.id
      }
    });
    assert.equal(client.response.status, 201);

    const otherStaff = await api(legacyBaseUrl, "/staff", {
      method: "POST",
      body: {
        name: `Other Staff ${stamp}`,
        role: "Stylist",
        branchId: branch.id,
        phone: `+9196${String(stamp).slice(-8)}`,
        status: "active"
      }
    });
    assert.equal(otherStaff.response.status, 201);

    const start = new Date("2026-06-20T10:00:00.000Z");
    const liveAppointment = await api(legacyBaseUrl, "/appointments", {
      method: "POST",
      idempotency: true,
      body: {
        clientId: client.payload.id,
        staffId: createdStaff.payload.id,
        branchId: branch.id,
        serviceIds: [service.id],
        startAt: start.toISOString(),
        status: "booked"
      }
    });
    assert.equal(liveAppointment.response.status, 201);

    const completedStart = new Date("2026-06-21T11:00:00.000Z");
    const completedAppointment = await api(legacyBaseUrl, "/appointments", {
      method: "POST",
      idempotency: true,
      body: {
        clientId: client.payload.id,
        staffId: createdStaff.payload.id,
        branchId: branch.id,
        serviceIds: [service.id],
        startAt: completedStart.toISOString(),
        status: "completed"
      }
    });
    assert.equal(completedAppointment.response.status, 201);

    const otherAppointment = await api(legacyBaseUrl, "/appointments", {
      method: "POST",
      idempotency: true,
      body: {
        clientId: client.payload.id,
        staffId: otherStaff.payload.id,
        branchId: branch.id,
        serviceIds: [service.id],
        startAt: new Date("2026-06-20T12:00:00.000Z").toISOString(),
        status: "booked"
      }
    });
    assert.equal(otherAppointment.response.status, 201);

    const ownerLogin = await api(v1BaseUrl, "/auth/login", {
      method: "POST",
      body: {
        tenantId: "tenant_aura",
        email: "owner@aurasalon.example",
        password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026",
        branchId: branch.id
      }
    });
    assert.equal(ownerLogin.response.status, 201);
    const ownerDashboard = await api(legacyBaseUrl, "/staff-self/dashboard?from=2026-06-20&to=2026-06-22&date=2026-06-20", {
      headers: staffHeaders(ownerLogin.payload.data.accessToken, branch.id)
    });
    assert.equal(ownerDashboard.response.status, 200);
    assert.ok(ownerDashboard.payload.staff.id);

    const dashboard = await api(legacyBaseUrl, "/staff-self/dashboard?from=2026-06-20&to=2026-06-22&date=2026-06-20", {
      headers: staffHeaders(loginData.accessToken, branch.id)
    });
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.payload.staff.id, createdStaff.payload.id);
    assert.ok(dashboard.payload.liveAppointments.some((item) => item.id === liveAppointment.payload.id));
    assert.ok(dashboard.payload.workReport.some((item) => item.id === completedAppointment.payload.id));
    assert.ok(dashboard.payload.appointments.every((item) => item.staffId === createdStaff.payload.id));
    assert.ok(!dashboard.payload.appointments.some((item) => item.id === otherAppointment.payload.id));

    const forbiddenOtherStaff = await api(legacyBaseUrl, `/staff-self/dashboard?staffId=${otherStaff.payload.id}`, {
      headers: staffHeaders(loginData.accessToken, branch.id)
    });
    assert.equal(forbiddenOtherStaff.response.status, 403);
  } finally {
    await close(server);
  }
});
