import { columnsFor, db } from "../db.js";

let ensured = false;

const TARGET_TABLES = [
  "clients",
  "staff",
  "services",
  "products",
  "inventory_transactions",
  "suppliers",
  "finance_expenses",
  "memberships",
  "appointments",
  "sales",
  "invoices",
  "payments"
];

const MIGRATION_COLUMNS = [
  ["imported", "INTEGER DEFAULT 0"],
  ["originalSystem", "TEXT DEFAULT ''"],
  ["originalRecordId", "TEXT DEFAULT ''"],
  ["importedAt", "TEXT DEFAULT ''"],
  ["importBatchId", "TEXT DEFAULT ''"]
];

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function ensureColumn(table, columns, column, definition) {
  if (!columns.includes(column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

function ensureRollbackIndex(table) {
  const columns = safeColumns(table);
  if (!columns.includes("importBatchId")) return;
  const tenantColumn = columns.includes("tenantId") ? "tenantId" : columns.includes("tenant_id") ? "tenant_id" : "";
  const fields = tenantColumn ? `${tenantColumn}, importBatchId` : "importBatchId";
  db.prepare(`CREATE INDEX IF NOT EXISTS idx_${table}_migration_batch ON ${table} (${fields})`).run();
}

export function ensureMigrationTargetMetadataSchema() {
  if (ensured) return;
  for (const table of TARGET_TABLES) {
    const columns = safeColumns(table);
    if (!columns.length) continue;
    for (const [column, definition] of MIGRATION_COLUMNS) {
      ensureColumn(table, columns, column, definition);
      if (!columns.includes(column)) columns.push(column);
    }
    ensureRollbackIndex(table);
  }
  ensured = true;
}
