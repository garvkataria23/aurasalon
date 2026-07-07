import { db } from "../db.js";
import { notFound } from "../utils/app-error.js";

const SOURCE_TABLES = [
  {
    source: "audit_logs",
    table: "audit_logs",
    tenantColumn: "tenantId",
    branchColumn: "branchId",
    createdColumn: "createdAt"
  },
  {
    source: "audit_log",
    table: "audit_log",
    tenantColumn: "tenant_id",
    branchColumn: "",
    createdColumn: "created_at"
  },
  {
    source: "security_audit_logs",
    table: "security_audit_logs",
    tenantColumn: "tenantId",
    branchColumn: "branchId",
    createdColumn: "createdAt"
  }
];

const HIGH_RISK_ACTIONS = ["delete", "deleted", "void", "refund", "restore", "approve", "reject", "failed", "denied", "blocked"];

const COLUMN_CACHE = new Map();

function tableExists(tableName) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @tableName").get({ tableName }));
}

function tableColumns(tableName) {
  if (!/^[a-zA-Z0-9_]+$/.test(tableName) || !tableExists(tableName)) return [];
  if (!COLUMN_CACHE.has(tableName)) {
    COLUMN_CACHE.set(tableName, db.prepare(`PRAGMA table_info(${tableName})`).all().map((column) => column.name));
  }
  return COLUMN_CACHE.get(tableName);
}

function firstColumn(columns, names) {
  return names.find((name) => columns.includes(name)) || "";
}

function selectExpr(columns, names, alias, fallback = "''") {
  const column = firstColumn(columns, names);
  return column ? `${column} AS ${alias}` : `${fallback} AS ${alias}`;
}

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    const parsed = JSON.parse(String(value));
    return parsed && typeof parsed === "object" ? parsed : fallback;
  } catch {
    return fallback;
  }
}

function compact(value) {
  return String(value || "").trim();
}

function lower(value) {
  return compact(value).toLowerCase();
}

function includesAny(value, terms) {
  const text = lower(value);
  return terms.some((term) => text.includes(term));
}

function detectLogType(row) {
  const action = lower(row.action);
  const entity = lower(row.entityType);
  if (action.includes("auth") || action.includes("login") || row.source === "security_audit_logs") return "Security";
  if (entity.includes("invoice") || entity.includes("payment") || action.includes("bill") || action.includes("refund")) return "Finance";
  if (entity.includes("client") || entity.includes("customer")) return "Client";
  if (entity.includes("appointment") || action.includes("booking")) return "Appointment";
  if (entity.includes("product") || entity.includes("inventory")) return "Inventory";
  return entity ? entity.replace(/(^|[-_ ])\w/g, (match) => match.toUpperCase()) : "System";
}

function detectSeverity(row) {
  const existing = compact(row.severity);
  if (existing) return existing;
  return includesAny(`${row.action} ${row.entityType}`, HIGH_RISK_ACTIONS) ? "warning" : "info";
}

function normalizeRow(row) {
  const beforePayload = safeJson(row.beforePayload || row.oldValue || row.details, {});
  const afterPayload = safeJson(row.afterPayload || row.newValue || row.details, {});
  const severity = detectSeverity(row);
  const logType = detectLogType({ ...row, severity });
  const activity = humanActivity({ ...row, logType });
  return {
    id: compact(row.id),
    source: compact(row.source),
    tenantId: compact(row.tenantId),
    branchId: compact(row.branchId),
    actorUserId: compact(row.actorUserId || row.userId || row.updatedBy || "system"),
    updatedBy: compact(row.updatedBy || row.actorUserId || row.userId || "System"),
    action: compact(row.action),
    activity,
    entityType: compact(row.entityType),
    entityId: compact(row.entityId),
    ipAddress: compact(row.ipAddress),
    userAgent: compact(row.userAgent),
    type: logType,
    severity,
    requestId: compact(row.requestId),
    createdAt: compact(row.createdAt),
    updatedAt: compact(row.updatedAt || row.createdAt),
    beforePayload,
    afterPayload,
    riskFlags: riskFlags({ ...row, severity, logType, activity, beforePayload, afterPayload })
  };
}

function humanActivity(row) {
  const action = compact(row.action);
  const entityType = compact(row.entityType);
  const entityId = compact(row.entityId);
  const actor = compact(row.updatedBy || row.actorUserId || row.userId || "System");
  if (!action) return `${actor} activity recorded`;
  if (action.startsWith("POST ")) return `${actor} created ${entityType || "record"}${entityId ? ` ${entityId}` : ""}`;
  if (action.startsWith("PATCH ") || action.startsWith("PUT ")) return `${actor} updated ${entityType || "record"}${entityId ? ` ${entityId}` : ""}`;
  if (action.startsWith("DELETE ")) return `${actor} deleted ${entityType || "record"}${entityId ? ` ${entityId}` : ""}`;
  return `${actor} ${action}`;
}

function riskFlags(row) {
  const flags = [];
  const actionText = `${row.action} ${row.activity} ${row.severity}`;
  if (includesAny(actionText, ["delete", "deleted", "void", "refund", "restore"])) flags.push("Sensitive record change");
  if (includesAny(actionText, ["failed", "denied", "blocked", "unauthorized"])) flags.push("Failed or blocked action");
  if (lower(row.severity).includes("critical") || lower(row.severity).includes("warning")) flags.push("Needs owner review");
  const hour = Number(String(row.createdAt || "").slice(11, 13));
  if (Number.isFinite(hour) && (hour < 8 || hour > 22)) flags.push("After-hours activity");
  return flags;
}

function activeSources() {
  return SOURCE_TABLES.map((source) => ({ ...source, columns: tableColumns(source.table) })).filter((source) => source.columns.length);
}

function sourceRows(source, query, access) {
  const columns = source.columns;
  const tenantExpr = source.tenantColumn && columns.includes(source.tenantColumn) ? source.tenantColumn : "";
  const branchExpr = source.branchColumn && columns.includes(source.branchColumn) ? source.branchColumn : "";
  const createdExpr = source.createdColumn && columns.includes(source.createdColumn) ? source.createdColumn : firstColumn(columns, ["createdAt", "created_at", "timestamp"]) || "id";
  const selected = [
    `'${source.source}' AS source`,
    selectExpr(columns, ["id"], "id"),
    tenantExpr ? `${tenantExpr} AS tenantId` : "'' AS tenantId",
    branchExpr ? `${branchExpr} AS branchId` : "'' AS branchId",
    selectExpr(columns, ["actorUserId", "actor_user_id", "user_id", "userId"], "actorUserId"),
    selectExpr(columns, ["actorName", "actor_name", "updatedBy", "updated_by", "user_name"], "updatedBy"),
    selectExpr(columns, ["action", "eventType", "event_type"], "action"),
    selectExpr(columns, ["entityType", "entity_type", "targetType", "target_type"], "entityType"),
    selectExpr(columns, ["entityId", "entity_id", "targetId", "target_id"], "entityId"),
    selectExpr(columns, ["severity"], "severity"),
    selectExpr(columns, ["details", "detailsJson", "details_json"], "details"),
    selectExpr(columns, ["old_value", "oldValue", "beforeJson", "before_json"], "beforePayload"),
    selectExpr(columns, ["new_value", "newValue", "afterJson", "after_json"], "afterPayload"),
    selectExpr(columns, ["ipAddress", "ip_address"], "ipAddress"),
    selectExpr(columns, ["userAgent", "user_agent"], "userAgent"),
    selectExpr(columns, ["requestId", "request_id"], "requestId"),
    `${createdExpr} AS createdAt`,
    selectExpr(columns, ["updatedAt", "updated_at"], "updatedAt", createdExpr)
  ];
  const where = [];
  const params = { tenantId: access.tenantId || "tenant_aura", branchId: query.branchId || "", from: query.from || "", to: query.to || "" };
  if (tenantExpr) where.push(`${tenantExpr} = @tenantId`);
  if (branchExpr) where.push("(@branchId = '' OR " + branchExpr + " = @branchId)");
  where.push("(@from = '' OR substr(" + createdExpr + ", 1, 10) >= @from)");
  where.push("(@to = '' OR substr(" + createdExpr + ", 1, 10) <= @to)");
  return db.prepare(`SELECT ${selected.join(", ")} FROM ${source.table} WHERE ${where.join(" AND ")} ORDER BY ${createdExpr} DESC LIMIT 1000`).all(params);
}

function filteredRows(query = {}, access = {}) {
  const q = lower(query.q);
  const type = lower(query.type || query.logType);
  const user = lower(query.user || query.userId);
  const ipAddress = lower(query.ipAddress);
  const entityType = lower(query.entityType);
  const severity = lower(query.severity);
  const rows = activeSources().flatMap((source) => sourceRows(source, query, access)).map(normalizeRow);
  return rows.filter((row) => {
    const haystack = lower(`${row.updatedBy} ${row.actorUserId} ${row.action} ${row.activity} ${row.entityType} ${row.entityId} ${row.ipAddress} ${row.type} ${row.severity} ${row.source}`);
    if (q && !haystack.includes(q)) return false;
    if (type && !lower(row.type).includes(type)) return false;
    if (user && !lower(`${row.updatedBy} ${row.actorUserId}`).includes(user)) return false;
    if (ipAddress && !lower(row.ipAddress).includes(ipAddress)) return false;
    if (entityType && !lower(row.entityType).includes(entityType)) return false;
    if (severity && !lower(row.severity).includes(severity)) return false;
    return true;
  }).sort((a, b) => String(b.createdAt).localeCompare(String(a.createdAt)));
}

function countBy(rows, predicate) {
  return rows.filter(predicate).length;
}

function uniqueOptions(rows, key, fallbackLabel = "All") {
  const values = [...new Set(rows.map((row) => compact(row[key])).filter(Boolean))].sort();
  return [{ label: fallbackLabel, value: "" }, ...values.slice(0, 80).map((value) => ({ label: value, value }))];
}

export const siteLogsService = {
  overview(query = {}, access = {}) {
    const rows = filteredRows(query, access);
    const highRisk = rows.filter((row) => row.riskFlags.length || includesAny(row.severity, ["warning", "critical"]));
    return {
      cards: [
        { key: "total", label: "Total logs", value: rows.length, detail: "Matched activity events" },
        { key: "client", label: "Client changes", value: countBy(rows, (row) => row.type === "Client"), detail: "Customer profile activity" },
        { key: "invoice", label: "Invoice changes", value: countBy(rows, (row) => row.type === "Finance"), detail: "Billing and payment events" },
        { key: "login", label: "Login/security", value: countBy(rows, (row) => row.type === "Security"), detail: "Access activity" },
        { key: "failed", label: "Failed actions", value: countBy(rows, (row) => includesAny(`${row.action} ${row.activity}`, ["failed", "denied", "blocked"])), detail: "Needs review" },
        { key: "risk", label: "High risk", value: highRisk.length, detail: "Warning or sensitive changes" }
      ],
      filters: {
        types: uniqueOptions(rows, "type", "All Types"),
        users: uniqueOptions(rows, "updatedBy", "All Users"),
        branches: uniqueOptions(rows, "branchId", "All Branches"),
        entities: uniqueOptions(rows, "entityType", "All Entities")
      },
      riskAlerts: highRisk.slice(0, 8),
      timeline: rows.slice(0, 12),
      sources: activeSources().map((source) => ({ source: source.source, table: source.table, columns: source.columns.length }))
    };
  },

  list(query = {}, access = {}) {
    const rows = filteredRows(query, access);
    const limit = Math.min(Number(query.limit) || 50, 500);
    const offset = Math.max(Number(query.offset) || 0, 0);
    return { rows: rows.slice(offset, offset + limit), total: rows.length, limit, offset };
  },

  detail(id, access = {}) {
    const rows = filteredRows({ limit: 1000 }, access);
    const row = rows.find((item) => item.id === id);
    if (!row) throw notFound("Site log not found");
    const timeline = rows.filter((item) => item.entityType === row.entityType && item.entityId === row.entityId).slice(0, 30);
    return { log: row, timeline };
  }
};
