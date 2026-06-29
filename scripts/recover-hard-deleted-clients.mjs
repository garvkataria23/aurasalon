import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { columnsFor, db, insertRow } from "../server/db.js";

const apply = process.argv.includes("--apply");
const now = new Date().toISOString();
const __dirname = dirname(fileURLToPath(import.meta.url));
const root = join(__dirname, "..");
const outputsDir = join(root, "outputs");

function parseJsonField(value, fallback = {}) {
  let current = value;
  for (let index = 0; index < 4; index += 1) {
    if (typeof current !== "string") break;
    const text = current.trim();
    if (!text) return fallback;
    try {
      current = JSON.parse(text);
    } catch {
      return fallback;
    }
  }
  return current && typeof current === "object" && !Array.isArray(current) ? current : fallback;
}

function text(value) {
  return String(value ?? "").trim();
}

function arrayValue(value) {
  if (Array.isArray(value)) return value.filter(Boolean);
  const item = text(value);
  return item ? [item] : [];
}

function uniqueText(parts = []) {
  return [...new Set(parts.map((part) => text(part)).filter(Boolean))].join("\n");
}

function stampForFile(value) {
  return value.replace(/[:.]/g, "-");
}

function placeholders(ids) {
  const params = {};
  const names = ids.map((id, index) => {
    const key = `id${index}`;
    params[key] = id;
    return `@${key}`;
  });
  return { sql: names.join(", "), params };
}

function branchIdOrNull(branchId) {
  const id = text(branchId);
  if (!id) return null;
  const exists = db.prepare("SELECT id FROM branches WHERE id = @id LIMIT 1").get({ id });
  return exists ? id : null;
}

function chooseMigrationRows(rows) {
  const best = new Map();
  for (const row of rows) {
    const id = text(row.targetId);
    if (!id) continue;
    const current = best.get(id);
    if (!current || migrationScore(row) > migrationScore(current)) {
      best.set(id, row);
    }
  }
  return best;
}

function migrationScore(row) {
  const status = text(row.status).toLowerCase();
  const statusScore = status === "valid" ? 3_000_000_000_000 : status === "warning" ? 2_000_000_000_000 : 1_000_000_000_000;
  const payloadScore = text(row.payload) ? 20_000_000 : 0;
  const rawScore = text(row.raw) ? 10_000_000 : 0;
  const timeScore = Date.parse(row.updatedAt || row.createdAt || "") || 0;
  return statusScore + payloadScore + rawScore + timeScore;
}

function buildClientRow(event, migrationRow, clientColumns) {
  const payload = parseJsonField(migrationRow.payload, {});
  const raw = parseJsonField(migrationRow.raw, {});
  const deletedAt = text(event.deletedAt) || now;
  const reason = `Recovered as archived backend backup after client hard-delete audit event at ${deletedAt}.`;
  const client = {
    ...payload,
    id: event.targetId,
    tenantId: text(event.tenantId || payload.tenantId || raw.tenantId) || "tenant_aura",
    branchId: branchIdOrNull(event.branchId || payload.branchId || raw.branchId),
    name: text(payload.name || raw.name),
    phone: text(payload.phone || raw.phone),
    email: text(payload.email || raw.email),
    gender: text(payload.gender || raw.gender),
    birthday: text(payload.birthday || raw.birthday),
    anniversary: text(payload.anniversary || raw.anniversary),
    tags: Array.isArray(payload.tags) ? payload.tags : arrayValue(raw.tags),
    notes: uniqueText([payload.notes, raw.notes, reason]),
    deletedAt,
    deletedBy: text(event.actorUserId) || "recovery",
    deletedReason: reason,
    createdAt: text(payload.createdAt || raw.createdAt) || deletedAt,
    updatedAt: now,
    imported: payload.imported ?? 1,
    originalSystem: text(payload.originalSystem || raw.originalSystem) || "migration-recovery",
    originalRecordId: text(payload.originalRecordId || raw.originalRecordId),
    importedAt: text(payload.importedAt || raw.importedAt || migrationRow.createdAt) || now,
    importBatchId: text(payload.importBatchId || raw.importBatchId || migrationRow.batchId)
  };

  if (!client.name || !client.phone) {
    return { error: "Migration payload is missing required client name or phone" };
  }

  return {
    row: Object.fromEntries(
      Object.entries(client).filter(([key, value]) => clientColumns.includes(key) && value !== undefined)
    )
  };
}

function missingClientEvents() {
  return db.prepare(`
    SELECT
      s.tenantId,
      s.branchId,
      s.targetId,
      MAX(s.actorUserId) AS actorUserId,
      MIN(s.createdAt) AS firstDeletedAt,
      MAX(s.createdAt) AS deletedAt,
      COUNT(*) AS deleteEvents
    FROM security_audit_logs s
    LEFT JOIN clients c ON c.id = s.targetId
    WHERE s.action = @action
      AND s.targetType = @targetType
      AND c.id IS NULL
    GROUP BY s.tenantId, s.branchId, s.targetId
    ORDER BY deletedAt DESC
  `).all({ action: "client.deleted", targetType: "clients" });
}

function migrationRowsFor(ids) {
  if (!ids.length) return [];
  const selected = placeholders(ids);
  return db.prepare(`
    SELECT targetId, jobId, batchId, resource, entity, sourceRowNumber, status, payload, raw, createdAt, updatedAt
    FROM migration_row_results
    WHERE resource = @resource
      AND targetId IN (${selected.sql})
    ORDER BY targetId, updatedAt DESC, createdAt DESC
  `).all({ resource: "clients", ...selected.params });
}

function clientCounts() {
  return db.prepare(`
    SELECT
      COUNT(*) AS total,
      SUM(CASE WHEN deletedAt IS NOT NULL AND LENGTH(deletedAt) > 0 THEN 1 ELSE 0 END) AS archived,
      SUM(CASE WHEN deletedAt IS NULL OR LENGTH(deletedAt) = 0 THEN 1 ELSE 0 END) AS visible
    FROM clients
  `).get();
}

const clientColumns = columnsFor("clients");
const requiredArchiveColumns = ["deletedAt", "deletedBy", "deletedReason"];
const missingArchiveColumns = requiredArchiveColumns.filter((column) => !clientColumns.includes(column));
if (missingArchiveColumns.length) {
  console.error(JSON.stringify({ ok: false, error: "Client archive columns are missing", missingArchiveColumns }, null, 2));
  process.exit(1);
}

const beforeCounts = clientCounts();
const missingBefore = missingClientEvents();
const migrationRows = migrationRowsFor(missingBefore.map((event) => event.targetId));
const bestMigrationByClientId = chooseMigrationRows(migrationRows);
const recoverableBefore = missingBefore.filter((event) => bestMigrationByClientId.has(event.targetId));
const unrecoverableBefore = missingBefore.filter((event) => !bestMigrationByClientId.has(event.targetId));
const restoredClients = [];
const skippedRecoverable = [];

if (apply) {
  const restoreTransaction = db.transaction(() => {
    for (const event of recoverableBefore) {
      const existing = db.prepare("SELECT id FROM clients WHERE id = @id LIMIT 1").get({ id: event.targetId });
      if (existing) continue;
      const migrationRow = bestMigrationByClientId.get(event.targetId);
      const built = buildClientRow(event, migrationRow, clientColumns);
      if (built.error) {
        skippedRecoverable.push({ clientId: event.targetId, error: built.error, sourceRowNumber: migrationRow.sourceRowNumber || null });
        continue;
      }
      insertRow("clients", built.row);
      restoredClients.push({
        clientId: event.targetId,
        branchId: built.row.branchId || "",
        sourceJobId: migrationRow.jobId || "",
        sourceRowNumber: migrationRow.sourceRowNumber || null,
        deletedAt: built.row.deletedAt
      });
    }
  });
  restoreTransaction();
}

const missingAfter = missingClientEvents();
const afterCounts = clientCounts();
const report = {
  ok: true,
  applied: apply,
  generatedAt: now,
  summary: {
    totalClientRowsBefore: beforeCounts.total || 0,
    archivedClientRowsBefore: beforeCounts.archived || 0,
    visibleClientRowsBefore: beforeCounts.visible || 0,
    missingClientIdsBefore: missingBefore.length,
    recoverableFromMigrationBefore: recoverableBefore.length,
    unrecoverableBefore: unrecoverableBefore.length,
    restoredClientRows: restoredClients.length,
    skippedRecoverableRows: skippedRecoverable.length,
    missingClientIdsAfter: missingAfter.length,
    totalClientRowsAfter: afterCounts.total || 0,
    archivedClientRowsAfter: afterCounts.archived || 0,
    visibleClientRowsAfter: afterCounts.visible || 0
  },
  restoredClients,
  skippedRecoverable,
  unrecoverableMissingClientIds: missingAfter.map((event) => ({
    clientId: event.targetId,
    tenantId: event.tenantId,
    branchId: event.branchId,
    firstDeletedAt: event.firstDeletedAt,
    lastDeletedAt: event.deletedAt,
    deleteEvents: event.deleteEvents
  }))
};

mkdirSync(outputsDir, { recursive: true });
const reportPath = join(outputsDir, `client-delete-recovery-${stampForFile(now)}${apply ? "-applied" : "-dry-run"}.json`);
writeFileSync(reportPath, JSON.stringify(report, null, 2));

console.log(JSON.stringify({ ok: true, applied: apply, reportPath, summary: report.summary }, null, 2));