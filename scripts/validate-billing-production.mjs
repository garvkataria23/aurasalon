import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";
import Database from "better-sqlite3";
import "../server/config/env.js";

const root = process.cwd();
const strictLive = process.argv.includes("--strict-live");
const requiredFiles = [
  "server/db/migrations/20260521_enterprise_billing.sql",
  "server/db/migrations/20260521_offline_pos_sync.sql",
  "server/db/migrations/20260521_corporate_credit_billing.sql",
  "server/db/migrations/20260521_gift_cards_store_credit.sql",
  "server/db/migrations/20260521_discount_approval_coupon_abuse.sql",
  "server/db/migrations/20260521_invoice_event_ledger.sql",
  "server/db/migrations/20260521_terminal_device_management.sql",
  "server/db/migrations/20260521_print_barcode_devices.sql",
  "server/db/migrations/20260521_day_close_z_report.sql",
  "server/services/billing.service.js",
  "server/services/gst-tax.service.js",
  "server/services/payment.service.js",
  "server/services/refund.service.js",
  "server/services/day-close-lock.service.js",
  "server/services/offline-pos-sync.service.js",
  "server/routes/billing-health.routes.js"
];

const requiredTables = [
  "invoices",
  "invoice_items",
  "invoice_payments",
  "invoice_events",
  "invoice_locks",
  "offline_sync_queue",
  "corporate_accounts",
  "gift_cards",
  "discount_approval_requests",
  "pos_terminals",
  "print_jobs",
  "day_close_locks",
  "z_reports"
];

const critical = [];
const warnings = [];

for (const file of requiredFiles) {
  if (!existsSync(join(root, file))) critical.push(`Missing required file: ${file}`);
}

const migrationText = requiredFiles
  .filter((file) => file.endsWith(".sql") && existsSync(join(root, file)))
  .map((file) => readFileSync(join(root, file), "utf8"))
  .join("\n");

for (const table of requiredTables) {
  if (!migrationText.includes(`CREATE TABLE IF NOT EXISTS ${table}`)) {
    critical.push(`Missing migration table definition: ${table}`);
  }
  const tableBlock = migrationText.slice(migrationText.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`), migrationText.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`) + 700);
  if (!tableBlock.includes("tenant_id")) warnings.push(`${table} migration block should be reviewed for tenant_id`);
}

const dbPath = resolve(process.env.AURA_DB_PATH || join(root, "data", "salon-crm.sqlite"));
if (existsSync(dbPath)) {
  const db = new Database(dbPath, { readonly: true });
  for (const table of requiredTables) {
    const exists = db.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name = ?").get(table);
    if (!exists) {
      warnings.push(`${table} is not present in the live SQLite database; apply migrations before deployment`);
      continue;
    }
    const columns = db.prepare(`PRAGMA table_info(${table})`).all().map((row) => row.name);
    if (!columns.includes("tenant_id")) {
      const message = `${table} live table is missing tenant_id; apply the enterprise migration or run a controlled table rebuild`;
      if (strictLive) critical.push(message);
      else warnings.push(message);
    }
  }
  db.close();
} else {
  warnings.push("Live SQLite database not found; file-level readiness was checked only");
}

const report = {
  ok: critical.length === 0,
  checkedAt: new Date().toISOString(),
  critical,
  warnings
};

console.log(JSON.stringify(report, null, 2));
process.exit(critical.length ? 1 : 0);
