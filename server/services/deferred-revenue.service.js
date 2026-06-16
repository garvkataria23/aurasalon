import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { istToday, normalizeBusinessDate } from "../utils/finance-time.js";
import { ensureAdvancedSchema, ensureAdvancedAccounts } from "./balance-sheet-advanced-schema.service.js";
import { balanceSheetService } from "./balance-sheet.service.js";

const id = (p) => `${p}_${randomUUID().slice(0, 12)}`;
const money = (v) => Math.round(Number(v || 0));
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;
const PAYMENT_ASSET = { cash: "1000", bank: "1010" };

function scope(access = {}, branchId = "") {
  ensureAdvancedSchema();
  if (!access.tenantId) throw badRequest("Tenant context is required");
  tenantService.ensureSubscriptionActive(access.tenantId);
  const requestedBranch = branchId || access.requestedBranchId || "";
  if (requestedBranch) tenantService.assertBranchAccess(access, requestedBranch);
  ensureAdvancedAccounts(access.tenantId, requestedBranch);
  return { tenantId: access.tenantId, branchId: requestedBranch };
}

function accountId(tenantId, branchId, code) {
  const row = db.prepare("SELECT id FROM chartOfAccounts WHERE tenantId=? AND branchId=? AND code=?").get(tenantId, branchId, code);
  if (!row) throw badRequest(`Account ${code} missing`);
  return row.id;
}

function monthsElapsed(startDate, asOfDate) {
  const [sy, sm] = startDate.split("-").map(Number);
  const [ay, am] = asOfDate.split("-").map(Number);
  return Math.max(0, (ay - sy) * 12 + (am - sm) + 1); // inclusive of the start month
}

// Stage 23 — prepaid value is booked as a deferred-revenue LIABILITY at sale,
// then recognised to income over time (straight line) or as consumed (on usage).
// Paise are conserved exactly: the final period absorbs any rounding remainder.
export const deferredRevenueService = {
  createSchedule(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const sourceType = ["package", "membership", "giftcard", "prepaid"].includes(payload.sourceType) ? payload.sourceType : "package";
    const sourceId = String(payload.sourceId || id("src"));
    const totalPaise = money(payload.totalPaise);
    if (totalPaise <= 0) throw badRequest("totalPaise must be > 0");
    const method = payload.method === "on_usage" ? "on_usage" : "straight_line";
    const periods = method === "straight_line" ? Math.max(1, Number(payload.periods) || 1) : 0;
    const startDate = normalizeBusinessDate(payload.startDate || istToday());
    const paymentMode = PAYMENT_ASSET[payload.paymentMode] ? payload.paymentMode : "bank";

    const scheduleId = id("def");
    const existing = db.prepare("SELECT * FROM deferredSchedules WHERE tenantId=? AND sourceType=? AND sourceId=?").get(tenantId, sourceType, sourceId);
    if (existing) return this.scheduleView(existing);

    // Sale entry: Dr Cash/Bank, Cr Deferred Revenue (liability).
    balanceSheetService.createJournal({
      branchId, businessDate: startDate, sourceType: `deferred.${sourceType}`, sourceId,
      memo: payload.memo || `${sourceType} sale`,
      idempotencyKey: `deferred-sale:${tenantId}:${sourceType}:${sourceId}`,
      lines: [
        { accountId: accountId(tenantId, branchId, PAYMENT_ASSET[paymentMode]), debitPaise: totalPaise },
        { accountId: accountId(tenantId, branchId, "2300"), creditPaise: totalPaise }
      ]
    }, access);

    db.prepare(`
      INSERT INTO deferredSchedules (id, tenantId, branchId, sourceType, sourceId, customerId, totalPaise, method, startDate, periods, paymentMode)
      VALUES (@id, @tenantId, @branchId, @sourceType, @sourceId, @customerId, @totalPaise, @method, @startDate, @periods, @paymentMode)
    `).run({
      id: scheduleId, tenantId, branchId, sourceType, sourceId,
      customerId: String(payload.customerId || ""), totalPaise, method, startDate, periods, paymentMode
    });
    return this.scheduleView(db.prepare("SELECT * FROM deferredSchedules WHERE id=?").get(scheduleId));
  },

  // Straight-line recognition for everything due as of a date (idempotent).
  recognizeDue(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const asOfDate = normalizeBusinessDate(payload.asOfDate || istToday());
    const due = db.prepare(
      "SELECT * FROM deferredSchedules WHERE tenantId=? AND status='active' AND method='straight_line' AND startDate<=?"
    ).all(tenantId, asOfDate);
    const summary = { recognized: 0, totalPaise: 0, schedules: [] };
    for (const s of due) {
      const targetPeriods = Math.min(s.periods, monthsElapsed(s.startDate, asOfDate));
      const donePeriods = db.prepare("SELECT COUNT(*) AS n FROM deferredRecognitions WHERE tenantId=? AND scheduleId=?").get(tenantId, s.id).n;
      let posted = 0;
      for (let p = donePeriods; p < targetPeriods; p++) {
        const amount = this.postRecognition(s, p, asOfDate, access, tenantId, branchId);
        summary.totalPaise += amount;
        posted++;
      }
      if (posted) { summary.recognized++; summary.schedules.push({ sourceId: s.sourceId, periodsPosted: posted }); }
    }
    return { asOfDate, ...summary, totalRecognized: rupees(summary.totalPaise) };
  },

  // Usage-based recognition (e.g. consume part of a package on a salon visit).
  recognizeUsage(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const s = db.prepare("SELECT * FROM deferredSchedules WHERE tenantId=? AND sourceType=? AND sourceId=?")
      .get(tenantId, payload.sourceType || "package", String(payload.sourceId || ""));
    if (!s) throw notFound("Deferred schedule not found");
    if (s.status !== "active") throw badRequest(`Schedule is ${s.status}`);
    const remaining = s.totalPaise - s.recognizedPaise;
    const amount = Math.min(money(payload.amountPaise), remaining);
    if (amount <= 0) throw badRequest("Nothing left to recognize");
    const periodIndex = db.prepare("SELECT COUNT(*) AS n FROM deferredRecognitions WHERE tenantId=? AND scheduleId=?").get(tenantId, s.id).n;
    this.postRecognitionAmount(s, periodIndex, amount, normalizeBusinessDate(payload.asOfDate || istToday()), access, tenantId, branchId);
    return this.scheduleView(db.prepare("SELECT * FROM deferredSchedules WHERE id=?").get(s.id));
  },

  postRecognition(s, periodIndex, asOfDate, access, tenantId, branchId) {
    const perPeriod = Math.round(s.totalPaise / s.periods);
    const isLast = periodIndex === s.periods - 1;
    const remaining = s.totalPaise - s.recognizedPaise;
    const amount = isLast ? remaining : Math.min(perPeriod, remaining);
    this.postRecognitionAmount(s, periodIndex, amount, asOfDate, access, tenantId, branchId);
    s.recognizedPaise += amount; // keep in-memory copy current for multi-period loops
    return amount;
  },

  postRecognitionAmount(s, periodIndex, amount, asOfDate, access, tenantId, branchId) {
    if (amount <= 0) return;
    const entry = balanceSheetService.createJournal({
      branchId: s.branchId, businessDate: asOfDate, sourceType: "deferred.recognition", sourceId: s.sourceId,
      memo: `Revenue recognition ${s.sourceType} #${periodIndex + 1}`,
      idempotencyKey: `deferred-rec:${tenantId}:${s.id}:${periodIndex}`,
      lines: [
        { accountId: accountId(tenantId, s.branchId, "2300"), debitPaise: amount },
        { accountId: accountId(tenantId, s.branchId, "4000"), creditPaise: amount }
      ]
    }, access);
    db.prepare(`
      INSERT OR IGNORE INTO deferredRecognitions (id, tenantId, scheduleId, periodIndex, recognizeDate, amountPaise, journalEntryId)
      VALUES (@id, @tenantId, @scheduleId, @periodIndex, @recognizeDate, @amountPaise, @journalEntryId)
    `).run({ id: id("drec"), tenantId, scheduleId: s.id, periodIndex, recognizeDate: asOfDate, amountPaise: amount, journalEntryId: entry.id });
    const newRecognized = db.prepare("SELECT COALESCE(SUM(amountPaise),0) AS t FROM deferredRecognitions WHERE tenantId=? AND scheduleId=?").get(tenantId, s.id).t;
    const status = newRecognized >= s.totalPaise ? "completed" : "active";
    db.prepare("UPDATE deferredSchedules SET recognizedPaise=?, status=? WHERE id=?").run(newRecognized, status, s.id);
  },

  scheduleView(s) {
    if (!s) return null;
    return {
      id: s.id, sourceType: s.sourceType, sourceId: s.sourceId, customerId: s.customerId,
      total: rupees(s.totalPaise), recognized: rupees(s.recognizedPaise),
      deferredBalance: rupees(s.totalPaise - s.recognizedPaise),
      method: s.method, periods: s.periods, startDate: s.startDate, status: s.status
    };
  },

  list(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const rows = db.prepare("SELECT * FROM deferredSchedules WHERE tenantId=? AND branchId=? ORDER BY createdAt DESC LIMIT 200").all(tenantId, branchId);
    const liabilityPaise = rows.filter((r) => r.status !== "cancelled").reduce((s, r) => s + (r.totalPaise - r.recognizedPaise), 0);
    return { deferredLiability: rupees(liabilityPaise), schedules: rows.map(this.scheduleView) };
  }
};