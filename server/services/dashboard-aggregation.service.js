import { db } from "../db.js";
import { logger } from "../utils/logger.js";
import { realtimeService } from "./realtime.service.js";
import { ensureDashboardSchema } from "./dashboard-schema.service.js";
import { clearDashboardCache } from "./dashboard-cache.service.js";

ensureDashboardSchema();

const nowIso = () => new Date().toISOString();
const todayIso = () => nowIso().slice(0, 10);
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const WORKING_HOURS = 10;

function safeJson(value, fallback) {
  if (value === null || value === undefined || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function datesBetween(from, to) {
  const dates = [];
  const cursor = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  while (cursor <= end) {
    dates.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return dates;
}

function activeTenants() {
  return db
    .prepare("SELECT id FROM tenants WHERE COALESCE(status, 'active') NOT IN ('deleted', 'suspended')")
    .all()
    .map((row) => row.id);
}

function branchIds(tenantId) {
  const rows = db
    .prepare("SELECT id FROM branches WHERE tenantId = ? AND COALESCE(status, 'active') <> 'inactive'")
    .all(tenantId);
  return rows.map((row) => row.id);
}

function branchClause(branchId, alias = "") {
  const column = `${alias ? `${alias}.` : ""}branchId`;
  return branchId ? ` AND ${column} = @branchId` : "";
}

function upsertDaily(payload) {
  db.prepare(
    `INSERT INTO daily_summary (
      tenant_id, date, branch_id, revenue, appointments_count, walkin_count,
      cancellations, noshows, new_customers, repeat_customers, avg_ticket,
      chair_utilization_pct, updated_at
    ) VALUES (
      @tenant_id, @date, @branch_id, @revenue, @appointments_count, @walkin_count,
      @cancellations, @noshows, @new_customers, @repeat_customers, @avg_ticket,
      @chair_utilization_pct, @updated_at
    )
    ON CONFLICT(tenant_id, date, branch_id) DO UPDATE SET
      revenue = excluded.revenue,
      appointments_count = excluded.appointments_count,
      walkin_count = excluded.walkin_count,
      cancellations = excluded.cancellations,
      noshows = excluded.noshows,
      new_customers = excluded.new_customers,
      repeat_customers = excluded.repeat_customers,
      avg_ticket = excluded.avg_ticket,
      chair_utilization_pct = excluded.chair_utilization_pct,
      updated_at = excluded.updated_at`
  ).run(payload);
}

function upsertHourly(payload) {
  db.prepare(
    `INSERT INTO hourly_summary (
      tenant_id, datetime_hour, branch_id, revenue, appointments_count
    ) VALUES (
      @tenant_id, @datetime_hour, @branch_id, @revenue, @appointments_count
    )
    ON CONFLICT(tenant_id, datetime_hour, branch_id) DO UPDATE SET
      revenue = excluded.revenue,
      appointments_count = excluded.appointments_count`
  ).run(payload);
}

function upsertStaff(payload) {
  db.prepare(
    `INSERT INTO staff_daily_summary (
      tenant_id, staff_id, date, services_completed, revenue_generated,
      tips_received, retention_count
    ) VALUES (
      @tenant_id, @staff_id, @date, @services_completed, @revenue_generated,
      @tips_received, @retention_count
    )
    ON CONFLICT(tenant_id, staff_id, date) DO UPDATE SET
      services_completed = excluded.services_completed,
      revenue_generated = excluded.revenue_generated,
      tips_received = excluded.tips_received,
      retention_count = excluded.retention_count`
  ).run(payload);
}

function upsertCustomerMetric(payload) {
  db.prepare(
    `INSERT INTO customer_metrics (
      tenant_id, customer_id, total_visits, total_spent, last_visit_date,
      avg_gap_days, rfm_recency, rfm_frequency, rfm_monetary, segment, clv, updated_at
    ) VALUES (
      @tenant_id, @customer_id, @total_visits, @total_spent, @last_visit_date,
      @avg_gap_days, @rfm_recency, @rfm_frequency, @rfm_monetary, @segment, @clv, @updated_at
    )
    ON CONFLICT(tenant_id, customer_id) DO UPDATE SET
      total_visits = excluded.total_visits,
      total_spent = excluded.total_spent,
      last_visit_date = excluded.last_visit_date,
      avg_gap_days = excluded.avg_gap_days,
      rfm_recency = excluded.rfm_recency,
      rfm_frequency = excluded.rfm_frequency,
      rfm_monetary = excluded.rfm_monetary,
      segment = excluded.segment,
      clv = excluded.clv,
      updated_at = excluded.updated_at`
  ).run(payload);
}

function scoreQuintile(value, values, higherBetter = true) {
  const cleaned = values.map(Number).filter((item) => Number.isFinite(item)).sort((a, b) => a - b);
  if (!cleaned.length) return 1;
  const rank = cleaned.findIndex((item) => Number(value) <= item);
  const percentile = (rank < 0 ? cleaned.length : rank + 1) / cleaned.length;
  const raw = Math.max(1, Math.min(5, Math.ceil(percentile * 5)));
  return higherBetter ? raw : 6 - raw;
}

function segmentFromRfm(r, f, m, visits) {
  if (!visits) return "New";
  if (r >= 5 && f >= 4 && m >= 4) return "Champions";
  if (r >= 4 && f >= 3) return "Loyal";
  if (r >= 4 && f <= 2) return "Potential Loyalist";
  if (r <= 2 && f >= 4 && m >= 4) return "Cant-Lose";
  if (r <= 2 && (f >= 3 || m >= 3)) return "At-Risk";
  if (r <= 2) return "Lost";
  if (f <= 2 && m <= 2) return "Hibernating";
  return "Loyal";
}

export class DashboardAggregationService {
  refreshHourlySummary(tenantId, date = todayIso()) {
    const branches = branchIds(tenantId);
    const refreshed = [];
    const run = db.transaction(() => {
      for (const branchId of branches) {
        for (let hour = 0; hour < 24; hour += 1) {
          const hourLabel = `${date} ${String(hour).padStart(2, "0")}:00`;
          const params = { tenantId, branchId, hourPrefix: `${date}T${String(hour).padStart(2, "0")}` };
          const revenue = db
            .prepare("SELECT COALESCE(SUM(total), 0) AS value FROM sales WHERE tenantId = @tenantId AND branchId = @branchId AND substr(createdAt, 1, 13) = @hourPrefix")
            .get(params).value;
          const appointments = db
            .prepare("SELECT COUNT(*) AS count FROM appointments WHERE tenantId = @tenantId AND branchId = @branchId AND substr(startAt, 1, 13) = @hourPrefix")
            .get(params).count;
          upsertHourly({
            tenant_id: tenantId,
            datetime_hour: hourLabel,
            branch_id: branchId,
            revenue: money(revenue),
            appointments_count: appointments
          });
        }
        refreshed.push(branchId);
      }
    });
    run();
    this.emitRefresh(tenantId, "", { scope: "hourly", date, branches: refreshed });
    return { tenantId, date, branches: refreshed.length };
  }

  refreshDailySummary(tenantId, date = todayIso()) {
    const branches = branchIds(tenantId);
    const run = db.transaction(() => {
      for (const branchId of branches) {
        const params = { tenantId, branchId, date };
        const sales = db.prepare("SELECT COUNT(*) AS count, COALESCE(SUM(total), 0) AS revenue FROM sales WHERE tenantId = @tenantId AND branchId = @branchId AND substr(createdAt, 1, 10) = @date").get(params);
        const appointments = db.prepare(
          `SELECT
            COUNT(*) AS count,
            SUM(CASE WHEN lower(source) LIKE 'walk%' THEN 1 ELSE 0 END) AS walkins,
            SUM(CASE WHEN lower(status) IN ('cancelled', 'canceled', 'cancel') THEN 1 ELSE 0 END) AS cancellations,
            SUM(CASE WHEN lower(status) IN ('no-show', 'noshow', 'no show') THEN 1 ELSE 0 END) AS noshows
          FROM appointments
          WHERE tenantId = @tenantId AND branchId = @branchId AND substr(startAt, 1, 10) = @date`
        ).get(params);
        const clients = db.prepare(
          `SELECT
            SUM(CASE WHEN substr(createdAt, 1, 10) = @date THEN 1 ELSE 0 END) AS newCustomers,
            SUM(CASE WHEN COALESCE(visitCount, 0) > 1 THEN 1 ELSE 0 END) AS repeatCustomers
          FROM clients
          WHERE tenantId = @tenantId AND (branchId = @branchId OR COALESCE(branchId, '') = '')`
        ).get(params);
        upsertDaily({
          tenant_id: tenantId,
          date,
          branch_id: branchId,
          revenue: money(sales.revenue),
          appointments_count: appointments.count || 0,
          walkin_count: appointments.walkins || 0,
          cancellations: appointments.cancellations || 0,
          noshows: appointments.noshows || 0,
          new_customers: clients.newCustomers || 0,
          repeat_customers: clients.repeatCustomers || 0,
          avg_ticket: sales.count ? money(Number(sales.revenue || 0) / Number(sales.count || 1)) : 0,
          chair_utilization_pct: this.computeChairUtilization(tenantId, branchId, date).utilizationPct,
          updated_at: nowIso()
        });
      }
    });
    run();
    this.emitRefresh(tenantId, "", { scope: "daily", date, branches: branches.length });
    return { tenantId, date, branches: branches.length };
  }

  refreshStaffDailySummary(tenantId, date = todayIso()) {
    const staff = db.prepare("SELECT id FROM staff WHERE tenantId = ?").all(tenantId);
    const run = db.transaction(() => {
      for (const person of staff) {
        const params = { tenantId, staffId: person.id, date };
        const appointments = db.prepare(
          `SELECT COUNT(*) AS completed
          FROM appointments
          WHERE tenantId = @tenantId AND staffId = @staffId
            AND substr(startAt, 1, 10) = @date
            AND lower(status) IN ('completed', 'billed', 'paid')`
        ).get(params);
        const sales = db.prepare(
          `SELECT total, splitPayments
          FROM sales
          WHERE tenantId = @tenantId AND staffId = @staffId AND substr(createdAt, 1, 10) = @date`
        ).all(params);
        const revenue = sales.reduce((sum, row) => sum + Number(row.total || 0), 0);
        const tips = sales.reduce((sum, row) => {
          const payments = safeJson(row.splitPayments, []);
          return sum + (Array.isArray(payments) ? payments.reduce((total, payment) => total + Number(payment.tip || payment.tipAmount || 0), 0) : 0);
        }, 0);
        upsertStaff({
          tenant_id: tenantId,
          staff_id: person.id,
          date,
          services_completed: appointments.completed || 0,
          revenue_generated: money(revenue),
          tips_received: money(tips),
          retention_count: 0
        });
      }
    });
    run();
    this.emitRefresh(tenantId, "", { scope: "staff_daily", date, staff: staff.length });
    return { tenantId, date, staff: staff.length };
  }

  refreshCustomerMetrics(tenantId) {
    const clients = db.prepare("SELECT id, createdAt FROM clients WHERE tenantId = ?").all(tenantId);
    const appointments = db.prepare(
      `SELECT clientId, startAt
      FROM appointments
      WHERE tenantId = ? AND lower(status) IN ('completed', 'billed', 'paid')
      ORDER BY clientId, startAt`
    ).all(tenantId);
    const sales = db.prepare("SELECT clientId, total, createdAt FROM sales WHERE tenantId = ?").all(tenantId);
    const byClient = new Map(clients.map((client) => [client.id, { client, visits: [], sales: [] }]));
    for (const appointment of appointments) {
      if (!byClient.has(appointment.clientId)) continue;
      byClient.get(appointment.clientId).visits.push(appointment.startAt);
    }
    for (const sale of sales) {
      if (!byClient.has(sale.clientId)) continue;
      byClient.get(sale.clientId).sales.push(sale);
    }
    const today = new Date(`${todayIso()}T00:00:00.000Z`);
    const metrics = [...byClient.values()].map((item) => {
      const visits = item.visits.sort();
      const totalSpent = item.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0);
      const lastVisit = visits[visits.length - 1] || "";
      const recencyDays = lastVisit ? Math.max(0, Math.round((today - new Date(lastVisit)) / 86400000)) : 9999;
      const gaps = [];
      for (let index = 1; index < visits.length; index += 1) {
        gaps.push(Math.max(0, (new Date(visits[index]) - new Date(visits[index - 1])) / 86400000));
      }
      const avgGap = gaps.length ? gaps.reduce((sum, gap) => sum + gap, 0) / gaps.length : 0;
      const avgTicket = item.sales.length ? totalSpent / item.sales.length : 0;
      return {
        customer_id: item.client.id,
        total_visits: visits.length,
        total_spent: money(totalSpent),
        last_visit_date: lastVisit ? lastVisit.slice(0, 10) : "",
        recency_days: recencyDays,
        avg_gap_days: money(avgGap),
        clv: money(avgTicket * Math.max(1, visits.length) * 2)
      };
    });
    const recencies = metrics.map((metric) => metric.recency_days);
    const frequencies = metrics.map((metric) => metric.total_visits);
    const monetaries = metrics.map((metric) => metric.total_spent);
    const run = db.transaction(() => {
      for (const metric of metrics) {
        const r = scoreQuintile(metric.recency_days, recencies, false);
        const f = scoreQuintile(metric.total_visits, frequencies, true);
        const m = scoreQuintile(metric.total_spent, monetaries, true);
        upsertCustomerMetric({
          tenant_id: tenantId,
          customer_id: metric.customer_id,
          total_visits: metric.total_visits,
          total_spent: metric.total_spent,
          last_visit_date: metric.last_visit_date,
          avg_gap_days: metric.avg_gap_days,
          rfm_recency: r,
          rfm_frequency: f,
          rfm_monetary: m,
          segment: segmentFromRfm(r, f, m, metric.total_visits),
          clv: metric.clv,
          updated_at: nowIso()
        });
      }
    });
    run();
    this.emitRefresh(tenantId, "", { scope: "customer_metrics", customers: metrics.length });
    return { tenantId, customers: metrics.length };
  }

  computeChairUtilization(tenantId, branchId, date = todayIso()) {
    const params = { tenantId, branchId, date };
    const rows = db.prepare(
      `SELECT chair, room, startAt, endAt, serviceIds
      FROM appointments
      WHERE tenantId = @tenantId AND branchId = @branchId
        AND substr(startAt, 1, 10) = @date
        AND lower(status) IN ('completed', 'in_service', 'in-service', 'billed', 'paid')`
    ).all(params);
    const chairs = new Set();
    let busy = 0;
    for (const appointment of rows) {
      chairs.add(appointment.chair || appointment.room || "Unassigned");
      const start = new Date(appointment.startAt).getTime();
      const end = appointment.endAt ? new Date(appointment.endAt).getTime() : 0;
      const duration = end > start ? (end - start) / 60000 : 30;
      busy += duration;
    }
    const chairCount = Math.max(1, chairs.size || 1);
    const available = chairCount * WORKING_HOURS * 60;
    return {
      busyMin: Math.round(busy),
      availableMin: available,
      utilizationPct: available ? money((busy * 100) / available) : 0
    };
  }

  refreshAllTenants() {
    const date = todayIso();
    const results = [];
    for (const tenantId of activeTenants()) {
      try {
        this.refreshHourlySummary(tenantId, date);
        this.refreshDailySummary(tenantId, date);
        this.refreshStaffDailySummary(tenantId, date);
        this.refreshCustomerMetrics(tenantId);
        results.push({ tenantId, ok: true });
      } catch (error) {
        logger.error("dashboard_refresh_failed", { tenantId, error: error.message });
        results.push({ tenantId, ok: false, error: error.message });
      }
    }
    return results;
  }

  refreshRange(tenantId, from, to) {
    for (const date of datesBetween(from, to)) {
      this.refreshHourlySummary(tenantId, date);
      this.refreshDailySummary(tenantId, date);
      this.refreshStaffDailySummary(tenantId, date);
    }
    this.refreshCustomerMetrics(tenantId);
    return { tenantId, from, to };
  }

  emitRefresh(tenantId, branchId = "", payload = {}) {
    clearDashboardCache(`dashboard:`);
    realtimeService.broadcast("dashboard:refreshed", {
      ...payload,
      tenantId,
      timestamp: nowIso()
    }, {
      tenantId,
      branchId,
      channel: branchId ? `branch:${branchId}` : `tenant:${tenantId}`
    });
  }
}

export const dashboardAggregationService = new DashboardAggregationService();
