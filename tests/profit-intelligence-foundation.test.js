import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const serverApp = readFileSync("server/app.js", "utf8");
const route = readFileSync("server/routes/profit-intelligence.routes.js", "utf8");
const service = readFileSync("server/services/profit-intelligence.service.js", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const page = readFileSync("src/app/pages/profit-intelligence.component.ts", "utf8");

test("Profit Intelligence API is mounted for v1 and legacy finance clients", () => {
  assert.match(serverApp, /import \{ profitIntelligenceRouter \}/, "router should be imported");
  assert.match(serverApp, /app\.use\("\/api\/v1", authenticateJwt\(\), profitIntelligenceRouter\)/, "v1 API should be authenticated");
  assert.match(serverApp, /app\.use\("\/api", profitIntelligenceRouter\)/, "legacy API should stay compatible");
});

test("Profit Intelligence summary is finance-protected and paise-based", () => {
  assert.match(route, /\/profit-intelligence\/summary[\s\S]*requirePermission\("read",\s*\(\) => "finance"\)/, "summary should require read finance");
  for (const field of [
    "revenuePaise",
    "productCostPaise",
    "staffCostPaise",
    "operatingExpensePaise",
    "grossProfitPaise",
    "netProfitPaise"
  ]) {
    assert.ok(service.includes(field), `${field} should be part of the P&L contract`);
  }
  assert.match(service, /journalEntryLines[\s\S]*chartOfAccounts/, "COGS should prefer posted journal lines when available");
  assert.match(service, /product_consume_drafts/, "COGS should fall back to product consume drafts");
  assert.match(service, /finance_staff_payouts/, "staff cost should use payout data");
  assert.match(service, /finance_expenses/, "operating expenses should use finance expenses");
});

test("Profit Intelligence page is routed and visible in Finance navigation", () => {
  assert.match(appRoutes, /profit-intelligence[\s\S]*ProfitIntelligenceComponent/, "Angular route should load ProfitIntelligenceComponent");
  assert.ok(appComponent.includes("path: '/profit-intelligence'"), "Finance navigation should include the page");
  assert.ok(page.includes("profit-intelligence/summary"), "page should call the summary endpoint");
  assert.ok(page.includes("grossMarginBps"), "page should expose gross margin");
  assert.ok(page.includes("netMarginBps"), "page should expose net margin");
});
