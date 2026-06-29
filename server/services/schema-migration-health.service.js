import { existsSync, readdirSync, readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationsDir = join(__dirname, "..", "db", "migrations");

let lastHealth = null;

function now() {
  return new Date().toISOString();
}

function ensureRegistryTable() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS schema_migrations (
      id TEXT PRIMARY KEY,
      fileName TEXT NOT NULL UNIQUE,
      status TEXT NOT NULL,
      tableNamesJson TEXT NOT NULL DEFAULT '[]',
      missingTablesJson TEXT NOT NULL DEFAULT '[]',
      note TEXT NOT NULL DEFAULT '',
      checkedAt TEXT NOT NULL,
      appliedAt TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT '',
      updatedAt TEXT NOT NULL DEFAULT ''
    )
  `).run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_schema_migrations_status ON schema_migrations (status, checkedAt)").run();
}

function listMigrationFiles() {
  if (!existsSync(migrationsDir)) return [];
  return readdirSync(migrationsDir)
    .filter((name) => name.toLowerCase().endsWith(".sql"))
    .sort((a, b) => a.localeCompare(b));
}

function extractCreateTableNames(sql) {
  const ddl = sql
    .replace(/\/\*[\s\S]*?\*\//g, " ")
    .split(/\r?\n/)
    .map((line) => line.replace(/--.*$/, ""))
    .join("\n");
  const tableNames = [];
  const tablePattern = /CREATE\s+TABLE\s+(?:IF\s+NOT\s+EXISTS\s+)?["`\[]?([A-Za-z0-9_]+)["`\]]?/gi;
  let match = tablePattern.exec(ddl);
  while (match) {
    tableNames.push(match[1]);
    match = tablePattern.exec(ddl);
  }
  return [...new Set(tableNames)];
}

function tableExists(tableName) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(tableName));
}

function statusForTables(tableNames, missingTables) {
  if (!tableNames.length) return "reference";
  if (!missingTables.length) return "covered";
  if (missingTables.length === tableNames.length) return "pending";
  return "partial";
}

function upsertMigrationRecord(record) {
  const existing = db.prepare("SELECT id, appliedAt, createdAt FROM schema_migrations WHERE fileName = ?").get(record.fileName);
  const checkedAt = now();
  const payload = {
    id: existing?.id || `sm_${record.fileName.replace(/[^A-Za-z0-9]+/g, "_").replace(/^_+|_+$/g, "")}`,
    fileName: record.fileName,
    status: record.status,
    tableNamesJson: JSON.stringify(record.tableNames),
    missingTablesJson: JSON.stringify(record.missingTables),
    note: record.note,
    checkedAt,
    appliedAt: record.status === "covered" ? (existing?.appliedAt || checkedAt) : (existing?.appliedAt || ""),
    createdAt: existing?.createdAt || checkedAt,
    updatedAt: checkedAt
  };

  db.prepare(`
    INSERT INTO schema_migrations (
      id, fileName, status, tableNamesJson, missingTablesJson, note, checkedAt, appliedAt, createdAt, updatedAt
    ) VALUES (
      @id, @fileName, @status, @tableNamesJson, @missingTablesJson, @note, @checkedAt, @appliedAt, @createdAt, @updatedAt
    )
    ON CONFLICT(fileName) DO UPDATE SET
      status = excluded.status,
      tableNamesJson = excluded.tableNamesJson,
      missingTablesJson = excluded.missingTablesJson,
      note = excluded.note,
      checkedAt = excluded.checkedAt,
      appliedAt = CASE
        WHEN excluded.status = 'covered' AND schema_migrations.appliedAt = '' THEN excluded.checkedAt
        ELSE schema_migrations.appliedAt
      END,
      updatedAt = excluded.updatedAt
  `).run(payload);
}

export function initializeSchemaMigrationHealth() {
  ensureRegistryTable();
  const files = listMigrationFiles();
  const records = files.map((fileName) => {
    const sql = readFileSync(join(migrationsDir, fileName), "utf8");
    const tableNames = extractCreateTableNames(sql);
    const missingTables = tableNames.filter((tableName) => !tableExists(tableName));
    const status = statusForTables(tableNames, missingTables);
    const note = status === "covered"
      ? "All declared tables are present through startup schema services or prior manual migration."
      : status === "reference"
        ? "No CREATE TABLE statement found; kept as reference migration."
        : "Declared tables are not fully present; do not run blindly without owner review.";
    const record = { fileName, status, tableNames, missingTables, note };
    upsertMigrationRecord(record);
    return record;
  });

  const summary = {
    checkedAt: now(),
    total: records.length,
    covered: records.filter((record) => record.status === "covered").length,
    partial: records.filter((record) => record.status === "partial").length,
    pending: records.filter((record) => record.status === "pending").length,
    reference: records.filter((record) => record.status === "reference").length,
    missingTables: records.flatMap((record) =>
      record.missingTables.map((tableName) => ({ fileName: record.fileName, tableName }))
    )
  };

  lastHealth = { summary, records };
  if (summary.pending || summary.partial) {
    console.warn(
      `[schema-health] ${summary.pending} pending and ${summary.partial} partial SQL migrations detected. Review /api/v1/admin/schema-health before enabling affected modules.`
    );
  }
  return lastHealth;
}

export function getSchemaMigrationHealth() {
  if (!lastHealth) return initializeSchemaMigrationHealth();
  return lastHealth;
}
