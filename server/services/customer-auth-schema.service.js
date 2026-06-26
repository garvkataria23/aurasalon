import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db, tableHasColumn } from "../db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260622_customer_auth_codes.sql");

let ensured = false;

export function ensureCustomerAuthSchema() {
  if (ensured) return;
  db.exec(readFileSync(migrationPath, "utf8"));
  ensureClientColumn("firebaseUid", "TEXT DEFAULT ''");
  ensureClientColumn("authProvider", "TEXT DEFAULT ''");
  ensureClientColumn("lastLoginAt", "TEXT DEFAULT ''");
  ensureClientColumn("phoneVerifiedAt", "TEXT DEFAULT ''");
  ensureClientColumn("emailVerifiedAt", "TEXT DEFAULT ''");
  db.prepare("CREATE INDEX IF NOT EXISTS idx_clients_customer_firebase_uid ON clients(tenantId, firebaseUid)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_clients_customer_phone ON clients(tenantId, phone)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_clients_customer_email ON clients(tenantId, email)").run();
  ensured = true;
}
function ensureClientColumn(column, definition) {
  if (!tableHasColumn("clients", column)) {
    db.prepare(`ALTER TABLE clients ADD COLUMN ${column} ${definition}`).run();
  }
}

