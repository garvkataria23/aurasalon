import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { seedChartOfAccounts } from "./balance-sheet-schema.service.js";
import { istToday, periodOf, normalizeBusinessDate } from "../utils/finance-time.js";
import { ensureHardeningSchema } from "./balance-sheet-hardening-schema.service.js";

const id = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;
const today = () => istToday(); // Stage 17: accounting day rolls over at IST midnight.
const money = (value) => Math.round(Number(value || 0));
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;
const rupeesToText = (value) => `₹${Math.round(Number(value || 0)).toLocaleString("en-IN")}`;
const parseJson = (value, fallback) => {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
};
const tableExists = (name) => Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name=?").get(name));
const safeAll = (sql, params = {}) => {
  try {
    return db.prepare(sql).all(params);
  } catch {
    return [];
  }
};
const safeGet = (sql, params = {}) => {
  try {
    return db.prepare(sql).get(params) || {};
  } catch {
    return {};
  }
};
const isPresent = (status) => ["present", "clocked_in", "clocked_out", "approved"].includes(String(status || "").toLowerCase());

function scope(access = {}, branchId = "") {
  if (!access.tenantId) throw badRequest("Tenant context is required");
  tenantService.ensureSubscriptionActive(access.tenantId);
  const requestedBranch = branchId || access.requestedBranchId || "";
  if (requestedBranch) tenantService.assertBranchAccess(access, requestedBranch);
  return { tenantId: access.tenantId, branchId: requestedBranch };
}

function rowAccount(row) {
  return {
    id: row.id,
    code: row.code,
    name: row.name,
    accountType: row.accountType,
    accountSubType: row.accountSubType,
    normalBalance: row.normalBalance,
    active: Boolean(row.active),
    systemAccount: Boolean(row.systemAccount)
  };
}

function accountIdByCode(tenantId, branchId, code) {
  seedChartOfAccounts(tenantId, branchId);
  const row = db.prepare("SELECT id FROM chartOfAccounts WHERE tenantId = ? AND branchId = ? AND code = ?").get(tenantId, branchId, code);
  if (!row) throw badRequest(`Chart of accounts missing code ${code}`);
  return row.id;
}

function signedBalance(row) {
  const debit = Number(row.debitPaise || 0);
  const credit = Number(row.creditPaise || 0);
  return row.normalBalance === "credit" ? credit - debit : debit - credit;
}

// Contribution to the account's STATEMENT SECTION, by accountType's natural
// side. Ensures contra accounts (e.g. accumulated depreciation: an asset that
// carries a credit balance) correctly REDUCE their section instead of inflating
// it. Used for balance-sheet section totals and working-capital aggregation.
function sectionBalance(row) {
  const debit = Number(row.debitPaise || 0);
  const credit = Number(row.creditPaise || 0);
  const debitNatured = row.accountType === "asset" || row.accountType === "expense";
  return debitNatured ? debit - credit : credit - debit;
}

function sectionTotal(rows) {
  return rows.reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
}

export const balanceSheetService = {
  accounts(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    seedChartOfAccounts(tenantId, branchId);
    return db.prepare(`
      SELECT * FROM chartOfAccounts
      WHERE tenantId = @tenantId AND branchId = @branchId
      ORDER BY code ASC
    `).all({ tenantId, branchId }).map(rowAccount);
  },

  createJournal(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    // Stage 17: normalise to IST business day (rejects accidental future-dating).
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.entryDate);
    // Stage 20: locked accounting periods reject new postings.
    this.assertPeriodOpen(tenantId, branchId, businessDate);
    const lines = Array.isArray(payload.lines) ? payload.lines : [];
    if (lines.length < 2) throw badRequest("At least two journal lines are required");
    const accounts = new Map(this.accounts({ branchId }, access).map((account) => [account.id, account]));
    let debitTotal = 0;
    let creditTotal = 0;
    for (const line of lines) {
      if (!accounts.has(line.accountId)) throw badRequest(`Unknown account: ${line.accountId}`);
      const debit = money(line.debitPaise);
      const credit = money(line.creditPaise);
      if (debit < 0 || credit < 0 || (debit && credit)) throw badRequest("Each line must have either debit or credit");
      debitTotal += debit;
      creditTotal += credit;
    }
    if (debitTotal <= 0 || debitTotal !== creditTotal) {
      throw badRequest("Journal entry must balance: total debit must equal total credit");
    }

    const entryId = id("je");
    const stamp = new Date().toISOString();
    const idempotencyKey = payload.idempotencyKey || `${tenantId}:${branchId}:${payload.sourceType || "manual"}:${payload.sourceId || entryId}`;
    const existing = db.prepare("SELECT * FROM journalEntries WHERE tenantId = ? AND idempotencyKey = ?").get(tenantId, idempotencyKey);
    if (existing) return this.journal(existing.id, access);

    db.prepare(`
      INSERT INTO journalEntries (
        id, tenantId, branchId, entryDate, businessDate, sourceType, sourceId, memo,
        status, locked, reversalOf, idempotencyKey, createdBy, createdAt, updatedAt
      ) VALUES (
        @id, @tenantId, @branchId, @entryDate, @businessDate, @sourceType, @sourceId, @memo,
        'posted', 1, @reversalOf, @idempotencyKey, @createdBy, @createdAt, @updatedAt
      )
    `).run({
      id: entryId,
      tenantId,
      branchId,
      entryDate: businessDate,
      businessDate,
      sourceType: payload.sourceType || "manual",
      sourceId: payload.sourceId || "",
      memo: payload.memo || "",
      reversalOf: payload.reversalOf || "",
      idempotencyKey,
      createdBy: access.userId || "system",
      createdAt: stamp,
      updatedAt: stamp
    });
    const insertLine = db.prepare(`
      INSERT INTO journalEntryLines
        (id, tenantId, branchId, journalEntryId, accountId, debitPaise, creditPaise, lineMemo, createdAt)
      VALUES
        (@id, @tenantId, @branchId, @journalEntryId, @accountId, @debitPaise, @creditPaise, @lineMemo, @createdAt)
    `);
    for (const line of lines) {
      insertLine.run({
        id: id("jel"),
        tenantId,
        branchId,
        journalEntryId: entryId,
        accountId: line.accountId,
        debitPaise: money(line.debitPaise),
        creditPaise: money(line.creditPaise),
        lineMemo: line.memo || "",
        createdAt: stamp
      });
    }
    return this.journal(entryId, access);
  },

  // Stage 20: immutable journals — the only correction path is a balanced
  // reversal entry. Original is flagged 'reversed' but never edited or deleted.
  reverseJournal(entryId, payload = {}, access = {}) {
    const { tenantId } = scope(access);
    const entry = db.prepare("SELECT * FROM journalEntries WHERE tenantId = ? AND id = ?").get(tenantId, entryId);
    if (!entry) throw notFound("Journal entry not found");
    if (entry.branchId) tenantService.assertBranchAccess(access, entry.branchId);
    if (entry.status === "reversed") throw badRequest("Journal entry is already reversed");
    if (entry.sourceType === "reversal") throw badRequest("A reversal entry cannot itself be reversed");

    const reversalDate = normalizeBusinessDate(payload.businessDate || today());
    this.assertPeriodOpen(tenantId, entry.branchId, reversalDate);

    const original = this.journal(entryId, access);
    const lines = original.lines.map((line) => ({
      accountId: line.accountId,
      debitPaise: line.creditPaise,
      creditPaise: line.debitPaise,
      memo: `Reversal of ${entryId}`
    }));
    const reversal = this.createJournal({
      branchId: entry.branchId,
      businessDate: reversalDate,
      sourceType: "reversal",
      sourceId: entryId,
      reversalOf: entryId,
      memo: payload.reason || `Reversal of ${entryId}`,
      idempotencyKey: `reversal:${tenantId}:${entryId}`,
      lines
    }, access);

    db.prepare("UPDATE journalEntries SET status = 'reversed', updatedAt = ? WHERE tenantId = ? AND id = ?")
      .run(new Date().toISOString(), tenantId, entryId);

    return { original: entryId, reversal };
  },

  journal(entryId, access = {}) {
    const { tenantId } = scope(access);
    const entry = db.prepare("SELECT * FROM journalEntries WHERE tenantId = ? AND id = ?").get(tenantId, entryId);
    if (!entry) throw notFound("Journal entry not found");
    if (entry.branchId) tenantService.assertBranchAccess(access, entry.branchId);
    const lines = db.prepare(`
      SELECT l.*, a.code, a.name, a.accountType
      FROM journalEntryLines l
      JOIN chartOfAccounts a ON a.id = l.accountId AND a.tenantId = l.tenantId
      WHERE l.tenantId = ? AND l.journalEntryId = ?
      ORDER BY l.createdAt ASC
    `).all(tenantId, entryId);
    return {
      id: entry.id,
      branchId: entry.branchId,
      businessDate: entry.businessDate,
      sourceType: entry.sourceType,
      sourceId: entry.sourceId,
      memo: entry.memo,
      status: entry.status,
      locked: Boolean(entry.locked),
      reversalOf: entry.reversalOf,
      lines: lines.map((line) => ({
        id: line.id,
        accountId: line.accountId,
        accountCode: line.code,
        accountName: line.name,
        accountType: line.accountType,
        debit: rupees(line.debitPaise),
        credit: rupees(line.creditPaise),
        debitPaise: line.debitPaise,
        creditPaise: line.creditPaise,
        memo: line.lineMemo
      }))
    };
  },

  trialBalance(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const rows = this.accountBalances(tenantId, branchId, asOfDate);
    const debitTotal = rows.reduce((sum, row) => sum + Math.max(0, Number(row.debitPaise || 0) - Number(row.creditPaise || 0)), 0);
    const creditTotal = rows.reduce((sum, row) => sum + Math.max(0, Number(row.creditPaise || 0) - Number(row.debitPaise || 0)), 0);
    return {
      asOfDate,
      balanced: debitTotal === creditTotal,
      debitTotal: rupees(debitTotal),
      creditTotal: rupees(creditTotal),
      difference: rupees(debitTotal - creditTotal),
      rows: rows.map((row) => ({
        accountId: row.id,
        code: row.code,
        name: row.name,
        accountType: row.accountType,
        debit: rupees(Math.max(0, Number(row.debitPaise || 0) - Number(row.creditPaise || 0))),
        credit: rupees(Math.max(0, Number(row.creditPaise || 0) - Number(row.debitPaise || 0))),
        balance: rupees(signedBalance(row))
      }))
    };
  },

  live(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const balances = this.accountBalances(tenantId, branchId, asOfDate)
      .map((row) => ({ ...row, balancePaise: sectionBalance(row) }));
    const assets = balances.filter((row) => row.accountType === "asset").map(this.statementRow);
    const liabilities = balances.filter((row) => row.accountType === "liability").map(this.statementRow);
    const equity = balances.filter((row) => row.accountType === "equity").map(this.statementRow);
    const income = balances.filter((row) => row.accountType === "income").reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const expenses = balances.filter((row) => row.accountType === "expense").reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const retainedEarningsPaise = income - expenses;
    if (retainedEarningsPaise) {
      equity.push({ code: "3999", name: "Current Profit / Loss", accountSubType: "current_profit", balance: rupees(retainedEarningsPaise), balancePaise: retainedEarningsPaise });
    }
    const totalAssetsPaise = sectionTotal(assets);
    const totalLiabilitiesPaise = sectionTotal(liabilities);
    const totalEquityPaise = sectionTotal(equity);
    const accountingEquationDifferencePaise = totalAssetsPaise - totalLiabilitiesPaise - totalEquityPaise;
    const readiness = this.readinessSnapshot(tenantId, branchId);
    return {
      asOfDate,
      branchId,
      productionReady: readiness.productionReady,
      productionReadinessReason: readiness.reason,
      totals: {
        assets: rupees(totalAssetsPaise),
        liabilities: rupees(totalLiabilitiesPaise),
        equity: rupees(totalEquityPaise),
        accountingEquationDifference: rupees(accountingEquationDifferencePaise)
      },
      totalsPaise: {
        assets: totalAssetsPaise,
        liabilities: totalLiabilitiesPaise,
        equity: totalEquityPaise,
        accountingEquationDifference: accountingEquationDifferencePaise
      },
      balanced: accountingEquationDifferencePaise === 0,
      sections: { assets, liabilities, equity },
      workingCapital: this.workingCapital({ branchId, asOfDate }, access),
      alerts: this.balanceAlerts(totalAssetsPaise, totalLiabilitiesPaise, totalEquityPaise, accountingEquationDifferencePaise)
    };
  },

  // Lightweight, dependency-free production readiness derived from stage 21
  // reconciliation history + open critical alerts (no circular service import).
  readinessSnapshot(tenantId, branchId) {
    ensureHardeningSchema();
    let latest = null;
    let criticalAlerts = 0;
    try {
      latest = db.prepare(
        "SELECT status FROM reconciliationRuns WHERE tenantId = ? AND branchId = ? ORDER BY asOfDate DESC, createdAt DESC LIMIT 1"
      ).get(tenantId, branchId);
      criticalAlerts = db.prepare(
        "SELECT COUNT(*) AS n FROM balanceSheetAlerts WHERE tenantId = ? AND branchId = ? AND status = 'open' AND severity = 'critical'"
      ).get(tenantId, branchId).n;
    } catch {
      latest = null;
      criticalAlerts = 0;
    }
    const productionReady = Boolean(latest) && latest.status === "ok" && criticalAlerts === 0;
    return {
      productionReady,
      reason: !latest
        ? "Run the stage 21 reconciliation watchdog to certify production readiness."
        : latest.status !== "ok"
          ? "Reconciliation found open issues; resolve them before production reliance."
          : criticalAlerts > 0
            ? "Open critical accounting alerts must be cleared."
            : "Stage 16-21 controls active and reconciliation clean."
    };
  },

  workingCapital(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate, { allowFuture: true });
    const rows = this.accountBalances(tenantId, branchId, asOfDate).map((row) => ({ ...row, balancePaise: sectionBalance(row) }));
    const currentAssets = rows.filter((row) => row.accountType === "asset" && ["cash", "bank", "receivables", "inventory"].includes(row.accountSubType));
    const currentLiabilities = rows.filter((row) => row.accountType === "liability" && ["payables", "tax", "loan"].includes(row.accountSubType));
    const inventory = currentAssets.filter((row) => row.accountSubType === "inventory").reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const cash = currentAssets.filter((row) => ["cash", "bank"].includes(row.accountSubType)).reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const ca = currentAssets.reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    const cl = currentLiabilities.reduce((sum, row) => sum + Number(row.balancePaise || 0), 0);
    return {
      asOfDate,
      currentAssets: rupees(ca),
      currentLiabilities: rupees(cl),
      workingCapital: rupees(ca - cl),
      currentRatio: cl ? Math.round((ca / cl) * 100) / 100 : null,
      quickRatio: cl ? Math.round(((ca - inventory) / cl) * 100) / 100 : null,
      cashRatio: cl ? Math.round((cash / cl) * 100) / 100 : null,
      cashRunwayDays: cl ? Math.max(0, Math.round((cash / Math.max(1, cl / 30)))) : null
    };
  },

  costStructure(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const toDate = normalizeBusinessDate(query.toDate || query.asOfDate, { allowFuture: true });
    const fromDate = String(query.fromDate || `${periodOf(toDate)}-01`).slice(0, 10);
    const avgTicketPaise = money(query.avgTicketPaise || 0);
    const rows = db.prepare(`
      SELECT a.code, a.name, a.accountType, a.accountSubType,
        COALESCE(SUM(l.debitPaise), 0) AS debitPaise,
        COALESCE(SUM(l.creditPaise), 0) AS creditPaise
      FROM chartOfAccounts a
      LEFT JOIN (
        journalEntryLines l
        JOIN journalEntries e ON e.id = l.journalEntryId
          AND e.tenantId = l.tenantId
          AND e.branchId = l.branchId
          AND e.status = 'posted'
          AND e.businessDate BETWEEN @fromDate AND @toDate
      ) ON l.accountId = a.id AND l.tenantId = a.tenantId AND l.branchId = a.branchId
      WHERE a.tenantId = @tenantId AND a.branchId = @branchId AND a.active = 1
      GROUP BY a.id
      ORDER BY a.code ASC
    `).all({ tenantId, branchId, fromDate, toDate });
    const lines = rows
      .map((row) => {
        const raw = row.accountType === "income"
          ? Number(row.creditPaise || 0) - Number(row.debitPaise || 0)
          : Number(row.debitPaise || 0) - Number(row.creditPaise || 0);
        const name = String(row.name || "").toLowerCase();
        const category = name.includes("salary") || name.includes("payroll") ? "salary"
          : name.includes("commission") ? "commission"
            : name.includes("rent") ? "rent"
              : name.includes("stock") || name.includes("inventory") || name.includes("cogs") || name.includes("consum") ? "product"
                : row.accountType;
        const behavior = ["product", "commission"].includes(category) ? "variable" : row.accountType === "expense" ? "fixed" : "income";
        return { code: row.code, name: row.name, behavior, category, amountPaise: raw, amount: rupees(raw) };
      })
      .filter((row) => row.amountPaise !== 0);
    const revenuePaise = lines.filter((line) => line.category === "income").reduce((sum, line) => sum + line.amountPaise, 0);
    const variablePaise = lines.filter((line) => line.behavior === "variable").reduce((sum, line) => sum + line.amountPaise, 0);
    const fixedPaise = lines.filter((line) => line.behavior === "fixed").reduce((sum, line) => sum + line.amountPaise, 0);
    const salaryPaise = lines.filter((line) => line.category === "salary" || line.category === "commission").reduce((sum, line) => sum + line.amountPaise, 0);
    const contributionPaise = revenuePaise - variablePaise;
    const netPaise = contributionPaise - fixedPaise;
    const contributionRatio = revenuePaise > 0 ? contributionPaise / revenuePaise : 0;
    const breakEvenPaise = contributionRatio > 0 ? Math.round(fixedPaise / contributionRatio) : null;
    return {
      fromDate,
      toDate,
      revenue: rupees(revenuePaise),
      variableCost: rupees(variablePaise),
      fixedCost: rupees(fixedPaise),
      salaryCost: rupees(salaryPaise),
      contributionMargin: rupees(contributionPaise),
      contributionMarginRatioPct: revenuePaise ? Math.round(contributionRatio * 1000) / 10 : 0,
      salaryToRevenuePct: revenuePaise ? Math.round((salaryPaise / revenuePaise) * 1000) / 10 : null,
      breakEvenRevenue: breakEvenPaise === null ? null : rupees(breakEvenPaise),
      breakEvenClients: breakEvenPaise !== null && avgTicketPaise > 0 ? Math.ceil(breakEvenPaise / avgTicketPaise) : null,
      netProfit: rupees(netPaise),
      marginOfSafetyPct: revenuePaise && breakEvenPaise !== null ? Math.round(((revenuePaise - breakEvenPaise) / revenuePaise) * 1000) / 10 : null,
      lines
    };
  },

  dailyOperations(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const businessDate = normalizeBusinessDate(query.asOfDate || query.businessDate || today(), { allowFuture: true });
    const invoices = safeAll(`
      SELECT id, staffId, staff_id, lineItems, line_items, total, grand_total, paid, paid_amount, discount, discount_total, gstAmount, gst_amount, createdAt, created_at
      FROM invoices
      WHERE COALESCE(tenant_id, @tenantId) = @tenantId
        AND (branchId = @branchId OR branch_id = @branchId OR @branchId = '')
        AND substr(COALESCE(createdAt, created_at, ''), 1, 10) = @businessDate
    `, { tenantId, branchId, businessDate });
    const salesPaise = invoices.reduce((sum, row) => sum + money(Number(row.grand_total ?? row.total ?? 0) * 100), 0);
    const paidPaise = invoices.reduce((sum, row) => sum + money(Number(row.paid_amount ?? row.paid ?? row.grand_total ?? row.total ?? 0) * 100), 0);
    const discountPaise = invoices.reduce((sum, row) => sum + money(Number(row.discount_total ?? row.discount ?? 0) * 100), 0);
    const gstPaise = invoices.reduce((sum, row) => sum + money(Number(row.gst_amount ?? row.gstAmount ?? 0) * 100), 0);

    const attendanceRows = tableExists("staff_attendance")
      ? safeAll("SELECT staffId, status, minutesWorked, overtimeMinutes FROM staff_attendance WHERE tenantId=@tenantId AND branchId=@branchId AND date=@businessDate", { tenantId, branchId, businessDate })
      : [];
    const attendanceByStaff = new Map(attendanceRows.map((row) => [String(row.staffId || ""), row]));
    const commissionRows = tableExists("staff_commissions")
      ? safeAll(`SELECT staff_id, staffId, commission_amount, commissionAmount FROM staff_commissions
          WHERE (tenant_id=@tenantId OR tenantId=@tenantId) AND (branch_id=@branchId OR branchId=@branchId OR @branchId='')
            AND @businessDate BETWEEN COALESCE(period_start, periodStart, @businessDate) AND COALESCE(period_end, periodEnd, @businessDate)`, { tenantId, branchId, businessDate })
      : [];
    const commissionByStaff = new Map();
    for (const row of commissionRows) {
      const staffId = String(row.staff_id || row.staffId || "");
      commissionByStaff.set(staffId, (commissionByStaff.get(staffId) || 0) + money(Number(row.commission_amount ?? row.commissionAmount ?? 0) * 100));
    }
    if (tableExists("staff_commission_runs")) {
      const runs = safeAll("SELECT entries FROM staff_commission_runs WHERE tenantId=@tenantId AND (branchId=@branchId OR @branchId='') AND @businessDate BETWEEN periodStart AND periodEnd", { tenantId, branchId, businessDate });
      for (const run of runs) {
        for (const entry of parseJson(run.entries, [])) {
          const staffId = String(entry.staffId || entry.staff_id || "");
          commissionByStaff.set(staffId, (commissionByStaff.get(staffId) || 0) + money(Number(entry.commission ?? entry.commissionAmount ?? entry.amount ?? 0) * 100));
        }
      }
    }
    const staffRows = safeAll("SELECT id, name, role, branchId, commissionRule FROM staff WHERE (branchId=@branchId OR @branchId='') AND status <> 'archived' ORDER BY name ASC", { branchId });
    const payrollRows = tableExists("staff_payroll_components")
      ? safeAll("SELECT staffId, basic, hra, allowances, grossPay, netPay FROM staff_payroll_components WHERE tenantId=@tenantId AND (branchId=@branchId OR @branchId='') AND @businessDate BETWEEN periodStart AND periodEnd", { tenantId, branchId, businessDate })
      : [];
    const payrollByStaff = new Map(payrollRows.map((row) => [String(row.staffId || ""), row]));
    const invoiceRevenueByStaff = new Map();
    for (const row of invoices) {
      const staffId = String(row.staff_id || row.staffId || "");
      if (!staffId) continue;
      invoiceRevenueByStaff.set(staffId, (invoiceRevenueByStaff.get(staffId) || 0) + money(Number(row.grand_total ?? row.total ?? 0) * 100));
    }
    const staff = staffRows.map((person) => {
      const staffId = String(person.id || "");
      const attendance = attendanceByStaff.get(staffId);
      const payroll = payrollByStaff.get(staffId) || {};
      const monthlyPayPaise = money(Number(payroll.netPay || payroll.grossPay || payroll.basic || 0) * 100);
      const dailySalaryPaise = isPresent(attendance?.status) ? Math.round(monthlyPayPaise / 30) : 0;
      const commissionPaise = commissionByStaff.get(staffId) || 0;
      const revenuePaise = invoiceRevenueByStaff.get(staffId) || 0;
      return {
        staffId,
        name: person.name,
        role: person.role,
        attendance: attendance?.status || "not_marked",
        minutesWorked: Number(attendance?.minutesWorked || 0),
        revenue: rupees(revenuePaise),
        dailySalary: rupees(dailySalaryPaise),
        commission: rupees(commissionPaise),
        totalStaffCost: rupees(dailySalaryPaise + commissionPaise),
        netContribution: rupees(revenuePaise - dailySalaryPaise - commissionPaise)
      };
    });
    const productRows = tableExists("inventoryMovements")
      ? safeAll(`SELECT sku, SUM(qty) AS qty, SUM(totalCostPaise) AS costPaise FROM inventoryMovements
          WHERE tenantId=@tenantId AND branchId=@branchId AND businessDate=@businessDate AND movementType='out'
          GROUP BY sku ORDER BY costPaise DESC LIMIT 10`, { tenantId, branchId, businessDate })
      : [];
    const productCostPaise = productRows.reduce((sum, row) => sum + money(row.costPaise), 0);
    const costs = this.costStructure({ branchId, toDate: businessDate }, access);
    const rentLine = (costs.lines || []).find((line) => String(line.name || "").toLowerCase().includes("rent"));
    const dailyRentPaise = rentLine ? money((Number(rentLine.amount || 0) * 100) / 30) : 0;
    const salaryPaise = staff.reduce((sum, row) => sum + money(row.dailySalary * 100), 0);
    const commissionPaise = staff.reduce((sum, row) => sum + money(row.commission * 100), 0);
    const directCostPaise = salaryPaise + commissionPaise + productCostPaise + dailyRentPaise;
    return {
      businessDate,
      invoiceCount: invoices.length,
      sales: rupees(salesPaise),
      paid: rupees(paidPaise),
      discount: rupees(discountPaise),
      gst: rupees(gstPaise),
      productConsumption: rupees(productCostPaise),
      dailyRent: rupees(dailyRentPaise),
      salary: rupees(salaryPaise),
      commission: rupees(commissionPaise),
      directCost: rupees(directCostPaise),
      netAfterTrackedCost: rupees(salesPaise - directCostPaise),
      staff,
      products: productRows.map((row) => ({ sku: row.sku, qty: Number(row.qty || 0), cost: rupees(row.costPaise) }))
    };
  },

  financeOs(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const asOfDate = normalizeBusinessDate(query.asOfDate || today(), { allowFuture: true });
    ensureHardeningSchema();
    const daily = this.dailyOperations({ branchId, asOfDate }, access);
    const costs = this.costStructure({ branchId, toDate: asOfDate, avgTicketPaise: query.avgTicketPaise || 0 }, access);
    const sheet = this.live({ branchId, asOfDate }, access);
    const outbox = safeGet(`
      SELECT
        SUM(CASE WHEN status='pending' THEN 1 ELSE 0 END) AS pending,
        SUM(CASE WHEN status='failed' THEN 1 ELSE 0 END) AS failed,
        SUM(CASE WHEN status='posted' THEN 1 ELSE 0 END) AS posted
      FROM glOutbox WHERE tenantId=@tenantId AND branchId=@branchId
    `, { tenantId, branchId });
    const invoiceRows = safeAll(`
      SELECT id, lineItems, line_items, total, grand_total, gstAmount, gst_amount, discount, discount_total
      FROM invoices
      WHERE COALESCE(tenant_id, @tenantId)=@tenantId
        AND (branchId=@branchId OR branch_id=@branchId OR @branchId='')
        AND substr(COALESCE(createdAt, created_at, ''), 1, 10)=@asOfDate
    `, { tenantId, branchId, asOfDate });
    const serviceMap = new Map();
    for (const invoice of invoiceRows) {
      const items = parseJson(invoice.lineItems || invoice.line_items, []);
      for (const item of Array.isArray(items) ? items : []) {
        const type = String(item.type || item.itemType || "").toLowerCase();
        const name = String(item.name || item.serviceName || item.productName || type || "Item");
        const qty = Number(item.quantity || item.qty || 1);
        const revenuePaise = money(Number(item.total ?? item.lineTotal ?? item.price ?? 0) * 100);
        const current = serviceMap.get(name) || { name, type: type || "service", count: 0, revenuePaise: 0 };
        current.count += qty;
        current.revenuePaise += revenuePaise;
        serviceMap.set(name, current);
      }
    }
    const serviceMargins = [...serviceMap.values()]
      .sort((a, b) => b.revenuePaise - a.revenuePaise)
      .slice(0, 8)
      .map((row) => {
        const estimatedCostPaise = row.type === "product" ? Math.round(row.revenuePaise * 0.45) : 0;
        const commissionPaise = Math.round(row.revenuePaise * 0.1);
        const marginPaise = row.revenuePaise - estimatedCostPaise - commissionPaise;
        return {
          name: row.name,
          type: row.type,
          count: row.count,
          revenue: rupees(row.revenuePaise),
          productCost: rupees(estimatedCostPaise),
          staffCommission: rupees(commissionPaise),
          margin: rupees(marginPaise),
          marginPct: row.revenuePaise ? Math.round((marginPaise / row.revenuePaise) * 1000) / 10 : 0
        };
      });
    const glRevenuePaise = this.accountBalances(tenantId, branchId, asOfDate)
      .filter((row) => row.accountType === "income")
      .reduce((sum, row) => sum + Number(row.creditPaise || 0) - Number(row.debitPaise || 0), 0);
    const inventoryValuePaise = this.accountBalances(tenantId, branchId, asOfDate)
      .filter((row) => row.accountSubType === "inventory")
      .reduce((sum, row) => sum + sectionBalance(row), 0);
    const wmaValue = safeGet("SELECT SUM(totalValuePaise) AS value FROM inventoryItems WHERE tenantId=@tenantId AND branchId=@branchId", { tenantId, branchId });
    const revenueDiffPaise = money(daily.sales * 100) - glRevenuePaise;
    const inventoryDiffPaise = Number(wmaValue.value || 0) - inventoryValuePaise;
    const outgoingRows = tableExists("outgoing_fund_entries")
      ? safeAll(`
        SELECT id, entry_no, entry_date, amount, payment_mode, paid_from_account_name, paid_to_account_name, transaction_type, status
        FROM outgoing_fund_entries
        WHERE tenant_id=@tenantId AND (branch_id=@branchId OR @branchId='')
          AND entry_date=@asOfDate AND status <> 'deleted'
        ORDER BY created_at DESC LIMIT 12
      `, { tenantId, branchId, asOfDate })
      : [];
    const outgoingPaise = outgoingRows.reduce((sum, row) => sum + money(Number(row.amount || 0) * 100), 0);
    const cashOutgoingPaise = outgoingRows
      .filter((row) => String(`${row.payment_mode || ""} ${row.paid_from_account_name || ""}`).toLowerCase().includes("cash"))
      .reduce((sum, row) => sum + money(Number(row.amount || 0) * 100), 0);
    const bankOutgoingPaise = outgoingPaise - cashOutgoingPaise;
    const paymentRows = safeAll(`
      SELECT invoiceId, invoice_id, mode, amount, reference, remarks, createdAt, created_at
      FROM payments
      WHERE COALESCE(tenant_id, @tenantId)=@tenantId
        AND (branchId=@branchId OR branch_id=@branchId OR @branchId='')
        AND substr(COALESCE(createdAt, created_at, ''), 1, 10)=@asOfDate
      ORDER BY COALESCE(createdAt, created_at, '') DESC LIMIT 200
    `, { tenantId, branchId, asOfDate });
    const cashCollectionPaise = paymentRows
      .filter((row) => String(row.mode || "").toLowerCase().includes("cash"))
      .reduce((sum, row) => sum + money(Number(row.amount || 0) * 100), 0);
    const bankCollectionPaise = paymentRows.reduce((sum, row) => sum + money(Number(row.amount || 0) * 100), 0) - cashCollectionPaise;
    const cashBankReconciliation = {
      cashCollection: rupees(cashCollectionPaise),
      bankCollection: rupees(bankCollectionPaise),
      cashOutgoing: rupees(cashOutgoingPaise),
      bankOutgoing: rupees(bankOutgoingPaise),
      expectedCash: rupees(cashCollectionPaise - cashOutgoingPaise),
      expectedBankNet: rupees(bankCollectionPaise - bankOutgoingPaise),
      paymentRows: paymentRows.length,
      outgoingRows: outgoingRows.length
    };
    const expenseMap = new Map();
    const addExpense = (category, amountPaise, source) => {
      const key = String(category || "general").toLowerCase();
      const current = expenseMap.get(key) || { category: key, amountPaise: 0, sources: new Set() };
      current.amountPaise += money(amountPaise);
      current.sources.add(source);
      expenseMap.set(key, current);
    };
    addExpense("salary", money(daily.salary * 100), "attendance");
    addExpense("commission", money(daily.commission * 100), "invoice");
    addExpense("rent", money(daily.dailyRent * 100), "fixed-cost");
    addExpense("product", money(daily.productConsumption * 100), "inventory");
    for (const row of outgoingRows) {
      const text = `${row.transaction_type || ""} ${row.paid_to_account_name || ""}`.toLowerCase();
      const category = text.includes("salary") ? "salary"
        : text.includes("rent") ? "rent"
          : text.includes("stock") || text.includes("purchase") || text.includes("product") ? "product"
            : text.includes("electric") || text.includes("utility") ? "utilities"
              : text.includes("market") || text.includes("ad") ? "marketing"
                : "other";
      addExpense(category, money(Number(row.amount || 0) * 100), "outgoing");
    }
    const expenseCategoryProfit = [...expenseMap.values()].map((row) => ({
      category: row.category,
      amount: rupees(row.amountPaise),
      netAfterCategory: rupees(money(daily.sales * 100) - row.amountPaise),
      sources: [...row.sources]
    })).sort((a, b) => b.amount - a.amount);
    const branchRows = safeAll("SELECT id, name FROM branches WHERE tenantId=@tenantId ORDER BY name ASC LIMIT 20", { tenantId });
    const branchWise = branchRows.map((branch) => {
      const bid = String(branch.id || "");
      const branchDaily = this.dailyOperations({ branchId: bid, asOfDate }, access);
      const branchSheet = this.live({ branchId: bid, asOfDate }, access);
      return {
        branchId: bid,
        branchName: branch.name || bid,
        cash: branchSheet.sections.assets.filter((row) => ["cash", "bank"].includes(row.accountSubType)).reduce((sum, row) => sum + Number(row.balance || 0), 0),
        receivable: branchSheet.sections.assets.filter((row) => row.accountSubType === "receivables").reduce((sum, row) => sum + Number(row.balance || 0), 0),
        payable: branchSheet.sections.liabilities.filter((row) => row.accountSubType === "payables").reduce((sum, row) => sum + Number(row.balance || 0), 0),
        stock: branchSheet.sections.assets.filter((row) => row.accountSubType === "inventory").reduce((sum, row) => sum + Number(row.balance || 0), 0),
        profit: branchDaily.netAfterTrackedCost
      };
    });
    const outboxRows = safeAll(`
      SELECT eventKey, eventType, status, businessDate, journalEntryId, createdAt
      FROM glOutbox
      WHERE tenantId=@tenantId AND branchId=@branchId
        AND (businessDate=@asOfDate OR substr(createdAt, 1, 10)=@asOfDate)
      ORDER BY createdAt DESC LIMIT 20
    `, { tenantId, branchId, asOfDate });
    const invoiceDrilldown = invoiceRows.slice(0, 12).map((invoice) => {
      const invoiceId = String(invoice.id || "");
      const status = outboxRows.find((row) => String(row.eventKey || "").includes(invoiceId))?.status || "not_queued";
      return {
        invoiceId,
        invoiceNumber: invoice.invoiceNumber || invoice.invoice_no || invoiceId,
        revenue: rupees(money(Number(invoice.grand_total ?? invoice.total ?? 0) * 100)),
        gst: rupees(money(Number(invoice.gst_amount ?? invoice.gstAmount ?? 0) * 100)),
        glStatus: status
      };
    });
    const timeline = [
      ...invoiceRows.slice(0, 10).map((row) => ({ at: row.createdAt || row.created_at || asOfDate, type: "invoice", title: row.invoiceNumber || row.invoice_no || row.id, amount: rupees(money(Number(row.grand_total ?? row.total ?? 0) * 100)) })),
      ...paymentRows.slice(0, 10).map((row) => ({ at: row.createdAt || row.created_at || asOfDate, type: "payment", title: `${row.mode || "payment"} received`, amount: Number(row.amount || 0) })),
      ...outgoingRows.slice(0, 10).map((row) => ({ at: row.entry_date, type: "outgoing", title: row.paid_to_account_name || row.transaction_type || row.entry_no, amount: Number(row.amount || 0) })),
      ...daily.products.slice(0, 8).map((row) => ({ at: asOfDate, type: "inventory", title: `Inventory consumed ${row.sku}`, amount: row.cost })),
      ...outboxRows.slice(0, 10).map((row) => ({ at: row.createdAt || row.businessDate, type: "gl", title: `${row.eventType} ${row.status}`, amount: 0 }))
    ].sort((a, b) => String(b.at || "").localeCompare(String(a.at || ""))).slice(0, 20);
    const gstPayablePaise = daily.gst * 100;
    const month = periodOf(asOfDate);
    const checklist = [
      { key: "salary_accrual", label: "Salary accrual", done: daily.salary > 0, amount: daily.salary },
      { key: "rent_accrual", label: "Rent accrual", done: daily.dailyRent > 0, amount: daily.dailyRent },
      { key: "commission_accrual", label: "Commission accrual", done: daily.commission > 0, amount: daily.commission },
      { key: "gst_payable", label: "GST payable review", done: daily.gst > 0, amount: daily.gst },
      { key: "depreciation", label: "Depreciation run", done: costs.lines.some((line) => String(line.category || "").includes("depreciation")), amount: 0 },
      { key: "deferred_revenue", label: "Deferred revenue recognition", done: sheet.sections.liabilities.some((row) => String(row.accountSubType || "").includes("deferred")), amount: 0 }
    ];
    const suggestions = [
      revenueDiffPaise !== 0 ? { severity: "warn", title: "POS to GL sync pending", text: `POS sales aur GL revenue me ${rupees(revenueDiffPaise)} ka gap hai.`, action: "Process GL outbox / invoice sync check karo." } : null,
      Number(outbox.failed || 0) > 0 ? { severity: "critical", title: "Failed journal events", text: `${outbox.failed} GL outbox events failed hain.`, action: "Hardening tab me Process GL outbox chalao." } : null,
      inventoryDiffPaise !== 0 ? { severity: "warn", title: "Inventory reconciliation gap", text: `WMA inventory aur GL inventory me ${rupees(inventoryDiffPaise)} ka gap hai.`, action: "Inventory issue/purchase posting verify karo." } : null,
      daily.salary === 0 ? { severity: "warn", title: "Salary allocation missing", text: "Aaj staff salary allocation 0 aa raha hai.", action: "Attendance salary profile/payroll component check karo." } : null,
      daily.productConsumption === 0 ? { severity: "ok", title: "Product consumption not posted", text: "Aaj inventory consume/issue entry nahi mili.", action: "Service recipe consume flow verify karo." } : null,
      cashBankReconciliation.expectedCash < 0 ? { severity: "critical", title: "Cash short warning", text: `Expected cash ${rupeesToText(cashBankReconciliation.expectedCash)} aa raha hai.`, action: "Cash drawer aur outgoing cash entries reconcile karo." } : null,
      outgoingPaise > money(daily.sales * 100) ? { severity: "warn", title: "Expense sales se high", text: `Outgoing ${rupeesToText(rupees(outgoingPaise))} aaj ki sales se zyada hai.`, action: "Owner approval se expense check karo." } : null
    ].filter(Boolean);
    const dailyClose = {
      ready: revenueDiffPaise === 0 && inventoryDiffPaise === 0 && Number(outbox.failed || 0) === 0,
      warnings: suggestions.filter((item) => item.severity !== "ok").length,
      checklist: [
        { key: "pos_gl", label: "POS sales GL me queued/posted", done: revenueDiffPaise === 0 },
        { key: "cash_bank", label: "Cash/Bank expected calculated", done: cashBankReconciliation.paymentRows > 0 || daily.sales === 0 },
        { key: "outgoing", label: "Outgoing fund impact included", done: true },
        { key: "inventory", label: "Inventory COGS reconciled", done: inventoryDiffPaise === 0 },
        { key: "gst", label: "GST payable estimated", done: daily.gst >= 0 },
        { key: "staff", label: "Staff salary/commission checked", done: daily.staffProfitability?.length ? true : daily.staff.length > 0 }
      ]
    };
    return {
      asOfDate,
      month,
      outgoingImpact: {
        total: rupees(outgoingPaise),
        cash: rupees(cashOutgoingPaise),
        bank: rupees(bankOutgoingPaise),
        profitAfterOutgoing: rupees(money(daily.netAfterTrackedCost * 100) - outgoingPaise),
        recent: outgoingRows.map((row) => ({
          id: row.id,
          entryNo: row.entry_no,
          category: row.transaction_type || "Outgoing",
          payee: row.paid_to_account_name || row.paid_from_account_name || "",
          mode: row.payment_mode || "",
          amount: Number(row.amount || 0),
          status: row.status || ""
        }))
      },
      todayTimeline: timeline,
      ownerDailyClose: dailyClose,
      cashBankReconciliation,
      expenseCategoryProfit,
      branchWiseBalanceSheet: branchWise,
      invoiceDrilldown,
      gstPayableControl: {
        todayCollected: daily.gst,
        monthEstimate: rupees(safeAll(`
          SELECT gstAmount, gst_amount FROM invoices
          WHERE COALESCE(tenant_id, @tenantId)=@tenantId
            AND (branchId=@branchId OR branch_id=@branchId OR @branchId='')
            AND substr(COALESCE(createdAt, created_at, ''), 1, 7)=@month
        `, { tenantId, branchId, month }).reduce((sum, row) => sum + money(Number(row.gst_amount ?? row.gstAmount ?? 0) * 100), 0)),
        postedOrQueued: outboxRows.filter((row) => String(row.eventType || "").includes("invoice")).length,
        payablePaise: gstPayablePaise
      },
      livePosToGl: {
        posSales: daily.sales,
        glRevenue: rupees(glRevenuePaise),
        difference: rupees(revenueDiffPaise),
        outboxPending: Number(outbox.pending || 0),
        outboxFailed: Number(outbox.failed || 0),
        outboxPosted: Number(outbox.posted || 0)
      },
      dailyProfit: {
        sales: daily.sales,
        gst: daily.gst,
        discount: daily.discount,
        salary: daily.salary,
        commission: daily.commission,
        rent: daily.dailyRent,
        productConsumption: daily.productConsumption,
        netAfterTrackedCost: daily.netAfterTrackedCost
      },
      staffProfitability: daily.staff,
      serviceMargins,
      inventoryConsumption: {
        total: daily.productConsumption,
        products: daily.products,
        wmaInventory: rupees(wmaValue.value),
        glInventory: rupees(inventoryValuePaise),
        difference: rupees(inventoryDiffPaise)
      },
      fixedCostAllocation: {
        dailyRent: daily.dailyRent,
        dailySalary: daily.salary,
        fixedCostMonth: costs.fixedCost,
        salaryCostMonth: costs.salaryCost
      },
      journalSuggestions: suggestions,
      reconciliation: {
        posVsGlRevenueDifference: rupees(revenueDiffPaise),
        inventoryDifference: rupees(inventoryDiffPaise),
        balanced: sheet.balanced,
        accountingEquationDifference: sheet.totals.accountingEquationDifference
      },
      copilotPrompts: [
        "Aaj profit kam kyu hai?",
        "Kaunsa staff profitable hai?",
        "Kaunsa service loss me hai?",
        "POS sale GL me post hui ya nahi?"
      ],
      monthEndClose: { month, checklist }
    };
  },

  ownerDailyClose(payload = {}, access = {}) {
    const branchId = payload.branchId || access.requestedBranchId || "";
    const asOfDate = normalizeBusinessDate(payload.asOfDate || today(), { allowFuture: true });
    const posToGl = this.syncPosToGl({ branchId, asOfDate }, access);
    const cogs = this.syncInventoryCogs({ branchId, asOfDate }, access);
    const accruals = this.postDailyAccruals({ branchId, asOfDate }, access);
    const report = this.financeOs({ branchId, asOfDate }, access);
    return { asOfDate, posToGl, cogs, accruals, report, ready: report.ownerDailyClose.ready, warnings: report.ownerDailyClose.warnings };
  },

  syncPosToGl(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    ensureHardeningSchema();
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || businessDate).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const invoices = safeAll(`
      SELECT id, invoiceNumber, invoice_no, total, grand_total, paid, paid_amount, balance, due_amount, status, createdAt, created_at
      FROM invoices
      WHERE COALESCE(tenant_id, @tenantId)=@tenantId
        AND (branchId=@branchId OR branch_id=@branchId OR @branchId='')
        AND substr(COALESCE(createdAt, created_at, ''), 1, 10) BETWEEN @fromDate AND @toDate
    `, { tenantId, branchId, fromDate, toDate });
    const insert = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'invoice.paid', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `);
    const summary = { fromDate, toDate, scanned: invoices.length, enqueued: 0, duplicate: 0, skipped: 0, events: [] };
    for (const invoice of invoices) {
      const amount = Number(invoice.paid_amount ?? invoice.paid ?? invoice.grand_total ?? invoice.total ?? 0);
      if (amount <= 0) {
        summary.skipped += 1;
        continue;
      }
      const invoiceDate = String(invoice.createdAt || invoice.created_at || businessDate).slice(0, 10);
      const eventKey = `invoice.paid:${tenantId}:${branchId}:${invoice.id}`;
      const row = {
        id: id("obx"),
        tenantId,
        branchId,
        eventKey,
        businessDate: invoiceDate,
        payloadJson: JSON.stringify({
          invoiceId: invoice.id,
          invoiceNumber: invoice.invoiceNumber || invoice.invoice_no || "",
          amountPaise: money(amount * 100),
          mode: payload.mode || "bank",
          revenueCode: payload.revenueCode || "4000",
          memo: `POS invoice ${invoice.invoiceNumber || invoice.invoice_no || invoice.id}`
        })
      };
      const result = insert.run(row);
      if (result.changes === 1) {
        summary.enqueued += 1;
        summary.events.push({ invoiceId: invoice.id, status: "enqueued", amount });
      } else {
        summary.duplicate += 1;
      }
    }
    return summary;
  },

  enqueueInvoicePaymentEvent({ invoice = {}, amount = 0, mode = "bank", access = {} } = {}) {
    const tenantId = access.tenantId;
    if (!tenantId || !invoice.id) return { enqueued: false, skipped: true };
    ensureHardeningSchema();
    const branchId = invoice.branch_id || invoice.branchId || access.requestedBranchId || "";
    const businessDate = String(invoice.paid_at || invoice.finalized_at || invoice.created_at || invoice.createdAt || today()).slice(0, 10);
    const amountPaise = money(amount * 100);
    if (amountPaise <= 0) return { enqueued: false, skipped: true };
    const eventKey = `invoice.paid:${tenantId}:${branchId}:${invoice.id}:${money(invoice.paid_amount || invoice.paid || amount)}`;
    const result = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'invoice.paid', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `).run({
      id: id("obx"),
      tenantId,
      branchId,
      eventKey,
      businessDate,
      payloadJson: JSON.stringify({
        invoiceId: invoice.id,
        invoiceNumber: invoice.invoice_no || invoice.invoiceNumber || "",
        amountPaise,
        mode,
        revenueCode: "4000",
        memo: `Invoice payment ${invoice.invoice_no || invoice.invoiceNumber || invoice.id}`
      })
    });
    return { enqueued: result.changes === 1, duplicate: result.changes === 0, eventKey };
  },

  enqueueInvoiceRefundEvent({ invoice = {}, refund = {}, mode = "bank", access = {} } = {}) {
    const tenantId = access.tenantId;
    if (!tenantId || !invoice.id || !refund.refundId) return { enqueued: false, skipped: true };
    ensureHardeningSchema();
    const branchId = invoice.branch_id || invoice.branchId || access.requestedBranchId || "";
    const businessDate = String(refund.processedAt || invoice.updated_at || today()).slice(0, 10);
    const amountPaise = money(Number(refund.amount || 0) * 100);
    if (amountPaise <= 0) return { enqueued: false, skipped: true };
    const eventKey = `invoice.refund:${tenantId}:${branchId}:${refund.refundId}`;
    const result = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'invoice.refund', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `).run({
      id: id("obx"),
      tenantId,
      branchId,
      eventKey,
      businessDate,
      payloadJson: JSON.stringify({
        invoiceId: invoice.id,
        refundId: refund.refundId,
        refundNo: refund.refundNo || "",
        amountPaise,
        taxReversalPaise: money(Number(refund.taxReversal || 0) * 100),
        mode,
        memo: `Invoice refund ${refund.refundNo || refund.refundId}`
      })
    });
    return { enqueued: result.changes === 1, duplicate: result.changes === 0, eventKey };
  },

  syncInventoryCogs(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    ensureHardeningSchema();
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const fromDate = String(payload.fromDate || businessDate).slice(0, 10);
    const toDate = normalizeBusinessDate(payload.toDate || businessDate, { allowFuture: true });
    const movements = safeAll(`
      SELECT sku, businessDate, sourceType, sourceId, SUM(qty) AS qty, SUM(totalCostPaise) AS cogsPaise
      FROM inventoryMovements
      WHERE tenantId=@tenantId AND branchId=@branchId AND movementType='out'
        AND businessDate BETWEEN @fromDate AND @toDate
      GROUP BY sku, businessDate, sourceType, sourceId
      ORDER BY businessDate ASC
    `, { tenantId, branchId, fromDate, toDate });
    const insert = db.prepare(`
      INSERT OR IGNORE INTO glOutbox
        (id, tenantId, branchId, eventType, eventKey, businessDate, payloadJson, status, availableAt)
      VALUES
        (@id, @tenantId, @branchId, 'inventory.cogs', @eventKey, @businessDate, @payloadJson, 'pending', 0)
    `);
    const summary = { fromDate, toDate, scanned: movements.length, enqueued: 0, duplicate: 0, skipped: 0, cogs: 0, events: [] };
    for (const movement of movements) {
      const cogsPaise = money(movement.cogsPaise);
      if (cogsPaise <= 0) {
        summary.skipped += 1;
        continue;
      }
      const eventKey = `inventory.cogs:${tenantId}:${branchId}:${movement.businessDate}:${movement.sku}:${movement.sourceType || "manual"}:${movement.sourceId || "none"}`;
      const result = insert.run({
        id: id("obx"),
        tenantId,
        branchId,
        eventKey,
        businessDate: movement.businessDate,
        payloadJson: JSON.stringify({
          sku: movement.sku,
          qty: Number(movement.qty || 0),
          cogsPaise,
          sourceType: movement.sourceType || "inventory",
          sourceId: movement.sourceId || "",
          memo: `COGS ${movement.sku}`
        })
      });
      if (result.changes === 1) {
        summary.enqueued += 1;
        summary.cogs += rupees(cogsPaise);
        summary.events.push({ sku: movement.sku, status: "enqueued", cogs: rupees(cogsPaise) });
      } else {
        summary.duplicate += 1;
      }
    }
    return summary;
  },

  postDailyAccruals(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const businessDate = normalizeBusinessDate(payload.businessDate || payload.asOfDate || today(), { allowFuture: true });
    const daily = this.dailyOperations({ branchId, asOfDate: businessDate }, access);
    const sourceId = `${tenantId}:${branchId}:${businessDate}`;
    const entries = [];
    const post = (key, memo, lines) => {
      const amount = lines.reduce((sum, line) => sum + money(line.debitPaise), 0);
      if (amount <= 0) return null;
      const entry = this.createJournal({
        branchId,
        businessDate,
        sourceType: key,
        sourceId,
        memo,
        idempotencyKey: `${key}:${sourceId}`,
        lines: lines.map((line) => ({ ...line, accountId: accountIdByCode(tenantId, branchId, line.code) }))
      }, access);
      entries.push({ key, memo, amount: rupees(amount), journalEntryId: entry.id });
      return entry;
    };
    post("salary.accrual", "Daily salary accrual", [
      { code: "5100", debitPaise: money(daily.salary * 100), memo: "Staff salary accrued" },
      { code: "2000", creditPaise: money(daily.salary * 100), memo: "Salary payable" }
    ]);
    post("rent.accrual", "Daily rent accrual", [
      { code: "5200", debitPaise: money(daily.dailyRent * 100), memo: "Daily rent allocated" },
      { code: "2000", creditPaise: money(daily.dailyRent * 100), memo: "Rent payable" }
    ]);
    post("commission.accrual", "Daily staff commission accrual", [
      { code: "5100", debitPaise: money(daily.commission * 100), memo: "Staff commission accrued" },
      { code: "2000", creditPaise: money(daily.commission * 100), memo: "Commission payable" }
    ]);
    post("gst.payable.accrual", "GST payable reclass from POS sales", [
      { code: "4000", debitPaise: money(daily.gst * 100), memo: "GST separated from sales" },
      { code: "2100", creditPaise: money(daily.gst * 100), memo: "GST payable" }
    ]);
    return { businessDate, posted: entries.length, entries };
  },

  runMonthCloseAutomation(payload = {}, access = {}) {
    const { branchId } = scope(access, payload.branchId || "");
    const period = String(payload.period || periodOf(payload.asOfDate || today())).slice(0, 7);
    const periodStart = new Date(`${period}-01T00:00:00Z`);
    const periodEnd = new Date(Date.UTC(periodStart.getUTCFullYear(), periodStart.getUTCMonth() + 1, 0)).toISOString().slice(0, 10);
    const endDate = normalizeBusinessDate(payload.asOfDate || periodEnd, { allowFuture: true });
    const fromDate = `${period}-01`;
    const pos = this.syncPosToGl({ branchId, fromDate, toDate: endDate }, access);
    const cogs = this.syncInventoryCogs({ branchId, fromDate, toDate: endDate }, access);
    const accruals = this.postDailyAccruals({ branchId, asOfDate: endDate }, access);
    const snapshot = this.createSnapshot({ branchId, asOfDate: endDate }, access);
    return {
      period,
      fromDate,
      toDate: endDate,
      posToGl: pos,
      inventoryCogs: cogs,
      accruals,
      snapshotId: snapshot.id,
      nextSteps: [
        "Process GL outbox chalao taaki queued POS/COGS journals post ho.",
        "Reconciliation run karo.",
        "Hardening tab se period lock karo jab checks clean ho."
      ]
    };
  },

  financeCopilot(payload = {}, access = {}) {
    const question = String(payload.question || "").trim();
    if (!question) throw badRequest("question is required");
    const branchId = payload.branchId || "";
    const asOfDate = normalizeBusinessDate(payload.asOfDate || today(), { allowFuture: true });
    const report = this.financeOs({ branchId, asOfDate }, access);
    const q = question.toLowerCase();
    let answer = "";
    const actions = [];
    if (q.includes("profit") || q.includes("kam") || q.includes("loss")) {
      answer = `Aaj sale ${rupeesToText(report.dailyProfit.sales)} hai aur tracked cost ke baad net ${rupeesToText(report.dailyProfit.netAfterTrackedCost)} hai. Major cost: salary ${rupeesToText(report.dailyProfit.salary)}, commission ${rupeesToText(report.dailyProfit.commission)}, product ${rupeesToText(report.dailyProfit.productConsumption)}, rent ${rupeesToText(report.dailyProfit.rent)}.`;
      if (report.dailyProfit.productConsumption === 0) actions.push("Service recipe/product consumption posting verify karo.");
      if (report.livePosToGl.difference !== 0) actions.push("POS to GL sync run karo.");
    } else if (q.includes("staff")) {
      const ranked = [...report.staffProfitability].sort((a, b) => b.netContribution - a.netContribution);
      const best = ranked[0];
      const weak = ranked[ranked.length - 1];
      answer = best
        ? `Best staff contribution ${best.name}: ${rupeesToText(best.netContribution)}. Lowest contribution ${weak?.name || best.name}: ${rupeesToText(weak?.netContribution || 0)}. Attendance aur salary allocation ko staff table me compare karo.`
        : "Aaj staff profitability ke liye invoice/staff/attendance data nahi mila.";
      actions.push("Staff attendance, salary profile aur commission rule complete rakho.");
    } else if (q.includes("service") || q.includes("loss")) {
      const weak = [...report.serviceMargins].sort((a, b) => a.marginPct - b.marginPct)[0];
      answer = weak
        ? `${weak.name} ka estimated margin ${weak.marginPct}% hai. Revenue ${rupeesToText(weak.revenue)}, product ${rupeesToText(weak.productCost)}, commission ${rupeesToText(weak.staffCommission)}.`
        : "Aaj service margin ke liye invoice line items nahi mile.";
      actions.push("Exact margin ke liye service recipe cost aur staff time-cost connect karo.");
    } else if (q.includes("gl") || q.includes("post") || q.includes("sync")) {
      answer = `POS sales ${rupeesToText(report.livePosToGl.posSales)} aur GL revenue ${rupeesToText(report.livePosToGl.glRevenue)} hai. Difference ${rupeesToText(report.livePosToGl.difference)}. Pending outbox ${report.livePosToGl.outboxPending}, failed ${report.livePosToGl.outboxFailed}.`;
      actions.push("Sync POS to GL chalao, phir Process GL outbox.");
    } else {
      answer = `Aaj ka finance snapshot: sale ${rupeesToText(report.dailyProfit.sales)}, tracked net ${rupeesToText(report.dailyProfit.netAfterTrackedCost)}, POS-GL gap ${rupeesToText(report.livePosToGl.difference)}, inventory gap ${rupeesToText(report.inventoryConsumption.difference)}.`;
      actions.push(...report.journalSuggestions.slice(0, 3).map((item) => item.action));
    }
    return { question, answer, actions, asOfDate, reportVersion: "finance-os-v2" };
  },

  ledger(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const accountId = String(query.accountId || "");
    if (!accountId) throw badRequest("accountId is required");
    const account = db.prepare("SELECT * FROM chartOfAccounts WHERE tenantId = ? AND branchId = ? AND id = ?").get(tenantId, branchId, accountId);
    if (!account) throw notFound("Account not found");
    const fromDate = String(query.fromDate || `${periodOf(today())}-01`).slice(0, 10);
    const toDate = normalizeBusinessDate(query.toDate, { allowFuture: true });
    let running = 0;
    const lines = db.prepare(`
      SELECT e.businessDate, e.sourceType, e.sourceId, e.memo, l.debitPaise, l.creditPaise, l.lineMemo
      FROM journalEntryLines l
      JOIN journalEntries e ON e.id = l.journalEntryId AND e.tenantId = l.tenantId
      WHERE l.tenantId = @tenantId AND l.branchId = @branchId AND l.accountId = @accountId
        AND e.status = 'posted' AND e.businessDate BETWEEN @fromDate AND @toDate
      ORDER BY e.businessDate ASC, e.createdAt ASC
    `).all({ tenantId, branchId, accountId, fromDate, toDate });
    return {
      account: rowAccount(account),
      fromDate,
      toDate,
      rows: lines.map((line) => {
        const movement = account.normalBalance === "credit"
          ? Number(line.creditPaise || 0) - Number(line.debitPaise || 0)
          : Number(line.debitPaise || 0) - Number(line.creditPaise || 0);
        running += movement;
        return {
          businessDate: line.businessDate,
          sourceType: line.sourceType,
          sourceId: line.sourceId,
          memo: line.lineMemo || line.memo,
          debit: rupees(line.debitPaise),
          credit: rupees(line.creditPaise),
          balance: rupees(running)
        };
      })
    };
  },

  createSnapshot(payload = {}, access = {}) {
    const sheet = this.live(payload, access);
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const snapshotId = id("bss");
    // Use authoritative paise totals — no rupees->paise round-trip rounding loss.
    db.prepare(`
      INSERT OR REPLACE INTO balanceSheetSnapshots
        (id, tenantId, branchId, asOfDate, totalAssetsPaise, totalLiabilitiesPaise, totalEquityPaise, payloadJson, createdAt)
      VALUES
        (@id, @tenantId, @branchId, @asOfDate, @totalAssetsPaise, @totalLiabilitiesPaise, @totalEquityPaise, @payloadJson, CURRENT_TIMESTAMP)
    `).run({
      id: snapshotId,
      tenantId,
      branchId,
      asOfDate: sheet.asOfDate,
      totalAssetsPaise: sheet.totalsPaise.assets,
      totalLiabilitiesPaise: sheet.totalsPaise.liabilities,
      totalEquityPaise: sheet.totalsPaise.equity,
      payloadJson: JSON.stringify(sheet)
    });
    return { id: snapshotId, ...sheet };
  },

  assertPeriodOpen(tenantId, branchId, date) {
    const locked = db.prepare("SELECT * FROM periodLocks WHERE tenantId = ? AND branchId = ? AND period = ?").get(tenantId, branchId, periodOf(date));
    if (locked) throw badRequest(`Accounting period ${periodOf(date)} is locked`);
  },

  accountBalances(tenantId, branchId, asOfDate) {
    seedChartOfAccounts(tenantId, branchId);
    return db.prepare(`
      SELECT a.id, a.code, a.name, a.accountType, a.accountSubType, a.normalBalance,
        COALESCE(SUM(l.debitPaise), 0) AS debitPaise,
        COALESCE(SUM(l.creditPaise), 0) AS creditPaise
      FROM chartOfAccounts a
      LEFT JOIN (
        journalEntryLines l
        JOIN journalEntries e
          ON e.id = l.journalEntryId
          AND e.tenantId = l.tenantId
          AND e.branchId = l.branchId
          AND e.status = 'posted'
          AND e.businessDate <= @asOfDate
      ) ON l.accountId = a.id AND l.tenantId = a.tenantId AND l.branchId = a.branchId
      WHERE a.tenantId = @tenantId AND a.branchId = @branchId AND a.active = 1
      GROUP BY a.id
      ORDER BY a.code ASC
    `).all({ tenantId, branchId, asOfDate });
  },

  statementRow(row) {
    return {
      code: row.code,
      name: row.name,
      accountSubType: row.accountSubType,
      balance: rupees(row.balancePaise),
      balancePaise: row.balancePaise
    };
  },

  balanceAlerts(assets, liabilities, equity, difference) {
    const alerts = [];
    if (difference !== 0) alerts.push({ severity: "critical", title: "Balance sheet not balanced", message: "Assets must equal liabilities plus equity." });
    if (assets <= 0) alerts.push({ severity: "warning", title: "No asset balance", message: "Opening balance or journal sync may be pending." });
    if (liabilities > assets) alerts.push({ severity: "warning", title: "High liability pressure", message: "Liabilities are greater than assets." });
    return alerts;
  }
};
