import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const app = readFileSync("server/app.js", "utf8");
const route = readFileSync("server/routes/due-recovery-report.routes.js", "utf8");
const service = readFileSync("server/services/due-recovery-report.service.js", "utf8");
const schema = readFileSync("server/services/due-recovery-followup-schema.service.js", "utf8");
const page = readFileSync("src/app/pages/invoice-reports.component.ts", "utf8");

test("due recovery report API is mounted and permissioned", () => {
  assert.match(app, /dueRecoveryReportRouter/, "app should import and mount due recovery router");
  assert.match(app, /ensureDueRecoveryFollowupSchema/, "app should register add-only due follow-up schema");
  assert.match(app, /app\.use\("\/api\/v1",\s*dueRecoveryReportRouter\)/, "v1 API should expose due recovery report");
  assert.match(app, /app\.use\("\/api",\s*dueRecoveryReportRouter\)/, "legacy API should expose due recovery report");
  assert.match(route, /GET|\.get\("\/reports\/invoices\/due-recovery"/, "route should expose due recovery GET endpoint");
  assert.match(route, /requirePermission\("read",\s*\(\) => "reports"\)/, "report read should require reports permission");
  assert.match(route, /send-reminder/, "route should expose manual reminder endpoint");
  assert.match(route, /assign-manager/, "route should expose assign manager endpoint");
  assert.match(route, /mark-call-done/, "route should expose call done endpoint");
  assert.match(route, /follow-up-note/, "route should expose follow-up note endpoint");
  assert.match(route, /requirePermission\("write",\s*\(\) => "payments"\)/, "reminder should require payment write permission");
});

test("due recovery follow-up schema is additive and tenant scoped", () => {
  assert.match(schema, /CREATE TABLE IF NOT EXISTS due_recovery_followups/, "follow-up ledger should be add-only schema bootstrap");
  assert.match(schema, /tenantId TEXT NOT NULL/, "follow-up ledger should include tenantId");
  assert.match(schema, /branchId TEXT DEFAULT ''/, "follow-up ledger should include branchId");
  assert.match(schema, /invoiceId TEXT NOT NULL/, "follow-up ledger should include invoiceId");
  assert.match(schema, /managerId TEXT DEFAULT ''/, "follow-up ledger should include managerId");
  assert.match(schema, /createdAt TEXT NOT NULL/, "follow-up ledger should timestamp every action");
});

test("due recovery service computes dashboard rows and reuses payment reminders", () => {
  assert.match(service, /invoicePaymentCollectionService\.reminder/, "manual reminders should reuse existing payment reminder flow");
  assert.match(service, /agingBucket\(age\)/, "rows should expose 0-10, 11-20 and 21+ aging buckets");
  assert.match(service, /totalPendingDue/, "summary should include pending due totals");
  assert.match(service, /callFollowUpPending/, "summary should include manager call queue");
  assert.match(service, /dailyFollowUpDueToday/, "summary should include daily follow-up queue");
  assert.match(service, /partialPaymentHistory/, "rows should expose partial payment history");
  assert.match(service, /settlementPaymentId/, "rows should expose settlement payment id");
  assert.match(service, /receivedBy/, "rows should expose receiver details");
  assert.match(service, /callFollowUpStatus/, "rows should expose call follow-up status");
  assert.match(service, /assignManager/, "service should support assign manager action");
  assert.match(service, /markCallDone/, "service should support call done action");
  assert.match(service, /addFollowupNote/, "service should support note action");
  assert.match(service, /Client phone missing/, "service should block reminders when client phone is missing");
  assert.match(service, /Closed invoices cannot receive reminders/, "service should block closed invoices");
  assert.match(service, /payment_link_due_reminder/, "service should pass the due reminder message type");
});

test("invoice reports page exposes due recovery UI and reminder action", () => {
  assert.match(page, /id:\s*'due-recovery'/, "invoice reports should include Due Recovery tab");
  assert.match(page, /dueRecoverySummary/, "UI should render due recovery summary cards");
  assert.match(page, /Call follow-up pending/, "UI should render manager call KPI");
  assert.match(page, /Daily follow-up due today/, "UI should render daily follow-up KPI");
  assert.match(page, /Send payment reminder/, "UI should expose manual reminder action");
  assert.match(page, /Assign manager/, "UI should expose assign manager action");
  assert.match(page, /Mark call done/, "UI should expose call done action");
  assert.match(page, /Add note/, "UI should expose follow-up note action");
  assert.match(page, /recoveryOwnerFilter/, "UI should filter by recovery owner");
  assert.match(page, /followUpStatusFilter/, "UI should filter by follow-up status");
  assert.match(page, /settlementPaymentId/, "UI should include settlement payment id column");
  assert.match(page, /Client phone missing/, "UI should explain disabled reminder when phone is missing");
  assert.match(page, /reports\/invoices\/due-recovery\/\$\{invoiceId\}\/send-reminder/, "UI should call the report reminder endpoint");
  assert.match(page, /reports\/invoices\/due-recovery\/\$\{invoiceId\}\/assign-manager/, "UI should call assign manager endpoint");
  assert.match(page, /reports\/invoices\/due-recovery\/\$\{invoiceId\}\/mark-call-done/, "UI should call call done endpoint");
  assert.match(page, /reports\/invoices\/due-recovery\/\$\{invoiceId\}\/follow-up-note/, "UI should call note endpoint");
  assert.match(page, /routerLink\]="\['\/pos\/invoices'\]"/, "UI should keep open invoice/receive due actions on POS invoices");
});
