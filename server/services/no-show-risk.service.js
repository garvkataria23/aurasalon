import { db } from "../db.js";
import { notFound } from "../utils/app-error.js";

function clamp(value) {
  return Math.max(0, Math.min(100, Number(value || 0)));
}

function add(factors, rule, points, value) {
  factors.push({ rule, points, value });
  return points;
}

export const noShowRiskService = {
  calculateRisk(access, customerId, context = {}) {
    const client = db.prepare("SELECT * FROM clients WHERE id = ? AND tenantId = ?").get(customerId, access.tenantId);
    if (!client) throw notFound("Customer not found");
    const stats = db.prepare(
      `SELECT
         SUM(CASE WHEN status = 'no-show' THEN 1 ELSE 0 END) AS noShows,
         SUM(CASE WHEN status = 'cancelled' THEN 1 ELSE 0 END) AS cancellations,
         SUM(CASE WHEN status = 'completed' OR status = 'paid' OR status = 'billed' THEN 1 ELSE 0 END) AS completed
       FROM appointments
       WHERE tenantId = ? AND clientId = ?`
    ).get(access.tenantId, customerId);
    const factors = [];
    let score = 0;
    const noShows = Math.max(Number(client.noShowCount || 0), Number(stats.noShows || 0));
    const cancellations = Math.max(Number(client.cancellationCount || 0), Number(stats.cancellations || 0));
    const completed = Number(stats.completed || 0);
    if (noShows >= 3) score += add(factors, "no_show_count_3_plus", 40, noShows);
    if (cancellations >= 5) score += add(factors, "cancellation_count_5_plus", 25, cancellations);
    if (completed === 0) score += add(factors, "first_time_customer", 15, true);
    if (context.depositStatus === "not_required" || context.depositCaptured === false) score += add(factors, "no_deposit_captured", 10, context.depositStatus || "none");
    if (context.startAt) {
      const hours = (new Date(context.startAt).getTime() - Date.now()) / 36e5;
      if (hours > 0 && hours < 2) score += add(factors, "last_minute_booking", 10, `${hours.toFixed(1)}h`);
    }
    if (String(context.sourceChannel || "").toLowerCase() === "walkin_promise") score += add(factors, "walkin_promise", 5, context.sourceChannel);
    if (["gold", "platinum"].includes(String(client.tier || "").toLowerCase())) score += add(factors, "loyalty_tier_high", -20, client.tier);
    if (completed > 10) score += add(factors, "completed_appointments_10_plus", -15, completed);
    score = clamp(score);
    const level = score <= 20 ? "low" : score <= 50 ? "medium" : "high";
    const recommendedAction = level === "low"
      ? "normal_processing"
      : level === "medium"
        ? "require_deposit"
        : "require_full_prepayment_and_manual_confirmation_call";
    return {
      customerId,
      riskScore: score,
      riskLevel: level,
      recommendedAction,
      factors,
      computedAt: new Date().toISOString()
    };
  }
};
