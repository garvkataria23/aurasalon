import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp } from "../server/app.js";
import { db } from "../server/db.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

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
  const stamp = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, status, planId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run(id, `Tenant ${slug}`, slug, "active", plan?.id || null, stamp, stamp);
}

test("engagement foundation migration is additive, scoped, and delete-safe", () => {
  const migration = read("server/db/migrations/20260529_engagement_command_center_foundation.sql");
  for (const table of [
    "engagement_threads",
    "engagement_messages",
    "engagement_call_logs",
    "engagement_drafts",
    "engagement_templates",
    "engagement_assignments",
    "engagement_sla_events",
    "engagement_audit_logs",
    "engagement_client_alerts",
    "engagement_recovery_opportunities",
    "engagement_ai_summaries",
    "engagement_conversions",
    "engagement_provider_accounts"
  ]) {
    assert.match(migration, new RegExp(`CREATE TABLE IF NOT EXISTS ${table}`));
  }
  assert.match(migration, /tenant_id TEXT NOT NULL/g);
  assert.match(migration, /branch_id TEXT NOT NULL DEFAULT ''/g);
  assert.match(migration, /BEFORE DELETE ON engagement_threads/);
  assert.match(migration, /BEFORE UPDATE ON engagement_audit_logs/);
});

test("engagement unified inbox APIs are tenant scoped and no-fake-send", async () => {
  ensureTenant("tenant_engagement_other", "engagement-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_eng_${Date.now()}`;
  try {
    const created = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: {
        branchId,
        type: "whatsapp",
        clientId: `client_eng_${Date.now()}`,
        subject: "Client recovery",
        displayName: "AFTAB TEST",
        phone: "9999999999"
      }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.type, "whatsapp");
    assert.equal(created.payload.status, "open");

    const assigned = await api(baseUrl, `/engagement/threads/${created.payload.id}/assign`, {
      method: "PATCH",
      branchId,
      body: { assignedTo: "staff_front_desk", reason: "Front desk ownership" }
    });
    assert.equal(assigned.response.status, 200);
    assert.equal(assigned.payload.assignedTo, "staff_front_desk");

    const status = await api(baseUrl, `/engagement/threads/${created.payload.id}/status`, {
      method: "PATCH",
      branchId,
      body: { status: "pending", reason: "Waiting for manager review" }
    });
    assert.equal(status.response.status, 200);
    assert.equal(status.payload.status, "pending");

    const draft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: {
        threadId: created.payload.id,
        body: "Namaste, aapki appointment recovery ke liye ye draft hai.",
        channel: "whatsapp",
        optOutChecked: true
      }
    });
    assert.equal(draft.response.status, 201);
    assert.equal(draft.payload.message.status, "draft");
    assert.equal(draft.payload.message.approvalStatus, "pending");

    const approved = await api(baseUrl, `/engagement/messages/${draft.payload.message.id}/approve`, {
      method: "POST",
      branchId,
      body: { note: "Approved by owner" }
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.payload.approvalStatus, "approved");

    const blockedSend = await api(baseUrl, `/engagement/messages/${draft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      body: {}
    });
    assert.equal(blockedSend.response.status, 200);
    assert.equal(blockedSend.payload.status, "pending_send");
    assert.equal(blockedSend.payload.deliveryStatus, "pending");
    assert.match(blockedSend.payload.failureReason, /provider|pending|adapter/i);

    const detail = await api(baseUrl, `/engagement/threads/${created.payload.id}`, { branchId });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.payload.thread.id, created.payload.id);
    assert.ok(detail.payload.messages.length >= 1);
    assert.ok(detail.payload.auditTrail.some((item) => item.action === "engagement.message.send_pending"));

    const messages = await api(baseUrl, `/engagement/messages?threadId=${created.payload.id}`, { branchId });
    assert.equal(messages.response.status, 200);
    assert.ok(messages.payload.some((item) => item.id === draft.payload.message.id));

    const rejectedDraft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: { threadId: created.payload.id, body: "Second draft for rejection", channel: "whatsapp" }
    });
    assert.equal(rejectedDraft.response.status, 201);
    const rejected = await api(baseUrl, `/engagement/messages/${rejectedDraft.payload.message.id}/reject`, {
      method: "POST",
      branchId,
      body: { reason: "Tone not approved" }
    });
    assert.equal(rejected.response.status, 200);
    assert.equal(rejected.payload.approvalStatus, "rejected");

    const otherTenantThreads = await api(baseUrl, `/engagement/threads?branchId=${branchId}`, {
      tenantId: "tenant_engagement_other",
      branchId
    });
    assert.equal(otherTenantThreads.response.status, 200);
    assert.equal(otherTenantThreads.payload.length, 0);
  } finally {
    await close(server);
  }
});

test("engagement provider readiness keeps adapters disabled by default and send pending", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_provider_${Date.now()}`;
  try {
    const readiness = await api(baseUrl, "/engagement/providers/readiness", { branchId });
    assert.equal(readiness.response.status, 200);
    assert.ok(readiness.payload.providers.some((provider) => provider.providerName === "whatsapp_cloud"));
    assert.ok(readiness.payload.providers.some((provider) => provider.providerName === "gupshup"));
    assert.ok(readiness.payload.providers.some((provider) => provider.providerName === "interakt"));
    assert.ok(readiness.payload.providers.some((provider) => provider.providerName === "twilio"));
    assert.ok(readiness.payload.providers.some((provider) => provider.providerName === "email_smtp"));
    assert.equal(readiness.payload.summary.directSendReady, 0);
    assert.equal(readiness.payload.summary.disabledByDefault, true);

    const configured = await api(baseUrl, "/engagement/providers/config", {
      method: "POST",
      branchId,
      body: {
        branchId,
        providerName: "whatsapp_cloud",
        status: "active",
        senderId: "919999999999",
        templateNamespace: "aurashine_namespace",
        webhookUrl: "https://example.com/webhooks/whatsapp"
      }
    });
    assert.equal(configured.response.status, 201);
    assert.equal(configured.payload.configComplete, true);
    assert.equal(configured.payload.providerConfigured, false);
    assert.equal(configured.payload.sendMode, "pending_send_only");
    assert.equal(configured.payload.directSendEnabled, false);

    const verified = await api(baseUrl, `/engagement/providers/${configured.payload.accountId}/verify`, {
      method: "POST",
      branchId,
      body: { note: "Readiness check only" }
    });
    assert.equal(verified.response.status, 200);
    assert.ok(verified.payload.lastVerifiedAt);
    assert.match(verified.payload.lastHealthStatus, /readiness_verified/);

    const thread = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: {
        branchId,
        type: "whatsapp",
        subject: "Provider pending send",
        displayName: "Provider Client",
        phone: "919999999999"
      }
    });
    assert.equal(thread.response.status, 201);
    const draft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: { threadId: thread.payload.id, body: "Provider readiness test", channel: "whatsapp", optOutChecked: true }
    });
    assert.equal(draft.response.status, 201);
    const approved = await api(baseUrl, `/engagement/messages/${draft.payload.message.id}/approve`, {
      method: "POST",
      branchId,
      body: { note: "Provider readiness approval" }
    });
    assert.equal(approved.response.status, 200);
    const send = await api(baseUrl, `/engagement/messages/${draft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      body: {}
    });
    assert.equal(send.response.status, 200);
    assert.equal(send.payload.status, "pending_send");
    assert.equal(send.payload.deliveryStatus, "pending");
    assert.equal(send.payload.providerAccountId, configured.payload.accountId);
    assert.match(send.payload.failureReason, /direct send adapter is disabled|pending/i);

    const audit = await api(baseUrl, `/engagement/audit?entityId=${configured.payload.accountId}&limit=50`, { branchId });
    assert.equal(audit.response.status, 200);
    assert.ok(audit.payload.some((row) => row.action === "engagement.provider.configured"));
    assert.ok(audit.payload.some((row) => row.action === "engagement.provider.readiness_verified"));
  } finally {
    await close(server);
  }
});

test("engagement enterprise controls enforce approvals, opt-out, DNC and quiet hours", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const branchId = `branch_eng_controls_${suffix}`;
  try {
    const thread = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: {
        branchId,
        type: "whatsapp",
        source: "manual",
        subject: "Enterprise control thread",
        displayName: "Control Client",
        phone: "9000000001"
      }
    });
    assert.equal(thread.response.status, 201);

    const sensitiveDraft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      role: "staff",
      body: {
        threadId: thread.payload.id,
        body: "Your payment due pending balance is Rs 500. Please pay now.",
        channel: "whatsapp",
        approvalRequired: false,
        optOutChecked: true,
        metadata: { quietHours: { enabled: false } }
      }
    });
    assert.equal(sensitiveDraft.response.status, 201);
    assert.equal(sensitiveDraft.payload.message.approvalStatus, "pending");
    assert.equal(sensitiveDraft.payload.message.metadata.enterpriseControls.draftOnlyRole, true);
    assert.ok(sensitiveDraft.payload.message.metadata.enterpriseControls.sensitiveTypes.includes("payment_due"));

    const staffApproval = await api(baseUrl, `/engagement/messages/${sensitiveDraft.payload.message.id}/approve`, {
      method: "POST",
      branchId,
      role: "staff",
      body: { note: "Staff tried approval" }
    });
    assert.equal(staffApproval.response.status, 403);

    const managerApproval = await api(baseUrl, `/engagement/messages/${sensitiveDraft.payload.message.id}/approve`, {
      method: "POST",
      branchId,
      role: "manager",
      body: { note: "Manager approved sensitive message" }
    });
    assert.equal(managerApproval.response.status, 200);
    assert.equal(managerApproval.payload.approvalStatus, "approved");

    const staffSend = await api(baseUrl, `/engagement/messages/${sensitiveDraft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      role: "staff",
      body: {}
    });
    assert.equal(staffSend.response.status, 403);

    const ownerSend = await api(baseUrl, `/engagement/messages/${sensitiveDraft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      role: "owner",
      body: {}
    });
    assert.equal(ownerSend.response.status, 200);
    assert.equal(ownerSend.payload.status, "pending_send");

    const broadcastDraft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      role: "owner",
      body: {
        threadId: thread.payload.id,
        body: "Monthly membership update for all clients.",
        channel: "whatsapp",
        approvalRequired: false,
        optOutChecked: true,
        metadata: { broadcast: true, quietHours: { enabled: false } }
      }
    });
    assert.equal(broadcastDraft.response.status, 201);
    assert.equal(broadcastDraft.payload.message.approvalStatus, "pending");

    const frontDeskBroadcastApproval = await api(baseUrl, `/engagement/messages/${broadcastDraft.payload.message.id}/approve`, {
      method: "POST",
      branchId,
      role: "frontDesk",
      body: { note: "Front desk tried broadcast approval" }
    });
    assert.equal(frontDeskBroadcastApproval.response.status, 403);

    const managerBroadcastApproval = await api(baseUrl, `/engagement/messages/${broadcastDraft.payload.message.id}/approve`, {
      method: "POST",
      branchId,
      role: "manager",
      body: { note: "Manager approved broadcast" }
    });
    assert.equal(managerBroadcastApproval.response.status, 200);

    const optOutDraft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        body: "Regular WhatsApp reply",
        channel: "whatsapp",
        approvalRequired: false,
        optOutChecked: false,
        metadata: { quietHours: { enabled: false } }
      }
    });
    assert.equal(optOutDraft.response.status, 201);
    const optOutSend = await api(baseUrl, `/engagement/messages/${optOutDraft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      body: {}
    });
    assert.equal(optOutSend.response.status, 200);
    assert.equal(optOutSend.payload.status, "send_blocked");
    assert.match(optOutSend.payload.failureReason, /opt-out/i);

    const dncDraft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        body: "Regular email reply",
        channel: "email",
        approvalRequired: false,
        metadata: { doNotContact: true, quietHours: { enabled: false } }
      }
    });
    assert.equal(dncDraft.response.status, 201);
    const dncSend = await api(baseUrl, `/engagement/messages/${dncDraft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      body: {}
    });
    assert.equal(dncSend.response.status, 200);
    assert.equal(dncSend.payload.status, "send_blocked");
    assert.match(dncSend.payload.failureReason, /do-not-contact/i);

    const quietDraft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        body: "Regular quiet-hours reply",
        channel: "sms",
        approvalRequired: false,
        metadata: { quietHours: { enabled: true, startHour: 0, endHour: 23, currentHour: 12 } }
      }
    });
    assert.equal(quietDraft.response.status, 201);
    const quietSend = await api(baseUrl, `/engagement/messages/${quietDraft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      body: {}
    });
    assert.equal(quietSend.response.status, 200);
    assert.equal(quietSend.payload.status, "send_blocked");
    assert.match(quietSend.payload.failureReason, /Quiet hours/i);
  } finally {
    await close(server);
  }
});

test("engagement communication audit ledger is immutable and queryable", async () => {
  ensureTenant("tenant_eng_audit_other", "eng-audit-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const branchId = `branch_eng_audit_${suffix}`;
  const clientId = `client_eng_audit_${suffix}`;
  const stamp = new Date().toISOString();
  db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
    VALUES (?, 'Engagement Audit Branch', 'Mumbai', 'active', ?, ?, 'tenant_aura')`).run(branchId, stamp, stamp);
  db.prepare(`INSERT OR IGNORE INTO clients (id, name, phone, email, branchId, createdAt, updatedAt, tenantId)
    VALUES (?, 'Audit Client', '9888898888', 'audit-client@example.com', ?, ?, ?, 'tenant_aura')`)
    .run(clientId, branchId, stamp, stamp);
  try {
    const thread = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: {
        branchId,
        type: "whatsapp",
        clientId,
        subject: "Audit ledger flow",
        displayName: "Audit Client",
        phone: "9888898888"
      }
    });
    assert.equal(thread.response.status, 201);

    const assigned = await api(baseUrl, `/engagement/threads/${thread.payload.id}/assign`, {
      method: "PATCH",
      branchId,
      body: { assignedTo: "audit_staff", reason: "Audit ownership" }
    });
    assert.equal(assigned.response.status, 200);

    const template = await api(baseUrl, "/engagement/templates", {
      method: "POST",
      branchId,
      body: {
        branchId,
        name: `Audit template ${suffix}`,
        templateKey: `audit_template_${suffix}`,
        channel: "whatsapp",
        category: "audit",
        body: "Hi {{client_name}}, this is an audited engagement note.",
        status: "active",
        approvalStatus: "approved"
      }
    });
    assert.equal(template.response.status, 201);

    const rendered = await api(baseUrl, `/engagement/templates/${template.payload.id}/render`, {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        clientId,
        variables: { client_name: "Audit Client" }
      }
    });
    assert.equal(rendered.response.status, 200);
    assert.match(rendered.payload.renderedBody, /Audit Client/);

    const draft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        clientId,
        body: rendered.payload.renderedBody,
        channel: "whatsapp",
        optOutChecked: true
      }
    });
    assert.equal(draft.response.status, 201);

    const approved = await api(baseUrl, `/engagement/messages/${draft.payload.message.id}/approve`, {
      method: "POST",
      branchId,
      body: { note: "Audit approval" }
    });
    assert.equal(approved.response.status, 200);

    const send = await api(baseUrl, `/engagement/messages/${draft.payload.message.id}/send`, {
      method: "POST",
      branchId,
      body: {}
    });
    assert.equal(send.response.status, 200);
    assert.equal(send.payload.status, "pending_send");

    const status = await api(baseUrl, `/engagement/threads/${thread.payload.id}/status`, {
      method: "PATCH",
      branchId,
      body: { status: "pending", reason: "Audit status update" }
    });
    assert.equal(status.response.status, 200);

    const ledger = await api(baseUrl, `/engagement/audit?threadId=${thread.payload.id}&limit=100`, { branchId });
    assert.equal(ledger.response.status, 200);
    const actions = new Set(ledger.payload.map((item) => item.action));
    for (const action of [
      "engagement.thread.created",
      "engagement.thread.assigned",
      "engagement.template.rendered",
      "engagement.message.draft_created",
      "engagement.message.approved",
      "engagement.message.send_attempted",
      "engagement.message.send_pending",
      "engagement.thread.status_updated"
    ]) {
      assert.ok(actions.has(action), `missing audit action ${action}`);
    }
    const sample = ledger.payload.find((item) => item.action === "engagement.message.send_attempted");
    assert.equal(sample.tenantId, "tenant_aura");
    assert.equal(sample.branchId, branchId);
    assert.equal(sample.clientId, clientId);
    assert.ok(sample.actorUserId);
    assert.ok(sample.actorRole);
    assert.ok(sample.createdAt);
    assert.equal(typeof sample.before, "object");
    assert.equal(typeof sample.after, "object");

    const filtered = await api(baseUrl, "/engagement/audit?action=engagement.message.send_pending", { branchId });
    assert.equal(filtered.response.status, 200);
    assert.ok(filtered.payload.some((item) => item.threadId === thread.payload.id && item.action === "engagement.message.send_pending"));

    const otherTenant = await api(baseUrl, `/engagement/audit?threadId=${thread.payload.id}`, {
      tenantId: "tenant_eng_audit_other",
      branchId
    });
    assert.equal(otherTenant.response.status, 200);
    assert.equal(otherTenant.payload.length, 0);

    const auditRow = db.prepare("SELECT id FROM engagement_audit_logs WHERE tenant_id = ? AND thread_id = ? LIMIT 1").get("tenant_aura", thread.payload.id);
    assert.ok(auditRow?.id);
    assert.throws(
      () => db.prepare("UPDATE engagement_audit_logs SET severity = 'debug' WHERE id = ?").run(auditRow.id),
      /immutable/
    );
    assert.throws(
      () => db.prepare("DELETE FROM engagement_audit_logs WHERE id = ?").run(auditRow.id),
      /immutable/
    );
  } finally {
    await close(server);
  }
});

test("engagement smart template APIs are tenant scoped and validate render variables", async () => {
  ensureTenant("tenant_template_other", "template-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const branchId = `branch_template_${suffix}`;
  try {
    const templates = await api(baseUrl, "/engagement/templates?channel=whatsapp", { branchId });
    assert.equal(templates.response.status, 200);
    assert.ok(templates.payload.some((item) => item.templateKey === "appointment_confirmation"));
    assert.ok(templates.payload.some((item) => item.templateKey === "negative_review_recovery"));
    assert.ok(templates.payload.every((item) => ["pending", "approved", "rejected"].includes(item.approvalStatus)));

    const created = await api(baseUrl, "/engagement/templates", {
      method: "POST",
      branchId,
      body: {
        branchId,
        name: `Payment link ${suffix}`,
        templateKey: `payment_link_${suffix}`,
        channel: "whatsapp",
        category: "payment",
        body: "Hi {{client_name}}, due {{due_amount}} can be paid at {{payment_link}}.",
        status: "draft",
        approvalStatus: "pending"
      }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.branchId, branchId);
    assert.deepEqual(created.payload.variables.sort(), ["client_name", "due_amount", "payment_link"].sort());
    assert.equal(created.payload.approvalStatus, "pending");

    const updated = await api(baseUrl, `/engagement/templates/${created.payload.id}`, {
      method: "PATCH",
      branchId,
      body: { status: "active", approvalStatus: "approved", purpose: "Collect due payment" }
    });
    assert.equal(updated.response.status, 200);
    assert.equal(updated.payload.status, "active");
    assert.equal(updated.payload.approvalStatus, "approved");
    assert.equal(updated.payload.version, created.payload.version + 1);

    const missing = await api(baseUrl, `/engagement/templates/${created.payload.id}/render`, {
      method: "POST",
      branchId,
      body: { variables: { client_name: "AFTAB", due_amount: "Rs 500" } }
    });
    assert.equal(missing.response.status, 400);
    assert.match(missing.payload.error, /missing/i);
    assert.ok(missing.payload.details.missingVariables.includes("payment_link"));

    const rendered = await api(baseUrl, `/engagement/templates/${created.payload.id}/render`, {
      method: "POST",
      branchId,
      body: { variables: { client_name: "AFTAB", due_amount: "Rs 500", payment_link: "https://pay.example/aftab" } }
    });
    assert.equal(rendered.response.status, 200);
    assert.equal(rendered.payload.renderedBody, "Hi AFTAB, due Rs 500 can be paid at https://pay.example/aftab.");
    assert.equal(rendered.payload.template.id, created.payload.id);

    const otherTenantRender = await api(baseUrl, `/engagement/templates/${created.payload.id}/render`, {
      method: "POST",
      tenantId: "tenant_template_other",
      branchId,
      body: { variables: { client_name: "AFTAB", due_amount: "Rs 500", payment_link: "x" } }
    });
    assert.equal(otherTenantRender.response.status, 404);
  } finally {
    await close(server);
  }
});

test("engagement client 360 API aggregates live client, membership, invoice and appointment data", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const stamp = new Date().toISOString();
  const suffix = Date.now();
  const branchId = `branch_client360_${suffix}`;
  const clientId = `client_360_${suffix}`;
  const staffId = `staff_360_${suffix}`;
  const serviceId = `svc_360_${suffix}`;
  const planId = `plan_360_${suffix}`;
  const saleId = `sale_360_${suffix}`;
  const pastStart = new Date(Date.now() - 86400000 * 6).toISOString();
  const upcomingStart = new Date(Date.now() + 86400000 * 5).toISOString();
  const packageExpiry = new Date(Date.now() + 86400000 * 10).toISOString();
  try {
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, ?, ?, 'active', ?, ?, ?)`).run(branchId, "Client 360 Branch", "Mumbai", stamp, stamp, "tenant_aura");
    db.prepare(`INSERT OR IGNORE INTO staff
      (id, name, role, phone, email, branchId, shift, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Asha Stylist', 'staff', '9000000001', 'asha@example.com', ?, '{}', 'active', ?, ?, ?)`)
      .run(staffId, branchId, stamp, stamp, "tenant_aura");
    db.prepare(`INSERT OR IGNORE INTO services
      (id, name, category, price, durationMinutes, assignedStaff, requiredProducts, addOns, packageServices, gstRate, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Hair Spa', 'Hair', 1200, 60, '[]', '[]', '[]', '[]', 18, 'active', ?, ?, ?)`)
      .run(serviceId, stamp, stamp, "tenant_aura");
    db.prepare(`INSERT INTO clients
      (id, name, phone, email, branchId, tags, notes, walletBalance, loyaltyPoints, totalSpend, visitCount, lastVisitAt,
       preferences, allergies, safetyFlags, communicationPreferences, preferredChannel, noShowCount, cancellationCount,
       tier, createdAt, updatedAt, tenantId)
      VALUES (?, 'AFTAB 360', '9999900000', 'aftab360@example.com', ?, '["VIP"]', 'Sensitive scalp note', 750, 420, 30000, 8, ?,
       '{"hairType":"dry"}', '["ammonia"]', '{"profileAlert":true}', '{"whatsapp":true}', 'whatsapp', 1, 0,
       'gold', ?, ?, 'tenant_aura')`)
      .run(clientId, branchId, pastStart, stamp, stamp);
    db.prepare(`INSERT INTO appointments
      (id, clientId, staffId, branchId, serviceIds, startAt, endAt, status, notes, billable, createdAt, updatedAt, tenantId, noShowRiskScore)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'completed', 'Past visit', 1, ?, ?, 'tenant_aura', 15)`)
      .run(`appt_past_${suffix}`, clientId, staffId, branchId, JSON.stringify([serviceId]), pastStart, pastStart, stamp, stamp);
    db.prepare(`INSERT INTO appointments
      (id, clientId, staffId, branchId, serviceIds, startAt, endAt, status, notes, billable, createdAt, updatedAt, tenantId, noShowRiskScore)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'booked', 'Future visit', 1, ?, ?, 'tenant_aura', 75)`)
      .run(`appt_upcoming_${suffix}`, clientId, staffId, branchId, JSON.stringify([serviceId]), upcomingStart, upcomingStart, stamp, stamp);
    db.prepare(`INSERT INTO sales
      (id, clientId, appointmentId, branchId, staffId, items, subtotal, discount, gstAmount, total, commissionTotal,
       membershipRedeem, splitPayments, status, createdAt, updatedAt, tenantId)
      VALUES (?, ?, '', ?, ?, ?, 20000, 0, 0, 20000, 0, '{}', '[]', 'completed', ?, ?, 'tenant_aura')`)
      .run(
        saleId,
        clientId,
        branchId,
        staffId,
        JSON.stringify([{ type: "package", name: "Glow Reset Package", expiresOn: packageExpiry, credits: 4, remainingCredits: 2 }]),
        stamp,
        stamp
      );
    db.prepare(`INSERT INTO invoices
      (id, saleId, clientId, invoiceNumber, lineItems, subtotal, discount, gstAmount, total, paid, balance, status,
       dueDate, createdAt, updatedAt, tenantId, branchId, staffId, tenant_id, branch_id, invoice_no, customer_id,
       grand_total, paid_amount, due_amount, payment_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 20000, 0, 0, 20000, 15000, 5000, 'partial',
       ?, ?, ?, 'tenant_aura', ?, ?, 'tenant_aura', ?, ?, ?, 20000, 15000, 5000, 'partial', ?, ?)`)
      .run(
        `inv_360_${suffix}`,
        saleId,
        clientId,
        `INV-360-${suffix}`,
        JSON.stringify([{ type: "package", name: "Glow Reset Package", expiresOn: packageExpiry, credits: 4, remainingCredits: 2 }]),
        packageExpiry,
        stamp,
        stamp,
        branchId,
        staffId,
        branchId,
        `INV-360-${suffix}`,
        clientId,
        stamp,
        stamp
      );
    db.prepare(`INSERT OR IGNORE INTO membership_plans
      (id, tenant_id, branch_id, code, name, price, validity_days, status, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, 'Aura Gold 30%', 2999, 365, 'active', ?, ?)`)
      .run(planId, branchId, `GOLD-${suffix}`, stamp, stamp);
    db.prepare(`INSERT INTO client_membership_ledger
      (id, tenant_id, branch_id, client_id, membership_id, plan_id, action, amount, paid_amount, credits_before,
       credits_after, starts_on, expires_on, snapshot_json, note, actor_user_id, created_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, 'sold', 2999, 2999, 0, 5, ?, ?, ?, 'Membership sold', 'owner', ?)`)
      .run(
        `ledger_360_${suffix}`,
        branchId,
        clientId,
        `member_360_${suffix}`,
        planId,
        stamp.slice(0, 10),
        new Date(Date.now() + 86400000 * 120).toISOString().slice(0, 10),
        JSON.stringify({ planName: "Aura Gold 30%" }),
        stamp
      );

    const result = await api(baseUrl, `/engagement/clients/${clientId}/360`, { branchId });
    assert.equal(result.response.status, 200);
    assert.equal(result.payload.client.name, "AFTAB 360");
    assert.equal(result.payload.branch.name, "Client 360 Branch");
    assert.equal(result.payload.membership.activeMembership.planName, "Aura Gold 30%");
    assert.equal(result.payload.package.activePackage.name, "Glow Reset Package");
    assert.equal(result.payload.wallet.balance, 750);
    assert.equal(result.payload.loyalty.points, 420);
    assert.equal(result.payload.balance.dueAmount, 5000);
    assert.equal(result.payload.appointments.upcoming.length, 1);
    assert.equal(result.payload.invoices.past[0].invoiceNumber, `INV-360-${suffix}`);
    assert.ok(result.payload.preferences.preferredStaff.some((item) => item.name === "Asha Stylist"));
    assert.ok(result.payload.preferences.preferredServices.some((item) => item.name === "Hair Spa"));
    assert.ok(result.payload.tags.some((item) => item.label === "High spender"));
    assert.ok(result.payload.tags.some((item) => item.label === "Member"));
    assert.ok(result.payload.tags.some((item) => item.label === "Due balance"));
    assert.ok(result.payload.tags.some((item) => item.label === "No-show risk"));
    assert.ok(result.payload.tags.some((item) => item.label === "Package expiring"));

    const aiSummary = await api(baseUrl, `/engagement/clients/${clientId}/ai-summary`, {
      method: "POST",
      branchId,
      body: { providerFallbackReason: "Test deterministic summary" }
    });
    assert.equal(aiSummary.response.status, 201);
    assert.match(aiSummary.payload.summaryText, /AFTAB 360/);
    assert.equal(aiSummary.payload.modelProvider, "local_deterministic");
    assert.equal(aiSummary.payload.modelName, "aura-engagement-local-v1");
    assert.equal(aiSummary.payload.version, 1);
    assert.ok(aiSummary.payload.generatedAt);
    assert.ok(aiSummary.payload.confidence > 0);
    assert.ok(aiSummary.payload.insights.some((item) => item.title === "Recent visits"));
    assert.ok(aiSummary.payload.suggestions.some((item) => item.title === "Likely upsell"));
    assert.ok(aiSummary.payload.alerts.some((item) => item.title === "Due balance"));
    assert.ok(aiSummary.payload.risks.some((item) => item.title === "Payment follow-up risk"));
    assert.ok(aiSummary.payload.nextBestActions.length >= 1);
    const stored = db.prepare("SELECT * FROM engagement_ai_summaries WHERE tenant_id = ? AND id = ?").get("tenant_aura", aiSummary.payload.id);
    assert.equal(stored.client_id, clientId);
    assert.equal(stored.branch_id, branchId);
    assert.equal(stored.generated_by, "system-user");
  } finally {
    await close(server);
  }
});

test("engagement booking wizard previews slots, creates appointment and records conversation event", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const stamp = new Date().toISOString();
  const branchId = `branch_eng_booking_${suffix}`;
  const clientId = `client_eng_booking_${suffix}`;
  const staffId = `staff_eng_booking_${suffix}`;
  const serviceId = `svc_eng_booking_${suffix}`;
  const saleId = `sale_eng_booking_${suffix}`;
  const startDate = new Date(Date.now() + 55 * 86400000).toISOString().slice(0, 10);
  try {
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Booking Branch', 'Mumbai', 'active', ?, ?, 'tenant_aura')`).run(branchId, stamp, stamp);
    db.prepare(`INSERT INTO clients
      (id, name, phone, email, branchId, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Booker', '9000090000', 'booker@example.com', ?, ?, ?, 'tenant_aura')`)
      .run(clientId, branchId, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO staff
      (id, name, role, phone, email, branchId, shift, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Stylist', 'staff', '9000011111', 'engstaff@example.com', ?, '{}', 'active', ?, ?, 'tenant_aura')`)
      .run(staffId, branchId, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO services
      (id, name, category, price, durationMinutes, assignedStaff, requiredProducts, addOns, packageServices, gstRate, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Hair Spa', 'Hair', 1500, 60, '[]', '[]', '[]', '[]', 18, 'active', ?, ?, 'tenant_aura')`)
      .run(serviceId, stamp, stamp);
    db.prepare(`INSERT INTO sales
      (id, clientId, appointmentId, branchId, staffId, items, subtotal, discount, gstAmount, total, commissionTotal,
       membershipRedeem, splitPayments, status, createdAt, updatedAt, tenantId)
      VALUES (?, ?, '', ?, ?, '[]', 500, 0, 0, 500, 0, '{}', '[]', 'completed', ?, ?, 'tenant_aura')`)
      .run(saleId, clientId, branchId, staffId, stamp, stamp);
    db.prepare(`INSERT INTO invoices
      (id, saleId, clientId, invoiceNumber, lineItems, subtotal, discount, gstAmount, total, paid, balance, status,
       createdAt, updatedAt, tenantId, branchId, tenant_id, branch_id, invoice_no, customer_id,
       grand_total, paid_amount, due_amount, payment_status, created_at, updated_at)
      VALUES (?, ?, ?, ?, '[]', 500, 0, 0, 500, 0, 500, 'due',
       ?, ?, 'tenant_aura', ?, 'tenant_aura', ?, ?, ?, 500, 0, 500, 'due', ?, ?)`)
      .run(`inv_eng_booking_${suffix}`, saleId, clientId, `INV-ENG-${suffix}`, stamp, stamp, branchId, branchId, `INV-ENG-${suffix}`, clientId, stamp, stamp);

    const thread = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: {
        branchId,
        type: "whatsapp",
        clientId,
        subject: "Book from chat",
        displayName: "Engagement Booker",
        phone: "9000090000"
      }
    });
    assert.equal(thread.response.status, 201);

    const preview = await api(baseUrl, "/engagement/booking/slot-preview", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        clientId,
        branchId,
        serviceIds: [serviceId],
        staffId,
        date: startDate,
        durationMinutes: 60
      }
    });
    assert.equal(preview.response.status, 200);
    assert.ok(preview.payload.suggestedSlots.length > 0);
    assert.equal(preview.payload.dueAmount, 500);
    assert.match(preview.payload.dueAmountWarning, /pending due/i);

    const slot = preview.payload.suggestedSlots[0];
    const created = await api(baseUrl, "/engagement/booking/create", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        clientId,
        branchId,
        serviceIds: [serviceId],
        staffId,
        slot,
        startAt: slot.startAt,
        endAt: slot.endAt,
        roomResource: slot.chair,
        familyBooking: true,
        numberOfGuests: 2,
        appointmentCategory: "service",
        notes: "Booked from engagement test"
      }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.appointment.clientId, clientId);
    assert.equal(created.payload.appointment.staffId, staffId);
    assert.equal(created.payload.appointment.sourceChannel, "engagement");
    assert.ok(created.payload.event.id);

    const duplicate = await api(baseUrl, "/engagement/booking/create", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        clientId,
        branchId,
        serviceIds: [serviceId],
        staffId,
        slot,
        startAt: slot.startAt,
        endAt: slot.endAt,
        roomResource: slot.chair
      }
    });
    assert.equal(duplicate.response.status, 409);

    const detail = await api(baseUrl, `/engagement/threads/${thread.payload.id}`, { branchId });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.payload.thread.appointmentId, created.payload.appointment.id);
    assert.ok(detail.payload.messages.some((item) => item.eventType === "appointment_booked" && item.appointmentId === created.payload.appointment.id));
    assert.ok(detail.payload.auditTrail.some((item) => item.action === "engagement.booking.created"));
  } finally {
    await close(server);
  }
});

test("engagement recovery opportunities detect, assign, draft and mark done", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const stamp = new Date().toISOString();
  const oldVisit = new Date(Date.now() - 120 * 86400000).toISOString();
  const expiry = new Date(Date.now() + 5 * 86400000).toISOString();
  const branchId = `branch_eng_recovery_${suffix}`;
  const clientId = `client_eng_recovery_${suffix}`;
  const staffId = `staff_eng_recovery_${suffix}`;
  const serviceId = `svc_eng_recovery_${suffix}`;
  const appointmentId = `appt_eng_recovery_${suffix}`;
  const saleId = `sale_eng_recovery_${suffix}`;
  const invoiceId = `inv_eng_recovery_${suffix}`;
  const callId = `call_eng_recovery_${suffix}`;
  const membershipId = `mem_eng_recovery_${suffix}`;
  const platformId = `rplat_eng_recovery_${suffix}`;
  const reviewId = `review_eng_recovery_${suffix}`;
  try {
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Recovery Branch', 'Mumbai', 'active', ?, ?, 'tenant_aura')`).run(branchId, stamp, stamp);
    db.prepare(`INSERT INTO clients
      (id, name, phone, email, branchId, walletBalance, totalSpend, visitCount, lastVisitAt, createdAt, updatedAt, tenantId)
      VALUES (?, 'Recovery Client', '9333393333', 'recovery@example.com', ?, 1200, 32000, 8, ?, ?, ?, 'tenant_aura')`)
      .run(clientId, branchId, oldVisit, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO staff
      (id, name, role, phone, email, branchId, shift, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Recovery Staff', 'staff', '9444494444', 'recoverystaff@example.com', ?, '{}', 'active', ?, ?, 'tenant_aura')`)
      .run(staffId, branchId, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO services
      (id, name, category, price, durationMinutes, assignedStaff, requiredProducts, addOns, packageServices, gstRate, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Recovery Hair Spa', 'Hair', 2200, 60, '[]', '[]', '[]', '[]', 18, 'active', ?, ?, 'tenant_aura')`)
      .run(serviceId, stamp, stamp);
    db.prepare(`INSERT INTO appointments
      (id, clientId, staffId, branchId, serviceIds, startAt, endAt, status, source, chair, room, notes, billable, createdAt, updatedAt, tenantId)
      VALUES (?, ?, ?, ?, ?, ?, ?, 'no_show', 'front_desk', 'Chair 1', 'Room 1', 'Client missed slot', 1, ?, ?, 'tenant_aura')`)
      .run(appointmentId, clientId, staffId, branchId, JSON.stringify([serviceId]), oldVisit, oldVisit, stamp, stamp);
    db.prepare(`INSERT INTO sales
      (id, clientId, appointmentId, branchId, staffId, items, subtotal, discount, gstAmount, total, status, createdAt, updatedAt, tenantId)
      VALUES (?, ?, ?, ?, ?, ?, 5000, 0, 0, 5000, 'completed', ?, ?, 'tenant_aura')`)
      .run(saleId, clientId, appointmentId, branchId, staffId, JSON.stringify([{ serviceId, name: "Recovery Hair Spa", price: 5000 }]), stamp, stamp);
    db.prepare(`INSERT INTO invoices
      (id, saleId, clientId, invoiceNumber, lineItems, subtotal, discount, gstAmount, total, paid, balance, status, dueDate,
       createdAt, updatedAt, tenantId, branchId, staffId, tenant_id, branch_id, invoice_no, customer_id, payment_status,
       grand_total, paid_amount, due_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 5000, 0, 0, 5000, 3500, 1500, 'partial', ?, ?, ?, 'tenant_aura', ?, ?,
        'tenant_aura', ?, ?, ?, 'partial', 5000, 3500, 1500, ?, ?)`)
      .run(
        invoiceId,
        saleId,
        clientId,
        `REC-${suffix}`,
        JSON.stringify([{ id: `pkg_${suffix}`, type: "package", name: "Recovery Glow Package", remainingCredits: 2, expiresOn: expiry }]),
        expiry,
        stamp,
        stamp,
        branchId,
        staffId,
        branchId,
        `REC-${suffix}`,
        clientId,
        stamp,
        stamp
      );
    db.prepare(`INSERT INTO client_membership_ledger
      (id, tenant_id, branch_id, client_id, membership_id, plan_id, invoice_id, action, amount, paid_amount, credits_before, credits_after, starts_on, expires_on, snapshot_json, note, actor_user_id, created_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, 'plan_recovery', ?, 'sold', 2999, 2999, 0, 3, ?, ?, ?, 'Recovery membership seed', 'owner', ?)`)
      .run(`mem_ledger_${suffix}`, branchId, clientId, membershipId, invoiceId, stamp, expiry, JSON.stringify({ planName: "Recovery Gold" }), stamp);
    db.prepare(`INSERT INTO engagement_call_logs
      (id, tenant_id, branch_id, client_id, staff_id, direction, phone, caller_name, started_at, duration_seconds, intent, outcome, status, follow_up_required, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, 'inbound', '9333393333', 'Recovery Client', ?, 0, 'booking', 'missed', 'missed', 1, ?, ?)`)
      .run(callId, branchId, clientId, staffId, stamp, stamp, stamp);
    db.prepare(`INSERT INTO review_platforms
      (id, tenant_id, branch_id, platform_code, platform_name, last_sync_status, provider_config_json, is_active, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, 'google', 'Google Business Profile', 'not_configured', '{}', 1, ?, ?)`)
      .run(platformId, branchId, stamp, stamp);
    db.prepare(`INSERT INTO reviews_v2
      (id, tenant_id, branch_id, platform_id, platform_review_id, reviewer_name, customer_id, primary_staff_id,
       service_ids, rating, rating_max, title, review_text, sentiment, status, priority, reviewed_at, imported_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, 'Recovery Client', ?, ?, ?, 2, 5, 'Recovery issue', 'Need follow up after bad visit.', 'negative', 'new', 'high', ?, ?, ?)`)
      .run(reviewId, branchId, platformId, `google-recovery-${suffix}`, clientId, staffId, JSON.stringify([serviceId]), stamp, stamp, stamp);

    const list = await api(baseUrl, "/engagement/recovery-opportunities", { branchId });
    assert.equal(list.response.status, 200);
    const types = new Set(list.payload.map((item) => item.opportunityType));
    for (const type of ["no_show", "missed_call", "payment_due", "membership_expiry", "package_expiry", "inactive_client", "negative_review", "high_value_client_inactive", "wallet_balance_unused", "service_due_reminder"]) {
      assert.ok(types.has(type), `expected recovery type ${type}`);
    }
    const paymentDue = list.payload.find((item) => item.opportunityType === "payment_due");
    assert.ok(paymentDue);
    assert.equal(paymentDue.client.name, "Recovery Client");
    assert.ok(paymentDue.suggestedMessage);

    const assigned = await api(baseUrl, `/engagement/recovery-opportunities/${paymentDue.id}/assign`, {
      method: "POST",
      branchId,
      body: { assignedTo: "front_desk_recovery", reason: "Owner assigned recovery" }
    });
    assert.equal(assigned.response.status, 200);
    assert.equal(assigned.payload.assignedTo, "front_desk_recovery");
    assert.equal(assigned.payload.status, "assigned");

    const draft = await api(baseUrl, `/engagement/recovery-opportunities/${paymentDue.id}/create-draft`, {
      method: "POST",
      branchId,
      body: { channel: "whatsapp" }
    });
    assert.equal(draft.response.status, 201);
    assert.equal(draft.payload.message.status, "draft");
    assert.equal(draft.payload.opportunity.status, "draft_created");
    assert.equal(draft.payload.opportunity.threadId, draft.payload.thread.id);

    const done = await api(baseUrl, `/engagement/recovery-opportunities/${paymentDue.id}/mark-done`, {
      method: "POST",
      branchId,
      body: { outcome: "recovered", note: "Client agreed to pay" }
    });
    assert.equal(done.response.status, 200);
    assert.equal(done.payload.status, "done");

    const audits = db.prepare("SELECT action FROM engagement_audit_logs WHERE tenant_id = ? AND entity_id = ? ORDER BY created_at").all("tenant_aura", paymentDue.id);
    assert.ok(audits.some((row) => row.action === "engagement.recovery.detected"));
    assert.ok(audits.some((row) => row.action === "engagement.recovery.assigned"));
    assert.ok(audits.some((row) => row.action === "engagement.recovery.draft_created"));
    assert.ok(audits.some((row) => row.action === "engagement.recovery.marked_done"));
  } finally {
    await close(server);
  }
});

test("engagement review response center drafts, approves and stores provider-safe replies", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const stamp = new Date().toISOString();
  const branchId = `branch_eng_review_${suffix}`;
  const clientId = `client_eng_review_${suffix}`;
  const staffId = `staff_eng_review_${suffix}`;
  const serviceId = `svc_eng_review_${suffix}`;
  const platformId = `rplat_eng_review_${suffix}`;
  const reviewId = `review_eng_${suffix}`;
  try {
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Review Branch', 'Mumbai', 'active', ?, ?, 'tenant_aura')`).run(branchId, stamp, stamp);
    db.prepare(`INSERT INTO clients
      (id, name, phone, email, branchId, createdAt, updatedAt, tenantId)
      VALUES (?, 'Review Recovery Client', '9111191111', 'review-client@example.com', ?, ?, ?, 'tenant_aura')`)
      .run(clientId, branchId, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO staff
      (id, name, role, phone, email, branchId, shift, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Review Stylist', 'staff', '9222292222', 'reviewstaff@example.com', ?, '{}', 'active', ?, ?, 'tenant_aura')`)
      .run(staffId, branchId, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO services
      (id, name, category, price, durationMinutes, assignedStaff, requiredProducts, addOns, packageServices, gstRate, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Review Hair Color', 'Hair', 2500, 90, '[]', '[]', '[]', '[]', 18, 'active', ?, ?, 'tenant_aura')`)
      .run(serviceId, stamp, stamp);
    db.prepare(`INSERT INTO review_platforms
      (id, tenant_id, branch_id, platform_code, platform_name, last_sync_status, provider_config_json, is_active, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, 'google', 'Google Business Profile', 'not_configured', '{}', 1, ?, ?)`)
      .run(platformId, branchId, stamp, stamp);
    db.prepare(`INSERT INTO reviews_v2
      (id, tenant_id, branch_id, platform_id, platform_review_id, reviewer_name, customer_id, primary_staff_id,
       service_ids, rating, rating_max, title, review_text, sentiment, status, priority, reviewed_at, imported_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, 'Review Recovery Client', ?, ?, ?, 2, 5, 'Long wait', ?, 'negative', 'new', 'high', ?, ?, ?)`)
      .run(
        reviewId,
        branchId,
        platformId,
        `google-${suffix}`,
        clientId,
        staffId,
        JSON.stringify([serviceId]),
        "The color service started late and nobody explained the delay.",
        stamp,
        stamp,
        stamp
      );

    const reviews = await api(baseUrl, "/engagement/reviews", { branchId });
    assert.equal(reviews.response.status, 200);
    const review = reviews.payload.find((item) => item.id === reviewId);
    assert.ok(review);
    assert.equal(review.client.name, "Review Recovery Client");
    assert.equal(review.staff.name, "Review Stylist");
    assert.equal(review.riskLevel, "high");

    const ai = await api(baseUrl, `/engagement/reviews/${reviewId}/ai-response`, {
      method: "POST",
      branchId,
      body: { tone: "apology" }
    });
    assert.equal(ai.response.status, 201);
    assert.match(ai.payload.aiResponse, /sorry|apolog/i);
    assert.equal(ai.payload.reply.approvalStatus, "pending");
    assert.equal(ai.payload.negativeAlert.alertType, "negative_review");

    const approved = await api(baseUrl, `/engagement/reviews/${reviewId}/approve-response`, {
      method: "POST",
      branchId,
      body: {
        replyId: ai.payload.reply.id,
        responseText: `${ai.payload.aiResponse} We will personally review this with the team.`,
        note: "Owner approved recovery response"
      }
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.payload.reply.approvalStatus, "approved");
    assert.match(approved.payload.reply.replyText, /personally review/);

    const sent = await api(baseUrl, `/engagement/reviews/${reviewId}/send-response`, {
      method: "POST",
      branchId,
      body: { replyId: approved.payload.reply.id }
    });
    assert.equal(sent.response.status, 200);
    assert.equal(sent.payload.status, "not_configured");
    assert.equal(sent.payload.postedToPlatform, false);

    const audits = db.prepare("SELECT action FROM engagement_audit_logs WHERE tenant_id = ? AND entity_id = ? ORDER BY created_at").all("tenant_aura", approved.payload.reply.id);
    assert.ok(audits.some((row) => row.action === "engagement.review_response.ai_generated"));
    assert.ok(audits.some((row) => row.action === "engagement.review_response.approved"));
    assert.ok(audits.some((row) => row.action === "engagement.review_response.send_attempted"));
  } finally {
    await close(server);
  }
});

test("engagement AI risk signals detect next-best-action risks and support review", async () => {
  ensureTenant("tenant_engagement_risk_other", "engagement-risk-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const stamp = new Date().toISOString();
  const oldVisit = new Date(Date.now() - 100 * 86400000).toISOString();
  const pastDelay = new Date(Date.now() - 75 * 60000).toISOString();
  const expiry = new Date(Date.now() + 4 * 86400000).toISOString();
  const branchId = `branch_eng_risk_${suffix}`;
  const clientId = `client_eng_risk_${suffix}`;
  const staffId = `staff_eng_risk_${suffix}`;
  const serviceId = `svc_eng_risk_${suffix}`;
  const invoiceId = `inv_eng_risk_${suffix}`;
  const membershipId = `mem_eng_risk_${suffix}`;
  const platformId = `rplat_eng_risk_${suffix}`;
  try {
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Risk Branch', 'Mumbai', 'active', ?, ?, 'tenant_aura')`).run(branchId, stamp, stamp);
    db.prepare(`INSERT INTO clients
      (id, name, phone, email, branchId, walletBalance, totalSpend, visitCount, lastVisitAt, createdAt, updatedAt, tenantId)
      VALUES (?, 'Risk Client', '9777797777', 'risk-client@example.com', ?, 500, 65000, 12, ?, ?, ?, 'tenant_aura')`)
      .run(clientId, branchId, oldVisit, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO staff
      (id, name, role, phone, email, branchId, shift, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Risk Stylist', 'staff', '9888898888', 'riskstaff@example.com', ?, '{}', 'active', ?, ?, 'tenant_aura')`)
      .run(staffId, branchId, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO services
      (id, name, category, price, durationMinutes, assignedStaff, requiredProducts, addOns, packageServices, gstRate, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Risk Hair Color', 'Hair', 3200, 90, '[]', '[]', '[]', '[]', 18, 'active', ?, ?, 'tenant_aura')`)
      .run(serviceId, stamp, stamp);

    const appointmentRows = [
      [`appt_cancel_a_${suffix}`, "cancelled", new Date(Date.now() - 15 * 86400000).toISOString()],
      [`appt_cancel_b_${suffix}`, "cancelled_by_client", new Date(Date.now() - 7 * 86400000).toISOString()],
      [`appt_no_show_${suffix}`, "no_show", new Date(Date.now() - 3 * 86400000).toISOString()],
      [`appt_delay_${suffix}`, "confirmed", pastDelay],
      [`appt_abandon_${suffix}`, "draft", stamp]
    ];
    for (const [appointmentId, status, startAt] of appointmentRows) {
      db.prepare(`INSERT INTO appointments
        (id, clientId, staffId, branchId, serviceIds, startAt, endAt, status, source, chair, room, notes, billable, noShowRiskScore, createdAt, updatedAt, tenantId)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, 'front_desk', 'Chair 3', 'Room 2', 'Risk test appointment', 1, ?, ?, ?, 'tenant_aura')`)
        .run(
          appointmentId,
          clientId,
          staffId,
          branchId,
          JSON.stringify([serviceId]),
          startAt,
          new Date(new Date(startAt).getTime() + 60 * 60000).toISOString(),
          status,
          status === "no_show" ? 91 : 0,
          stamp,
          stamp
        );
    }

    db.prepare(`INSERT INTO sales
      (id, clientId, appointmentId, branchId, staffId, items, subtotal, discount, gstAmount, total, status, createdAt, updatedAt, tenantId)
      VALUES (?, ?, ?, ?, ?, ?, 12000, 0, 0, 12000, 'completed', ?, ?, 'tenant_aura')`)
      .run(
        `sale_eng_risk_${suffix}`,
        clientId,
        `appt_no_show_${suffix}`,
        branchId,
        staffId,
        JSON.stringify([{ serviceId, name: "Risk Hair Color", price: 12000 }]),
        stamp,
        stamp
      );

    db.prepare(`INSERT INTO invoices
      (id, saleId, clientId, invoiceNumber, lineItems, subtotal, discount, gstAmount, total, paid, balance, status, dueDate,
       createdAt, updatedAt, tenantId, branchId, staffId, tenant_id, branch_id, invoice_no, customer_id, payment_status,
       grand_total, paid_amount, due_amount, created_at, updated_at)
      VALUES (?, ?, ?, ?, ?, 12000, 0, 0, 12000, 3000, 9000, 'partial', ?, ?, ?, 'tenant_aura', ?, ?,
        'tenant_aura', ?, ?, ?, 'partial', 12000, 3000, 9000, ?, ?)`)
      .run(
        invoiceId,
        `sale_eng_risk_${suffix}`,
        clientId,
        `RISK-${suffix}`,
        JSON.stringify([{ id: `pkg_risk_${suffix}`, type: "package", name: "Risk Glow Package", remainingCredits: 3, expiresOn: expiry }]),
        expiry,
        stamp,
        stamp,
        branchId,
        staffId,
        branchId,
        `RISK-${suffix}`,
        clientId,
        stamp,
        stamp
      );
    db.prepare(`INSERT INTO client_membership_ledger
      (id, tenant_id, branch_id, client_id, membership_id, plan_id, invoice_id, action, amount, paid_amount, credits_before, credits_after, starts_on, expires_on, snapshot_json, note, actor_user_id, created_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, 'plan_risk', ?, 'sold', 5000, 5000, 0, 5, ?, ?, ?, 'Risk membership seed', 'owner', ?)`)
      .run(`mem_ledger_risk_${suffix}`, branchId, clientId, membershipId, invoiceId, stamp, expiry, JSON.stringify({ planName: "Risk Gold" }), stamp);

    db.prepare(`INSERT INTO review_platforms
      (id, tenant_id, branch_id, platform_code, platform_name, last_sync_status, provider_config_json, is_active, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, 'google', 'Google Business Profile', 'not_configured', '{}', 1, ?, ?)`)
      .run(platformId, branchId, stamp, stamp);
    for (let i = 0; i < 2; i += 1) {
      db.prepare(`INSERT INTO reviews_v2
        (id, tenant_id, branch_id, platform_id, platform_review_id, reviewer_name, customer_id, primary_staff_id,
         service_ids, rating, rating_max, title, review_text, sentiment, status, priority, reviewed_at, imported_at, updated_at)
        VALUES (?, 'tenant_aura', ?, ?, ?, 'Risk Client', ?, ?, ?, 2, 5, 'Staff complaint', ?, 'negative', 'new', 'high', ?, ?, ?)`)
        .run(
          `review_eng_risk_${suffix}_${i}`,
          branchId,
          platformId,
          `google-risk-${suffix}-${i}`,
          clientId,
          staffId,
          JSON.stringify([serviceId]),
          i === 0 ? "The service was delayed and staff was rude." : "Bad experience with the same staff again.",
          stamp,
          stamp,
          stamp
        );
    }

    const thread = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: { branchId, type: "whatsapp", clientId, subject: "Risk thread", displayName: "Risk Client", phone: "9777797777" }
    });
    assert.equal(thread.response.status, 201);
    const messageRows = [
      [`msg_angry_${suffix}`, "inbound", "received", "delivered", "unknown", "I am angry, this was the worst service and I want refund.", ""],
      [`msg_optout_${suffix}`, "inbound", "received", "delivered", "opt_out", "STOP WhatsApp messages", ""],
      [`msg_payment_failed_${suffix}`, "outbound", "failed", "failed", "not_required", "Payment link for invoice failed", "payment link delivery failed"]
    ];
    for (const [id, direction, status, deliveryStatus, consentStatus, body, failureReason] of messageRows) {
      db.prepare(`INSERT INTO engagement_messages
        (id, tenant_id, branch_id, thread_id, client_id, invoice_id, staff_id, channel, direction, body, body_preview,
         status, delivery_status, approval_status, consent_status, opt_out_checked, failure_reason, metadata_json, created_by, created_at, updated_at)
        VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, 'whatsapp', ?, ?, ?, ?, ?, 'not_required', ?, 1, ?, '{}', 'owner', ?, ?)`)
        .run(id, branchId, thread.payload.id, clientId, invoiceId, staffId, direction, body, body.slice(0, 140), status, deliveryStatus, consentStatus, failureReason, stamp, stamp);
    }

    const list = await api(baseUrl, "/engagement/risk-signals", { branchId });
    assert.equal(list.response.status, 200);
    const riskTypes = new Set(list.payload.map((item) => item.alertType || item.alert_type));
    for (const type of [
      "angry_client",
      "repeated_cancellation",
      "unpaid_due",
      "package_expiry",
      "membership_expiry",
      "negative_review",
      "no_show_risk",
      "high_value_client_inactive",
      "repeated_staff_complaint",
      "appointment_delay_risk",
      "whatsapp_opt_out",
      "failed_payment_link",
      "abandoned_booking"
    ]) {
      assert.ok(riskTypes.has(type), `expected risk type ${type}`);
    }
    const angry = list.payload.find((item) => item.alertType === "angry_client");
    assert.ok(angry);
    assert.ok(["low", "medium", "high", "critical"].includes(angry.risk_level));
    assert.ok(Number(angry.risk_score) > 0);
    assert.ok(angry.reason);
    assert.ok(Array.isArray(angry.evidence));
    assert.ok(angry.suggested_action);
    assert.equal(angry.review_status, "unreviewed");

    const reviewed = await api(baseUrl, `/engagement/risk-signals/${angry.id}/review`, {
      method: "POST",
      branchId,
      body: { reviewStatus: "acknowledged", resolutionNote: "Manager checked client escalation", assignedTo: staffId }
    });
    assert.equal(reviewed.response.status, 200);
    assert.equal(reviewed.payload.review_status, "acknowledged");
    assert.equal(reviewed.payload.assignedTo, staffId);
    assert.ok(reviewed.payload.reviewedBy);

    const otherTenant = await api(baseUrl, "/engagement/risk-signals", { tenantId: "tenant_engagement_risk_other" });
    assert.equal(otherTenant.response.status, 200);
    assert.equal(otherTenant.payload.some((item) => item.clientId === clientId), false);

    const audits = db.prepare("SELECT action FROM engagement_audit_logs WHERE tenant_id = ? AND entity_id = ? ORDER BY created_at").all("tenant_aura", angry.id);
    assert.ok(audits.some((row) => row.action === "engagement.risk.detected"));
    assert.ok(audits.some((row) => row.action === "engagement.risk.reviewed"));
  } finally {
    await close(server);
  }
});

test("engagement SLA board tracks overdue work, escalation and staff accountability", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const stamp = new Date().toISOString();
  const branchId = `branch_eng_sla_${suffix}`;
  const clientId = `client_eng_sla_${suffix}`;
  const staffId = `staff_eng_sla_${suffix}`;
  const dueAt = new Date(Date.now() - 90 * 60000).toISOString();
  try {
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement SLA Branch', 'Mumbai', 'active', ?, ?, 'tenant_aura')`).run(branchId, stamp, stamp);
    db.prepare(`INSERT INTO clients
      (id, name, phone, email, branchId, createdAt, updatedAt, tenantId)
      VALUES (?, 'SLA Client', '9555595555', 'sla-client@example.com', ?, ?, ?, 'tenant_aura')`)
      .run(clientId, branchId, stamp, stamp);
    db.prepare(`INSERT OR IGNORE INTO staff
      (id, name, phone, email, branchId, shift, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'SLA Desk Owner', '9666696666', 'sla-staff@example.com', ?, '{}', 'active', ?, ?, 'tenant_aura')`)
      .run(staffId, branchId, stamp, stamp);

    const thread = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: {
        branchId,
        type: "whatsapp",
        clientId,
        subject: "SLA follow-up",
        displayName: "SLA Client",
        priority: "urgent"
      }
    });
    assert.equal(thread.response.status, 201);

    const assigned = await api(baseUrl, `/engagement/threads/${thread.payload.id}/assign`, {
      method: "PATCH",
      branchId,
      body: {
        assignedTo: staffId,
        staffId,
        priority: "urgent",
        slaDueAt: dueAt,
        reason: "Manager assigned SLA test"
      }
    });
    assert.equal(assigned.response.status, 200);
    assert.equal(assigned.payload.assignedTo, staffId);

    const draft = await api(baseUrl, "/engagement/messages/draft", {
      method: "POST",
      branchId,
      body: {
        threadId: thread.payload.id,
        body: "SLA response draft approved by manager.",
        channel: "whatsapp",
        approvalRequired: false,
        optOutChecked: true
      }
    });
    assert.equal(draft.response.status, 201);

    db.prepare(`INSERT INTO engagement_conversions
      (id, tenant_id, branch_id, thread_id, client_id, staff_id, assigned_to, conversion_type, source_channel,
       amount, status, converted_at, created_by, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, 'recovery_booking', 'whatsapp', 2500, 'converted', ?, 'owner', ?, ?)`)
      .run(`conv_sla_${suffix}`, branchId, thread.payload.id, clientId, staffId, staffId, stamp, stamp, stamp);
    db.prepare(`INSERT INTO engagement_recovery_opportunities
      (id, tenant_id, branch_id, thread_id, client_id, staff_id, assigned_to, opportunity_type, source_event_id,
       title, reason, expected_value, confidence, status, priority, due_at, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, 'abandoned_appointment', ?, 'Abandoned SLA recovery',
       'Client abandoned booking flow', 2500, 0.8, 'done', 'high', ?, ?, ?)`)
      .run(`recovery_sla_${suffix}`, branchId, thread.payload.id, clientId, staffId, staffId, `source_sla_${suffix}`, dueAt, stamp, stamp);

    const overdue = await api(baseUrl, "/engagement/sla/overdue", { branchId });
    assert.equal(overdue.response.status, 200);
    const overdueThread = overdue.payload.find((item) => item.threadId === thread.payload.id);
    assert.ok(overdueThread);
    assert.equal(overdueThread.slaStatus, "overdue");
    assert.ok(overdueThread.overdueMinutes >= 1);

    const escalation = await api(baseUrl, `/engagement/threads/${thread.payload.id}/escalate`, {
      method: "POST",
      branchId,
      body: { reason: "SLA breach requires manager review" }
    });
    assert.equal(escalation.response.status, 200);
    assert.equal(escalation.payload.status, "escalated");

    const staffClose = await api(baseUrl, `/engagement/threads/${thread.payload.id}/status`, {
      method: "PATCH",
      branchId,
      role: "staff",
      body: { status: "resolved", reason: "Staff tried to close escalated thread" }
    });
    assert.equal(staffClose.response.status, 403);

    const ownerClose = await api(baseUrl, `/engagement/threads/${thread.payload.id}/status`, {
      method: "PATCH",
      branchId,
      role: "owner",
      body: { status: "resolved", reason: "Manager resolved after escalation" }
    });
    assert.equal(ownerClose.response.status, 200);
    assert.equal(ownerClose.payload.status, "resolved");

    const report = await api(baseUrl, "/engagement/reports/staff-accountability", { branchId });
    assert.equal(report.response.status, 200);
    const staffRow = report.payload.rows.find((row) => row.staffId === staffId);
    assert.ok(staffRow);
    assert.equal(staffRow.conversions, 1);
    assert.equal(staffRow.abandonedRecovery, 1);
    assert.ok(staffRow.avgResolutionMinutes >= 0);

    const manager = await api(baseUrl, "/engagement/manager-view", { branchId });
    assert.equal(manager.response.status, 200);
    assert.ok(Array.isArray(manager.payload.unresolvedConversations));
    assert.ok(manager.payload.staffPerformance.rows.some((row) => row.staffId === staffId));

    const assignmentLog = db.prepare("SELECT * FROM engagement_assignments WHERE tenant_id = ? AND thread_id = ?").all("tenant_aura", thread.payload.id);
    assert.ok(assignmentLog.some((row) => row.assigned_to === staffId));
    const slaEvents = db.prepare("SELECT event_type FROM engagement_sla_events WHERE tenant_id = ? AND thread_id = ?").all("tenant_aura", thread.payload.id);
    assert.ok(slaEvents.some((row) => row.event_type === "sla_breached"));
    assert.ok(slaEvents.some((row) => row.event_type === "escalated"));
    const alerts = db.prepare("SELECT alert_type FROM engagement_client_alerts WHERE tenant_id = ? AND thread_id = ?").all("tenant_aura", thread.payload.id);
    assert.ok(alerts.some((row) => row.alert_type === "sla_breach"));
  } finally {
    await close(server);
  }
});

test("engagement reports aggregate analytics and export csv/pdf", async () => {
  ensureTenant("tenant_engagement_reports_other", "engagement-reports-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const branchId = `branch_eng_reports_${suffix}`;
  const clientId = `client_eng_reports_${suffix}`;
  const staffId = `staff_eng_reports_${suffix}`;
  const templateId = `tpl_eng_reports_${suffix}`;
  const stamp = new Date().toISOString();
  const inboundAt = new Date(Date.now() - 60 * 60 * 1000).toISOString();
  const outboundAt = new Date(Date.now() - 45 * 60 * 1000).toISOString();
  try {
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Engagement Reports Branch', 'Mumbai', 'active', ?, ?, 'tenant_aura')`).run(branchId, stamp, stamp);
    db.prepare(`INSERT OR REPLACE INTO clients
      (id, name, phone, email, branchId, walletBalance, totalSpend, visitCount, lastVisitAt, createdAt, updatedAt, tenantId)
      VALUES (?, 'Reports Client', '9555595555', 'reports@example.com', ?, 500, 36000, 9, ?, ?, ?, 'tenant_aura')`)
      .run(clientId, branchId, inboundAt, stamp, stamp);
    db.prepare(`INSERT OR REPLACE INTO staff
      (id, name, role, phone, email, branchId, permissions, status, createdAt, updatedAt, tenantId)
      VALUES (?, 'Reports Staff', 'manager', '9666696666', 'reports-staff@example.com', ?, '{}', 'active', ?, ?, 'tenant_aura')`)
      .run(staffId, branchId, stamp, stamp);

    const thread = await api(baseUrl, "/engagement/threads", {
      method: "POST",
      branchId,
      body: {
        branchId,
        clientId,
        staffId,
        assignedTo: staffId,
        type: "whatsapp",
        priority: "high",
        subject: "Reports client recovery",
        displayName: "Reports Client",
        phone: "9555595555"
      }
    });
    assert.equal(thread.response.status, 201);

    db.prepare(`INSERT INTO engagement_templates
      (id, tenant_id, branch_id, template_key, name, channel, category, language, body, variables_json,
       provider_status, approval_status, status, created_by, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, 'Reports payment due', 'whatsapp', 'payment', 'en',
       'Hi {{client_name}}, payment due {{due_amount}}', '["client_name","due_amount"]',
       'not_configured', 'approved', 'active', 'owner', ?, ?)`)
      .run(templateId, branchId, `reports_payment_due_${suffix}`, stamp, stamp);
    db.prepare(`INSERT INTO engagement_messages
      (id, tenant_id, branch_id, thread_id, client_id, staff_id, assigned_to, channel, direction, message_type,
       sender_role, recipient_name, recipient_address, body, body_preview, status, delivery_status, approval_status,
       created_by, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, 'whatsapp', 'inbound', 'text',
       'client', 'AuraShine', '9555595555', 'I need help with my pending payment.', 'payment help',
       'received', 'delivered', 'not_required', 'client', ?, ?)`)
      .run(`msg_reports_in_${suffix}`, branchId, thread.payload.id, clientId, staffId, staffId, inboundAt, inboundAt);
    db.prepare(`INSERT INTO engagement_messages
      (id, tenant_id, branch_id, thread_id, client_id, staff_id, assigned_to, channel, direction, message_type,
       sender_user_id, sender_role, recipient_name, recipient_address, body, body_preview, template_id, status,
       delivery_status, approval_status, created_by, sent_at, delivered_at, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, 'whatsapp', 'outbound', 'template',
       ?, 'manager', 'Reports Client', '9555595555', 'Payment recovery response sent.', 'Payment recovery',
       ?, 'sent', 'delivered', 'approved', 'owner', ?, ?, ?, ?)`)
      .run(`msg_reports_out_${suffix}`, branchId, thread.payload.id, clientId, staffId, staffId, staffId, templateId, outboundAt, outboundAt, outboundAt, outboundAt);
    db.prepare(`INSERT INTO engagement_drafts
      (id, tenant_id, branch_id, thread_id, message_id, client_id, staff_id, assigned_to, channel, draft_type,
       source, suggested_body, edited_body, confidence, approval_required, approval_status, status, risk_level,
       metadata_json, created_by, approved_by, approved_at, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, ?, 'whatsapp', 'reply',
       'ai_next_best_action', 'Collect due and recover client', 'Collect due and recover client', 0.92, 1,
       'approved', 'ready', 'medium', ?, 'owner', 'owner', ?, ?, ?)`)
      .run(`draft_reports_${suffix}`, branchId, thread.payload.id, `msg_reports_out_${suffix}`, clientId, staffId, staffId, JSON.stringify({ templateId }), outboundAt, inboundAt, outboundAt);
    db.prepare(`INSERT INTO engagement_sla_events
      (id, tenant_id, branch_id, thread_id, client_id, staff_id, assigned_to, event_type, sla_policy_key,
       due_at, breached_at, status, severity, response_time_seconds, evidence_json, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, 'sla_breached', 'high_priority', ?, ?, 'breached',
       'high', 900, '{}', ?, ?)`)
      .run(`sla_reports_${suffix}`, branchId, thread.payload.id, clientId, staffId, staffId, inboundAt, outboundAt, outboundAt, outboundAt);

    const paymentRecoveryId = `recovery_reports_payment_${suffix}`;
    const abandonedRecoveryId = `recovery_reports_abandon_${suffix}`;
    db.prepare(`INSERT INTO engagement_recovery_opportunities
      (id, tenant_id, branch_id, thread_id, client_id, invoice_id, staff_id, assigned_to, opportunity_type, source_event_id,
       source_channel, title, reason, suggested_action, expected_value, confidence, status, priority, due_at, recovered_at, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, ?, 'payment_due', ?, 'whatsapp',
       'Payment due recovery', 'Client has due balance', 'Send payment link draft', 1200, 0.88,
       'done', 'high', ?, ?, ?, ?)`)
      .run(paymentRecoveryId, branchId, thread.payload.id, clientId, `inv_reports_${suffix}`, staffId, staffId, `source_payment_${suffix}`, stamp, stamp, inboundAt, stamp);
    db.prepare(`INSERT INTO engagement_recovery_opportunities
      (id, tenant_id, branch_id, thread_id, client_id, appointment_id, staff_id, assigned_to, opportunity_type, source_event_id,
       source_channel, title, reason, suggested_action, expected_value, confidence, status, priority, due_at, recovered_at, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, ?, 'abandoned_appointment', ?, 'whatsapp',
       'Abandoned appointment conversion', 'Client did not complete booking', 'Offer suggested slot', 2500, 0.81,
       'done', 'high', ?, ?, ?, ?)`)
      .run(abandonedRecoveryId, branchId, thread.payload.id, clientId, `appt_reports_${suffix}`, staffId, staffId, `source_abandon_${suffix}`, stamp, stamp, inboundAt, stamp);
    db.prepare(`INSERT INTO engagement_recovery_opportunities
      (id, tenant_id, branch_id, thread_id, client_id, membership_id, staff_id, assigned_to, opportunity_type, source_event_id,
       title, reason, expected_value, confidence, status, priority, due_at, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, ?, 'membership_expiry', ?, 'Membership expiry recovery',
       'Membership expires soon', 2999, 0.7, 'open', 'normal', ?, ?, ?)`)
      .run(`recovery_reports_mem_${suffix}`, branchId, thread.payload.id, clientId, `mem_reports_${suffix}`, staffId, staffId, `source_mem_${suffix}`, stamp, inboundAt, stamp);
    db.prepare(`INSERT INTO engagement_recovery_opportunities
      (id, tenant_id, branch_id, thread_id, client_id, package_id, staff_id, assigned_to, opportunity_type, source_event_id,
       title, reason, expected_value, confidence, status, priority, due_at, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, ?, 'package_expiry', ?, 'Package expiry recovery',
       'Package expires soon', 3999, 0.7, 'open', 'normal', ?, ?, ?)`)
      .run(`recovery_reports_pkg_${suffix}`, branchId, thread.payload.id, clientId, `pkg_reports_${suffix}`, staffId, staffId, `source_pkg_${suffix}`, stamp, inboundAt, stamp);
    db.prepare(`INSERT INTO engagement_conversions
      (id, tenant_id, branch_id, thread_id, client_id, invoice_id, staff_id, assigned_to, conversion_type, source_channel,
       source_event_id, amount, status, converted_at, created_by, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, ?, 'payment_due', 'whatsapp', ?, 1200, 'converted', ?, 'owner', ?, ?)`)
      .run(`conv_reports_payment_${suffix}`, branchId, thread.payload.id, clientId, `inv_reports_${suffix}`, staffId, staffId, paymentRecoveryId, outboundAt, inboundAt, stamp);
    db.prepare(`INSERT INTO engagement_conversions
      (id, tenant_id, branch_id, thread_id, client_id, appointment_id, staff_id, assigned_to, conversion_type, source_channel,
       source_event_id, amount, status, converted_at, created_by, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, ?, 'recovery_booking', 'whatsapp', ?, 2500, 'converted', ?, 'owner', ?, ?)`)
      .run(`conv_reports_abandon_${suffix}`, branchId, thread.payload.id, clientId, `appt_reports_${suffix}`, staffId, staffId, abandonedRecoveryId, outboundAt, inboundAt, stamp);
    db.prepare(`INSERT INTO reviews_v2
      (id, tenant_id, branch_id, platform_id, platform_review_id, reviewer_name, customer_id, primary_staff_id,
       rating, review_text, sentiment, status, priority, assigned_to, resolution_required, reviewed_at, imported_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, 'Reports Client', ?, ?, 2, 'Service was delayed',
       'negative', 'new', 'high', ?, 1, ?, ?, ?)`)
      .run(`review_reports_${suffix}`, branchId, `platform_reports_${suffix}`, `platform_review_reports_${suffix}`, clientId, staffId, staffId, inboundAt, inboundAt, stamp);
    db.prepare(`INSERT INTO review_replies
      (id, tenant_id, branch_id, review_id, reply_text, ai_generated, approval_status, approved_by, approved_at, created_by, created_at, updated_at)
      VALUES (?, 'tenant_aura', ?, ?, 'We are sorry and will recover this personally.', 1, 'approved', 'owner', ?, 'owner', ?, ?)`)
      .run(`reply_reports_${suffix}`, branchId, `review_reports_${suffix}`, outboundAt, inboundAt, stamp);
    db.prepare(`INSERT INTO engagement_audit_logs
      (id, tenant_id, branch_id, thread_id, message_id, client_id, staff_id, actor_user_id, actor_role,
       action, entity_type, entity_id, before_json, after_json, details_json, severity, created_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, ?, 'owner', 'owner',
       'engagement.template.rendered', 'engagement_template', ?, '{}', '{}', ?, 'info', ?)`)
      .run(`audit_reports_tpl_${suffix}`, branchId, thread.payload.id, `msg_reports_out_${suffix}`, clientId, staffId, templateId, JSON.stringify({ templateId }), outboundAt);
    db.prepare(`INSERT INTO engagement_audit_logs
      (id, tenant_id, branch_id, thread_id, client_id, staff_id, actor_user_id, actor_role,
       action, entity_type, entity_id, before_json, after_json, details_json, severity, created_at)
      VALUES (?, 'tenant_aura', ?, ?, ?, ?, 'owner', 'owner',
       'engagement.ai_summary.generated', 'engagement_ai_summary', ?, '{}', '{}', '{}', 'info', ?)`)
      .run(`audit_reports_ai_${suffix}`, branchId, thread.payload.id, clientId, staffId, `summary_reports_${suffix}`, outboundAt);

    const report = await api(baseUrl, `/engagement/reports?branchId=${branchId}`, { branchId });
    assert.equal(report.response.status, 200);
    assert.ok(report.payload.summary.conversationVolume >= 1);
    assert.ok(report.payload.summary.totalMessages >= 2);
    assert.ok(report.payload.summary.slaBreaches >= 1);
    assert.ok(report.payload.summary.recoveryRevenue >= 3700);
    assert.ok(report.payload.summary.aiSuggestionAcceptanceRate >= 100);
    assert.ok(report.payload.channelWiseMessages.some((row) => row.channel === "whatsapp" && row.total >= 2));
    assert.ok(report.payload.staffWiseEngagement.some((row) => row.staffId === staffId && row.revenue >= 3700));
    assert.ok(report.payload.paymentDueRecovery.total >= 1);
    assert.ok(report.payload.membershipPackageExpiryRecovery.total >= 2);
    assert.ok(report.payload.templatePerformance.rendered >= 1);
    assert.equal(report.payload.whatsappDeliveryStatus.placeholder, true);

    const filtered = await api(baseUrl, `/engagement/reports?branchId=${branchId}&channel=whatsapp&recoveryType=payment_due&clientSegment=high_value`, { branchId });
    assert.equal(filtered.response.status, 200);
    assert.ok(filtered.payload.paymentDueRecovery.total >= 1);

    const csvResponse = await fetch(`${baseUrl}/engagement/reports/export/csv?branchId=${branchId}`, { headers: headers("owner", "tenant_aura", branchId) });
    assert.equal(csvResponse.status, 200);
    assert.match(csvResponse.headers.get("content-type") || "", /text\/csv/);
    const csv = await csvResponse.text();
    assert.match(csv, /section,metric,value/);
    assert.match(csv, /recovery_revenue/);

    const pdfResponse = await fetch(`${baseUrl}/engagement/reports/export/pdf?branchId=${branchId}`, { headers: headers("owner", "tenant_aura", branchId) });
    assert.equal(pdfResponse.status, 200);
    assert.match(pdfResponse.headers.get("content-type") || "", /application\/pdf/);
    const pdf = Buffer.from(await pdfResponse.arrayBuffer());
    assert.equal(pdf.toString("utf8", 0, 4), "%PDF");

    const isolated = await api(baseUrl, `/engagement/reports?branchId=${branchId}`, {
      tenantId: "tenant_engagement_reports_other",
      branchId
    });
    assert.equal(isolated.response.status, 200);
    assert.equal(isolated.payload.summary.conversationVolume, 0);
  } finally {
    await close(server);
  }
});

test("engagement command center frontend route is wired without replacing existing modules", () => {
  const appRoutes = read("src/app/app.routes.ts");
  const commandRoutes = read("src/app/features/command-center/command-center.routes.ts");
  const appShell = read("src/app/app.component.ts");
  const page = read("src/app/pages/engagement-command-center.component.ts");
  assert.match(appRoutes, /path: 'engagement'/);
  assert.match(commandRoutes, /path: 'engagement'/);
  assert.match(appShell, /Engagement Center/);
  assert.match(appShell, /\/command-center\/engagement/);
  assert.match(page, /Unified client inbox/);
  assert.match(page, /channelFilters/);
  assert.match(page, /engagement\/audit/);
  assert.match(page, /Private note/);
  assert.match(page, /Client 360/);
  assert.match(page, /engagement\/clients\/\$\{clientId\}\/360/);
  assert.match(page, /Past invoices/);
  assert.match(page, /Preferred staff/);
  assert.match(page, /Files placeholder/);
  assert.match(page, /Allergies/);
  assert.match(page, /AI guest summary drawer/);
  assert.match(page, /engagement\/clients\/\$\{clientId\}\/ai-summary/);
  assert.match(page, /generatedAiSummary/);
  assert.match(page, /Insights/);
  assert.match(page, /Suggestions/);
  assert.match(page, /Next best action/);
  assert.match(page, /confidencePercent/);
  assert.match(page, /Provider not configured|providerWarning/);
  assert.match(page, /pending approval/);
  assert.match(page, /engagement\/messages\/draft/);
  assert.match(page, /engagement\/templates/);
  assert.match(page, /engagement\/templates\/\$\{template.id\}\/render/);
  assert.match(page, /loadTemplates/);
  assert.match(page, /templateVariables/);
  assert.match(page, /Book appointment/);
  assert.match(page, /Booking wizard/);
  assert.match(page, /engagement\/booking\/slot-preview/);
  assert.match(page, /engagement\/booking\/create/);
  assert.match(page, /selectedBookingSlot/);
  assert.match(page, /Due warning/);
  assert.match(page, /Open appointments/);
  assert.match(page, /Recovery board/);
  assert.match(page, /Recovery Opportunities/);
  assert.match(page, /engagement\/recovery-opportunities/);
  assert.match(page, /create-draft/);
  assert.match(page, /mark-done/);
  assert.match(page, /recoveryRevenueValue/);
  assert.match(page, /Convert/);
  assert.match(page, /Review Response Center/);
  assert.match(page, /engagement\/reviews/);
  assert.match(page, /ai-response/);
  assert.match(page, /approve-response/);
  assert.match(page, /send-response/);
  assert.match(page, /reviewTone/);
  assert.match(page, /Send\/post placeholder/);
  assert.match(page, /Risk signals/);
  assert.match(page, /AI Risk & Next Best Action/);
  assert.match(page, /engagement\/risk-signals/);
  assert.match(page, /reviewRiskSignal/);
  assert.match(page, /riskLevelFilter/);
  assert.match(page, /SLA board/);
  assert.match(page, /SLA & Staff Accountability/);
  assert.match(page, /engagement\/sla\/overdue/);
  assert.match(page, /engagement\/reports\/staff-accountability/);
  assert.match(page, /engagement\/manager-view/);
  assert.match(page, /escalateThreadFromSla/);
  assert.match(page, /Staff Performance/);
  assert.match(page, /Reports & Analytics/);
  assert.match(page, /Engagement performance center/);
  assert.match(page, /engagement\/reports/);
  assert.match(page, /engagement\/reports\/export\/\$\{format\}/);
  assert.match(page, /reportRecoveryTypeFilter/);
  assert.match(page, /reportClientSegmentFilter/);
  assert.match(page, /exportEngagementReport/);
  assert.match(page, /Template Performance/);
  assert.match(page, /WhatsApp Delivery/);
  assert.match(page, /Provider Readiness/);
  assert.match(page, /Communication provider adapters/);
  assert.match(page, /engagement\/providers\/readiness/);
  assert.match(page, /engagement\/providers\/config/);
  assert.match(page, /engagement\/providers\/\$\{id\}\/verify/);
  assert.match(page, /saveProviderConfig/);
  assert.match(page, /verifyProvider/);
  assert.match(page, /Enterprise Controls/);
  assert.match(page, /respectQuietHours/);
});
