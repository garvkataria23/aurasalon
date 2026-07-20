import { db } from "../db.js";
import { happyHoursEngine } from "../utils/happy-hours-engine.js";

db.exec(`
  CREATE TABLE IF NOT EXISTS happyHoursWeatherEventSuggestions (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    tenantId TEXT NOT NULL,
    branchId TEXT NOT NULL,
    city TEXT NOT NULL DEFAULT '',
    serviceCategory TEXT NOT NULL DEFAULT 'default',
    signalDate TEXT NOT NULL,
    dayOfWeek TEXT NOT NULL DEFAULT '',
    hourSlot INTEGER NOT NULL DEFAULT 0,
    weatherCondition TEXT NOT NULL DEFAULT 'normal',
    temperatureCelsius REAL NOT NULL DEFAULT 0,
    rainProbabilityPercent REAL NOT NULL DEFAULT 0,
    eventType TEXT NOT NULL DEFAULT 'none',
    eventName TEXT NOT NULL DEFAULT '',
    expectedFootfall INTEGER NOT NULL DEFAULT 0,
    occupancyRate REAL NOT NULL DEFAULT 0,
    sampleCount INTEGER NOT NULL DEFAULT 0,
    demandRisk TEXT NOT NULL DEFAULT 'unknown',
    campaignAngle TEXT NOT NULL DEFAULT 'standard_offer',
    suggestedDiscountPercent INTEGER NOT NULL DEFAULT 0,
    servicePricePaise INTEGER NOT NULL DEFAULT 0,
    expectedDiscountPaise INTEGER NOT NULL DEFAULT 0,
    status TEXT NOT NULL DEFAULT 'suggested',
    reasons TEXT NOT NULL DEFAULT '[]',
    createdAt INTEGER NOT NULL DEFAULT (strftime('%s','now'))
  );

  CREATE INDEX IF NOT EXISTS idx_weatherEventSuggestions_scope
    ON happyHoursWeatherEventSuggestions(tenantId, branchId, status, signalDate, createdAt);
`);

function normalizeScope(scope = {}) {
  const tenantId = String(scope.tenantId || "").trim();
  const branchId = String(scope.branchId || "").trim();
  if (!tenantId || !branchId) throw new Error("tenantId and branchId are required");
  return { tenantId, branchId };
}

function cleanText(value, fallback = "") {
  return String(value || fallback).trim();
}

function intPaise(value) {
  return Math.max(0, Math.round(Number(value || 0)));
}

function clamp(value, min, max) {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return min;
  return Math.max(min, Math.min(max, parsed));
}

function tableExists(tableName) {
  try {
    return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @tableName").get({ tableName }));
  } catch {
    return false;
  }
}

function signalSlot(input = {}) {
  const date = input.signalDate ? new Date(`${String(input.signalDate).slice(0, 10)}T00:00:00+05:30`) : new Date();
  const parts = happyHoursEngine.getISTComponents(date);
  return {
    signalDate: String(input.signalDate || parts.nowDate).slice(0, 10),
    dayOfWeek: String(input.dayOfWeek || parts.nowDay).slice(0, 3).toLowerCase(),
    hourSlot: Math.max(0, Math.min(23, Number.parseInt(input.hourSlot ?? parts.nowTime.slice(0, 2), 10) || 0))
  };
}

function demandContext(scope = {}) {
  if (!tableExists("demandSignals")) return { occupancyRate: 0, sampleCount: 0, avgBookings: 0, avgRevenuePaise: 0 };
  try {
    const row = db.prepare(`
      SELECT COUNT(*) AS sampleCount,
             ROUND(AVG(occupancyRate), 4) AS occupancyRate,
             ROUND(AVG(bookingsInSlot), 4) AS avgBookings,
             ROUND(AVG(revenueInSlotPaise), 0) AS avgRevenuePaise
      FROM demandSignals
      WHERE tenantId = @tenantId
        AND branchId = @branchId
        AND dayOfWeek = @dayOfWeek
        AND hourSlot = @hourSlot
    `).get(scope);
    return {
      occupancyRate: Number(row?.occupancyRate || 0),
      sampleCount: Number(row?.sampleCount || 0),
      avgBookings: Number(row?.avgBookings || 0),
      avgRevenuePaise: intPaise(row?.avgRevenuePaise || 0)
    };
  } catch {
    return { occupancyRate: 0, sampleCount: 0, avgBookings: 0, avgRevenuePaise: 0 };
  }
}

function normalizedCondition(value) {
  const text = cleanText(value, "normal").toLowerCase().replace(/\s+/g, "_");
  if (["rain", "rainy", "drizzle"].includes(text)) return "rain";
  if (["heavy_rain", "storm", "thunderstorm"].includes(text)) return "storm";
  if (["heat", "hot", "heatwave"].includes(text)) return "heatwave";
  if (["cold", "winter", "chilly"].includes(text)) return "cold";
  if (["pollution", "smog"].includes(text)) return "pollution";
  return text || "normal";
}

function normalizedEvent(value) {
  const text = cleanText(value, "none").toLowerCase().replace(/\s+/g, "_");
  if (["festival", "wedding", "payday", "month_end", "local_event", "school_holiday", "traffic", "strike", "none"].includes(text)) return text;
  return text || "none";
}

function weatherEffect(input = {}) {
  const condition = normalizedCondition(input.weatherCondition);
  const rainProbability = clamp(input.rainProbabilityPercent, 0, 100);
  const temperature = Number(input.temperatureCelsius || 0);
  if (condition === "storm" || rainProbability >= 85) {
    return { points: 12, risk: "weather_disruption", angle: "rainy_day_rescue", reason: "Heavy rain/storm se walk-in demand dip ho sakta hai." };
  }
  if (condition === "rain" || rainProbability >= 55) {
    return { points: 8, risk: "rain_soft_demand", angle: "rainy_day_offer", reason: "Rainy signal hai; controlled offer demand recover kar sakta hai." };
  }
  if (condition === "heatwave" || temperature >= 38) {
    return { points: 9, risk: "heat_slowdown", angle: "cooling_beauty_bundle", reason: "Heatwave me comfort-led hair/skin bundle useful hota hai." };
  }
  if (condition === "cold" && temperature > 0 && temperature <= 14) {
    return { points: 5, risk: "seasonal_softness", angle: "winter_care_bundle", reason: "Cold weather me care bundle small nudge de sakta hai." };
  }
  if (condition === "pollution") {
    return { points: 7, risk: "pollution_care_need", angle: "detox_care_bundle", reason: "Pollution signal detox/skin-hair care bundle ke liye relevant hai." };
  }
  return { points: 0, risk: "normal", angle: "standard_offer", reason: "Weather normal hai; weather-based extra discount needed nahi." };
}

function eventEffect(input = {}) {
  const eventType = normalizedEvent(input.eventType);
  const expectedFootfall = Math.max(0, Number.parseInt(input.expectedFootfall, 10) || 0);
  if (eventType === "festival") {
    return { points: -2, cap: 10, risk: "high_intent", angle: "festival_bundle", reason: "Festival intent high hota hai; deep discount ke bajay bundle better hai." };
  }
  if (eventType === "wedding") {
    return { points: -3, cap: 8, risk: "premium_intent", angle: "bridal_upsell", reason: "Wedding demand premium hoti hai; discount cap low rakho." };
  }
  if (eventType === "payday" || eventType === "month_end") {
    return { points: -1, cap: 12, risk: "spend_window", angle: "payday_upgrade", reason: "Payday/month-end me upgrade bundle discount se zyada useful hai." };
  }
  if (eventType === "local_event" || expectedFootfall >= 500) {
    return { points: 5, cap: 15, risk: "event_opportunity", angle: "event_walkin_capture", reason: "Local event footfall capture ke liye small offer useful hai." };
  }
  if (eventType === "school_holiday") {
    return { points: 6, cap: 15, risk: "family_window", angle: "family_booking_bundle", reason: "Holiday family/group booking nudge ke liye good window hai." };
  }
  if (eventType === "traffic" || eventType === "strike") {
    return { points: 10, cap: 20, risk: "access_disruption", angle: "same_day_recovery", reason: "Travel disruption ho to same-day rescue discount demand recover karta hai." };
  }
  return { points: 0, cap: 25, risk: "none", angle: "standard_offer", reason: "Local event signal neutral hai." };
}

function demandEffect(demand = {}) {
  const occupancy = Number(demand.occupancyRate || 0);
  if (!demand.sampleCount) return { points: 0, cap: 20, risk: "collecting", reason: "DemandSignals sample abhi collect ho raha hai." };
  if (occupancy < 0.35) return { points: 7, cap: 25, risk: "very_low_demand", reason: "Occupancy very low hai; stronger recovery offer allowed hai." };
  if (occupancy < 0.55) return { points: 4, cap: 20, risk: "soft_demand", reason: "Occupancy soft hai; moderate weather/event offer safe hai." };
  if (occupancy > 0.8) return { points: -7, cap: 8, risk: "high_demand", reason: "Occupancy high hai; unnecessary discount cap low rakha." };
  return { points: 0, cap: 15, risk: "stable_demand", reason: "Demand stable hai; small controlled offer enough hai." };
}

function buildSuggestion(input = {}) {
  const current = normalizeScope(input);
  const slot = signalSlot(input);
  const demand = demandContext({ ...current, ...slot });
  const weather = weatherEffect(input);
  const event = eventEffect(input);
  const demandSignal = demandEffect(demand);
  const servicePricePaise = intPaise(input.servicePricePaise || 0);
  const baseDiscount = Number.parseInt(input.baseDiscountPercent, 10) || 5;
  const cap = Math.min(event.cap, demandSignal.cap);
  const suggestedDiscountPercent = Math.round(clamp(baseDiscount + weather.points + event.points + demandSignal.points, 0, cap));
  const campaignAngle = event.angle !== "standard_offer" ? event.angle : weather.angle;
  const demandRisk = [weather.risk, event.risk, demandSignal.risk].filter((risk) => risk && risk !== "none").join("+") || "normal";

  return {
    ...current,
    ...slot,
    city: cleanText(input.city),
    serviceCategory: cleanText(input.serviceCategory, "default") || "default",
    weatherCondition: normalizedCondition(input.weatherCondition),
    temperatureCelsius: Number(input.temperatureCelsius || 0),
    rainProbabilityPercent: clamp(input.rainProbabilityPercent, 0, 100),
    eventType: normalizedEvent(input.eventType),
    eventName: cleanText(input.eventName),
    expectedFootfall: Math.max(0, Number.parseInt(input.expectedFootfall, 10) || 0),
    occupancyRate: demand.occupancyRate,
    sampleCount: demand.sampleCount,
    demandRisk,
    campaignAngle,
    suggestedDiscountPercent,
    servicePricePaise,
    expectedDiscountPaise: Math.round(servicePricePaise * (suggestedDiscountPercent / 100)),
    status: demand.sampleCount ? "ready" : "collecting",
    reasons: [weather.reason, event.reason, demandSignal.reason]
  };
}

export function evaluate(scope = {}) {
  const best = buildSuggestion(scope);
  const scenarios = [
    best,
    buildSuggestion({ ...scope, weatherCondition: "normal", eventType: "none", baseDiscountPercent: 5 }),
    buildSuggestion({ ...scope, weatherCondition: "rain", rainProbabilityPercent: 70, eventType: scope.eventType || "none", baseDiscountPercent: 5 }),
    buildSuggestion({ ...scope, weatherCondition: scope.weatherCondition || "normal", eventType: "festival", baseDiscountPercent: 5 })
  ];
  const rows = scenarios.filter((row, index, all) =>
    all.findIndex((item) => `${item.weatherCondition}:${item.eventType}:${item.campaignAngle}` === `${row.weatherCondition}:${row.eventType}:${row.campaignAngle}`) === index
  );
  return {
    status: best.status,
    best,
    rows,
    summary: {
      scenarioCount: rows.length,
      maxDiscountPercent: Math.max(...rows.map((row) => Number(row.suggestedDiscountPercent || 0))),
      weatherRiskCount: rows.filter((row) => row.demandRisk.includes("weather") || row.demandRisk.includes("rain") || row.demandRisk.includes("heat")).length,
      eventOpportunityCount: rows.filter((row) => row.demandRisk.includes("event") || row.eventType !== "none").length
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
    INSERT INTO happyHoursWeatherEventSuggestions (
      tenantId, branchId, city, serviceCategory, signalDate, dayOfWeek, hourSlot,
      weatherCondition, temperatureCelsius, rainProbabilityPercent, eventType,
      eventName, expectedFootfall, occupancyRate, sampleCount, demandRisk,
      campaignAngle, suggestedDiscountPercent, servicePricePaise,
      expectedDiscountPaise, status, reasons
    )
    VALUES (
      @tenantId, @branchId, @city, @serviceCategory, @signalDate, @dayOfWeek, @hourSlot,
      @weatherCondition, @temperatureCelsius, @rainProbabilityPercent, @eventType,
      @eventName, @expectedFootfall, @occupancyRate, @sampleCount, @demandRisk,
      @campaignAngle, @suggestedDiscountPercent, @servicePricePaise,
      @expectedDiscountPaise, @status, @reasons
    )
  `).run(payload);
  return getSuggestion({ ...row, id: Number(result.lastInsertRowid) });
}

export function listSuggestions(scope = {}) {
  const current = normalizeScope(scope);
  const status = cleanText(scope.status);
  const limit = Math.min(100, Math.max(1, Number.parseInt(scope.limit, 10) || 25));
  return {
    rows: db.prepare(`
      SELECT *
      FROM happyHoursWeatherEventSuggestions
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
  const status = cleanText(scope.status, "suggested");
  db.prepare(`
    UPDATE happyHoursWeatherEventSuggestions
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
    FROM happyHoursWeatherEventSuggestions
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

export const happyHoursWeatherEventRepo = {
  evaluate,
  saveSuggestion,
  listSuggestions,
  updateStatus
};
