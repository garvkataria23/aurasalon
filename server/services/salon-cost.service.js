import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";
import { istToday, normalizeBusinessDate, periodOf } from "../utils/finance-time.js";

const id = (p) => `${p}_${randomUUID().slice(0, 12)}`;
const rupees = (paise) => Math.round(Number(paise || 0)) / 100;
const round2 = (n) => Math.round(Number(n || 0) * 100) / 100;

let ensured = false;
function ensureSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS costClassifications (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      accountCode TEXT NOT NULL,
      behavior TEXT NOT NULL DEFAULT 'fixed' CHECK(behavior IN ('fixed','variable','excluded')),
      category TEXT NOT NULL DEFAULT 'other',
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, branchId, accountCode)
    );
  `);
  ensured = true;
}

// Salon-sensible defaults: product used per service is variable; rent, salary,
// marketing and depreciation are period (fixed) costs. Owner can override any.
const SALON_DEFAULTS = [
  ["5000", "variable", "product"],
  ["5100", "fixed", "salary"],
  ["5200", "fixed", "rent"],
  ["5300", "fixed", "marketing"],
  ["5400", "fixed", "depreciation"],
  ["5600", "variable", "commission"]
];

function scope(access = {}, branchId = "") {
  ensureSchema();
  if (!access.tenantId) throw badRequest("Tenant context is required");
  tenantService.ensureSubscriptionActive(access.tenantId);
  const requestedBranch = branchId || access.requestedBranchId || "";
  if (requestedBranch) tenantService.assertBranchAccess(access, requestedBranch);
  seedDefaults(access.tenantId, requestedBranch);
  return { tenantId: access.tenantId, branchId: requestedBranch };
}

function seedDefaults(tenantId, branchId) {
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO costClassifications (id, tenantId, branchId, accountCode, behavior, category)
    VALUES (@id, @tenantId, @branchId, @accountCode, @behavior, @category)
  `);
  for (const [accountCode, behavior, category] of SALON_DEFAULTS) {
    stmt.run({ id: id("cc"), tenantId, branchId, accountCode, behavior, category });
  }
}

export const salonCostService = {
  classify(payload = {}, access = {}) {
    const { tenantId, branchId } = scope(access, payload.branchId || "");
    const accountCode = String(payload.accountCode || "").trim();
    if (!accountCode) throw badRequest("accountCode is required");
    const behavior = ["fixed", "variable", "excluded"].includes(payload.behavior) ? payload.behavior : "fixed";
    const category = String(payload.category || "other");
    db.prepare(`
      INSERT INTO costClassifications (id, tenantId, branchId, accountCode, behavior, category, updatedAt)
      VALUES (@id, @tenantId, @branchId, @accountCode, @behavior, @category, @updatedAt)
      ON CONFLICT(tenantId, branchId, accountCode) DO UPDATE SET behavior=@behavior, category=@category, updatedAt=@updatedAt
    `).run({ id: id("cc"), tenantId, branchId, accountCode, behavior, category, updatedAt: istToday() });
    return { accountCode, behavior, category };
  },

  classifications(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    return db.prepare("SELECT accountCode, behavior, category FROM costClassifications WHERE tenantId=? AND branchId=? ORDER BY accountCode").all(tenantId, branchId);
  },

  // Stage 25 — salon cost structure + break-even for a period.
  costStructure(query = {}, access = {}) {
    const { tenantId, branchId } = scope(access, query.branchId || "");
    const toDate = normalizeBusinessDate(query.toDate, { allowFuture: true });
    const fromDate = String(query.fromDate || `${periodOf(toDate)}-01`).slice(0, 10);
    const avgTicketPaise = Math.round(Number(query.avgTicketPaise || 0));

    const rows = db.prepare(`
      SELECT a.code, a.name, a.accountType,
        COALESCE(SUM(l.debitPaise),0) AS d, COALESCE(SUM(l.creditPaise),0) AS c
      FROM chartOfAccounts a
      LEFT JOIN journalEntryLines l ON l.accountId=a.id AND l.tenantId=a.tenantId AND l.branchId=a.branchId
      LEFT JOIN journalEntries e ON e.id=l.journalEntryId AND e.tenantId=l.tenantId
        AND e.status='posted' AND e.businessDate BETWEEN @fromDate AND @toDate
      WHERE a.tenantId=@tenantId AND a.branchId=@branchId AND a.accountType IN ('income','expense')
      GROUP BY a.id
    `).all({ tenantId, branchId, fromDate, toDate });

    const cls = new Map(this.classifications({ branchId }, access).map((r) => [r.accountCode, r]));

    let revenuePaise = 0, variablePaise = 0, fixedPaise = 0, salaryPaise = 0, excludedPaise = 0;
    const categories = {};
    const lines = [];
    for (const r of rows) {
      if (r.accountType === "income") { revenuePaise += Number(r.c) - Number(r.d); continue; }
      const amt = Number(r.d) - Number(r.c);
      if (amt === 0) continue;
      const c = cls.get(r.code) || { behavior: "fixed", category: "other" };
      if (c.behavior === "excluded") { excludedPaise += amt; continue; }
      if (c.behavior === "variable") variablePaise += amt; else fixedPaise += amt;
      if (c.category === "salary") salaryPaise += amt;
      categories[c.category] = (categories[c.category] || 0) + amt;
      lines.push({ code: r.code, name: r.name, behavior: c.behavior, category: c.category, amount: rupees(amt) });
    }

    const contributionMarginPaise = revenuePaise - variablePaise;
    const cmRatio = revenuePaise > 0 ? contributionMarginPaise / revenuePaise : 0;
    const breakEvenPaise = cmRatio > 0 ? Math.round(fixedPaise / cmRatio) : null;
    const netProfitPaise = contributionMarginPaise - fixedPaise;
    const marginOfSafety = breakEvenPaise !== null && revenuePaise > 0 ? round2((revenuePaise - breakEvenPaise) / revenuePaise * 100) : null;

    return {
      fromDate, toDate,
      revenue: rupees(revenuePaise),
      variableCost: rupees(variablePaise),
      fixedCost: rupees(fixedPaise),
      salaryCost: rupees(salaryPaise),
      excludedCost: rupees(excludedPaise),
      contributionMargin: rupees(contributionMarginPaise),
      contributionMarginRatioPct: round2(cmRatio * 100),
      variableCostRatioPct: revenuePaise > 0 ? round2(variablePaise / revenuePaise * 100) : null,
      salaryToRevenuePct: revenuePaise > 0 ? round2(salaryPaise / revenuePaise * 100) : null,
      breakEvenRevenue: breakEvenPaise === null ? null : rupees(breakEvenPaise),
      breakEvenClients: breakEvenPaise !== null && avgTicketPaise > 0 ? Math.ceil(breakEvenPaise / avgTicketPaise) : null,
      netProfit: rupees(netProfitPaise),
      marginOfSafetyPct: marginOfSafety,
      categories: Object.entries(categories).map(([category, paise]) => ({ category, amount: rupees(paise) })).sort((a, b) => b.amount - a.amount),
      lines: lines.sort((a, b) => b.amount - a.amount)
    };
  }
};