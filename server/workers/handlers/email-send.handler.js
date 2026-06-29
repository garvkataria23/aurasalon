import { randomUUID } from "node:crypto";
import { db } from "../../db.js";

function id(prefix) {
  return `${prefix}_${randomUUID().slice(0, 10)}`;
}

function tableHasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
}

function tenantColumn(table) {
  if (tableHasColumn(table, "tenantId")) return "tenantId";
  if (tableHasColumn(table, "tenant_id")) return "tenant_id";
  return "";
}

function scopedById(table, idValue, tenantId) {
  const column = tenantColumn(table);
  const tenantClause = column ? ` AND (${column} = @tenantId OR @tenantId = '')` : "";
  return db.prepare(`SELECT * FROM ${table} WHERE id = @id${tenantClause}`).get({ id: idValue, tenantId: tenantId || "" });
}

function invoiceContext(tenantId, invoiceId) {
  if (!invoiceId) return {};
  const invoice = scopedById("invoices", invoiceId, tenantId);
  if (!invoice) return {};
  const clientId = invoice.customer_id || invoice.customerId || invoice.clientId || "";
  const client = clientId ? scopedById("clients", clientId, tenantId) : {};
  return { invoice, client: client || {} };
}

export async function run(job) {
  const payload = job.payload || {};
  const { invoice, client } = invoiceContext(job.tenantId, payload.invoiceId || payload.invoice_id || "");
  const recipient = payload.to || payload.email || client?.email || "";
  if (!job.tenantId) return { success: false, error: "tenantId is required" };
  if (!recipient) return { success: true, skipped: true, reason: "missing_email_recipient" };

  const subject = payload.subject || `Aura Salon update${invoice?.invoice_no || invoice?.invoiceNumber ? ` - ${invoice.invoice_no || invoice.invoiceNumber}` : ""}`;
  const attachments = Array.isArray(payload.attachments) ? payload.attachments : [];
  const attachmentLine = attachments.length ? `\n\nAttachments: ${attachments.map((item) => item.filename || "report.pdf").join(", ")}` : "";
  const message = `${payload.message || payload.body || `${subject}\n\nThis email is queued for ${recipient}.`}${attachmentLine}`;
  const notificationId = id("email");
  db.prepare(
    `INSERT INTO notifications (id, clientId, type, channel, message, status, createdAt)
     VALUES (@id, @clientId, @type, 'email', @message, 'queued', CURRENT_TIMESTAMP)`
  ).run({
    id: notificationId,
    clientId: payload.clientId || client?.id || "",
    type: payload.type || payload.template || "email_send",
    message
  });
  db.prepare(
    `INSERT INTO audit_logs (id, tenantId, branchId, actorUserId, action, entityType, entityId, severity, details, createdAt, updatedAt)
     VALUES (@id, @tenantId, @branchId, 'job-worker', 'email.queued', @entityType, @entityId, 'info', @details, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run({
    id: id("audit"),
    tenantId: job.tenantId,
    branchId: payload.branchId || invoice?.branch_id || invoice?.branchId || "",
    entityType: payload.invoiceId || payload.invoice_id ? "invoice" : "notification",
    entityId: payload.invoiceId || payload.invoice_id || notificationId,
    details: JSON.stringify({ to: recipient, subject, notificationId, attachments: attachments.map((item) => ({ filename: item.filename, contentType: item.contentType })) })
  });
  return { success: true, notificationId, recipient, status: "queued" };
}
