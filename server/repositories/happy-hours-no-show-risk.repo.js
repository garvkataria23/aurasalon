import { db } from "../db.js";
import { happyHoursEngine } from "../utils/happy-hours-engine.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS happyHoursNoShowRiskSuggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    clientId TEXT NOT NULL DEFAULT '',
    serviceCategory TEXT NOT NULL DEFAULT 'default',
    signalDate TEXT NOT NULL,
    dayOfWeek TEXT NOT NULL DEFAULT '',
    hourSlot INTEGER NOT NULL DEFAULT 0,
    requestedStartAt TEXT NOT NULL DEFAULT '',
    cartTotalPaise INTEGER NOT NULL DEFAULT 0,
    baseDiscountPercent REAL NOT NULL DEFAULT 0,
    clientNoShowCount INTEGER NOT NULL DEFAULT 0,
    clientCancelCount INTEGER NOT NULL DEFAULT 0,
    clientCompletedCount INTEGER NOT NULL DEFAULT 0,
    branchNoShowRatePercent REAL NOT NULL DEFAULT 0,
    depositStatus TEXT NOT NULL DEFAULT 'not_required',
    depositRequired INTEGER NOT NULL DEFAULT 0,
    recommendedDepositPaise INTEGER NOT NULL DEFAULT 0,
    riskScore INTEGER NOT NULL DEFAULT 0,
    riskBand TEXT NOT NULL DEFAULT 'unknown',
    discountPosture TEXT NOT NULL DEFAULT 'unknown',
    campaignAngle TEXT NOT NULL DEFAULT 'collect_no_show_data',
    suggestedDiscountPercent INTEGER NOT NULL DEFAULT 0,
    expectedDiscountPaise INTEGER NOT NULL DEFAULT 0,
    expectedNetRevenuePaise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'suggested',
    reasons TEXT NOT NULL DEFAULT '[]',
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_noShowRiskSuggestions_scope
    ON happyHoursNoShowRiskSuggestions(tenantId, branchId, status, clientId, createdAt);
`);

const NO_SHOW_STATUSES = ["no_show", "noshow", "no-show", "no show"];
const CANCEL_STATUSES = ["cancelled", "canceled", "cancel"];
const COMPLETED_STATUSES = ["completed", "paid", "billed", "done", "closed"];

function normalizeScope(scope = {}) {
  const tenantId = String(scope.tenantId || "").trim();
  const branchId = String(scope.branchId || "").trim();
  if (!tenantId || !branchId) throw new Error("tenantId and branchId are required");
  return { tenantId, branchId };
}

function cleanCategory(value) {
  return String(value || "default").trim().toLowerCase() || "default";
}

function intPaise(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function percent(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? Math.max(0, Math.min(100, parsed)) : fallback;
}

function q(identifier) {
  if (!/^[A-Za-z_][A-Za-z0-9_]*$/.test(identifier)) throw new Error("Unsafe identifier");
  return `"${identifier}"`;
}

function tableExists(tableName) {
  try {
    return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @tableName").get({ tableName }));
  } catch {
    return false;
  }
}

function safeColumns(tableName) {
  if (!tableExists(tableName)) return [];
  try {
    return db.prepare(`PRAGMA table_info(${q(tableName)})`).all().map((column) => column.name);
  } catch {
    return [];
  }
}

function column(columns, candidates) {
  return candidates.find((candidate) => columns.includes(candidate)) || "";
}

function sqlList(values) {
  return values.map((value) => `'${value.replace(/'/g, "''")}'`).join(",");
}

function slot(input = {}) {
  const requestedStartAt = String(input.requestedStartAt || "").trim();
  const start = requestedStartAt ? new Date(requestedStartAt) : null;
  const date = start && Number.isFinite(start.getTime())
    ? start
    : input.signalDate
      ? new Date(`${String(input.signalDate).slice(0, 10)}T00:00:00+05:30`)
      : new Date();
  const parts = happyHoursEngine.getISTComponents(date);
  const hour = Number.isFinite(start?.getTime()) ? start.getHours() : Number.parseInt(input.hourSlot ?? parts.nowTime.slice(0, 2), 10);
  return {
    signalDate: String(input.signalDate || parts.nowDate).slice(0, 10),
    dayOfWeek: String(input.dayOfWeek || parts.nowDay).slice(0, 3).toLowerCase(),
    hourSlot: Math.max(0, Math.min(23, hour || 0)),
    requestedStartAt
  };
}

function daysAgo(dateText, days) {
  const date = new Date(`${String(dateText).slice(0, 10)}T00:00:00+05:30`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function appointmentStats(scope = {}) {
  const columns = safeColumns("appointments");
  if (!columns.length) {
    return { clientNoShowCount: 0, clientCancelCount: 0, clientCompletedCount: 0, branchNoShowRatePercent: 0, sampleCount: 0 };
  }
  const tenantCol = column(columns, ["tenantId", "tenant_id"]);
  const branchCol = column(columns, ["branchId", "branch_id"]);
  const clientCol = column(columns, ["clientId", "client_id"]);
  const statusCol = column(columns, ["status", "appointmentStatus", "bookingStatus"]);
  const startCol = column(columns, ["startAt", "appointmentDate", "scheduledFor", "slotStartAt", "startTime", "date"]);
  const categoryCol = column(columns, ["serviceCategory", "category"]);
  if (!branchCol || !statusCol) {
    return { clientNoShowCount: 0, clientCancelCount: 0, clientCompletedCount: 0, branchNoShowRatePercent: 0, sampleCount: 0 };
  }

  const tenantWhere = tenantCol ? `AND ${q(tenantCol)} = @tenantId` : "";
  const dateWhere = startCol ? `AND substr(CAST(${q(startCol)} AS TEXT), 1, 10) >= @fromDate` : "";
  const categoryWhere = categoryCol && scope.serviceCategory !== "default"
    ? `AND LOWER(CAST(${q(categoryCol)} AS TEXT)) = @serviceCategory`
    : "";
  const statusExpr = `LOWER(COALESCE(CAST(${q(statusCol)} AS TEXT), ''))`;
  const baseWhere = `
    WHERE ${q(branchCol)} = @branchId
      ${tenantWhere}
      ${dateWhere}
      ${categoryWhere}
  `;

  try {
    const branch = db.prepare(`
      SELECT COUNT(*) AS sampleCount,
             SUM(CASE WHEN ${statusExpr} IN (${sqlList(NO_SHOW_STATUSES)}) THEN 1 ELSE 0 END) AS noShows
      FROM appointments
      ${baseWhere}
    `).get(scope);
    const client = clientCol && scope.clientId
      ? db.prepare(`
          SELECT SUM(CASE WHEN ${statusExpr} IN (${sqlList(NO_SHOW_STATUSES)}) THEN 1 ELSE 0 END) AS noShows,
                 SUM(CASE WHEN ${statusExpr} IN (${sqlList(CANCEL_STATUSES)}) THEN 1 ELSE 0 END) AS cancels,
                 SUM(CASE WHEN ${statusExpr} IN (${sqlList(COMPLETED_STATUSES)}) THEN 1 ELSE 0 END) AS completed
          FROM appointments
          ${baseWhere}
            AND ${q(clientCol)} = @clientId
        `).get(scope)
      : {};
    const sampleCount = Number(branch?.sampleCount || 0);
    return {
      clientNoShowCount: Number(client?.noShows || 0),
      clientCancelCount: Number(client?.cancels || 0),
      clientCompletedCount: Number(client?.completed || 0),
      branchNoShowRatePercent: sampleCount ? percent((Number(branch?.noShows || 0) / sampleCount) * 100) : 0,
      sampleCount
    };
  } catch {
    return { clientNoShowCount: 0, clientCancelCount: 0, clientCompletedCount: 0, branchNoShowRatePercent: 0, sampleCount: 0 };
  }
}

function normalizeDepositStatus(value) {
  return String(value || "not_required").trim().toLowerCase().replace(/[\s-]+/g, "_") || "not_required";
}

function riskProfile(input = {}) {
  const depositStatus = normalizeDepositStatus(input.depositStatus);
  let score = 20;
  const reasons = [];
  score += Math.min(45, Number(input.clientNoShowCount || 0) * 18);
  score += Math.min(30, Number(input.clientCancelCount || 0) * 8);
  score += Math.min(25, Number(input.branchNoShowRatePercent || 0));
  score -= Math.min(25, Number(input.clientCompletedCount || 0) * 4);
  if (depositStatus === "paid" || depositStatus === "captured") score -= 22;
  if (depositStatus === "pending") score += 8;
  if (depositStatus === "failed" || depositStatus === "not_paid") score += 18;
  score = Math.max(0, Math.min(100, Math.round(score)));

  if (input.clientNoShowCount > 0) reasons.push(`${input.clientNoShowCount} no-show signal mila.`);
  if (input.clientCancelCount > 0) reasons.push(`${input.clientCancelCount} cancellation signal mila.`);
  if (input.branchNoShowRatePercent >= 15) reasons.push("Branch no-show/cancel rate elevated hai.");
  if (input.clientCompletedCount >= 5) reasons.push("Client completion history strong hai.");
  if (depositStatus === "paid" || depositStatus === "captured") reasons.push("Deposit paid hai; booking risk lower hai.");

  if (score >= 70) {
    return {
      score,
      riskBand: "high",
      discountPosture: "deposit_first_cap_discount",
      cap: 5,
      points: -8,
      depositPercent: 30,
      campaignAngle: "confirm_with_deposit",
      reason: "High no-show/cancel risk hai; discount cap rakho aur deposit-first flow use karo.",
      reasons
    };
  }
  if (score >= 45) {
    return {
      score,
      riskBand: "medium",
      discountPosture: "small_discount_with_confirmation",
      cap: 10,
      points: -2,
      depositPercent: 15,
      campaignAngle: "confirm_before_discount",
      reason: "Medium risk booking hai; small discount + confirmation safer hai.",
      reasons
    };
  }
  if (score <= 20 && Number(input.clientCompletedCount || 0) >= 3) {
    return {
      score,
      riskBand: "low",
      discountPosture: "trusted_client_nudge",
      cap: 20,
      points: 5,
      depositPercent: 0,
      campaignAngle: "trusted_client_offer",
      reason: "Reliable client history hai; controlled discount safely diya ja sakta hai.",
      reasons
    };
  }
  return {
    score,
    riskBand: "normal",
    discountPosture: "standard_confirmation",
    cap: 14,
    points: 1,
    depositPercent: 0,
    campaignAngle: "standard_booking_nudge",
    reason: "No-show risk normal range me hai; normal Happy Hours nudge enough hai.",
    reasons
  };
}

function buildSuggestion(input = {}, mode = "recommended") {
  const current = normalizeScope(input);
  const currentSlot = slot(input);
  const clientId = String(input.clientId || "").trim();
  const serviceCategory = cleanCategory(input.serviceCategory);
  const lookbackDays = Math.max(7, Math.min(730, Number.parseInt(input.lookbackDays, 10) || 180));
  const stats = appointmentStats({
    ...current,
    clientId,
    serviceCategory,
    fromDate: daysAgo(currentSlot.signalDate, lookbackDays)
  });
  const cartTotalPaise = intPaise(input.cartTotalPaise || input.servicePricePaise);
  const baseDiscountPercent = percent(input.baseDiscountPercent, 5);
  const manualNoShows = Number.parseInt(input.clientNoShowCount, 10) || 0;
  const manualCancels = Number.parseInt(input.clientCancelCount, 10) || 0;
  const manualCompleted = Number.parseInt(input.clientCompletedCount, 10) || 0;
  const clientNoShowCount = Math.max(manualNoShows, stats.clientNoShowCount);
  const clientCancelCount = Math.max(manualCancels, stats.clientCancelCount);
  const clientCompletedCount = Math.max(manualCompleted, stats.clientCompletedCount);
  const branchNoShowRatePercent = percent(input.branchNoShowRatePercent, stats.branchNoShowRatePercent);
  const depositStatus = normalizeDepositStatus(input.depositStatus);
  const profile = riskProfile({ clientNoShowCount, clientCancelCount, clientCompletedCount, branchNoShowRatePercent, depositStatus });
  const reasons = [profile.reason, ...profile.reasons];
  let points = profile.points;
  let cap = profile.cap;

  if (!clientId && !stats.sampleCount && !manualNoShows && !manualCancels && !manualCompleted) {
    points -= 2;
    reasons.push("Client/history signal missing hai; review-only suggestion rakho.");
  }
  if (mode === "conservative") points -= 4;
  if (mode === "aggressive") points += 5;

  const suggestedDiscountPercent = Math.round(Math.max(0, Math.min(cap, baseDiscountPercent + points)));
  const expectedDiscountPaise = Math.round(cartTotalPaise * (suggestedDiscountPercent / 100));
  const depositRequired = profile.depositPercent > 0 && !["paid", "captured"].includes(depositStatus);
  const recommendedDepositPaise = depositRequired ? Math.round(cartTotalPaise * (profile.depositPercent / 100)) : 0;

  return {
    ...current,
    ...currentSlot,
    clientId,
    serviceCategory,
    cartTotalPaise,
    baseDiscountPercent,
    clientNoShowCount,
    clientCancelCount,
    clientCompletedCount,
    branchNoShowRatePercent,
    depositStatus,
    depositRequired: depositRequired ? 1 : 0,
    recommendedDepositPaise,
    riskScore: profile.score,
    riskBand: profile.riskBand,
    discountPosture: profile.discountPosture,
    campaignAngle: profile.campaignAngle,
    suggestedDiscountPercent,
    expectedDiscountPaise,
    expectedNetRevenuePaise: Math.max(0, cartTotalPaise - expectedDiscountPaise),
    status: clientId || stats.sampleCount || manualNoShows || manualCancels || manualCompleted ? "ready" : "collecting",
    mode,
    reasons
  };
}

export function evaluate(scope = {}) {
  const best = buildSuggestion(scope, "recommended");
  const rows = [
    buildSuggestion(scope, "conservative"),
    best,
    buildSuggestion(scope, "aggressive")
  ];
  return {
    status: best.status,
    best,
    rows,
    summary: {
      riskScore: best.riskScore,
      riskBand: best.riskBand,
      depositRequired: Boolean(best.depositRequired),
      recommendedDepositPaise: best.recommendedDepositPaise,
      maxDiscountPercent: Math.max(...rows.map((row) => Number(row.suggestedDiscountPercent || 0))),
      expectedNetRevenuePaise: best.expectedNetRevenuePaise
    }
  };
}

export function saveSuggestion(scope = {}) {
  const row = evaluate(scope).best;
  const payload = {
    ...row,
    reasons: JSON.stringify(row.reasons || []),
    status: "suggested"
  };
  const result = db.prepare(`
    INSERT INTO happyHoursNoShowRiskSuggestions (
      tenantId, branchId, clientId, serviceCategory, signalDate, dayOfWeek, hourSlot,
      requestedStartAt, cartTotalPaise, baseDiscountPercent, clientNoShowCount,
      clientCancelCount, clientCompletedCount, branchNoShowRatePercent, depositStatus,
      depositRequired, recommendedDepositPaise, riskScore, riskBand, discountPosture,
      campaignAngle, suggestedDiscountPercent, expectedDiscountPaise, expectedNetRevenuePaise,
      status, reasons
    )
    VALUES (
      @tenantId, @branchId, @clientId, @serviceCategory, @signalDate, @dayOfWeek, @hourSlot,
      @requestedStartAt, @cartTotalPaise, @baseDiscountPercent, @clientNoShowCount,
      @clientCancelCount, @clientCompletedCount, @branchNoShowRatePercent, @depositStatus,
      @depositRequired, @recommendedDepositPaise, @riskScore, @riskBand, @discountPosture,
      @campaignAngle, @suggestedDiscountPercent, @expectedDiscountPaise, @expectedNetRevenuePaise,
      @status, @reasons
    )
  `).run(payload);
  return getSuggestion({ ...row, id: Number(result.lastInsertRowid) });
}

export function listSuggestions(scope = {}) {
  const current = normalizeScope(scope);
  const status = String(scope.status || "").trim();
  const limit = Math.min(100, Math.max(1, Number.parseInt(scope.limit, 10) || 25));
  return {
    rows: db.prepare(`
      SELECT *
      FROM happyHoursNoShowRiskSuggestions
      WHERE tenantId = @tenantId
        AND branchId = @branchId
        AND (@status = '' OR status = @status)
      ORDER BY createdAt DESC, id DESC
      LIMIT @limit
    `).all({ ...current, status, limit }).map(parseSuggestion)
  };
}

export function updateStatus(scope = {}) {
  const current = normalizeScope(scope);
  const id = Number.parseInt(scope.id, 10) || 0;
  const status = String(scope.status || "suggested").trim();
  db.prepare(`
    UPDATE happyHoursNoShowRiskSuggestions
    SET status = @status
    WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
  `).run({ ...current, id, status });
  return getSuggestion({ ...current, id });
}

function getSuggestion(scope = {}) {
  const current = normalizeScope(scope);
  const id = Number.parseInt(scope.id, 10) || 0;
  const row = db.prepare(`
    SELECT *
    FROM happyHoursNoShowRiskSuggestions
    WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
  `).get({ ...current, id });
  return parseSuggestion(row);
}

function parseSuggestion(row) {
  if (!row) return null;
  return {
    ...row,
    depositRequired: Boolean(row.depositRequired),
    reasons: JSON.parse(row.reasons || "[]")
  };
}

export const happyHoursNoShowRiskRepo = {
  evaluate,
  saveSuggestion,
  listSuggestions,
  updateStatus
};
