import { db, tableHasColumn } from "../db.js";
import { logger } from "../utils/logger.js";

const COLUMNS = [
  ["totpSecret", "TEXT DEFAULT ''"],
  ["totpEnabled", "INTEGER DEFAULT 0"],
  ["totpPendingSecret", "TEXT DEFAULT ''"],
  ["totpRecoveryCodes", "TEXT DEFAULT '[]'"],
  ["totpVerifiedAt", "TEXT DEFAULT ''"]
];

let ensured = false;

function hasColumn(table, column) {
  if (typeof tableHasColumn === "function") return tableHasColumn(table, column);
  return db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
}

export function ensureTwoFactorSchema() {
  if (ensured) return;
  for (const [column, definition] of COLUMNS) {
    if (!hasColumn("tenant_users", column)) {
      db.prepare(`ALTER TABLE tenant_users ADD COLUMN ${column} ${definition}`).run();
    }
  }
  ensured = true;
  logger.info("two_factor_schema_ensured", { table: "tenant_users", columns: COLUMNS.map(([column]) => column) });
}
