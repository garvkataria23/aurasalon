import { db } from "../db.js";

const CANDIDATE_DISCOUNTS = [0, 5, 10, 15, 20, 25, 30];
const MIN_DEMAND_DAYS = 183;

function normalizeScope(scope = {}) {
  const tenantId = String(scope.tenantId || "").trim();
  const branchId = String(scope.branchId || "").trim();
  if (!tenantId || !branchId) throw new Error("tenantId and branchId are required");
  return { tenantId, branchId };
}

function dateSpanDays(minDate, maxDate) {
  if (!minDate || !maxDate) return 0;
  const start = new Date(`${String(minDate).slice(0, 10)}T00:00:00Z`);
  const end = new Date(`${String(maxDate).slice(0, 10)}T00:00:00Z`);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) return 0;
  return Math.max(0, Math.floor((end.getTime() - start.getTime()) / 86400000));
}

function demandGate(scope = {}) {
  const current = normalizeScope(scope);
  const row = db.prepare(`
    SELECT COUNT(*) AS sampleCount,
           MIN(signalDate) AS minDate,
           MAX(signalDate) AS maxDate
    FROM demandSignals
    WHERE tenantId = @tenantId AND branchId = @branchId
  `).get(current);
  const spanDays = dateSpanDays(row?.minDate, row?.maxDate);
  return {
    ...current,
    sampleCount: Number(row?.sampleCount || 0),
    minDate: row?.minDate || null,
    maxDate: row?.maxDate || null,
    spanDays,
    ready: spanDays >= MIN_DEMAND_DAYS
  };
}

function normalizeDay(value) {
  return String(value || "").trim().slice(0, 3).toLowerCase();
}

function normalizeHour(value) {
  return Math.max(0, Math.min(23, Number.parseInt(value, 10) || 0));
}

function observedCandidates({ tenantId, branchId, dayOfWeek, hourSlot }) {
  const rows = db.prepare(`
    SELECT activeDiscountPct AS discountPct,
           COUNT(*) AS sampleCount,
           ROUND(AVG(revenueInSlotPaise), 0) AS expectedRevenuePaise,
           ROUND(AVG(occupancyRate), 4) AS occupancyRate,
           SUM(bookingsInSlot) AS bookingsInSlot
    FROM demandSignals
    WHERE tenantId = @tenantId
      AND branchId = @branchId
      AND dayOfWeek = @dayOfWeek
      AND hourSlot = @hourSlot
      AND activeDiscountPct IN (${CANDIDATE_DISCOUNTS.join(",")})
    GROUP BY activeDiscountPct
  `).all({ tenantId, branchId, dayOfWeek, hourSlot });
  const byDiscount = new Map(rows.map((row) => [Number(row.discountPct || 0), row]));
  return CANDIDATE_DISCOUNTS.map((discountPct) => {
    const row = byDiscount.get(discountPct);
    return {
      discountPct,
      sampleCount: Number(row?.sampleCount || 0),
      expectedRevenuePaise: Math.max(0, Math.round(Number(row?.expectedRevenuePaise || 0))),
      occupancyRate: Number(row?.occupancyRate || 0),
      bookingsInSlot: Number(row?.bookingsInSlot || 0)
    };
  });
}

export function recommendDiscount(input = {}) {
  const current = normalizeScope(input);
  const gate = demandGate(current);
  const dayOfWeek = normalizeDay(input.dayOfWeek);
  const hourSlot = normalizeHour(input.hourSlot);
  const servicePricePaise = Math.max(0, Number.parseInt(input.servicePricePaise, 10) || 0);

  if (!gate.ready) {
    return {
      status: gate.sampleCount ? "collecting" : "blocked",
      recommendedDiscountPct: null,
      expectedRevenuePaise: 0,
      confidence: 0,
      candidates: [],
      reasoning: [
        `F1 gate requires ${MIN_DEMAND_DAYS}+ days of demandSignals.`,
        `Current span is ${gate.spanDays} days from ${gate.minDate || "n/a"} to ${gate.maxDate || "n/a"}.`,
        "Rules engine fallback must remain active; no RL pricing should run yet."
      ],
      gate
    };
  }

  const candidates = observedCandidates({ ...current, dayOfWeek, hourSlot });
  const observed = candidates.filter((candidate) => candidate.sampleCount > 0);
  if (!observed.length) {
    return {
      status: "collecting",
      recommendedDiscountPct: 0,
      expectedRevenuePaise: servicePricePaise,
      confidence: 0.1,
      candidates,
      reasoning: [
        "Demand history is old enough, but this day/hour slot has no observed discount samples.",
        "Keep default pricing or create a draft test rule for controlled exploration."
      ],
      gate
    };
  }

  const winner = [...observed].sort((a, b) =>
    b.expectedRevenuePaise - a.expectedRevenuePaise || a.discountPct - b.discountPct
  )[0];
  const confidence = Math.min(0.95, Math.round((Math.min(winner.sampleCount, 60) / 60) * 100) / 100);
  return {
    status: "ready",
    recommendedDiscountPct: winner.discountPct,
    expectedRevenuePaise: winner.expectedRevenuePaise,
    confidence,
    candidates,
    reasoning: [
      `Best observed arm is ${winner.discountPct}% for ${dayOfWeek} ${hourSlot}:00.`,
      `${winner.sampleCount} samples support this arm; confidence is capped until samples deepen.`,
      "Recommendation is advisory and should create draft rules only."
    ],
    gate
  };
}

export const yieldEngine = { recommendDiscount, demandGate };
