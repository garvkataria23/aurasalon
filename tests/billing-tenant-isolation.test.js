import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migrations = [
  "server/db/migrations/20260521_enterprise_billing.sql",
  "server/db/migrations/20260521_offline_pos_sync.sql",
  "server/db/migrations/20260521_corporate_credit_billing.sql",
  "server/db/migrations/20260521_gift_cards_store_credit.sql",
  "server/db/migrations/20260521_discount_approval_coupon_abuse.sql",
  "server/db/migrations/20260521_invoice_event_ledger.sql",
  "server/db/migrations/20260521_terminal_device_management.sql",
  "server/db/migrations/20260521_print_barcode_devices.sql",
  "server/db/migrations/20260521_day_close_z_report.sql"
].map((file) => readFileSync(file, "utf8")).join("\n");

const billingServices = [
  "server/services/offline-pos-sync.service.js",
  "server/services/corporate-account.service.js",
  "server/services/gift-card.service.js",
  "server/services/invoice-event-ledger.service.js",
  "server/services/terminal.service.js",
  "server/services/print-device.service.js",
  "server/services/day-close-lock.service.js"
].map((file) => readFileSync(file, "utf8")).join("\n");

test("prompt 16-25 billing tables are tenant scoped", () => {
  const tables = ["offline_sync_queue", "corporate_accounts", "gift_cards", "discount_approval_requests", "invoice_events", "pos_terminals", "print_jobs", "day_close_locks", "z_reports"];
  for (const table of tables) {
    const start = migrations.indexOf(`CREATE TABLE IF NOT EXISTS ${table}`);
    assert.notEqual(start, -1, `${table} migration missing`);
    assert.match(migrations.slice(start, start + 700), /tenant_id TEXT NOT NULL/, `${table} missing tenant_id`);
  }
});

test("billing services filter tenant_id in database access", () => {
  assert.match(billingServices, /WHERE tenant_id = \?/);
  assert.match(billingServices, /access\.tenantId/);
});
