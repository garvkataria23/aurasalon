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

const headers = {
  "content-type": "application/json",
  "x-tenant-id": "tenant_aura",
  "x-user-role": "owner"
};

async function request(baseUrl, path, { method = "GET", body, role = "owner", extraHeaders = {} } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: { ...headers, "x-user-role": role, ...extraHeaders },
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, body: text ? JSON.parse(text) : null };
}

test("sales checkout creates sale.checkout audit event", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const checkout = await request(baseUrl, "/sales/checkout", {
      method: "POST",
      body: {
        clientId: "client_riya",
        branchId: "branch_hyd",
        items: [{ id: "svc_haircut", type: "service", quantity: 1 }],
        payments: [{ mode: "cash", amount: 1200 }]
      }
    });
    assert.equal(checkout.response.status, 201);
    const saleId = checkout.body.sale?.id || checkout.body.id;
    assert.ok(saleId);

    const audit = await request(baseUrl, "/security/audit?action=sale.checkout");
    assert.equal(audit.response.status, 200);
    assert.ok(Array.isArray(audit.body.auditLogs));
    assert.ok(audit.body.auditLogs.some((row) => row.action === "sale.checkout" && row.targetId === saleId));
  } finally {
    await close(server);
  }
});

test("client delete creates client.deleted audit event", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const created = await request(baseUrl, "/clients", {
      method: "POST",
      body: {
        name: "Audit Test User",
        phone: "+91 99999 00001",
        createdAt: "2000-01-01T00:00:00.000Z",
        updatedAt: "2000-01-01T00:00:00.000Z"
      }
    });
    assert.equal(created.response.status, 201);
    const clientId = created.body.id;
    assert.ok(clientId);

    const deleted = await request(baseUrl, `/clients/${clientId}`, { method: "DELETE" });
    assert.equal(deleted.response.status, 200);
    assert.equal(deleted.body.deleted, true);

    const audit = await request(baseUrl, "/security/audit?action=client.deleted");
    assert.equal(audit.response.status, 200);
    assert.ok(Array.isArray(audit.body.auditLogs));
    assert.ok(audit.body.auditLogs.some((row) => row.action === "client.deleted" && row.targetId === clientId));
  } finally {
    await close(server);
  }
});

test("POS invoice delete waits for manager approval before soft delete", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const checkout = await request(baseUrl, "/sales/checkout", {
      method: "POST",
      body: {
        clientId: "client_riya",
        branchId: "branch_hyd",
        items: [{ type: "custom", name: "Approval test service", quantity: 1, price: 12000, gstRate: 18 }],
        payments: [{ mode: "cash", amount: 12000 }]
      }
    });
    assert.equal(checkout.response.status, 201);
    const invoice = checkout.body.invoice;
    assert.ok(invoice?.id);

    const approval = await request(baseUrl, `/pos/invoices/${invoice.id}/delete`, {
      method: "POST",
      role: "frontDesk",
      body: {
        actionType: "delete",
        reason: "Duplicate invoice approval test",
        ownerPin: "1234",
        invoice: {
          id: invoice.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || invoice.id,
          branchId: "branch_hyd",
          clientName: "Riya Sharma",
          staffName: "Unassigned",
          total: 12000,
          paid: 12000,
          balance: 0,
          payments: [{ mode: "cash", amount: 12000 }],
          items: [{ type: "product", name: "Audit shampoo", quantity: 2, price: 6000, sku: "AUDIT-SHAMPOO" }],
          status: invoice.status || "paid"
        }
      }
    });
    assert.equal(approval.response.status, 202);
    assert.equal(approval.body.status, "pending");

    const beforeApprove = await request(baseUrl, `/invoices/${invoice.id}`);
    assert.equal(beforeApprove.response.status, 200);
    assert.notEqual(beforeApprove.body.status, "deleted");

    const activity = await request(baseUrl, `/invoice-activity?q=${invoice.id}`);
    assert.equal(activity.response.status, 200);
    assert.ok(activity.body.rows.some((row) => row.id === approval.body.id && row.status === "pending_approval"));

    const posActivity = await request(baseUrl, `/pos/invoice-activity?q=${invoice.id}`);
    assert.equal(posActivity.response.status, 200);
    assert.ok(posActivity.body.rows.some((row) => row.id === approval.body.id));

    const activityDetail = await request(baseUrl, `/pos/invoice-activity/${approval.body.id}`);
    assert.equal(activityDetail.response.status, 200);
    assert.equal(activityDetail.body.id, approval.body.id);
    assert.equal(activityDetail.body.invoiceId, invoice.id);

    const otherTenantDetail = await request(baseUrl, `/pos/invoice-activity/${approval.body.id}`, {
      extraHeaders: { "x-tenant-id": "tenant_other" }
    });
    assert.equal(otherTenantDetail.response.status, 404);

    const missingDetail = await request(baseUrl, "/pos/invoice-activity/not-real-activity");
    assert.equal(missingDetail.response.status, 404);

    const denied = await request(baseUrl, `/pos/invoices/${invoice.id}/approve`, {
      method: "POST",
      role: "staff",
      body: { activityId: approval.body.id, ownerPin: "1234" }
    });
    assert.equal(denied.response.status, 403);

    const approved = await request(baseUrl, `/pos/invoices/${invoice.id}/approve`, {
      method: "POST",
      role: "manager",
      body: { activityId: approval.body.id, ownerPin: "1234" }
    });
    assert.equal(approved.response.status, 200);
    assert.equal(approved.body.status, "approved");

    const afterApprove = await request(baseUrl, `/invoices/${invoice.id}`);
    assert.equal(afterApprove.response.status, 200);
    assert.equal(afterApprove.body.status, "deleted");

    const staffRestore = await request(baseUrl, `/pos/invoices/${invoice.id}/restore`, {
      method: "POST",
      role: "staff",
      body: { reason: "Staff should not restore invoices" }
    });
    assert.equal(staffRestore.response.status, 403);

    const restored = await request(baseUrl, `/pos/invoices/${invoice.id}/restore`, {
      method: "POST",
      role: "manager",
      body: { reason: "Manager restore after duplicate review" }
    });
    assert.equal(restored.response.status, 200);
    assert.equal(restored.body.status, "restored");

    const editClosed = await request(baseUrl, `/pos/invoices/${invoice.id}/approval-request`, {
      method: "POST",
      role: "cashier",
      body: {
        actionType: "edit",
        reason: "Closed invoice correction should use adjustment note",
        ownerPin: "1234",
        invoice: {
          id: invoice.id,
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || invoice.id,
          branchId: "branch_hyd",
          status: "paid",
          total: 12000,
          paid: 12000,
          balance: 0
        }
      }
    });
    assert.equal(editClosed.response.status, 409);
    assert.equal(editClosed.body.details.requiresAdjustmentNote, true);

    const adjustment = await request(baseUrl, `/pos/invoices/${invoice.id}/adjustment-note`, {
      method: "POST",
      role: "cashier",
      body: {
        type: "credit_note",
        amount: 500,
        reason: "Closed invoice correction tracked as credit note"
      }
    });
    assert.equal(adjustment.response.status, 201);
    assert.equal(adjustment.body.status, "recorded");

    const immutableAudit = await request(baseUrl, `/auditLogs/${approval.body.id}`, {
      method: "PATCH",
      body: { action: "tamper" }
    });
    assert.equal(immutableAudit.response.status, 405);

    const reports = await request(baseUrl, `/pos/invoice-activity/reports?q=${invoice.id}`);
    assert.equal(reports.response.status, 200);
    assert.ok(reports.body.summary.deletions >= 1);
    assert.ok(reports.body.summary.restorations >= 1);
    assert.ok(reports.body.summary.highRiskActivities >= 1);
    assert.ok(reports.body.exportRows.some((row) => ["high", "critical"].includes(row.riskLevel)));
    assert.ok(reports.body.exportRows.some((row) => String(row.riskReason || "").includes("High cash invoice delete alert")));
    assert.ok(reports.body.exportRows.some((row) => String(row.riskReason || "").includes("Stock reversal mismatch warning")));
    assert.ok(reports.body.dailyEditDeleteReport.some((row) => row.deletions >= 1));
    assert.ok(reports.body.deletedInvoiceReport.some((row) => row.invoiceNumber === (invoice.invoiceNumber || invoice.id)));

    const csvResponse = await fetch(`${baseUrl}/pos/invoice-activity/reports?q=${invoice.id}&format=csv`, {
      headers
    });
    assert.equal(csvResponse.status, 200);
    assert.match(csvResponse.headers.get("content-type") || "", /text\/csv/);
    const csv = await csvResponse.text();
    assert.match(csv, /invoiceNumber/);
    assert.match(csv, /riskLevel/);
    assert.ok(csv.includes(invoice.invoiceNumber || invoice.id));

    const pdfResponse = await fetch(`${baseUrl}/pos/invoice-activity/reports?q=${invoice.id}&format=pdf`, {
      headers
    });
    assert.equal(pdfResponse.status, 200);
    assert.match(pdfResponse.headers.get("content-type") || "", /application\/pdf/);
    const pdf = Buffer.from(await pdfResponse.arrayBuffer()).toString("utf8");
    assert.match(pdf, /%PDF-1.4/);
  } finally {
    await close(server);
  }
});

test("invoice activity applies Level 9 smart risk detection", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const checkout = await request(baseUrl, "/sales/checkout", {
      method: "POST",
      body: {
        clientId: "client_riya",
        branchId: "branch_hyd",
        items: [{ type: "custom", name: "Risk edit service", quantity: 1, price: 15000, gstRate: 18 }],
        payments: []
      }
    });
    assert.equal(checkout.response.status, 201);
    const invoice = checkout.body.invoice;
    assert.ok(invoice?.id);
    db.prepare(
      `UPDATE invoices
          SET status = 'unpaid',
              payment_status = 'unpaid',
              paid = 0,
              paid_amount = 0,
              balance = 15000,
              due_amount = 15000,
              discount = 0,
              discount_total = 0,
              total = 15000,
              grand_total = 15000,
              updatedAt = @updatedAt,
              updated_at = @updatedAt
        WHERE id = @id`
    ).run({ id: invoice.id, updatedAt: new Date().toISOString() });

    const edited = await request(baseUrl, `/pos/invoices/${invoice.id}/edit`, {
      method: "PATCH",
      role: "manager",
      body: {
        reason: "Risk scoring edit test",
        invoice: {
          branchId: "branch_hyd",
          status: "unpaid",
          total: 15000,
          paid: 0,
          balance: 15000,
          discount: 3000
        }
      }
    });
    assert.equal(edited.response.status, 200);

    const activity = await request(baseUrl, `/invoice-activity?q=${invoice.id}`);
    assert.equal(activity.response.status, 200);
    const riskRow = activity.body.rows.find((row) => row.actionType === "edited" && String(row.invoiceId) === String(invoice.id));
    assert.ok(riskRow);
    assert.ok(["high", "critical"].includes(riskRow.riskLevel));
    assert.match(riskRow.riskReason, /Suspicious discount change warning/);
    assert.match(riskRow.riskReason, /High due invoice edit warning/);
    assert.match(riskRow.suggestedAction, /balance|approval|discount|policy/i);
  } finally {
    await close(server);
  }
});

test("day-close lock blocks direct POS invoice edits", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const suffix = Date.now();
  const branchId = `branch_level8_${suffix}`;
  try {
    const stamp = new Date().toISOString();
    db.prepare(`INSERT OR IGNORE INTO branches (id, name, city, status, createdAt, updatedAt, tenantId)
      VALUES (?, ?, 'Hyderabad', 'active', ?, ?, 'tenant_aura')`)
      .run(branchId, `Level 8 Lock Branch ${suffix}`, stamp, stamp);

    const checkout = await request(baseUrl, "/sales/checkout", {
      method: "POST",
      body: {
        clientId: "client_riya",
        branchId,
        items: [{ type: "custom", name: "Day close lock test", quantity: 1, price: 900, gstRate: 18 }],
        payments: []
      }
    });
    assert.equal(checkout.response.status, 201);
    const invoice = checkout.body.invoice;
    assert.ok(invoice?.id);
    const businessDate = String(invoice.createdAt || new Date().toISOString()).slice(0, 10);

    const locked = await request(baseUrl, `/day-close/${branchId}/${businessDate}/lock`, {
      method: "POST",
      role: "owner",
      body: { reason: "Level 8 lock test" }
    });
    assert.equal(locked.response.status, 200);
    assert.equal(locked.body.status, "locked");

    const edit = await request(baseUrl, `/pos/invoices/${invoice.id}/edit`, {
      method: "PATCH",
      role: "manager",
      body: {
        reason: "Try edit after day close",
        invoice: {
          branchId,
          createdAt: `${businessDate}T10:00:00.000Z`,
          status: "unpaid",
          total: 900,
          paid: 0,
          balance: 900
        }
      }
    });
    assert.equal(edit.response.status, 409);
    assert.equal(edit.body.details.requiresAdjustmentNote, true);
    assert.match(edit.body.error, /day close/i);
  } finally {
    await close(server);
  }
});
