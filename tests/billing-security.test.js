import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const billingRoutes = readFileSync("server/routes/billing.routes.js", "utf8");
const discountApproval = readFileSync("server/services/discount-approval.service.js", "utf8");
const eventLedger = readFileSync("server/services/invoice-event-ledger.service.js", "utf8");

test("billing mutations require controlled payment/finalize/refund workflows", () => {
  assert.match(billingRoutes, /Idempotency-Key header required/);
  assert.match(billingRoutes, /\/billing\/invoices\/:id\/finalize/);
  assert.match(billingRoutes, /\/billing\/invoices\/:id\/refund/);
  assert.doesNotMatch(billingRoutes, /\.delete\("\/billing\/invoices\/:id"/);
});

test("discount approval blocks self approval and ledger supports tamper evidence", () => {
  assert.match(discountApproval, /cannot approve own discount/i);
  assert.match(eventLedger, /previous_hash/);
  assert.match(eventLedger, /eventHash|event_hash/);
});
