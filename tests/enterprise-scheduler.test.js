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

function headers(extra = {}) {
  return {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": "owner",
    "x-user-id": "enterprise-scheduler-test",
    ...extra
  };
}

async function api(baseUrl, path, { method = "GET", body, extraHeaders = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(extraHeaders),
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

function futureDate(days) {
  const date = new Date();
  date.setUTCDate(date.getUTCDate() + days);
  return date.toISOString().slice(0, 10);
}

test("enterprise scheduler supports windowed context, blocked time, multi-service booking and drag move", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const branch = await firstResource(baseUrl, "branches");
    const service = await firstResource(baseUrl, "services", (item) => (item.status || "active") === "active");
    const stamp = Date.now();
    const targetDate = futureDate(120);

    const staffOne = await api(baseUrl, "/staff", {
      method: "POST",
      body: {
        name: `Enterprise Scheduler A ${stamp}`,
        role: "Stylist",
        branchId: branch.id,
        phone: `+91 91000${String(stamp).slice(-5)}`,
        status: "active"
      }
    });
    assert.equal(staffOne.response.status, 201);

    const staffTwo = await api(baseUrl, "/staff", {
      method: "POST",
      body: {
        name: `Enterprise Scheduler B ${stamp}`,
        role: "Therapist",
        branchId: branch.id,
        phone: `+91 92000${String(stamp).slice(-5)}`,
        status: "active"
      }
    });
    assert.equal(staffTwo.response.status, 201);

    const client = await api(baseUrl, "/clients", {
      method: "POST",
      body: {
        name: `Enterprise Scheduler Client ${stamp}`,
        phone: `+91 93000${String(stamp).slice(-5)}`,
        branchId: branch.id
      }
    });
    assert.equal(client.response.status, 201);

    const context = await api(
      baseUrl,
      `/enterprise-scheduler/context?branchId=${branch.id}&date=${targetDate}&from=${targetDate}&to=${futureDate(121)}&staffLimit=1&staffSearch=${encodeURIComponent(String(stamp))}&clientLimit=25&serviceLimit=50`
    );
    assert.equal(context.response.status, 200);
    assert.equal(context.payload.staffWindow.limit, 1);
    assert.ok(context.payload.staffWindow.total >= 2);
    assert.ok(context.payload.clients.length <= 25);
    assert.ok(context.payload.services.length <= 50);

    const blocked = await api(baseUrl, "/enterprise-scheduler/blocked-times", {
      method: "POST",
      body: {
        branchId: branch.id,
        staffId: staffOne.payload.id,
        date: targetDate,
        startTime: "09:00",
        endTime: "09:15",
        reason: "Training"
      }
    });
    assert.equal(blocked.response.status, 201);
    assert.equal(blocked.payload.blockedTime.staffId, staffOne.payload.id);

    const removed = await api(baseUrl, `/enterprise-scheduler/blocked-times/${blocked.payload.blockedTime.id}`, { method: "DELETE" });
    assert.equal(removed.response.status, 200);
    assert.equal(removed.payload.deleted, true);

    const booking = await api(baseUrl, "/enterprise-scheduler/multi-service-bookings", {
      method: "POST",
      body: {
        branchId: branch.id,
        clientId: client.payload.id,
        status: "booked",
        notifyTargets: [],
        lines: [
          {
            serviceId: service.id,
            staffId: staffOne.payload.id,
            startAt: `${targetDate}T10:00:00.000Z`,
            durationMinutes: 30,
            chair: `Chair A ${stamp}`
          },
          {
            serviceId: service.id,
            staffId: staffTwo.payload.id,
            startAt: `${targetDate}T10:30:00.000Z`,
            durationMinutes: 45,
            chair: `Chair B ${stamp}`
          }
        ]
      }
    });
    assert.equal(booking.response.status, 201);
    assert.equal(booking.payload.appointments.length, 2);
    assert.equal(booking.payload.appointments[0].bookingGroupId, booking.payload.appointments[1].bookingGroupId);

    const moved = await api(baseUrl, `/enterprise-scheduler/appointments/${booking.payload.appointments[0].id}/move`, {
      method: "PATCH",
      body: {
        staffId: staffTwo.payload.id,
        startAt: `${targetDate}T12:00:00.000Z`,
        endAt: `${targetDate}T12:45:00.000Z`,
        reason: "Drag move test"
      }
    });
    assert.equal(moved.response.status, 200);
    assert.equal(moved.payload.appointment.staffId, staffTwo.payload.id);
    assert.equal(moved.payload.appointment.endAt, `${targetDate}T12:45:00.000Z`);
  } finally {
    await close(server);
  }
});
