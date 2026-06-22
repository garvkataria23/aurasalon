import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { normalizeBusinessDate } from "../utils/finance-time.js";
import { ensureAdvancedSchema } from "./balance-sheet-advanced-schema.service.js";
import { balanceSheetService } from "./balance-sheet.service.js";

const id = (p) => `${p}_${randomUUID().slice(0, 12)}`;
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;

function scope(access = {}, branchId = "") {
  ensureAdvancedSchema();
  if (!access.tenantId) throw badRequest("Tenant context is required");
  tenantService.ensureSubscriptionActive(access.tenantId);
  const requestedBranch = branchId || access.requestedBranchId || "";
  if (requestedBranch) tenantService.assertBranchAccess(access, requestedBranch);
  return { tenantId: access.tenantId, branchId: requestedBranch };
}

// Stage 22 — cost centers (chair / stylist / category) and dimensional P&L.
// Journals stay standard double-entry; a side table tags lines so the owner can
// see profit per chair / stylist / service category without altering the ledger.
export const dimensionService = {
  createCostCenter(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const code = String(payload.code || "").trim();
    const name = String(payload.name || "").trim();
    if (!code || !name) throw badRequest("code and name are required");
    const type = ["chair", "stylist", "category", "department", "custom"].includes(payload.type) ? payload.type : "custom";
    const ccId = id("cc");
    db.prepare(`
      INSERT OR IGNORE INTO costCenters (id, tenantId, branchId, code, name, type)
      VALUES (@id, @tenantId, @branchId, @code, @name, @type)
    `).run({ id: ccId, tenantId, branchId, code, name, type });
    return db.prepare("SELECT * FROM costCenters WHERE tenantId=? AND branchId=? AND code=?").get(tenantId, branchId, code);
  },

  listCostCenters(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    return db.prepare("SELECT * FROM costCenters WHERE tenantId=? AND branchId=? ORDER BY type, code").all(tenantId, branchId);
  },

  // Post a journal (via the immutable ledger) and tag chosen lines with a cost
  // center. Each input line may carry costCenterId. Idempotent on re-post.
  postJournalWithDimensions(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const entry = balanceSheetService.createJournal(payload, access);

    const already = db.prepare(
      "SELECT COUNT(*) AS n FROM journalLineDimensions WHERE tenantId=? AND journalEntryId=?"
    ).get(tenantId, entry.id).n;
    if (already === 0) {
      const posted = [...entry.lines];
      const insert = db.prepare(`
        INSERT INTO journalLineDimensions (id, tenantId, branchId, journalEntryId, lineId, costCenterId, amountPaise, side)
        VALUES (@id, @tenantId, @branchId, @journalEntryId, @lineId, @costCenterId, @amountPaise, @side)
      `);
      for (const input of (payload.lines || [])) {
        if (!input.costCenterId) continue;
        const debit = Math.round(Number(input.debitPaise || 0));
        const credit = Math.round(Number(input.creditPaise || 0));
        const matchIdx = posted.findIndex((l) => l.accountId === input.accountId && l.debitPaise === debit && l.creditPaise === credit);
        if (matchIdx === -1) continue;
        const line = posted.splice(matchIdx, 1)[0];
        insert.run({
          id: id("jld"), tenantId, branchId: entry.branchId, journalEntryId: entry.id,
          lineId: line.id, costCenterId: input.costCenterId,
          amountPaise: debit || credit, side: debit ? "debit" : "credit"
        });
      }
    }
    return entry;
  },

  dimensionalProfitLoss(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const fromDate = String(query.fromDate || "0000-01-01").slice(0, 10);
    const toDate = normalizeBusinessDate(query.toDate, { allowFuture: true });
    const rows = db.prepare(`
      SELECT cc.code, cc.name, cc.type,
        SUM(CASE WHEN a.accountType='income' THEN (CASE WHEN d.side='credit' THEN d.amountPaise ELSE -d.amountPaise END) ELSE 0 END) AS incomePaise,
        SUM(CASE WHEN a.accountType='expense' THEN (CASE WHEN d.side='debit' THEN d.amountPaise ELSE -d.amountPaise END) ELSE 0 END) AS expensePaise
      FROM journalLineDimensions d
      JOIN costCenters cc ON cc.id = d.costCenterId AND cc.tenantId = d.tenantId
      JOIN journalEntryLines l ON l.id = d.lineId AND l.tenantId = d.tenantId
      JOIN chartOfAccounts a ON a.id = l.accountId AND a.tenantId = l.tenantId
      JOIN journalEntries e ON e.id = d.journalEntryId AND e.tenantId = d.tenantId
        AND e.status = 'posted' AND e.businessDate BETWEEN @fromDate AND @toDate
      WHERE d.tenantId = @tenantId ${branchId ? "AND cc.branchId = @branchId" : ""}
      GROUP BY cc.id ORDER BY (incomePaise - expensePaise) DESC
    `).all(branchId ? { tenantId, branchId, fromDate, toDate } : { tenantId, fromDate, toDate });
    return {
      fromDate, toDate,
      costCenters: rows.map((r) => ({
        code: r.code, name: r.name, type: r.type,
        income: rupees(r.incomePaise), expense: rupees(r.expensePaise),
        netProfit: rupees(Number(r.incomePaise || 0) - Number(r.expensePaise || 0))
      }))
    };
  }
};