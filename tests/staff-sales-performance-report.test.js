import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const service = readFileSync("server/services/staff-sales-report.service.js", "utf8");
const routes = readFileSync("server/routes/staff-sales-report.routes.js", "utf8");
const component = readFileSync("src/app/pages/staff-sales-report.component.ts", "utf8");

test("staff sales API stays backward-compatible while exposing performance fields", () => {
  for (const legacyField of ["totals", "staff", "items"]) {
    assert.match(service, new RegExp(`${legacyField}\\s*[:},]`), `legacy ${legacyField} field should remain in report response`);
  }
  for (const analyticsField of [
    "clientsCount",
    "invoiceCount",
    "averageBill",
    "pendingDue",
    "discountGiven",
    "tips",
    "estimatedCommission",
    "performanceScore",
    "serviceBreakdown",
    "productBreakdown",
    "serviceSaleRows",
    "serviceQty",
    "serviceClientsCount",
    "serviceInvoiceCount",
    "grossServiceSale",
    "finalServiceSale",
    "serviceDiscountAmount",
    "serviceDiscountPercent",
    "staffServiceShareBeforeDiscount",
    "staffServiceShareAfterDiscount"
  ]) {
    assert.match(service, new RegExp(analyticsField), `${analyticsField} should be calculated by staff report service`);
  }
});

test("staff sales service supports additive filters and breakdown calculations", () => {
  for (const helper of ["matchesItemFilters", "breakdownRows", "commissionEstimate", "performanceScore", "paymentInvoiceId", "serviceSaleRow"]) {
    assert.match(service, new RegExp(`function ${helper}\\(`), `${helper} helper should exist`);
  }
  for (const filter of ["staffId", "saleType", "serviceSaleType", "discountMode", "dueStatus", "client", "service", "product", "category", "commissionStatus", "performanceBucket", "q"]) {
    assert.match(service, new RegExp(filter), `${filter} filter should be supported`);
  }
  assert.match(service, /normalizedDiscountMode/, "discount mode query should be normalized");
  assert.match(service, /costSignal: "ok"/, "COGS confidence signal should be present");
  assert.match(service, /missing_cost/, "missing product consume cost should be surfaced");
});

test("staff sales service exposes service invoice drilldown fields", () => {
  for (const drilldownField of [
    "serviceName",
    "serviceGroup",
    "qty",
    "invoiceNumber",
    "invoiceDate",
    "appointmentDate",
    "createdDate",
    "customerName",
    "customerContact",
    "branchName",
    "saleType",
    "staffSharePercent",
    "grossPrice",
    "discountAmount",
    "finalPrice",
    "serviceShareBeforeDiscount",
    "serviceShareAfterDiscount",
    "discountPercent",
    "paymentMode",
    "transactionId",
    "discount",
    "gst",
    "dueAmount"
  ]) {
    assert.match(service, new RegExp(drilldownField), `${drilldownField} should be present in service sale drilldown rows`);
  }
  assert.match(service, /Quick Sale/, "quick sale label should be present");
  assert.match(service, /Appointment/, "appointment label should be present");
});

test("staff sales route remains permissioned on the existing endpoint", () => {
  assert.match(routes, /"\/reports\/staff-sales"/, "existing staff sales endpoint should remain");
  assert.match(routes, /requirePermission\("read", \(\) => "reports"\)/, "staff sales endpoint should require report read permission");
  assert.match(routes, /staffSalesReportService\.report\(req\.query,\s*req\.access\)/, "route should pass query filters to service");
});

test("staff sales UI exposes leaderboard, exports, expandable details, and Staff 360 link", () => {
  for (const label of [
    "Staff Leaderboard",
    "Services By Staff",
    "Products By Staff",
    "Commission / Payout",
    "Total attributed sales",
    "Total clients",
    "Total invoices",
    "Average bill",
    "Pending due",
    "Discount given",
    "Staff tips",
    "Estimated commission",
    "Staff summary",
    "Services sales by staff",
    "Discount mode",
    "With Discount",
    "Without Discount",
    "Compare Both",
    "Gross service sale",
    "Final service sale",
    "Share before discount",
    "Share after discount",
    "Gross price",
    "Final price",
    "Transaction ID",
    "Line item audit"
  ]) {
    assert.match(component, new RegExp(label), `${label} should render in the staff sales report`);
  }
  for (const method of ["exportCsv", "exportServiceRowsCsv", "exportOwnerPdf", "exportPayoutPdf", "toggleStaff", "isExpanded", "staffOptions", "hasMissingCost", "discountModeLabel", "serviceAmountFor"]) {
    assert.match(component, new RegExp(`${method}\\(`), `${method} should exist in staff sales component`);
  }
  assert.match(component, /serviceBreakdown/, "expanded service detail should render");
  assert.match(component, /serviceSaleRows/, "services by staff exact invoice rows should render");
  assert.match(component, /productBreakdown/, "expanded product detail should render");
  assert.match(component, /routerLink="\/staff-os\/employee-masters"/, "Staff 360 link should point to Staff OS");
  assert.match(component, /routerLink="\/pos\/invoices"/, "invoice action should open POS invoices");
  assert.match(component, /routerLink="\/clients"/, "client action should open client search");
});
