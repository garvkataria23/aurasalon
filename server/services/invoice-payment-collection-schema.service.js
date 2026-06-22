import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { columnsFor, db } from "../db.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260530_invoice_payment_collection.sql");

function hasColumn(table, column) {
  try {
    return columnsFor(table).includes(column);
  } catch {
    return false;
  }
}

function ensureColumn(table, column, definition) {
  if (!hasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
  }
}

export function ensureInvoicePaymentCollectionSchema() {
  db.exec(readFileSync(migrationPath, "utf8"));

  ensureColumn("invoices", "online_paid_amount", "REAL DEFAULT 0");
  ensureColumn("invoices", "balance_due", "REAL DEFAULT 0");
  ensureColumn("invoices", "payment_link_id", "TEXT DEFAULT ''");
  ensureColumn("invoices", "paid_at", "TEXT DEFAULT ''");

  ensureColumn("payment_webhook_events", "branch_id", "TEXT DEFAULT ''");
  ensureColumn("payment_webhook_events", "invoice_id", "TEXT DEFAULT ''");
  ensureColumn("payment_webhook_events", "link_id", "TEXT DEFAULT ''");
  ensureColumn("payment_webhook_events", "provider_payment_id", "TEXT DEFAULT ''");
  ensureColumn("payment_webhook_events", "provider_link_id", "TEXT DEFAULT ''");
  ensureColumn("payment_webhook_events", "amount", "REAL DEFAULT 0");
  ensureColumn("payment_webhook_events", "signature_verified", "INTEGER DEFAULT 0");
  ensureColumn("payment_webhook_events", "updated_at", "TEXT DEFAULT ''");

  if (hasColumn("invoices", "balance") && hasColumn("invoices", "balance_due")) {
    db.prepare("UPDATE invoices SET balance_due = COALESCE(NULLIF(balance_due, 0), balance, due_amount, 0)").run();
  }
  db.prepare("CREATE INDEX IF NOT EXISTS idx_invoices_tenant_balance_due ON invoices(tenant_id, branch_id, balance_due)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_invoices_tenant_payment_link ON invoices(tenant_id, payment_link_id)").run();
}
