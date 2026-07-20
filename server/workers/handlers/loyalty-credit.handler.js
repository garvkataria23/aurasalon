import { db } from "../../db.js";
import { loyaltyService } from "../../services/loyalty.service.js";

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

export async function run(job) {
  const payload = job.payload || {};
  const customerId = payload.customerId || payload.clientId || payload.customer_id || "";
  if (!job.tenantId || !customerId) return { success: false, error: "tenantId and customerId are required" };

  const invoiceId = payload.invoiceId || payload.invoice_id || "";
  const invoice = invoiceId ? scopedById("invoices", invoiceId, job.tenantId) : null;
  const points = Number(payload.points || (invoice ? Math.floor(Number(invoice.total || invoice.total_amount || 0) / 100) : 0));
  if (!points) return { success: true, skipped: true, reason: "zero_loyalty_points" };

  const access = { tenantId: job.tenantId, userId: "job-worker", role: "owner", branchId: payload.branchId || invoice?.branch_id || invoice?.branchId || "" };
  const transaction = loyaltyService.transact({
    customerId,
    invoiceId,
    type: payload.type || "earn",
    points,
    description: payload.description || "Background loyalty credit"
  }, access);
  const clientTenantColumn = tenantColumn("clients");
  const clientTenantClause = clientTenantColumn ? ` AND (${clientTenantColumn} = @tenantId OR @tenantId = '')` : "";
  db.prepare(
    `UPDATE clients
     SET loyaltyPoints = @balanceAfter,
         updatedAt = CURRENT_TIMESTAMP
     WHERE id = @customerId${clientTenantClause}`
  ).run({ balanceAfter: transaction.balanceAfter, customerId, tenantId: job.tenantId });
  return { success: true, transactionId: transaction.id, customerId, points: transaction.points, balanceAfter: transaction.balanceAfter };
}
