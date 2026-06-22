import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("server/db/migrations/20260523_inventory_enterprise.sql", "utf8");
const schemaBootstrap = readFileSync("server/services/staff-os-schema.service.js", "utf8");
const routes = readFileSync("server/routes/inventory-intelligence.routes.js", "utf8");
const service = readFileSync("server/services/inventory-enterprise.service.js", "utf8");
const billingInventory = readFileSync("server/services/billing-inventory.service.js", "utf8");
const salonOperations = readFileSync("server/services/salon-operations.service.js", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const recipesPage = readFileSync("src/app/pages/inventory-recipes.component.ts", "utf8");

function tableDefinition(tableName) {
  return migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${tableName} \\([\\s\\S]*?\\);`))?.[0] || "";
}

test("inventory enterprise migration creates tenant-safe tables", () => {
  const requiredTables = [
    "purchase_orders",
    "purchase_order_items",
    "service_recipes",
    "service_recipe_items",
    "service_recipe_versions",
    "service_recipe_usage_logs",
    "service_recipe_usage_items",
    "service_recipe_alerts",
    "service_recipe_templates",
    "stock_counts",
    "stock_count_items",
    "stock_variance_findings",
    "inventory_theft_findings",
    "branch_transfer_requests",
    "barcode_scan_events",
    "inventory_report_snapshots",
    "supplier_whatsapp_queue"
  ];
  for (const table of requiredTables) {
    const definition = tableDefinition(table);
    assert.ok(definition, `${table} table exists`);
    assert.match(definition, /tenant_id TEXT NOT NULL/, `${table} has tenant_id`);
  }
  for (const table of ["purchase_orders", "stock_counts", "barcode_scan_events", "supplier_whatsapp_queue"]) {
    assert.match(tableDefinition(table), /branch_id TEXT NOT NULL/, `${table} has required branch scope`);
  }
  assert.match(tableDefinition("branch_transfer_requests"), /source_branch_id TEXT NOT NULL/);
  assert.match(tableDefinition("branch_transfer_requests"), /target_branch_id TEXT NOT NULL/);
  assert.match(tableDefinition("purchase_orders"), /version INTEGER DEFAULT 1/);
  assert.match(tableDefinition("purchase_orders"), /expected_delivery_date TEXT DEFAULT ''/);
  assert.match(tableDefinition("purchase_orders"), /grn_number TEXT DEFAULT ''/);
  assert.match(tableDefinition("purchase_orders"), /variance_json TEXT DEFAULT '\[\]'/);
  assert.match(tableDefinition("purchase_orders"), /status_history_json TEXT DEFAULT '\[\]'/);
  assert.match(tableDefinition("purchase_order_items"), /hsn_sac TEXT DEFAULT ''/);
  assert.match(tableDefinition("purchase_order_items"), /mrp REAL DEFAULT 0/);
  assert.match(tableDefinition("purchase_order_items"), /discount_percent REAL DEFAULT 0/);
  assert.match(tableDefinition("purchase_order_items"), /gst_percent REAL DEFAULT 18/);
  assert.match(tableDefinition("purchase_order_items"), /damaged_qty REAL DEFAULT 0/);
  assert.match(tableDefinition("purchase_order_items"), /excess_qty REAL DEFAULT 0/);
  assert.match(tableDefinition("service_recipes"), /approval_status TEXT DEFAULT 'approved'/);
  assert.match(tableDefinition("service_recipes"), /usage_modifiers_json TEXT DEFAULT '\[\]'/);
  assert.match(tableDefinition("service_recipe_items"), /unit TEXT DEFAULT 'pcs'/);
  assert.match(tableDefinition("service_recipe_items"), /allowed_substitutes_json TEXT DEFAULT '\[\]'/);
  assert.match(tableDefinition("service_recipe_usage_logs"), /staff_id TEXT DEFAULT ''/);
  assert.match(tableDefinition("service_recipe_usage_items"), /variance_pct REAL DEFAULT 0/);
  assert.match(tableDefinition("service_recipe_alerts"), /alert_type TEXT NOT NULL/);
  assert.match(tableDefinition("service_recipe_templates"), /template_key TEXT NOT NULL/);
  assert.match(tableDefinition("barcode_scan_events"), /scanned_code TEXT DEFAULT ''[\s\S]*code TEXT NOT NULL/, "barcode scans keep legacy and inventory scanner code columns");
  assert.match(schemaBootstrap, /20260523_inventory_enterprise\.sql/);
  assert.match(schemaBootstrap, /purchase_orders", "expected_delivery_date"/);
  assert.match(schemaBootstrap, /purchase_order_items", "hsn_sac"/);
  assert.match(schemaBootstrap, /service_recipes", "approval_status"/);
  assert.match(schemaBootstrap, /service_recipe_items", "unit"/);
});

test("inventory enterprise routes expose operational workflows", () => {
  const endpoints = [
    "/inventory-intelligence/purchase-orders",
    "/inventory-intelligence/purchase-orders/:id/bill-matches",
    "/inventory-intelligence/purchase-orders/:id/approve",
    "/inventory-intelligence/purchase-orders/:id/send",
    "/inventory-intelligence/purchase-orders/:id/receive",
    "/inventory-intelligence/purchase-orders/:id/cancel",
    "/inventory-intelligence/purchase-orders/:id/reject",
    "/inventory-intelligence/purchase-orders/:id/reopen",
    "/inventory-intelligence/purchase-bill-drafts/:id/match-po",
    "/inventory-intelligence/service-recipes",
    "/inventory-intelligence/service-recipes/dashboard",
    "/inventory-intelligence/service-recipes/templates",
    "/inventory-intelligence/service-recipes/usage",
    "/inventory-intelligence/service-recipes/alerts",
    "/inventory-intelligence/service-recipes/:id/submit-approval",
    "/inventory-intelligence/service-recipes/:id/approve",
    "/inventory-intelligence/service-recipes/:id/consume",
    "/inventory-intelligence/stock-counts",
    "/inventory-intelligence/leakage-scan",
    "/inventory-intelligence/transfer-recommendations",
    "/inventory-intelligence/transfer-requests",
    "/inventory-intelligence/barcode-scan",
    "/inventory-intelligence/reports",
    "/inventory-intelligence/supplier-whatsapp-queue"
  ];
  for (const endpoint of endpoints) {
    assert.ok(routes.includes(endpoint), `${endpoint} is routed`);
  }
});

test("inventory enterprise service enforces tenant, branch, approval and FIFO behavior", () => {
  assert.match(service, /assertBranch\(access, branchId\)/, "mutations assert branch access");
  assert.match(service, /tenant_id = \?/g, "SQL filters by tenant_id");
  assert.match(service, /status: "draft"/, "PO starts as draft");
  assert.match(service, /approved: \["draft"\]/, "PO approval lifecycle begins at draft");
  assert.match(service, /sent: \["approved"\]/, "PO send requires approval");
  assert.match(service, /partial_receive/, "PO supports partial receive");
  assert.match(service, /ORDER BY CASE WHEN expiryDate IS NULL OR expiryDate = '' THEN 1 ELSE 0 END, expiryDate ASC, createdAt ASC/, "FIFO expiry-first query is present");
  assert.match(service, /inventory_theft_findings/, "leakage findings are persisted");
  assert.match(service, /supplier_whatsapp_queue/, "WhatsApp supplier queue is persisted");
  assert.match(service, /scanned_code: code/, "barcode scans remain compatible with legacy print barcode table shape");
  assert.match(service, /CONSUMABLE_TYPES/, "service BOM editor filters to consumable and both products");
  assert.match(service, /serviceRecipeDashboard/, "recipe dashboard computes missing recipes, forecasts and margins");
  assert.match(service, /service_recipe_usage_logs/, "staff-aware service usage logs are persisted");
  assert.match(service, /OVERUSE_TOLERANCE_PCT/, "overuse detection is explicit");
  assert.match(service, /approval_status = 'approved'/, "service consumption uses approved recipes only");
  assert.match(service, /poLineCalculations/, "PO lines calculate discount, GST and total amounts");
  assert.match(service, /supplier_invoice_no/, "GRN receiving captures supplier invoice details");
  assert.match(service, /damaged_qty/, "GRN receiving captures damaged quantity");
  assert.match(service, /rate_changed/, "PO receiving flags rate variance");
  assert.match(service, /Purchase Order:/, "Supplier WhatsApp draft uses a detailed PO format");
  assert.match(service, /purchaseOrderBillMatches/, "PO can compare supplier bill drafts against ordered, billed and received quantity");
  assert.match(service, /lastPurchaseForProduct/, "PO item detail includes supplier last purchase rate");
  assert.match(service, /inventoryImpactForItems/, "PO detail exposes stock impact preview");
  assert.match(service, /late_delivery/, "PO warnings include late delivery alerts");
});

test("POS and service completion call FIFO and service BOM deduction", () => {
  assert.match(billingInventory, /consumeProductFifo/);
  assert.match(billingInventory, /consumeServiceRecipe/);
  assert.match(salonOperations, /consumeProductFifo/);
  assert.match(salonOperations, /consumeServiceRecipe/);
  assert.match(billingInventory, /referenceType:\s*"invoice"/, "invoice finalization auto-consumes approved service recipes");
  assert.match(salonOperations, /referenceType:\s*"appointment"/, "completed appointments auto-consume approved service recipes");
  assert.match(salonOperations, /referenceType:\s*"sale"/, "POS service sales auto-consume approved service recipes");
});

test("Angular exposes inventory enterprise pages in routes and sidebar", () => {
  for (const path of ["inventory/purchase-orders", "inventory/purchase-orders/:id", "inventory/recipes", "inventory/stock-audit", "inventory/reports", "inventory/scanner"]) {
    assert.ok(appRoutes.includes(path), `${path} route exists`);
  }
  for (const label of ["Purchase Orders", "Service Recipes", "Stock Audit", "Inventory Reports", "Inventory Scanner"]) {
    assert.ok(appComponent.includes(label), `${label} navigation item exists`);
  }
  for (const phrase of ["Auto Product Consume Service Setup", "POS checkout", "Appointment complete", "Invoice finalization", "No physical stock entry"]) {
    assert.ok(recipesPage.includes(phrase), `${phrase} appears on service recipe page`);
  }
});
