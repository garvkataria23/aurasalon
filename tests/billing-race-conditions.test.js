import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const enterpriseMigration = readFileSync("server/db/migrations/20260521_enterprise_billing.sql", "utf8");
const offlineMigration = readFileSync("server/db/migrations/20260521_offline_pos_sync.sql", "utf8");
const paymentService = readFileSync("server/services/payment.service.js", "utf8");
const billingService = readFileSync("server/services/billing.service.js", "utf8");
const offlineSync = readFileSync("server/services/offline-pos-sync.service.js", "utf8");

test("invoice number and offline operation ids have duplicate prevention", () => {
  assert.match(enterpriseMigration, /UNIQUE \(tenant_id, branch_id, financial_year, invoice_no\)/);
  assert.match(offlineMigration, /id TEXT PRIMARY KEY/);
  assert.match(offlineSync, /duplicate: true/);
});

test("payments guard against overpayment race outcomes", () => {
  assert.match(paymentService, /overpay|exceed|Total paid cannot exceed/i);
  assert.match(billingService, /db\.transaction/);
});
