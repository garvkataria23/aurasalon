import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp } from "../server/app.js";

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function headers({ tenantId = "tenant_aura", token = "" } = {}) {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": "owner",
    ...(token ? { authorization: `Bearer ${token}` } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, tenantId = "tenant_aura", token = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers({ tenantId, token }),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function data(payload) {
  return payload?.data ?? payload;
}

async function login(baseUrl) {
  const loginResponse = await api(baseUrl, "/auth/login", {
    method: "POST",
    body: {
      tenantId: "tenant_aura",
      email: "owner@aurasalon.example",
      password: process.env.DEMO_ADMIN_PASSWORD || "AuraOwner#2026"
    }
  });
  assert.equal(loginResponse.response.status, 201);
  const token = data(loginResponse.payload).accessToken;
  assert.ok(token);
  return token;
}

test("security shield routes expose 2FA, alerts and blocklist APIs", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api/v1`;
  try {
    const token = await login(baseUrl);

    const setup = await api(baseUrl, "/auth/2fa/setup", { method: "POST", token });
    assert.equal(setup.response.status, 200);
    assert.match(data(setup.payload).secret, /^[A-Z2-7]+$/);
    assert.match(data(setup.payload).provisioningUri, /^otpauth:\/\/totp\//);

    const status = await api(baseUrl, "/auth/2fa/status", { token });
    assert.equal(status.response.status, 200);
    assert.equal(data(status.payload).pendingSetup, true);

    const summary = await api(baseUrl, "/security/alerts/summary", { token });
    assert.equal(summary.response.status, 200);
    assert.equal(typeof Number(data(summary.payload).open || 0), "number");

    const alerts = await api(baseUrl, "/security/alerts?limit=20", { token });
    assert.equal(alerts.response.status, 200);
    assert.ok(Array.isArray(data(alerts.payload).alerts));

    const blocks = await api(baseUrl, "/security/blocklist?status=active&limit=100", { token });
    assert.equal(blocks.response.status, 200);
    assert.ok(Array.isArray(data(blocks.payload).blocks));
  } finally {
    await close(server);
  }
});

test("security shield pages and navigation are wired", () => {
  const routes = readFileSync("src/app/app.routes.ts", "utf8");
  const nav = readFileSync("src/app/app.component.ts", "utf8");
  const shield = readFileSync("src/app/pages/enterprise-security-shield.component.ts", "utf8");
  const twoFactor = readFileSync("src/app/pages/two-factor-setup.component.ts", "utf8");
  const blocklist = readFileSync("src/app/pages/security-blocklist.component.ts", "utf8");

  for (const path of ["enterprise-security-shield", "two-factor", "security-alerts", "security-blocklist", "security-policy-center"]) {
    assert.match(routes, new RegExp(`path: '${path}'`));
  }

  assert.match(nav, /Security Shield/);
  assert.match(nav, /Two-Factor Auth/);
  assert.match(nav, /Security Blocklist/);
  assert.match(shield, /28/);
  assert.match(shield, /routerLink="\/security-alerts"/);
  assert.match(twoFactor, /authenticator code or one-time recovery code/i);
  assert.match(blocklist, /security\/blocklist/);
});
