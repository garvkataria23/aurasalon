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

function headers(role = "owner", tenantId = "tenant_aura") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role
  };
}

async function api(baseUrl, path, { method = "GET", body, role = "owner", tenantId = "tenant_aura" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(role, tenantId),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureOtherTenant() {
  const now = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, status, planId, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?)`).run("tenant_staff_other", "Other Staff Tenant", "staff-other", "active", plan?.id || null, now, now);
}

test("staff enterprise profile covers leave, payroll, commission, KYC, skills, notifications and transfers", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const branches = await api(baseUrl, "/branches?limit=2");
    assert.equal(branches.response.status, 200);
    const branch = branches.payload[0];
    const otherBranch = branches.payload[1] || branch;
    assert.ok(branch?.id);

    const uniqueStamp = String(Date.now()).slice(-8);
    const biometricCode = `BIO${uniqueStamp}`;
    const created = await api(baseUrl, "/staff", {
      method: "POST",
      body: {
        name: `Enterprise Staff ${uniqueStamp}`,
        role: "Stylist",
        branchId: branch.id,
        phone: `+91 98${uniqueStamp}`,
        status: "active",
        leaveBalance: { paid: 6 },
        multiBranchIds: [branch.id],
        weeklyOffs: ["Monday"],
        biometricConfig: { employeeCode: biometricCode, deviceId: "device_main" }
      }
    });
    assert.equal(created.response.status, 201);
    const staffId = created.payload.id;

    const profile = await api(baseUrl, `/staff-management/profile/${staffId}`);
    assert.equal(profile.response.status, 200);
    assert.equal(profile.payload.staff.id, staffId);

    const shift = await api(baseUrl, "/staff-management/shifts", {
      method: "POST",
      body: { staffId, branchId: branch.id, date: "2026-06-03", startTime: "10:00", endTime: "19:00" }
    });
    assert.equal(shift.response.status, 201);

    const movedShift = await api(baseUrl, `/staff-management/shifts/${shift.payload.id}/move`, {
      method: "POST",
      body: { branchId: branch.id, date: "2026-06-04", startTime: "11:00", endTime: "20:00" }
    });
    assert.equal(movedShift.response.status, 200);
    assert.equal(movedShift.payload.date, "2026-06-04");

    const biometric = await api(baseUrl, "/staff-management/biometric-events", {
      method: "POST",
      body: {
        employeeCode: biometricCode,
        deviceId: "device_main",
        branchId: branch.id,
        eventType: "clock_in",
        eventAt: "2026-06-04T11:00:00.000Z"
      }
    });
    assert.equal(biometric.response.status, 201);
    assert.equal(biometric.payload.event.staffId, staffId);
    assert.ok(biometric.payload.attendance.id);

    const leave = await api(baseUrl, "/staff-management/leave", {
      method: "POST",
      body: { staffId, branchId: branch.id, startDate: "2026-06-01", endDate: "2026-06-02", reason: "Family work" }
    });
    assert.equal(leave.response.status, 201);
    assert.equal(leave.payload.status, "pending");

    const blockedApproval = await api(baseUrl, `/staff-management/leave/${leave.payload.id}/approved`, {
      method: "POST",
      role: "staff",
      body: { reason: "try approve" }
    });
    assert.equal(blockedApproval.response.status, 403);

    const approvedLeave = await api(baseUrl, `/staff-management/leave/${leave.payload.id}/approved`, {
      method: "POST",
      body: { reason: "Approved" }
    });
    assert.equal(approvedLeave.response.status, 200);
    assert.equal(approvedLeave.payload.status, "approved");

    const payroll = await api(baseUrl, "/staff-management/payroll-components", {
      method: "POST",
      body: { staffId, branchId: branch.id, basic: 30000, hra: 10000, allowances: 5000, pf: 1800, pt: 200 }
    });
    assert.equal(payroll.response.status, 201);
    assert.equal(payroll.payload.netPay, 43000);

    const commission = await api(baseUrl, "/staff-management/commission-rules", {
      method: "POST",
      body: { staffId, branchId: branch.id, name: "Level 100 rule", servicePercent: 12, productPercent: 5, targetBonus: 1500 }
    });
    assert.equal(commission.response.status, 201);

    const doc = await api(baseUrl, "/staff-management/documents", {
      method: "POST",
      body: { staffId, branchId: branch.id, documentType: "PAN", documentNumber: "ABCDE1234F", status: "verified" }
    });
    assert.equal(doc.response.status, 201);

    const uploaded = await api(baseUrl, `/staff-management/documents/${doc.payload.id}/upload`, {
      method: "POST",
      body: {
        fileName: "pan-card.txt",
        mimeType: "text/plain",
        contentBase64: Buffer.from("PAN verification file").toString("base64")
      }
    });
    assert.equal(uploaded.response.status, 200);
    assert.equal(uploaded.payload.metadata.file.fileName, "pan-card.txt");

    const skill = await api(baseUrl, "/staff-management/skills", {
      method: "POST",
      body: { staffId, branchId: branch.id, skillName: "Advanced color", level: "expert", certificationStatus: "certified" }
    });
    assert.equal(skill.response.status, 201);

    const review = await api(baseUrl, "/staff-management/reviews", {
      method: "POST",
      body: { staffId, branchId: branch.id, rating: 5, feedback: "Great rebooking experience", rebookingFlag: true }
    });
    assert.equal(review.response.status, 201);

    const notification = await api(baseUrl, "/staff-management/notifications/draft", {
      method: "POST",
      body: { staffId, branchId: branch.id, type: "target_alert" }
    });
    assert.equal(notification.response.status, 201);
    assert.equal(notification.payload.status, "draft");

    const copied = await api(baseUrl, `/staff-management/notifications/${notification.payload.id}/copied`, { method: "POST" });
    assert.equal(copied.response.status, 200);
    assert.equal(copied.payload.status, "copied");

    const sendAttempt = await api(baseUrl, `/staff-management/notifications/${notification.payload.id}/send-whatsapp`, { method: "POST" });
    assert.equal(sendAttempt.response.status, 200);
    assert.equal(sendAttempt.payload.sent, false);
    assert.equal(sendAttempt.payload.providerConfigured, false);

    const transfer = await api(baseUrl, "/staff-management/transfers", {
      method: "POST",
      body: { staffId, fromBranchId: branch.id, toBranchId: otherBranch.id, effectiveDate: "2026-06-05", reason: "Capacity balancing" }
    });
    assert.equal(transfer.response.status, 201);
    assert.equal(transfer.payload.status, "pending");

    const approvedTransfer = await api(baseUrl, `/staff-management/transfers/${transfer.payload.id}/approve`, { method: "POST" });
    assert.equal(approvedTransfer.response.status, 200);
    assert.equal(approvedTransfer.payload.status, "approved");

    const after = await api(baseUrl, `/staff-management/profile/${staffId}`);
    assert.equal(after.response.status, 200);
    assert.ok(after.payload.shifts.some((row) => row.id === shift.payload.id && row.date === "2026-06-04"));
    assert.ok(after.payload.biometricEvents.some((row) => row.id === biometric.payload.event.id));
    assert.ok(after.payload.leaveRequests.some((row) => row.id === leave.payload.id));
    assert.ok(after.payload.payrollComponents.some((row) => row.id === payroll.payload.id));
    assert.ok(after.payload.commissionRules.some((row) => row.id === commission.payload.id));
    assert.ok(after.payload.documents.some((row) => row.id === doc.payload.id));
    assert.ok(after.payload.skills.some((row) => row.id === skill.payload.id));
    assert.ok(after.payload.reviews.some((row) => row.id === review.payload.id));
    assert.ok(after.payload.notifications.some((row) => row.id === notification.payload.id));
    assert.ok(after.payload.transfers.some((row) => row.id === transfer.payload.id));
    assert.ok(Array.isArray(after.payload.optimizer.suggestions));

    const payslip = await fetch(`${baseUrl}/staff-management/payroll-components/${payroll.payload.id}/payslip.pdf`, {
      headers: headers("owner", "tenant_aura")
    });
    assert.equal(payslip.status, 200);
    assert.match(payslip.headers.get("content-type") || "", /application\/pdf/);
    assert.equal(Buffer.from(await payslip.arrayBuffer()).toString("utf8", 0, 4), "%PDF");
  } finally {
    await close(server);
  }
});

test("staff enterprise profile is tenant isolated", async () => {
  ensureOtherTenant();
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const branches = await api(baseUrl, "/branches?limit=1");
    const branch = branches.payload[0];
    const created = await api(baseUrl, "/staff", {
      method: "POST",
      body: { name: `Tenant Staff ${Date.now()}`, role: "Stylist", branchId: branch.id }
    });
    assert.equal(created.response.status, 201);

    const leaked = await api(baseUrl, `/staff-management/profile/${created.payload.id}`, {
      tenantId: "tenant_staff_other"
    });
    assert.equal(leaked.response.status, 404);
  } finally {
    await close(server);
  }
});
