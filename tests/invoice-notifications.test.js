import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const root = new URL("../", import.meta.url);
const read = (path) => readFileSync(new URL(path, root), "utf8");

test("invoice notification migration is tenant safe and idempotent", () => {
  const sql = read("server/db/migrations/20260524_invoice_notifications.sql");
  assert.match(sql, /CREATE TABLE IF NOT EXISTS business_notification_profiles/);
  assert.match(sql, /CREATE TABLE IF NOT EXISTS invoice_notification_queue/);
  assert.match(sql, /tenant_id TEXT NOT NULL/);
  assert.match(sql, /branch_id TEXT NOT NULL DEFAULT ''/);
  assert.match(sql, /idx_invoice_notification_queue_unique_recipient/);
});

test("invoice close queues client and owner notifications", () => {
  const service = read("server/services/invoice-notification.service.js");
  const operations = read("server/services/salon-operations.service.js");
  const billing = read("server/controllers/billing.controller.js");
  const routes = read("server/routes/invoice-notification.routes.js");

  assert.match(service, /clientMessages\(ctx\)/);
  assert.match(service, /ownerMessages\(ctx\)/);
  assert.match(service, /function normalizeIndianPhone/);
  assert.match(service, /function normalizeRecipientAddress/);
  assert.match(service, /\+91\$\{digits\.slice\(1\)\}/);
  assert.match(service, /business_notification_profiles/);
  assert.match(service, /invoice_notification_queue/);
  assert.match(operations, /invoiceNotificationService\.queueForPosInvoice/);
  assert.match(billing, /invoiceNotificationService\.queueForInvoice/);
  assert.match(routes, /invoice-notifications\/profile/);
  assert.match(routes, /invoice-notifications\/queue/);
});

test("business details page is routed for invoice notification settings", () => {
  const routes = read("src/app/app.routes.ts");
  const nav = read("src/app/app.component.ts");
  const page = read("src/app/pages/business-details.component.ts");

  assert.match(routes, /business-details/);
  assert.match(nav, /Business Details/);
  assert.match(page, /invoice-notifications\/profile/);
  assert.match(page, /Client channels/);
  assert.match(page, /Owner channels/);
});
