import { db } from "../db.js";
import { assertBranch, auditDecision, branchFrom, camel, dbSizeBytes, emitEvent, listRows, makeId, number, requireManager, requireTenant, tableCount, toJson } from "./enterprise-command-utils.js";

function healthPayload(access, branchId = "") {
  return {
    status: "healthy",
    apiLatencyP95: 0,
    errorRate: 0,
    queueBacklog: tableCount("staff_mobile_sync_queue", access.tenantId, branchId),
    websocketStatus: "available",
    aiCostLedgerRows: tableCount("ai_cost_ledger", access.tenantId, branchId),
    databaseSizeBytes: dbSizeBytes(),
    backupStatus: "not_configured"
  };
}

export const observabilityCenterService = {
  health(query, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    assertBranch(access, branchId);
    return healthPayload(access, branchId);
  },

  errors(query, access) {
    return listRows("error_events", access, query);
  },

  latency(query, access) {
    return listRows("api_latency_metrics", access, query);
  },

  usage(query, access) {
    return listRows("tenant_usage_metrics", access, query);
  },

  snapshot(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const metrics = healthPayload(access, branchId);
    const row = {
      id: makeId("health"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      status: metrics.status,
      metrics_json: toJson(metrics)
    };
    db.prepare(`INSERT INTO system_health_snapshots (id, tenant_id, branch_id, status, metrics_json)
      VALUES (@id, @tenant_id, @branch_id, @status, @metrics_json)`).run(row);
    db.prepare(`INSERT INTO tenant_usage_metrics (id, tenant_id, branch_id, metric_key, metric_value)
      VALUES (?, ?, ?, 'database_size_bytes', ?)`).run(makeId("usage"), access.tenantId, branchId, number(metrics.databaseSizeBytes));
    auditDecision("system.health_snapshot", "system_health_snapshot", row.id, access, { branchId, details: metrics });
    emitEvent("system:health_snapshot", access, branchId, row.id);
    return { ...camel(row), metrics };
  }
};
