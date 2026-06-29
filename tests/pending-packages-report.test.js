import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const read = (path) => readFileSync(path, "utf8");

test("pending packages backend route and report logic are wired", () => {
  const app = read("server/app.js");
  const route = read("server/routes/pending-packages-report.routes.js");
  const service = read("server/services/pending-packages-report.service.js");

  assert.match(route, /"\/reports\/pending-packages"/, "route should expose reports/pending-packages");
  assert.match(route, /"\/reports\/expired-packages"/, "route should expose reports/expired-packages");
  assert.match(route, /"\/reports\/completed-packages"/, "route should expose reports/completed-packages");
  assert.match(route, /requirePermission\("read",\s*\(\) => "reports"\)/, "route should require reports read permission");
  assert.match(app, /pendingPackagesReportRouter/, "app should import pending packages report router");
  assert.match(app, /app\.use\("\/api\/v1",\s*pendingPackagesReportRouter\)/, "v1 API should mount pending packages report");
  assert.match(app, /app\.use\("\/api",\s*pendingPackagesReportRouter\)/, "legacy API should mount pending packages report");

  assert.match(service, /startsWith\("pkgmem_"\)/, "package membership should be detected by pkgmem id");
  assert.match(service, /startsWith\("package:"\)/, "package membership should be detected by package plan name");
  assert.match(service, /packageId/, "package membership should be detected from credits or redeem history package id");
  assert.match(service, /pendingQty\s*=\s*money\(Math\.max\(0,\s*totalQty - redeemedQty\)\)/, "pending qty should be total minus redeemed");
  assert.match(service, /pendingServicesPrice:\s*money\(pendingQty \* price\)/, "pending value should use pending qty times price");
  assert.match(service, /status === "expiring"/, "expiring status filter should exist");
  assert.match(service, /status === "expired"/, "expired status filter should exist");
  assert.match(service, /buildExpiredSummary/, "expired package report should summarize package rows");
  assert.match(service, /completed\(query = \{\}, access = \{\}\)/, "completed package report method should exist");
  assert.match(service, /if \(pendingQty > 0\) return;/, "completed package rows should require zero pending quantity");
  assert.match(service, /buildCompletedSummary/, "completed package report should summarize completed rows");
});

test("pending packages frontend page exposes Salonist-style report controls", () => {
  const routes = read("src/app/app.routes.ts");
  const page = read("src/app/pages/pending-packages-report.component.ts");
  const packages = read("src/app/pages/packages.component.ts");

  assert.match(routes, /reports\/pending-packages/, "Angular route should exist");
  assert.match(packages, /routerLink="\/reports\/pending-packages"/, "packages page should link to pending packages report");

  for (const label of [
    "Pending Packages",
    "Run Report",
    "Download CSV",
    "Total Service",
    "Services Amount",
    "Pending Services Amount",
    "Pending Qty",
    "Redeemed Qty",
    "Expiring Packages",
    "Expired Pending Packages",
    "Name",
    "Contact",
    "Package",
    "Service Name",
    "Price",
    "Total Qty",
    "Redeemed Qty",
    "Pending Services Price",
    "Expired On",
    "No data found"
  ]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing UI label ${label}`);
  }

  assert.match(page, /placeholder="Client, contact, package, service"/, "search input should cover report fields");
  assert.match(page, /\[\(ngModel\)\]="limit"/, "page size selector should drive limit");
  assert.match(page, /pending-table-wrap[\s\S]*overflow:\s*auto/, "horizontal overflow should stay inside the table container");
  assert.match(page, /\/whatsapp/, "reminder action should deep-link to WhatsApp surface");
  assert.match(page, /\/pos\/invoices/, "invoice action should deep-link to invoice register");
  assert.match(page, /\/clients/, "client action should deep-link to client profile");
});

test("expired packages frontend page matches the package expiry report shape", () => {
  const routes = read("src/app/app.routes.ts");
  const reports = read("src/app/pages/reports.component.ts");
  const page = read("src/app/pages/expired-packages-report.component.ts");

  assert.match(routes, /reports\/expired-packages/, "Angular route should exist");
  assert.match(reports, /Expired Packages/, "reports command center should link to expired packages");

  for (const label of [
    "Expired Packages",
    "Run Report",
    "Download",
    "Total Packages",
    "Packages Amount",
    "Total Services",
    "Pending Services",
    "Name",
    "Contact",
    "Package",
    "Price",
    "No. of Pending Services",
    "Date",
    "Expired On",
    "No data found"
  ]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing UI label ${label}`);
  }

  assert.match(page, /placeholder="Customer, contact, package"/, "search input should cover expired report fields");
  assert.match(page, /report<ExpiredPackagesReport>\('expired-packages'/, "page should call expired packages API report");
  assert.match(page, /expired-packages-report\.csv/, "download should export expired packages CSV");
});

test("completed packages frontend page matches the completed package report shape", () => {
  const routes = read("src/app/app.routes.ts");
  const page = read("src/app/pages/completed-packages-report.component.ts");

  assert.match(routes, /reports\/completed-packages/, "Angular route should exist");

  for (const label of [
    "Completed Packages",
    "Run Report",
    "Download CSV",
    "Total completed services",
    "Total service amount",
    "Completed package count",
    "Redeemed quantity",
    "Name",
    "Contact",
    "Package",
    "Service Name",
    "Price",
    "Total Qty",
    "Redeemed Qty",
    "Pending Qty",
    "Date",
    "Expired On",
    "No data found"
  ]) {
    assert.match(page, new RegExp(label.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing UI label ${label}`);
  }

  assert.match(page, /placeholder="Client, contact, package, service"/, "search input should cover completed report fields");
  assert.match(page, /report<CompletedPackagesReport>\('completed-packages'/, "page should call completed packages API report");
  assert.match(page, /completed-packages-report\.csv/, "download should export completed packages CSV");
  assert.match(page, /\/pos\/invoices/, "invoice action should deep-link to invoice register");
  assert.match(page, /\/clients/, "client action should deep-link to client profile");
});
