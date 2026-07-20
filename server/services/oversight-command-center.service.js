import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { invoiceEventLedgerService } from "./invoice-event-ledger.service.js";
import { ensureOversightCommandCenterSchema } from "./oversight-command-center-schema.service.js";

const DEFAULT_TENANT_ID = "tenant_aura";
const DEFAULT_BRANCH_ID = "branch_hyd";
const today = () => new Date().toISOString().slice(0, 10);
const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @table").get({ table }));
}

const columnCache = new Map();
function columns(table) {
  if (!tableExists(table)) return [];
  if (!columnCache.has(table)) {
    columnCache.set(table, db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name));
  }
  return columnCache.get(table);
}

function hasColumn(table, column) {
  return columns(table).includes(column);
}

function tenantId(access = {}) {
  return access.tenantId || DEFAULT_TENANT_ID;
}

function branchId(access = {}, query = {}) {
  return query.branchId || access.branchId || access.branchIds?.[0] || DEFAULT_BRANCH_ID;
}

function scope(table, access = {}, query = {}, params = {}) {
  const clauses = [];
  const tenantColumn = hasColumn(table, "tenantId") ? "tenantId" : hasColumn(table, "tenant_id") ? "tenant_id" : "";
  const branchColumn = hasColumn(table, "branchId") ? "branchId" : hasColumn(table, "branch_id") ? "branch_id" : "";
  if (tenantColumn) {
    clauses.push(`${tenantColumn} = @tenantId`);
    params.tenantId = tenantId(access);
  }
  if (branchColumn && branchId(access, query)) {
    clauses.push(`(${branchColumn} = @branchId OR ${branchColumn} IS NULL OR ${branchColumn} = '')`);
    params.branchId = branchId(access, query);
  }
  return clauses;
}

function safeRows(table, access, query = {}, limit = 250) {
  if (!tableExists(table)) return [];
  const params = { limit };
  const clauses = scope(table, access, query, params);
  const createdColumn = hasColumn(table, "createdAt") ? "createdAt" : hasColumn(table, "created_at") ? "created_at" : "";
  const sql = `SELECT * FROM ${table}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}${createdColumn ? ` ORDER BY ${createdColumn} DESC` : ""} LIMIT @limit`;
  return db.prepare(sql).all(params);
}

function riskLevel(score) {
  if (score >= 80) return "critical";
  if (score >= 60) return "high";
  if (score >= 35) return "medium";
  return "low";
}

function rupee(value) {
  return Number(value || 0);
}

function staffNameLookup(access, query) {
  const map = new Map();
  for (const table of ["staff", "staff_members", "users"]) {
    if (!tableExists(table)) continue;
    const params = { limit: 500 };
    const clauses = scope(table, access, query, params);
    const idColumn = hasColumn(table, "id") ? "id" : hasColumn(table, "staffId") ? "staffId" : "";
    const nameColumn = hasColumn(table, "name") ? "name" : hasColumn(table, "staffName") ? "staffName" : hasColumn(table, "fullName") ? "fullName" : "";
    if (!idColumn || !nameColumn) continue;
    const rows = db.prepare(`SELECT ${idColumn} AS id, ${nameColumn} AS name FROM ${table}${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""} LIMIT @limit`).all(params);
    rows.forEach((row) => map.set(String(row.id), row.name));
  }
  return map;
}

function buildStaffRiskRows(access, query) {
  const names = staffNameLookup(access, query);
  const staff = new Map();
  const get = (id, name = "") => {
    const key = String(id || "unassigned");
    if (!staff.has(key)) {
      staff.set(key, {
        staffId: key,
        staffName: name || names.get(key) || (key === "unassigned" ? "Unassigned" : key),
        riskScore: 0,
        riskLevel: "low",
        voids: 0,
        refunds: 0,
        discountAlerts: 0,
        dataAccess: 0,
        attendanceAlerts: 0,
        openFraudAlerts: 0,
        suggestedAction: "Monitor"
      });
    }
    return staff.get(key);
  };
  const bump = (id, amount, field, name = "") => {
    const row = get(id, name);
    row.riskScore += amount;
    if (field) row[field] += 1;
  };

  safeRows("fraud_alerts", access, query, 500).forEach((row) => {
    const subjectType = String(row.subjectType || row.subject_type || "").toLowerCase();
    if (!["staff", "user", "cashier", "employee"].includes(subjectType)) return;
    const score = Number(row.riskScore || row.risk_score || 25);
    const target = row.subjectId || row.subject_id || row.staffId || row.staff_id || row.userId || row.user_id;
    bump(target, Math.max(10, Math.min(40, score / 2)), "openFraudAlerts");
  });

  safeRows("discount_approval_requests", access, query, 500).forEach((row) => {
    const target = row.requested_by || row.requestedBy || row.createdBy || row.created_by;
    const status = String(row.status || "").toLowerCase();
    bump(target, status === "pending" ? 12 : 5, "discountAlerts");
  });

  for (const table of ["audit_log", "audit_logs", "invoice_audit_log", "security_audit_logs"]) {
    safeRows(table, access, query, 500).forEach((row) => {
      const action = String(row.action || row.eventType || row.event_type || row.type || row.activity || "").toLowerCase();
      const target = row.staffId || row.staff_id || row.actorUserId || row.actor_user_id || row.userId || row.user_id || row.createdBy || row.created_by;
      if (/void|cancel|delete/.test(action)) bump(target, 14, "voids");
      if (/refund|reversal/.test(action)) bump(target, 16, "refunds");
      if (/discount/.test(action)) bump(target, 8, "discountAlerts");
      if (/export|payroll|salary|security|sensitive|client.*view/.test(action)) bump(target, 10, "dataAccess");
    });
  }

  for (const table of ["staff_attendance_risk_events", "staff_biometric_risk_events", "attendance_anomalies"]) {
    safeRows(table, access, query, 500).forEach((row) => {
      bump(row.staffId || row.staff_id || row.userId || row.user_id, 12, "attendanceAlerts", row.staffName || row.staff_name);
    });
  }

  return Array.from(staff.values())
    .map((row) => {
      const score = Math.min(100, Math.round(row.riskScore));
      return {
        ...row,
        riskScore: score,
        riskLevel: riskLevel(score),
        suggestedAction: score >= 80 ? "Owner review today" : score >= 60 ? "Manager review" : score >= 35 ? "Watch this week" : "Monitor"
      };
    })
    .sort((a, b) => b.riskScore - a.riskScore)
    .slice(0, 25);
}

function latestAuditRun(access, query) {
  ensureOversightCommandCenterSchema();
  return db.prepare(
    `SELECT * FROM oversight_audit_verify_runs
     WHERE tenantId = @tenantId AND branchId = @branchId
     ORDER BY createdAt DESC LIMIT 1`
  ).get({ tenantId: tenantId(access), branchId: branchId(access, query) }) || null;
}

function recentInvoiceIds(access, query, limit = 50) {
  if (!tableExists("invoice_events")) return [];
  const params = { limit };
  const clauses = scope("invoice_events", access, query, params);
  const invoiceColumn = hasColumn("invoice_events", "invoice_id") ? "invoice_id" : hasColumn("invoice_events", "invoiceId") ? "invoiceId" : "";
  const createdColumn = hasColumn("invoice_events", "created_at") ? "created_at" : hasColumn("invoice_events", "createdAt") ? "createdAt" : "";
  if (!invoiceColumn) return [];
  const sql = `SELECT DISTINCT ${invoiceColumn} AS invoiceId FROM invoice_events${clauses.length ? ` WHERE ${clauses.join(" AND ")}` : ""}${createdColumn ? ` ORDER BY ${createdColumn} DESC` : ""} LIMIT @limit`;
  return db.prepare(sql).all(params).map((row) => row.invoiceId).filter(Boolean);
}

function buildExceptionRows(staffRiskRows, auditRun, access, query) {
  const exceptions = [];
  const add = (type, title, severity, count, amount = 0, action = "Review") => {
    if (!count) return;
    exceptions.push({ type, title, severity, count, amount, action });
  };
  add("staff_risk", "High-risk staff signals", "high", staffRiskRows.filter((row) => row.riskScore >= 60).length, 0, "Open staff risk");
  add("audit_verify", "Audit-chain warnings", auditRun?.tamperCount ? "critical" : "medium", Number(auditRun?.warningCount || 0), 0, "Run audit verify");
  const pendingDiscounts = safeRows("discount_approval_requests", access, query, 500).filter((row) => String(row.status || "").toLowerCase() === "pending");
  add("discount_approval", "Pending discount approvals", "medium", pendingDiscounts.length, pendingDiscounts.reduce((sum, row) => sum + rupee(row.discount_amount || row.discountAmount), 0), "Approve or reject");
  const openFraud = safeRows("fraud_alerts", access, query, 500).filter((row) => !["resolved", "closed"].includes(String(row.status || "").toLowerCase()));
  add("fraud_alert", "Open fraud alerts", "high", openFraud.length, 0, "Investigate");
  return exceptions.slice(0, 20);
}

function reconciliationSignal(access, query) {
  const rows = safeRows("payment_reconciliation_runs", access, query, 20).concat(safeRows("razorpay_reconciliation_runs", access, query, 20));
  const latest = rows[0] || null;
  return {
    status: latest ? String(latest.status || "review_required") : "not_configured",
    lastRunAt: latest?.createdAt || latest?.created_at || "-",
    mismatchCount: Number(latest?.mismatchCount || latest?.mismatch_count || latest?.unmatchedCount || latest?.unmatched_count || 0)
  };
}

export const oversightCommandCenterService = {
  summary(query = {}, access = {}) {
    ensureOversightCommandCenterSchema();
    const auditRun = latestAuditRun(access, query);
    const staffRiskRows = buildStaffRiskRows(access, query);
    const exceptionRows = buildExceptionRows(staffRiskRows, auditRun, access, query);
    const reconciliation = reconciliationSignal(access, query);
    const highRiskStaff = staffRiskRows.filter((row) => row.riskScore >= 60).length;
    const tamperCount = Number(auditRun?.tamperCount || 0);
    return {
      summary: {
        openExceptions: exceptionRows.reduce((sum, row) => sum + row.count, 0),
        highRiskStaff,
        pendingApprovals: exceptionRows.find((row) => row.type === "discount_approval")?.count || 0,
        auditStatus: auditRun?.status || "not_run",
        auditDueToday: auditRun?.runDate !== today(),
        reconciliationMismatches: reconciliation.mismatchCount,
        siemStatus: tableExists("audit_log") || tableExists("fraud_alerts") ? "ready" : "setup_required"
      },
      cards: {
        financialScrutiny: { label: "Financial scrutiny", status: exceptionRows.length ? "review" : "clean", value: exceptionRows.length },
        staffRisk: { label: "Staff risk engine", status: highRiskStaff ? "review" : "clean", value: highRiskStaff },
        auditVerify: { label: "Daily audit verify", status: auditRun?.status || "not_run", value: auditRun?.verifiedInvoices || 0 },
        reconciliation: { label: "Nightly reconciliation", status: reconciliation.status, value: reconciliation.mismatchCount },
        siem: { label: "SIEM stream", status: tableExists("audit_log") || tableExists("fraud_alerts") ? "ready" : "setup_required", value: 0 }
      },
      auditVerify: {
        lastRun: auditRun,
        dueToday: auditRun?.runDate !== today()
      },
      reconciliation,
      staffRiskRows,
      exceptionRows,
      siem: {
        exportRoute: "/api/oversight/siem/export",
        sources: ["fraud_alerts", "audit_log", "invoice_audit_log", "oversight_audit_verify_runs"].filter(tableExists)
      }
    };
  },

  runAuditVerify(query = {}, access = {}) {
    ensureOversightCommandCenterSchema();
    const details = [];
    let warningCount = 0;
    let tamperCount = 0;
    const invoiceIds = recentInvoiceIds(access, query, Number(query.limit || 50));
    for (const invoiceId of invoiceIds) {
      try {
        const result = invoiceEventLedgerService.verify(invoiceId, { ...access, tenantId: tenantId(access) });
        const warnings = result.warnings || [];
        warningCount += warnings.length;
        tamperCount += warnings.filter((warning) => /mismatch/.test(String(warning.type || ""))).length;
        details.push({ invoiceId, ok: result.ok, eventCount: result.eventCount, warnings });
      } catch (error) {
        warningCount += 1;
        details.push({ invoiceId, ok: false, error: error.message });
      }
    }
    const run = {
      id: makeId("oav"),
      tenantId: tenantId(access),
      branchId: branchId(access, query),
      runDate: today(),
      status: tamperCount ? "tamper_alert" : warningCount ? "warning" : "clean",
      verifiedInvoices: invoiceIds.length,
      warningCount,
      tamperCount,
      detailsJson: JSON.stringify({ invoices: details }),
      createdBy: access.userId || access.user?.id || "system",
      createdAt: now()
    };
    db.prepare(
      `INSERT INTO oversight_audit_verify_runs
       (id, tenantId, branchId, runDate, status, verifiedInvoices, warningCount, tamperCount, detailsJson, createdBy, createdAt)
       VALUES (@id, @tenantId, @branchId, @runDate, @status, @verifiedInvoices, @warningCount, @tamperCount, @detailsJson, @createdBy, @createdAt)`
    ).run(run);
    return { ...run, details };
  },

  runDailyIfDue(access = {}) {
    const query = {};
    const latest = latestAuditRun(access, query);
    if (latest?.runDate === today()) return { skipped: true, latest };
    return this.runAuditVerify(query, { ...access, userId: access.userId || "oversight-daily-cron" });
  },

  siemExport(query = {}, access = {}) {
    const events = [];
    safeRows("fraud_alerts", access, query, 100).forEach((row) => events.push({ source: "fraud_alerts", type: row.alertType || row.alert_type || "fraud_alert", severity: row.severity || "medium", createdAt: row.createdAt || row.created_at, payload: row }));
    safeRows("audit_log", access, query, 100).forEach((row) => events.push({ source: "audit_log", type: row.action || row.eventType || "audit", severity: "info", createdAt: row.createdAt || row.created_at, payload: row }));
    safeRows("invoice_audit_log", access, query, 100).forEach((row) => events.push({ source: "invoice_audit_log", type: row.action || row.eventType || "invoice_audit", severity: "info", createdAt: row.createdAt || row.created_at, payload: row }));
    return { exportedAt: now(), tenantId: tenantId(access), branchId: branchId(access, query), events };
  }
};
