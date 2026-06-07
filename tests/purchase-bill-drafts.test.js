import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { purchaseBillAiService } from "../server/services/purchase-bill-ai.service.js";

const migration = readFileSync("server/db/migrations/20260530_purchase_bill_drafts.sql", "utf8");
const schemaService = readFileSync("server/services/purchase-bill-schema.service.js", "utf8");
const app = readFileSync("server/app.js", "utf8");
const routes = readFileSync("server/routes/inventory-intelligence.routes.js", "utf8");
const service = readFileSync("server/services/purchase-bill-draft.service.js", "utf8");
const aiService = readFileSync("server/services/purchase-bill-ai.service.js", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const inventoryPage = readFileSync("src/app/pages/inventory.component.ts", "utf8");
const draftPage = readFileSync("src/app/pages/purchase-bill-drafts.component.ts", "utf8");

function tableDefinition(tableName) {
  return migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\([\\s\\S]*?\\);`))?.[0] || "";
}

test("purchase bill draft migration is tenant and branch scoped", () => {
  for (const table of ["purchase_bill_drafts", "purchase_bill_draft_items", "purchase_bill_attachments", "product_categories", "product_supplier_aliases"]) {
    const definition = tableDefinition(table);
    assert.ok(definition, `${table} table exists`);
    assert.match(definition, /tenant_id TEXT NOT NULL/, `${table} has tenant_id`);
  }
  for (const table of ["purchase_bill_drafts", "purchase_bill_draft_items", "purchase_bill_attachments"]) {
    assert.match(tableDefinition(table), /branch_id TEXT NOT NULL/, `${table} has branch_id`);
  }
  assert.match(tableDefinition("purchase_bill_drafts"), /status TEXT DEFAULT 'draft'/);
  assert.match(tableDefinition("purchase_bill_drafts"), /supplier_email TEXT DEFAULT ''/);
  assert.match(tableDefinition("purchase_bill_drafts"), /cgst_amount REAL DEFAULT 0/);
  assert.match(tableDefinition("purchase_bill_drafts"), /sgst_amount REAL DEFAULT 0/);
  assert.match(tableDefinition("purchase_bill_draft_items"), /usage_type TEXT DEFAULT 'retail'/);
  assert.match(tableDefinition("purchase_bill_draft_items"), /conversion_factor REAL DEFAULT 1/);
  assert.match(tableDefinition("purchase_bill_draft_items"), /hsn_sac TEXT DEFAULT ''/);
  assert.match(tableDefinition("purchase_bill_draft_items"), /discount_percent REAL DEFAULT 0/);
  assert.match(tableDefinition("purchase_bill_draft_items"), /cgst_amount REAL DEFAULT 0/);
  assert.match(tableDefinition("purchase_bill_draft_items"), /match_suggestions_json TEXT DEFAULT '\[\]'/);
  assert.match(migration, /idx_purchase_bill_confirmed_invoice[\s\S]*WHERE status = 'confirmed'/, "confirmed invoices are protected from double stock add");
});

test("purchase bill draft schema is bootstrapped without editing db.js", () => {
  assert.match(schemaService, /20260530_purchase_bill_drafts\.sql/);
  assert.match(app, /ensurePurchaseBillDraftSchema/);
});

test("purchase bill draft API exposes upload, review and confirm lifecycle", () => {
  for (const endpoint of [
    "/inventory-intelligence/purchase-bill-drafts",
    "/inventory-intelligence/purchase-bill-drafts/upload",
    "/inventory-intelligence/purchase-bill-drafts/:id",
    "/inventory-intelligence/purchase-bill-drafts/:id/save-supplier",
    "/inventory-intelligence/purchase-bill-drafts/:id/items",
    "/inventory-intelligence/purchase-bill-drafts/:id/items/:itemId",
    "/inventory-intelligence/purchase-bill-drafts/:id/items/:itemId/create-product",
    "/inventory-intelligence/purchase-bill-drafts/:id/confirm",
    "/inventory-intelligence/purchase-bill-drafts/:id/cancel",
    "/inventory-intelligence/product-categories"
  ]) {
    assert.ok(routes.includes(endpoint), `${endpoint} is routed`);
  }
});

test("purchase bill confirm reuses existing inventory receiving flow", () => {
  assert.match(service, /intelligentInventoryService\.purchaseEntry/, "confirm calls purchaseEntry for stock movement");
  assert.match(service, /Purchase bill draft needs review before confirmation/, "confirm validates required reviewed fields");
  assert.match(service, /Confirmed or cancelled drafts cannot be edited/, "confirmed drafts are locked");
  assert.match(service, /already confirmed\. Stock was not added again/, "duplicate invoice confirmation is blocked");
  assert.match(service, /createProductForItem/, "new products can be created from reviewed lines");
  assert.match(service, /saveSupplierForDraft/, "new suppliers can be saved and linked before confirmation");
  assert.match(service, /fillMissingSupplierDetails/, "matched suppliers are enriched from extracted GST invoice contact details");
  assert.match(service, /repositories\.suppliers\.update/, "supplier master is repaired when draft has missing phone email or address");
  assert.match(service, /createProductFromDraftItem/, "new product rows can be saved before confirmation");
  assert.match(service, /productSuggestions/, "likely product matches are surfaced before create-new decisions");
  assert.match(service, /product_supplier_aliases/, "supplier aliases are saved for future fuzzy matching");
  assert.match(aiService, /extractPdfTextFromPayload/);
  assert.match(aiService, /claudeExtract/);
  assert.match(aiService, /localExtract/);
});

test("local purchase bill parser extracts Turquoise invoice table without address rows", async () => {
  const rawText = [
    "M/s.",
    "S SENSE STUDIO",
    "EVERSHINE MILLENNIUM PARADISE 62, SHOP NO 17,18",
    "Email: sales.turquoisewellness@gmail.com Mob.: +91 9920974906 / +91 7304342745",
    "Product Description",
    "Rate (Rs.)",
    "M.R.P",
    "Amount",
    "GST INVOICE",
    "Quantity",
    "TURQUOISE WELLNESS",
    "27CKFPS2594L1ZF",
    "Invoice No.:",
    "Date. :",
    "08/07/2025",
    "TW0517/25-26",
    "2070.34",
    "MORFOSE NICHE PRO BOND REPAIR SHAMPOO 1000",
    "ML MRP 3490",
    "3490.00",
    "1.000",
    "30.00",
    "Nos",
    "1",
    "33051090",
    "2070.34",
    "2070.34",
    "MORFOSE NICHE PRO BOND REPAIR HAIR MASK 500",
    "ML MRP 3490",
    "3490.00",
    "1.000",
    "30.00",
    "Nos",
    "2",
    "33059090",
    "2070.34",
    "Rupees :",
    "Four Thousand Eight Hundred Eighty Five only.",
    "4140.68",
    "4885.00",
    "GRAND TOTAL",
    "GST %",
    "18 %",
    "Add : CGST",
    "Add : SGST",
    "372.66",
    "372.66"
  ].join("\n");

  const extracted = await purchaseBillAiService.extract({ aiProvider: "local", extractedText: rawText });

  assert.equal(extracted.supplierName, "TURQUOISE WELLNESS");
  assert.equal(extracted.supplierGstin, "27CKFPS2594L1ZF");
  assert.equal(extracted.billNo, "TW0517/25-26");
  assert.equal(extracted.items.length, 2);
  assert.equal(extracted.subtotal, 4140.68);
  assert.equal(extracted.gstAmount, 745.32);
  assert.equal(extracted.cgstAmount, 372.66);
  assert.equal(extracted.sgstAmount, 372.66);
  assert.equal(extracted.igstAmount, 0);
  assert.equal(extracted.totalAmount, 4885);
  assert.ok(extracted.items.every((item) => item.productName.startsWith("MORFOSE NICHE PRO")));
  assert.ok(!extracted.items.some((item) => /EVERSHINE|Email|Mobile|Contact/i.test(item.productName)));
});

test("Angular links AI Purchase Bill Drafts into inventory without replacing inventory", () => {
  assert.ok(appRoutes.includes("inventory/purchase-bill-drafts"));
  assert.ok(appComponent.includes("AI Bill Drafts"));
  assert.ok(inventoryPage.includes("/inventory/purchase-bill-drafts"));
  assert.match(draftPage, /Confirm purchase/);
  assert.match(draftPage, /Save supplier/);
  assert.match(draftPage, /Supplier phone/);
  assert.match(draftPage, /Add product/);
  assert.match(draftPage, /Discount/);
  assert.match(draftPage, /CGST/);
  assert.match(draftPage, /SGST/);
  assert.match(draftPage, /New product/);
  assert.match(draftPage, /Salon use/);
  assert.match(draftPage, /applySuggestion/);
  assert.match(draftPage, /prepareUploadFile/);
});
