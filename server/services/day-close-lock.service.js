import { randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";

const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;
const SETTLED_RECON_STATUSES = new Set(["matched", "reviewed", "resolved"]);

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function requireTable(table) {
  if (!safeColumns(table).length) throw badRequest(`${table} migration is not applied`);
}

function providerKey(mode = "", provider = "") {
  const value = String(provider || mode || "").trim().toLowerCase().replace(/\s+/g, "_");
  if (["cash"].includes(value)) return "cash";
  if (["razorpay"].includes(value)) return "razorpay";
  if (["upi", "gpay", "googlepay", "paytm", "phonepe"].includes(value)) return "upi";
  if (["card", "credit_card", "debit_card", "credit", "debit"].includes(value)) return "card";
  if (["bank", "bank_transfer", "neft", "rtgs", "imps"].includes(value)) return "bank";
  return value || "bank";
}

export class DayCloseLockService {
  status(branchId, businessDate, access = {}) {
    requireTable("day_close_locks");
    const row = db
      .prepare("SELECT * FROM day_close_locks WHERE tenant_id = ? AND branch_id = ? AND business_date = ? ORDER BY created_at DESC LIMIT 1")
      .get(access.tenantId, branchId, businessDate);
    return row || { tenant_id: access.tenantId, branch_id: branchId, business_date: businessDate, status: "open" };
  }

  assertOpen(branchId, businessDate, access = {}) {
    const state = this.status(branchId, businessDate, access);
    if (state.status === "locked") throw conflict("Business date is locked after day close", { branchId, businessDate });
    return true;
  }

  lock(branchId, businessDate, payload = {}, access = {}) {
    requireTable("day_close_locks");
    if (!branchId || !businessDate) throw badRequest("branchId and date are required");
    const openDrawer = db
      .prepare("SELECT id FROM cash_drawer_sessions WHERE tenant_id = ? AND branch_id = ? AND status = 'open' LIMIT 1")
      .get(access.tenantId, branchId);
    if (openDrawer) throw conflict("Cannot close day while a cash drawer is open", { cashDrawerId: openDrawer.id });
    const pendingDraft = db
      .prepare("SELECT id FROM invoices WHERE tenant_id = ? AND branch_id = ? AND status = 'draft' AND paid_amount > 0 LIMIT 1")
      .get(access.tenantId, branchId);
    if (pendingDraft) throw conflict("Cannot close day while draft invoices have payments", { invoiceId: pendingDraft.id });
    const evidenceBlockers = this.lockEvidenceBlockers(branchId, businessDate, access);
    if (evidenceBlockers.length) {
      throw conflict("Cannot lock day until closing evidence is complete", { blockers: evidenceBlockers });
    }
    const current = this.status(branchId, businessDate, access);
    if (current.status === "locked") return current;
    const id = makeId("dclk");
    db.prepare(
      `INSERT INTO day_close_locks (id, tenant_id, branch_id, business_date, status, locked_by, locked_at, created_at)
       VALUES (?, ?, ?, ?, 'locked', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(id, access.tenantId, branchId, businessDate, access.userId || "");
    return this.status(branchId, businessDate, access);
  }

  lockEvidenceBlockers(branchId, businessDate, access = {}) {
    const blockers = [];
    const zReport = safeColumns("z_reports").length
      ? db.prepare("SELECT id FROM z_reports WHERE tenant_id = ? AND branch_id = ? AND business_date = ? LIMIT 1").get(access.tenantId, branchId, businessDate)
      : null;
    if (!zReport) blockers.push("Z_REPORT_MISSING");

    if (safeColumns("glOutbox").length) {
      const outbox = db.prepare(
        `SELECT status, COUNT(*) AS total
           FROM glOutbox
          WHERE tenantId = ? AND branchId = ? AND businessDate = ?
            AND status IN ('pending', 'failed')
          GROUP BY status`
      ).all(access.tenantId, branchId, businessDate);
      for (const row of outbox) {
        blockers.push(`GL_OUTBOX_${String(row.status || "").toUpperCase()}_${Number(row.total || 0)}`);
      }
    }

    if (safeColumns("invoice_payments").length && safeColumns("invoices").length) {
      const rows = db.prepare(
        `SELECT ip.payment_mode, ip.provider, SUM(ip.amount) AS amount
           FROM invoice_payments ip
           JOIN invoices i ON i.tenant_id = ip.tenant_id AND i.id = ip.invoice_id
          WHERE ip.tenant_id = ?
            AND i.branch_id = ?
            AND ip.status = 'paid'
            AND date(COALESCE(NULLIF(ip.paid_at, ''), ip.created_at)) = date(?)
          GROUP BY ip.payment_mode, ip.provider`
      ).all(access.tenantId, branchId, businessDate);
      const providers = [...new Set(rows.map((row) => providerKey(row.payment_mode, row.provider)).filter((provider) => provider && provider !== "cash"))];
      for (const provider of providers) {
        const recon = safeColumns("payment_reconciliation").length
          ? db.prepare(
            `SELECT status
               FROM payment_reconciliation
              WHERE tenant_id = ? AND branch_id = ? AND settlement_date = ? AND provider = ?
              ORDER BY created_at DESC
              LIMIT 1`
          ).get(access.tenantId, branchId, businessDate, provider)
          : null;
        if (!recon) blockers.push(`PAYMENT_RECONCILIATION_MISSING_${provider.toUpperCase()}`);
        else if (!SETTLED_RECON_STATUSES.has(String(recon.status || "").toLowerCase())) blockers.push(`PAYMENT_RECONCILIATION_${String(recon.status || "OPEN").toUpperCase()}_${provider.toUpperCase()}`);
      }
    }
    return blockers;
  }

  reopen(branchId, businessDate, payload = {}, access = {}) {
    if (!["owner", "admin", "superAdmin"].includes(access.role)) throw forbidden("Only admin or owner can reopen a closed day");
    const reason = payload.reason || payload.reopen_reason;
    if (!reason) throw badRequest("reopen reason is required");
    const current = this.status(branchId, businessDate, access);
    if (current.status !== "locked") throw notFound("Locked day close not found");
    db.prepare(
      `UPDATE day_close_locks
          SET status = 'reopened', reopened_by = ?, reopened_at = CURRENT_TIMESTAMP, reopen_reason = ?
        WHERE tenant_id = ? AND id = ?`
    ).run(access.userId || "", reason, access.tenantId, current.id);
    return this.status(branchId, businessDate, access);
  }
}

export const dayCloseLockService = new DayCloseLockService();
