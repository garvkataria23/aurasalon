import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { istToday, istStamp, epochSeconds, normalizeBusinessDate, periodOf } from "../utils/finance-time.js";
import { ensureHardeningSchema } from "./balance-sheet-hardening-schema.service.js";
import { balanceSheetService } from "./balance-sheet.service.js";

const id = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;
const money = (value) => Math.round(Number(value || 0));
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;

function scope(access = {}, branchId = "") {
  ensureHardeningSchema();
  if (!access.tenantId) throw badRequest("Tenant context is required");
  tenantService.ensureSubscriptionActive(access.tenantId);
  const requestedBranch = branchId || access.requestedBranchId || "";
  if (requestedBranch) tenantService.assertBranchAccess(access, requestedBranch);
  return { tenantId: access.tenantId, branchId: requestedBranch };
}

function accountIdByCode(tenantId, branchId, code) {
  const row = db.prepare(
    "SELECT id FROM chartOfAccounts WHERE tenantId = ? AND branchId = ? AND code = ?"
  ).get(tenantId, branchId, code);
  if (!row) throw badRequest(`Chart of accounts missing code ${code} for branch ${branchId || "tenant"}`);
  return row.id;
}

// ---------------------------------------------------------------------------
// Stage 16 — GL outbox event → journal mapping registry
// Each mapper returns { memo, lines:[{ code, debitPaise?, creditPaise? }] }.
// ---------------------------------------------------------------------------
const PAYMENT_ASSET = { cash: "1000", bank: "1010" };
const EXPENSE_BY_CATEGORY = {
  salary: "5100", rent: "5200", marketing: "5300", cogs: "5000", depreciation: "5400"
};

const eventMappers = {
  "invoice.paid": (p) => ({
    memo: p.memo || "Invoice settlement",
    lines: [
      { code: PAYMENT_ASSET[p.mode] || "1010", debitPaise: money(p.amountPaise) },
      { code: p.revenueCode || "4000", creditPaise: money(p.amountPaise) }
    ]
  }),
  "invoice.refund": (p) => {
    const amount = money(p.amountPaise);
    const tax = Math.min(amount, money(p.taxReversalPaise));
    const net = amount - tax;
    return {
      memo: p.memo || "Invoice refund",
      lines: [
        { code: p.revenueCode || "4000", debitPaise: net },
        ...(tax > 0 ? [{ code: "2100", debitPaise: tax }] : []),
        { code: PAYMENT_ASSET[p.mode] || "1010", creditPaise: amount }
      ]
    };
  },
  "expense.recorded": (p) => ({
    memo: p.memo || `Expense: ${p.category || "general"}`,
    lines: [
      { code: EXPENSE_BY_CATEGORY[p.category] || "5300", debitPaise: money(p.amountPaise) },
      { code: p.settled === false ? "2000" : (PAYMENT_ASSET[p.mode] || "1010"), creditPaise: money(p.amountPaise) }
    ]
  }),
  "inventory.purchase": (p) => ({
    memo: p.memo || "Inventory purchase",
    lines: [
      { code: "1200", debitPaise: money(p.totalCostPaise) },
      { code: p.settled === false ? "2000" : (PAYMENT_ASSET[p.mode] || "1010"), creditPaise: money(p.totalCostPaise) }
    ]
  }),
  "inventory.cogs": (p) => ({
    memo: p.memo || "Cost of goods sold",
    lines: [
      { code: "5000", debitPaise: money(p.cogsPaise) },
      { code: "1200", creditPaise: money(p.cogsPaise) }
    ]
  }),
  "salary.paid": (p) => ({
    memo: p.memo || "Salary disbursement",
    lines: [
      { code: "5100", debitPaise: money(p.amountPaise) },
      { code: PAYMENT_ASSET[p.mode] || "1010", creditPaise: money(p.amountPaise) }
    ]
  })
};

export function registerOutboxMapper(eventType, mapper) {
  if (typeof mapper !== "function") throw badRequest("mapper must be a function");
  eventMappers[eventType] = mapper;
}

export const balanceSheetHardeningService = {
  // -------------------------------------------------------------------------
  // Stage 18 — idempotent scheduler guard. Claims (tenant, jobType, runKey)
  // exactly once; concurrent / repeat triggers are skipped, not double-run.
  // -------------------------------------------------------------------------
  runOnce(tenantId, jobType, runKey, work) {
    ensureHardeningSchema();
    const now = epochSeconds();
    const claim = db.prepare(`
      INSERT OR IGNORE INTO schedulerRuns (id, tenantId, jobType, runKey, status, startedAt)
      VALUES (@id, @tenantId, @jobType, @runKey, 'running', @startedAt)
    `).run({ id: id("run"), tenantId, jobType, runKey, startedAt: now });

    if (claim.changes === 0) {
      const existing = db.prepare(
        "SELECT * FROM schedulerRuns WHERE tenantId = ? AND jobType = ? AND runKey = ?"
      ).get(tenantId, jobType, runKey);
      return { skipped: true, status: existing?.status || "unknown", runKey };
    }
    try {
      const result = typeof work === "function" ? work() : null;
      db.prepare("UPDATE schedulerRuns SET status='done', finishedAt=?, detail=? WHERE tenantId=? AND jobType=? AND runKey=?")
        .run(epochSeconds(), "", tenantId, jobType, runKey);
      return { skipped: false, status: "done", runKey, result };
    } catch (error) {
      db.prepare("UPDATE schedulerRuns SET status='failed', finishedAt=?, detail=? WHERE tenantId=? AND jobType=? AND runKey=?")
        .run(epochSeconds(), String(error?.message || error).slice(0, 500), tenantId, jobType, runKey);
      throw error;
    }
  },

  // -------------------------------------------------------------------------
  // Stage 16 — enqueue a business event (dedup by eventKey) and process outbox.
  // -------------------------------------------------------------------------
  enqueue(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const eventType = String(payload.eventType || "");
    if (!eventMappers[eventType]) throw badRequest(`Unknown outbox eventType: ${eventType}`);
    const eventKey = String(payload.eventKey || `${eventType}:${payload.sourceId || id("evt")}`);
    const businessDate = normalizeBusinessDate(payload.businessDate);
    const result = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, @eventType, @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `).run({
      id: id("obx"), tenantId, branchId, eventType, eventKey, businessDate,
      payloadJson: JSON.stringify(payload.data || payload.payload || {})
    });
    const row = db.prepare("SELECT * FROM glOutbox WHERE tenantId = ? AND eventKey = ?").get(tenantId, eventKey);
    return { enqueued: result.changes === 1, duplicate: result.changes === 0, event: this.outboxRow(row) };
  },

  processOutbox(payload = {}, access = {}) {
    const { tenantId } = scope(access);
    const limit = Math.min(Math.max(Number(payload.limit) || 50, 1), 500);
    const now = epochSeconds();
    const pending = db.prepare(`
      SELECT * FROM glOutbox
      WHERE tenantId = @tenantId AND status IN ('pending','failed')
        AND attempts < maxAttempts AND availableAt <= @now
      ORDER BY createdAt ASC LIMIT @limit
    `).all({ tenantId, now, limit });

    const summary = { processed: 0, posted: 0, failed: 0, results: [] };
    for (const row of pending) {
      summary.processed += 1;
      try {
        const mapper = eventMappers[row.eventType];
        if (!mapper) throw new Error(`No mapper for ${row.eventType}`);
        const data = JSON.parse(row.payloadJson || "{}");
        const mapped = mapper(data);
        const lines = (mapped.lines || []).map((line) => ({
          accountId: accountIdByCode(tenantId, row.branchId, line.code),
          debitPaise: money(line.debitPaise),
          creditPaise: money(line.creditPaise),
          memo: line.memo || ""
        }));
        const entry = balanceSheetService.createJournal({
          branchId: row.branchId,
          businessDate: row.businessDate,
          sourceType: row.eventType,
          sourceId: row.eventKey,
          memo: mapped.memo || row.eventType,
          idempotencyKey: `outbox:${row.eventKey}`,
          lines
        }, {
          ...access,
          tenantId,
          userId: access.userId || "outbox",
          branchId: row.branchId,
          requestedBranchId: row.branchId
        });

        db.prepare(`
          UPDATE glOutbox SET status='posted', journalEntryId=@jid, processedAt=@at,
            attempts=attempts+1, lastError='' WHERE id=@id
        `).run({ jid: entry.id, at: istStamp(), id: row.id });
        summary.posted += 1;
        summary.results.push({ eventKey: row.eventKey, status: "posted", journalEntryId: entry.id });
      } catch (error) {
        const attempts = row.attempts + 1;
        const backoff = Math.min(3600, 30 * Math.pow(2, attempts)); // seconds, capped 1h
        const status = attempts >= row.maxAttempts ? "failed" : "pending";
        db.prepare(`
          UPDATE glOutbox SET status=@status, attempts=@attempts, availableAt=@availableAt,
            lastError=@err WHERE id=@id
        `).run({
          status, attempts, availableAt: epochSeconds() + backoff,
          err: String(error?.message || error).slice(0, 500), id: row.id
        });
        summary.failed += 1;
        summary.results.push({ eventKey: row.eventKey, status, error: String(error?.message || error) });
      }
    }
    return summary;
  },

  outbox(query = {}, access = {}) {
    const { tenantId } = scope(access);
    const status = String(query.status || "");
    const rows = status
      ? db.prepare("SELECT * FROM glOutbox WHERE tenantId=? AND status=? ORDER BY createdAt DESC LIMIT 200").all(tenantId, status)
      : db.prepare("SELECT * FROM glOutbox WHERE tenantId=? ORDER BY createdAt DESC LIMIT 200").all(tenantId);
    return rows.map(this.outboxRow);
  },

  outboxRow(row) {
    if (!row) return null;
    return {
      id: row.id, eventType: row.eventType, eventKey: row.eventKey, branchId: row.branchId,
      businessDate: row.businessDate, status: row.status, attempts: row.attempts,
      maxAttempts: row.maxAttempts, lastError: row.lastError, journalEntryId: row.journalEntryId,
      createdAt: row.createdAt, processedAt: row.processedAt
    };
  },

  // -------------------------------------------------------------------------
  // Stage 19 — Weighted Moving Average inventory valuation.
  // totalValuePaise is authoritative; wmaCostPaise is derived (rounded).
  // -------------------------------------------------------------------------
  receiveStock(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const sku = String(payload.sku || "").trim();
    if (!sku) throw badRequest("sku is required");
    const qty = Number(payload.qty || 0);
    const unitCostPaise = money(payload.unitCostPaise);
    if (qty <= 0 || unitCostPaise < 0) throw badRequest("qty must be > 0 and unitCostPaise >= 0");
    const businessDate = normalizeBusinessDate(payload.businessDate);

    return db.transaction(() => {
      const item = this.ensureItem(tenantId, branchId, sku, payload.name);
      const addValue = money(qty * unitCostPaise);
      const qtyAfter = item.qtyOnHand + qty;
      const valueAfter = item.totalValuePaise + addValue;
      const wmaAfter = qtyAfter > 0 ? Math.round(valueAfter / qtyAfter) : 0;
      this.writeItem(tenantId, branchId, sku, qtyAfter, wmaAfter, valueAfter);
      this.writeMovement({
        tenantId, branchId, sku, movementType: "in", qty, unitCostPaise,
        totalCostPaise: addValue, wmaCostAfterPaise: wmaAfter, qtyAfter, valueAfterPaise: valueAfter,
        sourceType: payload.sourceType || "purchase", sourceId: payload.sourceId || "", businessDate
      });
      const event = this.enqueue({
        branchId, eventType: "inventory.purchase",
        eventKey: `inv-in:${sku}:${payload.sourceId || id("m")}`,
        businessDate,
        data: { totalCostPaise: addValue, mode: payload.mode, settled: payload.settled }
      }, access);
      return { sku, qtyOnHand: qtyAfter, wmaCost: rupees(wmaAfter), totalValue: rupees(valueAfter), outbox: event.event };
    })();
  },

  issueStock(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const sku = String(payload.sku || "").trim();
    if (!sku) throw badRequest("sku is required");
    const qty = Number(payload.qty || 0);
    if (qty <= 0) throw badRequest("qty must be > 0");
    const businessDate = normalizeBusinessDate(payload.businessDate);

    return db.transaction(() => {
      const item = this.ensureItem(tenantId, branchId, sku, payload.name);
      if (qty > item.qtyOnHand) throw badRequest(`Insufficient stock for ${sku}: have ${item.qtyOnHand}, need ${qty}`);
      const cogsPaise = money(qty * item.wmaCostPaise);
      const qtyAfter = item.qtyOnHand - qty;
      const valueAfter = Math.max(0, item.totalValuePaise - cogsPaise);
      const wmaAfter = qtyAfter > 0 ? Math.round(valueAfter / qtyAfter) : item.wmaCostPaise;
      this.writeItem(tenantId, branchId, sku, qtyAfter, wmaAfter, valueAfter);
      this.writeMovement({
        tenantId, branchId, sku, movementType: "out", qty, unitCostPaise: item.wmaCostPaise,
        totalCostPaise: cogsPaise, wmaCostAfterPaise: wmaAfter, qtyAfter, valueAfterPaise: valueAfter,
        sourceType: payload.sourceType || "sale", sourceId: payload.sourceId || "", businessDate
      });
      const event = this.enqueue({
        branchId, eventType: "inventory.cogs",
        eventKey: `inv-out:${sku}:${payload.sourceId || id("m")}`,
        businessDate, data: { cogsPaise }
      }, access);
      return { sku, qtyOnHand: qtyAfter, cogs: rupees(cogsPaise), totalValue: rupees(valueAfter), outbox: event.event };
    })();
  },

  inventoryValuation(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const items = db.prepare(
      "SELECT * FROM inventoryItems WHERE tenantId=? AND branchId=? AND qtyOnHand <> 0 ORDER BY sku ASC"
    ).all(tenantId, branchId);
    const totalValuePaise = items.reduce((sum, r) => sum + Number(r.totalValuePaise || 0), 0);
    const glInventoryPaise = this.glAccountBalancePaise(tenantId, branchId, "1200", query.asOfDate);
    const variancePaise = totalValuePaise - glInventoryPaise;
    return {
      branchId,
      totalValue: rupees(totalValuePaise),
      glInventoryValue: rupees(glInventoryPaise),
      variance: rupees(variancePaise),
      reconciled: Math.abs(variancePaise) <= 100,
      items: items.map((r) => ({
        sku: r.sku, name: r.name, qtyOnHand: r.qtyOnHand,
        wmaCost: rupees(r.wmaCostPaise), totalValue: rupees(r.totalValuePaise)
      }))
    };
  },

  ensureItem(tenantId, branchId, sku, name) {
    db.prepare(`
      INSERT OR IGNORE INTO inventoryItems (id, tenantId, branchId, sku, name)
      VALUES (@id, @tenantId, @branchId, @sku, @name)
    `).run({ id: id("inv"), tenantId, branchId, sku, name: name || sku });
    return db.prepare("SELECT * FROM inventoryItems WHERE tenantId=? AND branchId=? AND sku=?").get(tenantId, branchId, sku);
  },

  writeItem(tenantId, branchId, sku, qtyOnHand, wmaCostPaise, totalValuePaise) {
    db.prepare(`
      UPDATE inventoryItems SET qtyOnHand=@qtyOnHand, wmaCostPaise=@wmaCostPaise,
        totalValuePaise=@totalValuePaise, updatedAt=@updatedAt
      WHERE tenantId=@tenantId AND branchId=@branchId AND sku=@sku
    `).run({ tenantId, branchId, sku, qtyOnHand, wmaCostPaise, totalValuePaise, updatedAt: istStamp() });
  },

  writeMovement(m) {
    db.prepare(`
      INSERT INTO inventoryMovements
        (id, tenantId, branchId, sku, movementType, qty, unitCostPaise, totalCostPaise,
         wmaCostAfterPaise, qtyAfter, valueAfterPaise, sourceType, sourceId, businessDate)
      VALUES
        (@id, @tenantId, @branchId, @sku, @movementType, @qty, @unitCostPaise, @totalCostPaise,
         @wmaCostAfterPaise, @qtyAfter, @valueAfterPaise, @sourceType, @sourceId, @businessDate)
    `).run({ id: id("mov"), ...m });
  },

  glAccountBalancePaise(tenantId, branchId, code, asOfDate) {
    const date = normalizeBusinessDate(asOfDate, { allowFuture: true });
    const row = db.prepare(`
      SELECT a.normalBalance,
        COALESCE(SUM(l.debitPaise), 0) AS debitPaise,
        COALESCE(SUM(l.creditPaise), 0) AS creditPaise
      FROM chartOfAccounts a
      LEFT JOIN journalEntryLines l ON l.accountId = a.id AND l.tenantId = a.tenantId AND l.branchId = a.branchId
      LEFT JOIN journalEntries e ON e.id = l.journalEntryId AND e.tenantId = l.tenantId
        AND e.status = 'posted' AND e.businessDate <= @date
      WHERE a.tenantId=@tenantId AND a.branchId=@branchId AND a.code=@code
      GROUP BY a.id
    `).get({ tenantId, branchId, code, date });
    if (!row) return 0;
    const debit = Number(row.debitPaise || 0);
    const credit = Number(row.creditPaise || 0);
    return row.normalBalance === "credit" ? credit - debit : debit - credit;
  },

  // -------------------------------------------------------------------------
  // Stage 20 — period lock management. Immutable journals are enforced by the
  // ledger itself (no edit/delete path); corrections happen via reversal.
  // -------------------------------------------------------------------------
  periods(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    return db.prepare(
      "SELECT period, lockedAt, lockedBy, reason FROM periodLocks WHERE tenantId=? AND branchId=? ORDER BY period DESC"
    ).all(tenantId, branchId);
  },

  closePeriod(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const period = periodOf(payload.period || istToday());
    const force = Boolean(payload.force);
    const recon = this.reconcile({ branchId, asOfDate: `${period}-28` }, access);
    if (recon.status === "critical" && !force) {
      throw badRequest(`Cannot close ${period}: reconciliation is critical. Resolve issues or pass force=true.`);
    }
    db.prepare(`
      INSERT OR IGNORE INTO periodLocks (id, tenantId, branchId, period, lockedBy, reason)
      VALUES (@id, @tenantId, @branchId, @period, @lockedBy, @reason)
    `).run({
      id: id("plk"), tenantId, branchId, period,
      lockedBy: access.userId || "system",
      reason: payload.reason || (force ? "Force-closed with open reconciliation flags" : "Period close")
    });
    return { period, locked: true, reconciliation: recon };
  },

  reopenPeriod(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const period = periodOf(payload.period || "");
    if (!period) throw badRequest("period is required");
    if (!payload.reason) throw badRequest("reason is required to reopen a locked period (audit trail)");
    const row = db.prepare("SELECT * FROM periodLocks WHERE tenantId=? AND branchId=? AND period=?").get(tenantId, branchId, period);
    if (!row) throw notFound(`Period ${period} is not locked`);
    db.prepare("DELETE FROM periodLocks WHERE tenantId=? AND branchId=? AND period=?").run(tenantId, branchId, period);
    return { period, locked: false, reopenedBy: access.userId || "system", reason: payload.reason };
  },

  // -------------------------------------------------------------------------
  // Stage 21 — reconciliation watchdog. Runs structural ledger checks, writes
  // alerts, and records run history that feeds production-readiness.
  // -------------------------------------------------------------------------
  reconcile(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const checks = [];

    const trial = balanceSheetService.trialBalance({ branchId, asOfDate }, access);
    checks.push({
      key: "trial_balanced", label: "Trial balance debit = credit",
      ok: trial.balanced, severity: trial.balanced ? "ok" : "critical",
      detail: trial.balanced ? "" : `Difference ${trial.difference}`
    });

    const unbalanced = db.prepare(`
      SELECT l.journalEntryId AS jid, SUM(l.debitPaise) AS d, SUM(l.creditPaise) AS c
      FROM journalEntryLines l
      JOIN journalEntries e ON e.id = l.journalEntryId AND e.tenantId = l.tenantId AND e.status='posted'
      WHERE l.tenantId=@tenantId ${branchId ? "AND l.branchId=@branchId" : ""}
      GROUP BY l.journalEntryId HAVING SUM(l.debitPaise) <> SUM(l.creditPaise)
    `).all(branchId ? { tenantId, branchId } : { tenantId });
    checks.push({
      key: "entries_balanced", label: "Every posted journal entry balances",
      ok: unbalanced.length === 0, severity: unbalanced.length ? "critical" : "ok",
      detail: unbalanced.length ? `${unbalanced.length} unbalanced entries` : ""
    });

    const live = balanceSheetService.live({ branchId, asOfDate }, access);
    const eqOk = live.balanced;
    checks.push({
      key: "accounting_equation", label: "Assets = Liabilities + Equity",
      ok: eqOk, severity: eqOk ? "ok" : "critical",
      detail: eqOk ? "" : `Difference ${live.totals.accountingEquationDifference}`
    });

    const inv = this.inventoryValuation({ branchId, asOfDate }, access);
    checks.push({
      key: "inventory_reconciled", label: "WMA inventory value = GL inventory account",
      ok: inv.reconciled, severity: inv.reconciled ? "ok" : "warning",
      detail: inv.reconciled ? "" : `Variance ${inv.variance}`
    });

    const stuck = db.prepare(
      "SELECT COUNT(*) AS n FROM glOutbox WHERE tenantId=? AND status='failed'"
    ).get(tenantId).n;
    checks.push({
      key: "outbox_healthy", label: "No GL outbox events stuck in failed state",
      ok: stuck === 0, severity: stuck ? "warning" : "ok",
      detail: stuck ? `${stuck} failed events` : ""
    });

    const status = checks.some((c) => !c.ok && c.severity === "critical") ? "critical"
      : checks.some((c) => !c.ok) ? "warning" : "ok";

    const runId = id("rec");
    db.prepare(`
      INSERT INTO reconciliationRuns (id, tenantId, branchId, asOfDate, status, checksJson)
      VALUES (@id, @tenantId, @branchId, @asOfDate, @status, @checksJson)
    `).run({ id: runId, tenantId, branchId, asOfDate, status, checksJson: JSON.stringify(checks) });

    // Refresh open alert set for this scope (Stage 21 alerting).
    db.prepare("DELETE FROM balanceSheetAlerts WHERE tenantId=? AND branchId=? AND status='open'").run(tenantId, branchId);
    const alertStmt = db.prepare(`
      INSERT INTO balanceSheetAlerts (id, tenantId, branchId, alertDate, severity, title, message, status, payloadJson)
      VALUES (@id, @tenantId, @branchId, @alertDate, @severity, @title, @message, 'open', @payloadJson)
    `);
    for (const c of checks.filter((c) => !c.ok)) {
      alertStmt.run({
        id: id("ba"), tenantId, branchId, alertDate: asOfDate, severity: c.severity,
        title: c.label, message: c.detail || "Reconciliation check failed", payloadJson: JSON.stringify(c)
      });
    }

    return { id: runId, asOfDate, branchId, status, checks };
  },

  latestReconciliation(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const row = db.prepare(
      "SELECT * FROM reconciliationRuns WHERE tenantId=? AND branchId=? ORDER BY asOfDate DESC, createdAt DESC LIMIT 1"
    ).get(tenantId, branchId);
    if (!row) return null;
    return { id: row.id, asOfDate: row.asOfDate, status: row.status, createdAt: row.createdAt, checks: JSON.parse(row.checksJson || "[]") };
  },

  // -------------------------------------------------------------------------
  // Aggregated hardening status for the UI + production-readiness gate.
  // -------------------------------------------------------------------------
  hardeningStatus(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const latest = this.latestReconciliation({ branchId }, access);
    const failedOutbox = db.prepare("SELECT COUNT(*) AS n FROM glOutbox WHERE tenantId=? AND status='failed'").get(tenantId).n;
    const criticalAlerts = db.prepare(
      "SELECT COUNT(*) AS n FROM balanceSheetAlerts WHERE tenantId=? AND branchId=? AND status='open' AND severity='critical'"
    ).get(tenantId, branchId).n;

    const stages = [
      { stage: 16, label: "GL outbox exactly-once sync", done: true, healthy: failedOutbox === 0, note: failedOutbox ? `${failedOutbox} failed events` : "Outbox clean" },
      { stage: 17, label: "IST date boundary protection", done: true, healthy: true, note: "Business dates booked in Asia/Kolkata" },
      { stage: 18, label: "Idempotent scheduler protection", done: true, healthy: true, note: "Run-once guard active" },
      { stage: 19, label: "WMA inventory valuation", done: true, healthy: true, note: "Weighted moving average live" },
      { stage: 20, label: "Period lock + immutable journals", done: true, healthy: true, note: "Reversal-only corrections" },
      { stage: 21, label: "Reconciliation watchdog", done: true, healthy: latest ? latest.status !== "critical" : false, note: latest ? `Last run: ${latest.status}` : "Not run yet" }
    ];

    const productionReady = stages.every((s) => s.done && s.healthy)
      && criticalAlerts === 0 && latest && latest.status === "ok";

    return {
      branchId,
      productionReady,
      productionReadinessReason: productionReady
        ? "All stage 16-21 controls active and reconciliation clean."
        : "Run reconciliation and clear critical alerts to certify production readiness.",
      stages,
      latestReconciliation: latest
    };
  }
};
