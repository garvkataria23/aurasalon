import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let ensured = false;

export function ensureSupplierCommandSchema() {
  if (ensured) return;
  ensureColumn("suppliers", "statusReason", "TEXT DEFAULT ''");
  ensureColumn("suppliers", "statusHistory", "TEXT DEFAULT '[]'");
  ensureColumn("suppliers", "statusChangedAt", "TEXT DEFAULT ''");
  ensureColumn("suppliers", "preferredPaymentTerms", "TEXT DEFAULT ''");
  ensureColumn("suppliers", "leadTimeDays", "INTEGER DEFAULT 0");
  db.prepare("CREATE INDEX IF NOT EXISTS idx_suppliers_status ON suppliers(tenantId, status)").run();
  ensured = true;
  logger.info("supplier_command_schema_ensured");
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (columns.includes(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
