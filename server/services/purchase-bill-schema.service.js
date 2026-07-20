import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260530_purchase_bill_drafts.sql");
let ensured = false;

export function ensurePurchaseBillDraftSchema() {
  if (ensured) return;
  db.exec(readFileSync(migrationPath, "utf8"));
  ensureColumn("purchase_bill_drafts", "supplier_phone", "TEXT DEFAULT ''");
  ensureColumn("purchase_bill_drafts", "supplier_email", "TEXT DEFAULT ''");
  ensureColumn("purchase_bill_drafts", "supplier_address", "TEXT DEFAULT ''");
  ensureColumn("purchase_bill_drafts", "purchase_order_id", "TEXT DEFAULT ''");
  ensureColumn("purchase_bill_drafts", "po_match_json", "TEXT DEFAULT '{}'");
  ensureColumn("purchase_bill_drafts", "cgst_amount", "REAL DEFAULT 0");
  ensureColumn("purchase_bill_drafts", "sgst_amount", "REAL DEFAULT 0");
  ensureColumn("purchase_bill_drafts", "igst_amount", "REAL DEFAULT 0");
  ensureColumn("purchase_bill_draft_items", "match_suggestions_json", "TEXT DEFAULT '[]'");
  ensureColumn("purchase_bill_draft_items", "hsn_sac", "TEXT DEFAULT ''");
  ensureColumn("purchase_bill_draft_items", "discount_percent", "REAL DEFAULT 0");
  ensureColumn("purchase_bill_draft_items", "discount_amount", "REAL DEFAULT 0");
  ensureColumn("purchase_bill_draft_items", "cgst_amount", "REAL DEFAULT 0");
  ensureColumn("purchase_bill_draft_items", "sgst_amount", "REAL DEFAULT 0");
  ensureColumn("purchase_bill_draft_items", "igst_amount", "REAL DEFAULT 0");
  ensured = true;
  logger.info("purchase_bill_draft_schema_ensured", {
    migration: migrationPath.split(/[\\/]/).pop()
  });
}

function ensureColumn(table, column, definition) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((item) => item.name);
  if (columns.includes(column)) return;
  db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}
