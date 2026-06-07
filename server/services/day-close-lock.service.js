import { randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";

const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

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
    const current = this.status(branchId, businessDate, access);
    if (current.status === "locked") return current;
    const id = makeId("dclk");
    db.prepare(
      `INSERT INTO day_close_locks (id, tenant_id, branch_id, business_date, status, locked_by, locked_at, created_at)
       VALUES (?, ?, ?, ?, 'locked', ?, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run(id, access.tenantId, branchId, businessDate, access.userId || "");
    return this.status(branchId, businessDate, access);
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
