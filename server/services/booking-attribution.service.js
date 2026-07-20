import { db } from "../db.js";

function dateBounds({ from = "", to = "" } = {}) {
  const end = to ? new Date(to) : new Date();
  const start = from ? new Date(from) : new Date(end.getTime() - 30 * 86400000);
  return { from: start.toISOString(), to: end.toISOString() };
}

export const bookingAttributionService = {
  inferSourceFromRequest(req) {
    if (req.get("x-walkin-flag")) return { sourceChannel: "walkin", sourceMedium: "front_desk" };
    const ua = (req.get("user-agent") || "").toLowerCase();
    if (ua.includes("mobile") || req.get("x-booking-portal")) return { sourceChannel: "portal", sourceMedium: "direct" };
    return {};
  },

  getAttributionReport(access, query = {}) {
    const { from, to } = dateBounds(query);
    const branchId = query.branchId || "";
    const rows = db.prepare(
      `SELECT
         COALESCE(NULLIF(sourceChannel, ''), NULLIF(source, ''), 'unknown') AS channel,
         COUNT(*) AS bookings
       FROM appointments
       WHERE tenantId = ?
         AND startAt >= ?
         AND startAt <= ?
         AND (? = '' OR branchId = ?)
       GROUP BY channel
       ORDER BY bookings DESC`
    ).all(access.tenantId, from, to, branchId, branchId);
    const sales = db.prepare(
      `SELECT COALESCE(NULLIF(a.sourceChannel, ''), NULLIF(a.source, ''), 'unknown') AS channel,
              SUM(COALESCE(s.total, 0)) AS revenue
       FROM sales s
       LEFT JOIN appointments a ON a.id = s.appointmentId
       WHERE s.tenantId = ?
         AND s.createdAt >= ?
         AND s.createdAt <= ?
         AND (? = '' OR s.branchId = ?)
       GROUP BY channel`
    ).all(access.tenantId, from, to, branchId, branchId);
    const revenueByChannel = new Map(sales.map((row) => [row.channel, Number(row.revenue || 0)]));
    return rows.map((row) => ({
      channel: row.channel,
      bookings: Number(row.bookings || 0),
      revenue: revenueByChannel.get(row.channel) || 0,
      conversionRate: Number(row.bookings || 0) ? 100 : 0
    }));
  }
};

