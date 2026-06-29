import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const route = readFileSync("server/routes/message-history-report.routes.js", "utf8");
const service = readFileSync("server/services/message-history-report.service.js", "utf8");
const app = readFileSync("server/app.js", "utf8");
const routes = readFileSync("src/app/app.routes.ts", "utf8");
const page = readFileSync("src/app/pages/message-history-report.component.ts", "utf8");
const literal = (value) => new RegExp(String(value).replace(/[.*+?^${}()|[\]\\]/g, "\\$&"));

test("message history report API is exposed and mounted", () => {
  assert.match(route, /\.get\("\/reports\/message-history"/, "route should expose message history endpoint");
  assert.match(route, /messageHistoryReportService\.report/, "route should call report service");
  assert.match(route, /requirePermission\("read",\s*\(\) => "reports"\)/, "route should require reports read permission");
  assert.match(app, /messageHistoryReportRouter/, "app should mount message history router");
});

test("message history service consolidates outbound message sources", () => {
  for (const token of [
    "message_logs",
    "whatsapp_messages",
    "engagement_messages",
    "invoice_notification_queue",
    "staff_notification_queue",
    "notifications",
    "summary",
    "rows",
    "sources"
  ]) {
    assert.match(service, literal(token), `missing backend token: ${token}`);
  }
});

test("message logs route opens automated message history page", () => {
  assert.match(routes, /path:\s*'message-logs'/, "message logs route should remain stable");
  assert.match(routes, /MessageHistoryReportComponent/, "message logs route should load dedicated component");
});

test("message history UI includes filters, cards, table and export", () => {
  for (const token of [
    "Automated Messages",
    "Message History",
    "All WhatsApp, SMS, email, invoice, engagement and staff notification logs",
    "Channel",
    "Status",
    "Source",
    "Template",
    "Send date & time",
    "Delivery",
    "CSV",
    "No message history found"
  ]) {
    assert.match(page, literal(token), `missing UI token: ${token}`);
  }
});
