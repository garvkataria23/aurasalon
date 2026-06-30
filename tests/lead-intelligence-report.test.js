import { readFileSync } from "node:fs";
import test from "node:test";
import assert from "node:assert/strict";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

test("lead intelligence backend routes are additive", () => {
  const routes = read("server/routes/engagement.routes.js");
  assert.match(routes, /engagementLeadIntelligenceService/);
  assert.match(routes, /\/engagement\/leads\/report/);
  assert.match(routes, /\/engagement\/leads\/:id\/assign/);
  assert.match(routes, /\/engagement\/leads\/:id\/follow-up-note/);
  assert.match(routes, /\/engagement\/leads\/:id\/mark-won/);
  assert.match(routes, /\/engagement\/leads\/:id\/mark-lost/);
  assert.match(routes, /\/engagement\/threads\/:id/);
});

test("lead intelligence service reuses lead sources and append-only actions", () => {
  const service = read("server/services/engagement-lead-intelligence.service.js");
  assert.match(service, /engagement_threads/);
  assert.match(service, /whatsapp_threads/);
  assert.match(service, /engagementLeadActions/);
  assert.match(service, /leadTemperature/);
  assert.match(service, /conversionRate/);
  assert.match(service, /overdueFollowUps/);
  assert.match(service, /revenueFromLeads/);
});

test("lead action schema is added through engagement wrapper", () => {
  const schema = read("server/services/engagement-schema.service.js");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS engagementLeadActions/);
  assert.match(schema, /tenantId TEXT NOT NULL/);
  assert.match(schema, /branchId TEXT NOT NULL/);
  assert.doesNotMatch(schema, /ALTER TABLE/);
});

test("engagement UI exposes lead report, filters, cards and actions", () => {
  const ui = read("src/app/pages/engagement-command-center.component.ts");
  assert.match(ui, /Lead Intelligence/);
  assert.match(ui, /engagement\/leads\/report/);
  assert.match(ui, /Total leads/);
  assert.match(ui, /Hot leads/);
  assert.match(ui, /Pending follow-up/);
  assert.match(ui, /Won leads/);
  assert.match(ui, /Lost leads/);
  assert.match(ui, /Conversion rate/);
  assert.match(ui, /Lead revenue/);
  assert.match(ui, /Overdue/);
  assert.match(ui, /Top source/);
  assert.match(ui, /leadSourceFilter/);
  assert.match(ui, /leadFollowUpFilter/);
  assert.match(ui, /assignLead/);
  assert.match(ui, /markLeadWon/);
  assert.match(ui, /markLeadLost/);
  assert.match(ui, /exportLeadCsv/);
});

test("reports command center links to engagement lead report", () => {
  const reports = read("src/app/pages/reports.component.ts");
  assert.match(reports, /Leads Report/);
  assert.match(reports, /path: '\/engagement'/);
  assert.match(reports, /queryParams: \{ tab: 'leads' \}/);
});
