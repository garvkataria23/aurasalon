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

function headers(role) {
  return {
    "content-type": "application/json",
    "x-tenant-id": "tenant_aura",
    "x-user-role": role
  };
}

test("staff cannot create services", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const response = await fetch(`${baseUrl}/services`, {
      method: "POST",
      headers: headers("staff"),
      body: JSON.stringify({ name: "X", category: "Hair", price: 100, durationMinutes: 30 })
    });
    assert.equal(response.status, 403);
  } finally {
    await close(server);
  }
});

test("owner can create services", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const response = await fetch(`${baseUrl}/services`, {
      method: "POST",
      headers: headers("owner"),
      body: JSON.stringify({ name: "X", category: "Hair", price: 100, durationMinutes: 30 })
    });
    assert.equal(response.status, 201);
  } finally {
    await close(server);
  }
});

test("analyst cannot delete clients", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const response = await fetch(`${baseUrl}/clients/client_riya`, {
      method: "DELETE",
      headers: headers("analyst")
    });
    assert.equal(response.status, 403);
  } finally {
    await close(server);
  }
});
