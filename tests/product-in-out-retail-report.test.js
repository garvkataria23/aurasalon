import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const routes = readFileSync("server/routes/inventory-intelligence.routes.js", "utf8");
const service = readFileSync("server/services/inventory-enterprise.service.js", "utf8");
const page = readFileSync("src/app/pages/inventory-reports.component.ts", "utf8");

test("inventory intelligence exposes Product IN/OUT Retail report API", () => {
  assert.match(routes, /\/inventory-intelligence\/product-in-out-retail-report/);
  assert.match(routes, /productInOutRetailReport\(req\.query, req\.access\)/);
  assert.match(service, /productInOutRetailReport\(query = \{\}, access\)/);
  assert.match(service, /movementBreakdown/);
  assert.match(service, /negativeStockAlert/);
  assert.match(service, /batchFifoSource/);
});

test("inventory reports page adds Product IN/OUT Retail tab and Salonist base columns", () => {
  for (const label of [
    "Product IN/OUT Retail",
    "Product",
    "Barcode / SKU",
    "Cost Price",
    "Sell Price",
    "Sales Count",
    "New Stock",
    "Adjustment",
    "In Hand"
  ]) {
    assert.match(page, new RegExp(label.replace(/[/.]/g, "\\$&")), `missing label ${label}`);
  }
});

test("Product IN/OUT Retail includes advanced controls and exports", () => {
  for (const token of [
    "Opening Stock",
    "Purchase In",
    "Retail Sold Out",
    "Return In",
    "Waste / Expiry",
    "Gross Margin",
    "Margin %",
    "Reorder Qty",
    "Batch / FIFO",
    "Last Movement",
    "Export CSV",
    "Owner PDF",
    "Product 360",
    "Stock ledger",
    "Sale invoices",
    "Create reorder"
  ]) {
    assert.match(page, new RegExp(token.replace(/[/.]/g, "\\$&")), `missing advanced control ${token}`);
  }
  assert.match(page, /loadProductInOut\(\)/);
  assert.match(page, /exportProductInOutCsv\(\)/);
  assert.match(page, /exportProductInOutOwnerPdf\(\)/);
});
