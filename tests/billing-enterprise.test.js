import test from "node:test";
import assert from "node:assert/strict";

const { invoiceCalculationService } = await import("../server/services/invoice-calculation.service.js");
const { gstTaxService } = await import("../server/services/gst-tax.service.js");
const { staffCommissionService } = await import("../server/services/staff-commission.service.js");
const { walletService } = await import("../server/services/wallet.service.js");
const { loyaltyService } = await import("../server/services/loyalty.service.js");

test("enterprise billing calculation handles discounts and CGST/SGST", () => {
  const result = invoiceCalculationService.calculateInvoice({
    items: [{ item_type: "service", item_name: "Hair Spa", quantity: 1, unit_price: 1000, tax_rate: 18 }],
    billDiscount: { type: "amount", value: 100 },
    branchState: "Telangana",
    placeOfSupply: "Telangana"
  });

  assert.equal(result.subtotal, 1000);
  assert.equal(result.discount_total, 100);
  assert.equal(result.tax_total, 162);
  assert.equal(result.grand_total, 1062);
  assert.deepEqual(result.taxes.map((tax) => tax.tax_type), ["CGST", "SGST"]);
});

test("GST tax service supports IGST for interstate invoices", () => {
  const result = gstTaxService.calculateItem({
    amount: 1000,
    taxRate: 18,
    branchState: "Telangana",
    placeOfSupply: "Maharashtra"
  });

  assert.equal(result.taxableAmount, 1000);
  assert.equal(result.igst, 180);
  assert.equal(result.cgst, 0);
  assert.equal(result.sgst, 0);
  assert.equal(result.total, 1180);
});

test("GST tax service supports inclusive tax", () => {
  const result = gstTaxService.calculateItem({
    amount: 1180,
    taxRate: 18,
    inclusive: true,
    branchState: "Telangana",
    placeOfSupply: "Telangana"
  });

  assert.equal(result.taxableAmount, 1000);
  assert.equal(result.taxAmount, 180);
  assert.equal(result.total, 1180);
});

test("enterprise billing services expose required APIs for later integration tests", () => {
  assert.equal(typeof staffCommissionService.staffReport, "function");
  assert.equal(typeof staffCommissionService.summary, "function");
  assert.equal(typeof walletService.use, "function");
  assert.equal(typeof loyaltyService.redeem, "function");
});
