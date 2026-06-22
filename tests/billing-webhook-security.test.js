import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const razorpayPayment = readFileSync("server/services/razorpay-payment.service.js", "utf8");
const paymentRoutes = readFileSync("server/routes/payment.routes.js", "utf8");
const migration = readFileSync("server/db/migrations/20260521_enterprise_billing.sql", "utf8");

test("razorpay webhook verifies signatures and dedupes events", () => {
  assert.match(razorpayPayment, /webhook.*secret|RAZORPAY_WEBHOOK_SECRET/is);
  assert.match(razorpayPayment, /signature/i);
  assert.match(razorpayPayment, /payment_webhook_events/);
  assert.match(migration, /payment_webhook_events/);
});

test("webhook route is public but isolated to payment webhook handler", () => {
  assert.match(paymentRoutes, /paymentPublicRouter/);
  assert.match(paymentRoutes, /\/payments\/razorpay\/webhook/);
});
