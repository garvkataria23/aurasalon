import { db } from "../db.js";

const funnelSteps = [
  "portal_visit",
  "branch_selected",
  "service_selected",
  "staff_selected",
  "slot_selected",
  "hold_created",
  "customer_details_entered",
  "otp_verified",
  "payment_started",
  "payment_succeeded",
  "booking_confirmed"
];

function range(query = {}) {
  return {
    from: query.from || "0000-01-01",
    to: query.to || "9999-12-31",
    branchId: query.branchId || ""
  };
}

function pct(part, total) {
  return total ? Number(((Number(part || 0) / Number(total || 0)) * 100).toFixed(2)) : 0;
}

export const bookingFunnelAnalyticsService = {
  getFunnelMetrics(access, query = {}) {
    const { from, to, branchId } = range(query);
    const rows = db.prepare(
      `SELECT e.eventName, COUNT(DISTINCT e.sessionId) AS count,
              AVG((julianday(e.createdAt) - julianday(s.startedAt)) * 24 * 60) AS avgMinutes
       FROM booking_funnel_events e
       JOIN online_booking_sessions s ON s.id = e.sessionId AND s.tenantId = e.tenantId
       WHERE e.tenantId = ?
         AND e.createdAt >= ?
         AND e.createdAt <= ?
         AND (? = '' OR s.branchId = ?)
       GROUP BY e.eventName`
    ).all(access.tenantId, from, to, branchId, branchId);
    const byName = new Map(rows.map((row) => [row.eventName, row]));
    let previous = 0;
    const steps = funnelSteps.map((name, index) => {
      const row = byName.get(name) || {};
      const count = Number(row.count || 0);
      const dropOffFromPrevious = index === 0 ? 0 : Math.max(previous - count, 0);
      const metric = {
        eventName: name,
        count,
        dropOffFromPrevious,
        dropOffRatePct: index === 0 ? 0 : pct(dropOffFromPrevious, previous),
        avgTimeToReachFromStartMin: Number(Number(row.avgMinutes || 0).toFixed(2))
      };
      previous = count;
      return metric;
    });
    const visits = steps[0]?.count || 0;
    const confirmed = steps.find((step) => step.eventName === "booking_confirmed")?.count || 0;
    return {
      steps,
      conversionRate: pct(confirmed, visits),
      insights: this.insights(steps)
    };
  },

  getConversionRates(access, query = {}) {
    const { from, to } = range(query);
    const totals = db.prepare(
      `SELECT
         COUNT(*) AS sessions,
         SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM online_booking_sessions
       WHERE tenantId = ? AND startedAt >= ? AND startedAt <= ?`
    ).get(access.tenantId, from, to);
    const byDevice = db.prepare(
      `SELECT COALESCE(NULLIF(deviceType, ''), 'unknown') AS name,
              COUNT(*) AS sessions,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM online_booking_sessions
       WHERE tenantId = ? AND startedAt >= ? AND startedAt <= ?
       GROUP BY COALESCE(NULLIF(deviceType, ''), 'unknown')`
    ).all(access.tenantId, from, to);
    const bySource = db.prepare(
      `SELECT COALESCE(NULLIF(utmSource, ''), source, 'direct') AS name,
              COUNT(*) AS sessions,
              SUM(CASE WHEN status = 'completed' THEN 1 ELSE 0 END) AS completed
       FROM online_booking_sessions
       WHERE tenantId = ? AND startedAt >= ? AND startedAt <= ?
       GROUP BY COALESCE(NULLIF(utmSource, ''), source, 'direct')`
    ).all(access.tenantId, from, to);
    const decorate = (row) => ({
      name: row.name,
      sessions: Number(row.sessions || 0),
      completed: Number(row.completed || 0),
      conversionRatePct: pct(row.completed, row.sessions)
    });
    return {
      overallConversionPct: pct(totals.completed, totals.sessions),
      sessions: Number(totals.sessions || 0),
      completed: Number(totals.completed || 0),
      mobileVsDesktop: byDevice.map(decorate),
      bySource: bySource.map(decorate)
    };
  },

  getAbandonmentReasons(access, query = {}) {
    const { from, to } = range(query);
    const rows = db.prepare(
      `SELECT lastStep, COUNT(*) AS count, AVG(cartValue) AS avgCartValue
       FROM booking_abandonments
       WHERE tenantId = ? AND abandonedAt >= ? AND abandonedAt <= ?
       GROUP BY lastStep
       ORDER BY count DESC`
    ).all(access.tenantId, from, to);
    return rows.map((row) => ({
      lastStep: Number(row.lastStep || 0),
      count: Number(row.count || 0),
      avgCartValue: Number(Number(row.avgCartValue || 0).toFixed(2))
    }));
  },

  getRecoveryStats(access, query = {}) {
    const { from, to } = range(query);
    const row = db.prepare(
      `SELECT COUNT(*) AS total,
              SUM(CASE WHEN recoveryStatus = 'converted' THEN 1 ELSE 0 END) AS recovered,
              SUM(recoveryAttempts) AS attempts
       FROM booking_abandonments
       WHERE tenantId = ? AND abandonedAt >= ? AND abandonedAt <= ?`
    ).get(access.tenantId, from, to);
    return {
      totalAbandonments: Number(row.total || 0),
      recoveryAttempts: Number(row.attempts || 0),
      recoverySuccesses: Number(row.recovered || 0),
      recoveryConversionPct: pct(row.recovered, row.total)
    };
  },

  insights(steps = []) {
    const worst = [...steps].slice(1).sort((a, b) => b.dropOffRatePct - a.dropOffRatePct)[0];
    if (!worst || !worst.dropOffRatePct) return ["Funnel is collecting data; no major drop-off detected yet."];
    return [`Highest drop-off at ${worst.eventName.replaceAll("_", " ")} (${worst.dropOffRatePct}%).`];
  }
};
