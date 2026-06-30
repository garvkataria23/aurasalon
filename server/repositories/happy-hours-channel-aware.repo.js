import { db } from "../db.js";
import { happyHoursEngine } from "../utils/happy-hours-engine.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS happyHoursChannelAwareSuggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    sourceChannel TEXT NOT NULL DEFAULT 'walk_in',
    campaignChannel TEXT NOT NULL DEFAULT '',
    serviceCategory TEXT NOT NULL DEFAULT 'default',
    signalDate TEXT NOT NULL,
    dayOfWeek TEXT NOT NULL DEFAULT '',
    hourSlot INTEGER NOT NULL DEFAULT 0,
    servicePricePaise INTEGER NOT NULL DEFAULT 0,
    baseDiscountPercent REAL NOT NULL DEFAULT 0,
    channelFeePercent REAL NOT NULL DEFAULT 0,
    conversionRatePercent REAL NOT NULL DEFAULT 0,
    occupancyRate REAL NOT NULL DEFAULT 0,
    sampleCount INTEGER NOT NULL DEFAULT 0,
    historicalBookingCount INTEGER NOT NULL DEFAULT 0,
    historicalRevenuePaise INTEGER NOT NULL DEFAULT 0,
    channelRisk TEXT NOT NULL DEFAULT 'unknown',
    campaignAngle TEXT NOT NULL DEFAULT 'collect_channel_data',
    suggestedDiscountPercent INTEGER NOT NULL DEFAULT 0,
    expectedDiscountPaise INTEGER NOT NULL DEFAULT 0,
    expectedNetRevenuePaise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'suggested',
    reasons TEXT NOT NULL DEFAULT '[]',
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_channelAwareSuggestions_scope
    ON happyHoursChannelAwareSuggestions(tenantId, branchId, status, sourceChannel, createdAt);
`);

const CHANNEL_FEES = {
  walk_in: 0,
  online_booking: 2,
  whatsapp: 1,
  google: 5,
  instagram: 4,
  referral: 3,
  aggregator: 18,
  coupon: 0,
  loyalty: 0,
  corporate: 6
};

function normalizeScope(scope = {}) {
  const tenantId = String(scope.tenantId || "").trim();
  const branchId = String(scope.branchId || "").trim();
  if (!tenantId || !branchId) throw new Error("tenantId and branchId are required");
  return { tenantId, branchId };
}

function cleanCategory(value) {
  return String(value || "default").trim().toLowerCase() || "default";
}

function normalizeChannel(value) {
  const channel = String(value || "walk_in").trim().toLowerCase().replace(/[\s-]+/g, "_");
  if (["walkin", "walk"].includes(channel)) return "walk_in";
  if (["online", "web", "booking_portal"].includes(channel)) return "online_booking";
  if (["wa", "whats_app"].includes(channel)) return "whatsapp";
  return channel || "walk_in";
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

function slot(input = {}) {
  const date = input.signalDate ? new Date(`${String(input.signalDate).slice(0, 10)}T00:00:00+05:30`) : new Date();
  const parts = happyHoursEngine.getISTComponents(date);
  return {
    signalDate: String(input.signalDate || parts.nowDate).slice(0, 10),
    dayOfWeek: String(input.dayOfWeek || parts.nowDay).slice(0, 3).toLowerCase(),
    hourSlot: Math.max(0, Math.min(23, Number.parseInt(input.hourSlot ?? parts.nowTime.slice(0, 2), 10) || 0))
  };
}

function daysAgo(dateText, days) {
  const date = new Date(`${String(dateText).slice(0, 10)}T00:00:00+05:30`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function demandContext(scope = {}) {
  if (!tableExists("demandSignals")) return { occupancyRate: 0, sampleCount: 0 };
  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS sampleCount,
             ROUND(AVG(occupancyRate), 4) AS occupancyRate
      FROM demandSignals
      WHERE tenantId = @tenantId
        AND branchId = @branchId
        AND dayOfWeek = @dayOfWeek
        AND hourSlot = @hourSlot
    `).get(scope);
    return {
      occupancyRate: Number(row?.occupancyRate || 0),
      sampleCount: Number(row?.sampleCount || 0)
    };
  } catch {
    return { occupancyRate: 0, sampleCount: 0 };
  }
}

function channelStatsFromTable(tableName, input = {}) {
  const columns = safeColumns(tableName);
  if (!columns.length) return { bookingCount: 0, revenuePaise: 0 };
  const tenantCol = column(columns, ["tenantId", "tenant_id"]);
  const branchCol = column(columns, ["branchId", "branch_id"]);
  const channelCol = column(columns, ["sourceChannel", "bookingSource", "source", "channel", "salesChannel", "leadSource"]);
  const categoryCol = column(columns, ["serviceCategory", "category"]);
  const dateCol = column(columns, ["createdAt", "created_at", "invoiceDate", "appointmentDate", "startAt", "start_at", "date"]);
  const statusCol = column(columns, ["status", "invoiceStatus", "appointmentStatus"]);
  const amountCol = column(columns, ["grandTotalPaise", "netTotalPaise", "totalPaise", "amountPaise", "revenuePaise", "totalAmount"]);
  if (!tenantCol || !branchCol || !channelCol) return { bookingCount: 0, revenuePaise: 0 };

  const categoryWhere = categoryCol && input.serviceCategory !== "default"
    ? `AND LOWER(CAST(${q(categoryCol)} AS TEXT)) = @serviceCategory`
    : "";
  const dateWhere = dateCol ? `AND substr(CAST(${q(dateCol)} AS TEXT), 1, 10) >= @fromDate` : "";
  const statusWhere = statusCol ? `AND LOWER(COALESCE(CAST(${q(statusCol)} AS TEXT), '')) NOT IN ('cancelled','canceled','void','refunded','deleted','no_show')` : "";

  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS bookingCount,
             COALESCE(SUM(${amountCol ? q(amountCol) : "0"}), 0) AS revenuePaise
      FROM ${q(tableName)}
      WHERE ${q(tenantCol)} = @tenantId
        AND ${q(branchCol)} = @branchId
        AND LOWER(REPLACE(REPLACE(CAST(${q(channelCol)} AS TEXT), '-', '_'), ' ', '_')) = @sourceChannel
        ${categoryWhere}
        ${dateWhere}
        ${statusWhere}
    `).get(input);
    return {
      bookingCount: Number(row?.bookingCount || 0),
      revenuePaise: intPaise(row?.revenuePaise || 0)
    };
  } catch {
    return { bookingCount: 0, revenuePaise: 0 };
  }
}

function channelStats(input = {}) {
  const rows = ["appointments", "invoices", "posInvoices"].map((tableName) => channelStatsFromTable(tableName, input));
  return rows.reduce((total, row) => ({
    bookingCount: total.bookingCount + row.bookingCount,
    revenuePaise: total.revenuePaise + row.revenuePaise
  }), { bookingCount: 0, revenuePaise: 0 });
}

function channelProfile(input = {}) {
  const sourceChannel = normalizeChannel(input.sourceChannel);
  const channelFeePercent = percent(input.channelFeePercent, CHANNEL_FEES[sourceChannel] ?? 3);
  const conversionRatePercent = percent(input.conversionRatePercent, 0);
  if (channelFeePercent >= 12) {
    return { risk: "high_fee_channel", cap: 8, points: -4, angle: "protect_channel_margin", reason: "High commission/source fee channel hai; discount cap low rakha." };
  }
  if (["walk_in", "whatsapp", "referral", "loyalty"].includes(sourceChannel)) {
    return { risk: "owned_channel", cap: 25, points: conversionRatePercent && conversionRatePercent < 25 ? 8 : 5, angle: "owned_channel_boost", reason: "Owned/low-fee channel par controlled discount zyada profitable hota hai." };
  }
  if (sourceChannel === "online_booking") {
    return { risk: "high_intent_channel", cap: 15, points: 3, angle: "online_booking_nudge", reason: "Online booking high-intent channel hai; small nudge enough hai." };
  }
  if (["google", "instagram"].includes(sourceChannel)) {
    return { risk: "paid_discovery_channel", cap: 18, points: conversionRatePercent && conversionRatePercent < 20 ? 7 : 4, angle: "discovery_conversion_offer", reason: "Discovery channel par conversion nudge useful ho sakta hai." };
  }
  return { risk: "standard_channel", cap: 18, points: 4, angle: "channel_conversion_offer", reason: "Channel signal normal hai; moderate offer enough hai." };
}

function buildSuggestion(input = {}, mode = "recommended") {
  const current = normalizeScope(input);
  const currentSlot = slot(input);
  const sourceChannel = normalizeChannel(input.sourceChannel);
  const serviceCategory = cleanCategory(input.serviceCategory);
  const lookbackDays = Math.max(7, Math.min(365, Number.parseInt(input.lookbackDays, 10) || 90));
  const statsInput = {
    ...current,
    sourceChannel,
    serviceCategory,
    fromDate: daysAgo(currentSlot.signalDate, lookbackDays)
  };
  const stats = channelStats(statsInput);
  const demand = demandContext({ ...current, ...currentSlot });
  const servicePricePaise = intPaise(input.servicePricePaise);
  const baseDiscountPercent = percent(input.baseDiscountPercent, 5);
  const profile = channelProfile(input);
  const reasons = [profile.reason];
  let points = profile.points;
  let cap = profile.cap;

  if (demand.sampleCount && demand.occupancyRate < 0.4) {
    points += 6;
    cap = Math.min(30, cap + 5);
    reasons.push("Slot occupancy low hai; channel boost allowed hai.");
  } else if (demand.occupancyRate >= 0.8) {
    points -= 6;
    cap = Math.min(cap, 8);
    reasons.push("Slot occupancy high hai; extra discount avoid karo.");
  } else {
    reasons.push(demand.sampleCount ? "Slot demand stable hai." : "DemandSignals abhi collecting state me hai.");
  }

  if (!stats.bookingCount) reasons.push("Channel history missing hai; suggestion review-only rakho.");
  if (mode === "conservative") points -= 3;
  if (mode === "aggressive") points += 5;

  const suggestedDiscountPercent = Math.round(Math.max(0, Math.min(cap, baseDiscountPercent + points)));
  const expectedDiscountPaise = Math.round(servicePricePaise * (suggestedDiscountPercent / 100));
  const channelFeePaise = Math.round((servicePricePaise - expectedDiscountPaise) * (percent(input.channelFeePercent, CHANNEL_FEES[sourceChannel] ?? 3) / 100));

  return {
    ...current,
    ...currentSlot,
    sourceChannel,
    campaignChannel: String(input.campaignChannel || sourceChannel).trim() || sourceChannel,
    serviceCategory,
    servicePricePaise,
    baseDiscountPercent,
    channelFeePercent: percent(input.channelFeePercent, CHANNEL_FEES[sourceChannel] ?? 3),
    conversionRatePercent: percent(input.conversionRatePercent, 0),
    occupancyRate: demand.occupancyRate,
    sampleCount: demand.sampleCount,
    historicalBookingCount: stats.bookingCount,
    historicalRevenuePaise: stats.revenuePaise,
    channelRisk: profile.risk,
    campaignAngle: profile.angle,
    suggestedDiscountPercent,
    expectedDiscountPaise,
    expectedNetRevenuePaise: Math.max(0, servicePricePaise - expectedDiscountPaise - channelFeePaise),
    status: stats.bookingCount || demand.sampleCount ? "ready" : "collecting",
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
      sourceChannel: best.sourceChannel,
      channelFeePercent: best.channelFeePercent,
      historicalBookingCount: best.historicalBookingCount,
      historicalRevenuePaise: best.historicalRevenuePaise,
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
    INSERT INTO happyHoursChannelAwareSuggestions (
      tenantId, branchId, sourceChannel, campaignChannel, serviceCategory,
      signalDate, dayOfWeek, hourSlot, servicePricePaise, baseDiscountPercent,
      channelFeePercent, conversionRatePercent, occupancyRate, sampleCount,
      historicalBookingCount, historicalRevenuePaise, channelRisk, campaignAngle,
      suggestedDiscountPercent, expectedDiscountPaise, expectedNetRevenuePaise,
      status, reasons
    )
    VALUES (
      @tenantId, @branchId, @sourceChannel, @campaignChannel, @serviceCategory,
      @signalDate, @dayOfWeek, @hourSlot, @servicePricePaise, @baseDiscountPercent,
      @channelFeePercent, @conversionRatePercent, @occupancyRate, @sampleCount,
      @historicalBookingCount, @historicalRevenuePaise, @channelRisk, @campaignAngle,
      @suggestedDiscountPercent, @expectedDiscountPaise, @expectedNetRevenuePaise,
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
      FROM happyHoursChannelAwareSuggestions
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
    UPDATE happyHoursChannelAwareSuggestions
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
    FROM happyHoursChannelAwareSuggestions
    WHERE id = @id AND tenantId = @tenantId AND branchId = @branchId
  `).get({ ...current, id });
  return parseSuggestion(row);
}

function parseSuggestion(row) {
  if (!row) return null;
  return {
    ...row,
    reasons: JSON.parse(row.reasons || "[]")
  };
}

export const happyHoursChannelAwareRepo = {
  evaluate,
  saveSuggestion,
  listSuggestions,
  updateStatus
};
