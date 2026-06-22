import crypto from "node:crypto";
import { db } from "../db.js";
import { realtimeService } from "./realtime.service.js";
import { ensureDashboardSchema } from "./dashboard-schema.service.js";

ensureDashboardSchema();

const todayIso = () => new Date().toISOString().slice(0, 10);
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function addDays(date, days) {
  const next = new Date(`${date}T00:00:00.000Z`);
  next.setUTCDate(next.getUTCDate() + days);
  return next.toISOString().slice(0, 10);
}

function stats(values) {
  const clean = values.map(Number).filter(Number.isFinite);
  if (!clean.length) return { mean: 0, sd: 0 };
  const mean = clean.reduce((sum, value) => sum + value, 0) / clean.length;
  const variance = clean.reduce((sum, value) => sum + (value - mean) ** 2, 0) / clean.length;
  return { mean, sd: Math.sqrt(variance) };
}

function insertAlert({ tenantId, branchId = "", type, severity, title, message, entityRef = "" }) {
  const exists = db.prepare(
    `SELECT id FROM alerts
     WHERE tenant_id = @tenantId AND type = @type AND title = @title
       AND status = 'open' AND substr(created_at, 1, 10) = @today`
  ).get({ tenantId, type, title, today: todayIso() });
  if (exists) return exists.id;
  const id = crypto.randomUUID();
  db.prepare(
    `INSERT INTO alerts (id, tenant_id, branch_id, type, severity, title, message, entity_ref, status, created_at)
     VALUES (@id, @tenantId, @branchId, @type, @severity, @title, @message, @entityRef, 'open', @createdAt)`
  ).run({ id, tenantId, branchId, type, severity, title, message, entityRef, createdAt: new Date().toISOString() });
  realtimeService.broadcast("dashboard:alert:anomaly", { id, type, severity, title, message, tenantId, branchId }, {
    tenantId,
    branchId,
    channel: branchId ? `branch:${branchId}` : `tenant:${tenantId}`
  });
  return id;
}

function branchesForTenant(tenantId) {
  return db.prepare("SELECT id FROM branches WHERE tenantId = ?").all(tenantId).map((row) => row.id);
}

export class AnomalyDetectionService {
  detectRevenueAnomaly(tenantId, branchId = "") {
    const today = todayIso();
    const current = db.prepare(
      `SELECT COALESCE(SUM(total), 0) AS value FROM sales
       WHERE tenantId = @tenantId AND (@branchId = '' OR branchId = @branchId)
         AND substr(createdAt, 1, 10) = @today`
    ).get({ tenantId, branchId, today }).value;
    const values = db.prepare(
      `SELECT substr(createdAt, 1, 10) AS date, COALESCE(SUM(total), 0) AS value
       FROM sales
       WHERE tenantId = @tenantId AND (@branchId = '' OR branchId = @branchId)
         AND substr(createdAt, 1, 10) BETWEEN @from AND @to
       GROUP BY substr(createdAt, 1, 10)`
    ).all({ tenantId, branchId, from: addDays(today, -30), to: addDays(today, -1) }).map((row) => row.value);
    const baseline = stats(values);
    const threshold = baseline.mean - (2 * baseline.sd);
    if (baseline.mean > 0 && Number(current) < threshold) {
      const severity = current < baseline.mean * 0.6 ? "critical" : "warning";
      insertAlert({
        tenantId,
        branchId,
        type: "revenue_drop",
        severity,
        title: "Revenue anomaly detected",
        message: `Today's revenue ${money(current)} is below historical baseline ${money(baseline.mean)}.`,
        entityRef: "sales"
      });
    }
    return { current: money(current), mean: money(baseline.mean), sd: money(baseline.sd), anomalous: baseline.mean > 0 && Number(current) < threshold };
  }

  detectCancellationSpike(tenantId, branchId = "") {
    const today = todayIso();
    const current = db.prepare(
      `SELECT COUNT(*) AS count FROM appointments
       WHERE tenantId = @tenantId AND (@branchId = '' OR branchId = @branchId)
         AND substr(startAt, 1, 10) = @today
         AND lower(status) IN ('cancelled', 'canceled', 'cancel')`
    ).get({ tenantId, branchId, today }).count;
    const values = db.prepare(
      `SELECT substr(startAt, 1, 10) AS date, COUNT(*) AS count
       FROM appointments
       WHERE tenantId = @tenantId AND (@branchId = '' OR branchId = @branchId)
         AND substr(startAt, 1, 10) BETWEEN @from AND @to
         AND lower(status) IN ('cancelled', 'canceled', 'cancel')
       GROUP BY substr(startAt, 1, 10)`
    ).all({ tenantId, branchId, from: addDays(today, -30), to: addDays(today, -1) }).map((row) => row.count);
    const baseline = stats(values);
    const threshold = baseline.mean + (2 * baseline.sd);
    if (current > threshold && current > 2) {
      insertAlert({
        tenantId,
        branchId,
        type: "cancellation_spike",
        severity: "warning",
        title: "Cancellation spike",
        message: `${current} cancellations today vs baseline ${money(baseline.mean)}.`,
        entityRef: "appointments"
      });
    }
    return { current, mean: money(baseline.mean), sd: money(baseline.sd), anomalous: current > threshold && current > 2 };
  }

  detectInventoryAnomaly(tenantId, productId) {
    const today = todayIso();
    const values = db.prepare(
      `SELECT substr(createdAt, 1, 10) AS date, ABS(COALESCE(SUM(quantity), 0)) AS qty
       FROM inventory_transactions
       WHERE tenantId = @tenantId AND productId = @productId
         AND type IN ('deduction', 'sale', 'usage', 'waste')
         AND substr(createdAt, 1, 10) BETWEEN @from AND @to
       GROUP BY substr(createdAt, 1, 10)`
    ).all({ tenantId, productId, from: addDays(today, -30), to: today }).map((row) => row.qty);
    const baseline = stats(values.slice(0, -1));
    const current = values[values.length - 1] || 0;
    const anomalous = baseline.mean > 0 && current > baseline.mean + (2 * baseline.sd);
    if (anomalous) {
      insertAlert({
        tenantId,
        type: "inventory_consumption",
        severity: "warning",
        title: "Inventory consumption anomaly",
        message: `Product ${productId} consumption is above normal baseline.`,
        entityRef: productId
      });
    }
    return { current, mean: money(baseline.mean), sd: money(baseline.sd), anomalous };
  }

  detectStaffProductivityDrop(tenantId, staffId) {
    const today = todayIso();
    const current = db.prepare(
      `SELECT COALESCE(SUM(total), 0) AS value FROM sales
       WHERE tenantId = @tenantId AND staffId = @staffId
         AND substr(createdAt, 1, 10) BETWEEN @from AND @to`
    ).get({ tenantId, staffId, from: addDays(today, -6), to: today }).value;
    const previous = db.prepare(
      `SELECT COALESCE(SUM(total), 0) AS value FROM sales
       WHERE tenantId = @tenantId AND staffId = @staffId
         AND substr(createdAt, 1, 10) BETWEEN @from AND @to`
    ).get({ tenantId, staffId, from: addDays(today, -13), to: addDays(today, -7) }).value;
    const dropPct = previous ? ((previous - current) * 100) / previous : 0;
    if (dropPct > 25) {
      insertAlert({
        tenantId,
        type: "staff_productivity_drop",
        severity: "warning",
        title: "Staff productivity drop",
        message: `Staff ${staffId} revenue dropped ${money(dropPct)}% WoW.`,
        entityRef: staffId
      });
    }
    return { current: money(current), previous: money(previous), dropPct: money(dropPct), anomalous: dropPct > 25 };
  }

  runAllChecks(tenantId) {
    const branches = branchesForTenant(tenantId);
    const results = [];
    for (const branchId of branches) {
      results.push({ branchId, revenue: this.detectRevenueAnomaly(tenantId, branchId), cancellations: this.detectCancellationSpike(tenantId, branchId) });
    }
    const staff = db.prepare("SELECT id FROM staff WHERE tenantId = ?").all(tenantId);
    for (const person of staff) this.detectStaffProductivityDrop(tenantId, person.id);
    return results;
  }

  getAnomalies(tenantId, status = "open") {
    return db.prepare(
      `SELECT id, branch_id AS branchId, type, severity, title, message, entity_ref AS entityRef,
              status, created_at AS createdAt, resolved_at AS resolvedAt
       FROM alerts
       WHERE tenant_id = @tenantId AND (@status = 'all' OR status = @status)
       ORDER BY created_at DESC
       LIMIT 100`
    ).all({ tenantId, status });
  }

  resolveAnomaly(tenantId, id) {
    const result = db.prepare(
      `UPDATE alerts SET status = 'resolved', resolved_at = @resolvedAt
       WHERE tenant_id = @tenantId AND id = @id`
    ).run({ tenantId, id, resolvedAt: new Date().toISOString() });
    return { id, resolved: result.changes > 0 };
  }
}

export const anomalyDetectionService = new AnomalyDetectionService();
