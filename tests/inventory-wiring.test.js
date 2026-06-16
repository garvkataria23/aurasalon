import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const serverApp = readFileSync("server/app.js", "utf8");
const repositoryRegistry = readFileSync("server/repositories/repository-registry.js", "utf8");
const inventoryRoutes = readFileSync("server/routes/inventory-intelligence.routes.js", "utf8");
const resourceRoutes = readFileSync("server/routes/resource.routes.js", "utf8");
const inventoryService = readFileSync("server/services/inventory-enterprise.service.js", "utf8");
const billingInventory = readFileSync("server/services/billing-inventory.service.js", "utf8");
const salonOperations = readFileSync("server/services/salon-operations.service.js", "utf8");
const inventoryHome = readFileSync("src/app/pages/inventory.component.ts", "utf8");
const reorderPage = readFileSync("src/app/pages/inventory-reorder.component.ts", "utf8");
const fifoPage = readFileSync("src/app/pages/inventory-fifo.component.ts", "utf8");
const financialPage = readFileSync("src/app/pages/inventory-financial.component.ts", "utf8");

const inventorySidebarPaths = [
  "/inventory",
  "/inventory/purchase-bill-drafts",
  "/inventory/purchase-orders",
  "/inventory/reorder",
  "/suppliers",
  "/services",
  "/inventory/recipes",
  "/inventory/fifo",
  "/inventory/product-consume",
  "/inventory/stock-audit",
  "/inventory/financial",
  "/inventory/reports",
  "/inventory/scanner"
];

test("Inventory sidebar exposes every sale-ready stock workflow", () => {
  assert.match(appComponent, /id:\s*'inventory'/, "inventory group should exist");
  assert.match(appComponent, /primaryPath:\s*'\/inventory'/, "inventory group should open inventory home");
  for (const path of inventorySidebarPaths) {
    assert.match(appComponent, new RegExp(`path:\\s*'${path.replace("/", "\\/")}'`), `${path} should be in Inventory sidebar`);
  }
});

test("Inventory Angular routes cover home cards and detail pages", () => {
  for (const path of [
    "inventory",
    "inventory/purchase-bill-drafts",
    "inventory/purchase-orders",
    "inventory/purchase-orders/:id",
    "inventory/reorder",
    "inventory/recipes",
    "inventory/fifo",
    "inventory/product-consume",
    "inventory/stock-audit",
    "inventory/financial",
    "inventory/reports",
    "inventory/scanner",
    "inventory/products/:id",
    "suppliers",
    "suppliers/:id",
    "services"
  ]) {
    assert.match(appRoutes, new RegExp(`path:\\s*'${path}'`), `${path} route should exist`);
  }
  for (const linkedPath of ["/inventory/reorder", "/inventory/fifo", "/inventory/financial"]) {
    assert.match(inventoryHome, new RegExp(`routerLink="${linkedPath.replace("/", "\\/")}"`), `${linkedPath} card should stay linked from inventory home`);
  }
});

test("Inventory backend APIs and repositories are mounted for legacy and v1 clients", () => {
  assert.match(serverApp, /import \{ inventoryIntelligenceRouter \}/, "inventory intelligence router should be imported");
  assert.match(serverApp, /app\.use\("\/api\/v1", authenticateJwt\(\), inventoryIntelligenceRouter\)/, "inventory v1 router should be authenticated");
  assert.match(serverApp, /app\.use\("\/api", inventoryIntelligenceRouter\)/, "inventory legacy router should be mounted");
  assert.match(serverApp, /app\.use\("\/api(?:\/v1)?", authenticateJwt\(\), resourceRouter\)/, "v1 resource router should be authenticated");
  for (const resource of ["products", "suppliers", "services", "inventory", "inventoryBatches"]) {
    assert.match(repositoryRegistry, new RegExp(`${resource}: repositoryForTable`), `${resource} resource should be registered`);
  }
  assert.match(resourceRoutes, /requirePermission\("read"\)/, "resource reads should require permission");
  assert.match(resourceRoutes, /requirePermission\("write"\)/, "resource writes should require permission");
});

test("Inventory operational APIs keep permission gates for purchase, recipes, counts and reports", () => {
  for (const endpoint of [
    "/inventory-intelligence/summary",
    "/inventory-intelligence/reorder-suggestions/run",
    "/inventory-intelligence/purchase-orders",
    "/inventory-intelligence/purchase-bill-drafts/upload",
    "/inventory-intelligence/service-recipes",
    "/inventory-intelligence/product-consume-drafts",
    "/inventory-intelligence/stock-counts",
    "/inventory-intelligence/barcode-scan",
    "/inventory-intelligence/reports",
    "/inventory-intelligence/reports/snapshot",
    "/inventory-intelligence/supplier-whatsapp-queue"
  ]) {
    assert.ok(inventoryRoutes.includes(endpoint), `${endpoint} should be routed`);
  }
  assert.match(inventoryRoutes, /requirePermission\("read",\s*\(\) => "inventory"\)/, "inventory reads should be permission guarded");
  assert.match(inventoryRoutes, /requirePermission\("write",\s*\(\) => "inventory"\)/, "inventory writes should be permission guarded");
});

test("Inventory services enforce tenant, branch, approval and FIFO stock deduction", () => {
  assert.match(inventoryService, /assertBranch\(access, branchId\)/, "inventory mutations should assert branch access");
  assert.match(inventoryService, /tenant_id = \?/g, "inventory SQL should filter tenant");
  assert.match(inventoryService, /approval_status = 'approved'/, "service consumption should use approved recipes");
  assert.match(inventoryService, /ORDER BY CASE WHEN expiryDate IS NULL OR expiryDate = '' THEN 1 ELSE 0 END, expiryDate ASC, createdAt ASC/, "FIFO expiry-first selection should remain");
  assert.match(inventoryService, /inventory_report_snapshots/, "financial snapshots should persist");
  assert.match(inventoryService, /barcode_scan_events/, "scanner events should persist");
  assert.match(billingInventory, /consumeProductFifo/, "invoice finalization should consume product FIFO");
  assert.match(billingInventory, /consumeServiceRecipe/, "invoice finalization should consume service recipes");
  assert.match(salonOperations, /consumeProductFifo/, "POS sales should consume product FIFO");
  assert.match(salonOperations, /consumeServiceRecipe/, "appointments/sales should consume service recipes");
});

test("Inventory advanced pages use live branch-scoped APIs", () => {
  assert.match(reorderPage, /inventory-intelligence\/summary/, "reorder page should read live inventory summary");
  assert.match(reorderPage, /inventory-intelligence\/reorder-suggestions\/run/, "reorder page should generate approval-safe suggestions");
  assert.match(fifoPage, /inventoryBatches/, "FIFO page should load registered inventory batches resource");
  assert.match(financialPage, /inventory-intelligence\/reports\/snapshot/, "financial page should create inventory report snapshots");
  for (const page of [reorderPage, fifoPage, financialPage]) {
    assert.match(page, /branchId:\s*this\.api\.selectedBranchId\(\)/, "advanced inventory pages should send branch scope");
  }
});
