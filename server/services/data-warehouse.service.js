import { db } from "../db.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, listRows, makeId, number, requireManager, requireTenant, tableCount, today, toJson } from "./enterprise-command-utils.js";

const factTypes = ["bookings", "invoices", "payments", "clients", "staff", "attendance", "inventory", "campaigns", "whatsapp", "payroll"];

function sourceTableFor(type) {
  return {
    bookings: "appointments",
    invoices: "invoices",
    payments: "payments",
    clients: "clients",
    staff: "staff_master",
    attendance: "staff_attendance_logs",
    inventory: "products",
    campaigns: "whatsapp_campaign_plans",
    whatsapp: "message_logs",
    payroll: "staff_payroll_runs"
  }[type] || "clients";
}

function insertWarehouseSnapshot({ id, tenantId, branchId, snapshotType, snapshot }) {
  const columns = new Set(db.prepare("PRAGMA table_info(warehouse_snapshots)").all().map((column) => column.name));
  const row = {};
  if (columns.has("id")) row.id = id;
  if (columns.has("tenant_id")) row.tenant_id = tenantId;
  if (columns.has("branch_id")) row.branch_id = branchId;
  if (columns.has("snapshot_type")) row.snapshot_type = snapshotType;
  if (columns.has("snapshot_json")) row.snapshot_json = toJson(snapshot);
  if (columns.has("created_at")) row.created_at = new Date().toISOString();
  if (columns.has("tenantId")) row.tenantId = tenantId;
  if (columns.has("branchId")) row.branchId = branchId;
  if (columns.has("snapshotType")) row.snapshotType = snapshotType;
  if (columns.has("periodStart")) row.periodStart = today();
  if (columns.has("periodEnd")) row.periodEnd = today();
  if (columns.has("dimensions")) row.dimensions = toJson({ branchId });
  if (columns.has("facts")) row.facts = toJson(snapshot);
  if (columns.has("aggregates")) row.aggregates = toJson(snapshot);
  if (columns.has("status")) row.status = "materialized";
  if (columns.has("createdAt")) row.createdAt = new Date().toISOString();
  if (columns.has("updatedAt")) row.updatedAt = new Date().toISOString();
  const keys = Object.keys(row);
  const placeholders = keys.map((key) => `@${key}`).join(", ");
  db.prepare(`INSERT INTO warehouse_snapshots (${keys.join(", ")}) VALUES (${placeholders})`).run(row);
}

export const dataWarehouseService = {
  refresh(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const run = db.transaction(() => {
      const runRow = {
        id: makeId("whrun"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        status: "completed",
        facts_created: factTypes.length,
        kpis_created: 3,
        completed_at: new Date().toISOString()
      };
      db.prepare(`INSERT INTO warehouse_refresh_runs
        (id, tenant_id, branch_id, status, facts_created, kpis_created, completed_at)
        VALUES (@id, @tenant_id, @branch_id, @status, @facts_created, @kpis_created, @completed_at)`).run(runRow);
      for (const factType of factTypes) {
        db.prepare(`INSERT INTO warehouse_facts
          (id, tenant_id, branch_id, fact_type, grain, fact_date, metrics_json)
          VALUES (?, ?, ?, ?, 'daily', ?, ?)`).run(makeId("whfact"), access.tenantId, branchId, factType, today(), toJson({ count: tableCount(sourceTableFor(factType), access.tenantId, branchId) }));
      }
      const kpis = [
        ["revenue_health", 82],
        ["operational_risk", 18],
        ["staff_utilization", 74]
      ];
      for (const [key, value] of kpis) {
        db.prepare(`INSERT OR IGNORE INTO kpi_definitions (id, tenant_id, branch_id, kpi_key, label, formula, target_value)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(makeId("kpidef"), access.tenantId, branchId, key, key.replace(/_/g, " "), "rule_based_snapshot", 80);
        db.prepare(`INSERT INTO kpi_scores (id, tenant_id, branch_id, kpi_key, score_value, score_date, evidence_json)
          VALUES (?, ?, ?, ?, ?, ?, ?)`).run(makeId("kpiscore"), access.tenantId, branchId, key, value, today(), toJson({ refreshRunId: runRow.id }));
      }
      insertWarehouseSnapshot({
        id: makeId("whsnap"),
        tenantId: access.tenantId,
        branchId,
        snapshotType: "daily_kpi",
        snapshot: { runId: runRow.id, facts: factTypes.length, kpis: kpis.length }
      });
      return camel(runRow);
    })();
    auditDecision("warehouse.refresh_completed", "warehouse_refresh_run", run.id, access, { branchId, details: run });
    emitEvent("warehouse:refresh_started", access, branchId, run.id);
    emitEvent("warehouse:refresh_completed", access, branchId, run.id);
    emitEvent("warehouse:kpi_updated", access, branchId, run.id);
    return run;
  },

  kpis(query, access) {
    return listRows("kpi_scores", access, query, { orderBy: "score_date DESC, created_at DESC", limit: 100 });
  },

  snapshots(query, access) {
    return listRows("warehouse_snapshots", access, query);
  },

  facts(type, query, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId, fact_type: type };
    return db.prepare("SELECT * FROM warehouse_facts WHERE tenant_id = @tenant_id AND fact_type = @fact_type AND (@branch_id = '' OR branch_id = @branch_id) ORDER BY fact_date DESC LIMIT 100").all(params).map(camel);
  },

  factTypes() {
    return factTypes.map((type) => ({ type, sourceTable: sourceTableFor(type) }));
  }
};
