import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const clientsComponent = readFileSync("src/app/pages/clients.component.ts", "utf8");

test("clients CRM layout keeps heavy sections inside scroll-safe panels", () => {
  assert.match(clientsComponent, /\.client-360-card-grid[\s\S]*max-height:\s*min\(560px,\s*58vh\);/, "metric cards should not stretch the full page");
  assert.match(clientsComponent, /\.client-360-card-grid[\s\S]*overflow-y:\s*auto;/, "metric cards should scroll inside the board");
  assert.match(clientsComponent, /\.client-database-panel \.table-wrap[\s\S]*max-height:\s*min\(780px,\s*72vh\);/, "client table should use an internal vertical scroll");
  assert.match(clientsComponent, /\.client-database-panel \.table-wrap[\s\S]*overflow:\s*auto;/, "client table should scroll inside the panel");
});

test("clients CRM table keeps actions visible while the table scrolls", () => {
  assert.match(clientsComponent, /\.client-database-panel \.clients-crm-table[\s\S]*min-width:\s*1360px;/, "table should preserve readable columns");
  assert.match(clientsComponent, /\.client-database-panel \.clients-crm-table thead th[\s\S]*position:\s*sticky;/, "table header should remain visible");
  assert.match(clientsComponent, /\.client-database-panel \.clients-crm-table th:last-child,[\s\S]*right:\s*0;/, "right action column should pin to the panel edge");
  assert.match(clientsComponent, /@media \(max-width: 1380px\)[\s\S]*\.client-database-panel \.table-toolbar[\s\S]*grid-template-columns:\s*1fr;/, "toolbar should stack before it crowds the right edge");
});
