import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const page = readFileSync("src/app/pages/invoice-reports.component.ts", "utf8");

test("invoice reports exposes Sales Discount Intelligence tab and filters", () => {
  assert.match(page, /sales-discount-intelligence/);
  assert.match(page, /Sales Discount Intelligence/);
  for (const label of [
    "Discount type",
    "Coupon code",
    "Service / product",
    "Discount % bucket",
    "Risk"
  ]) {
    assert.match(page, new RegExp(label.replace(/[/%]/g, "\\$&")), `missing filter ${label}`);
  }
});

test("Sales Discount Intelligence includes register, source, profit and audit columns", () => {
  for (const label of [
    "Invoice date",
    "Invoice time",
    "Manual discount",
    "Coupon discount",
    "Membership/loyalty",
    "Final price",
    "Discount given by",
    "Approval",
    "Edited after discount",
    "Suspicious alert",
    "COGS",
    "Staff commission impact",
    "Gross margin",
    "Loss-making alert"
  ]) {
    assert.match(page, new RegExp(label.replace(/[/.]/g, "\\$&")), `missing column ${label}`);
  }
});

test("Sales Discount Intelligence implements breakdowns and owner export", () => {
  for (const token of [
    "salesDiscountSummary",
    "salesDiscountSourceCards",
    "salesDiscountStaffRows",
    "salesDiscountClientRows",
    "salesDiscountRiskRows",
    "exportSalesDiscountOwnerPdf",
    "salesDiscountExportSummaryLines",
    "discountRiskLabel",
    "discountApprovalStatus"
  ]) {
    assert.match(page, new RegExp(token), `missing implementation token ${token}`);
  }
});
