import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const serverApp = readFileSync("server/app.js", "utf8");
const billingRoutes = readFileSync("server/routes/billing.routes.js", "utf8");
const paymentRoutes = readFileSync("server/routes/payment.routes.js", "utf8");
const posSettingsRoutes = readFileSync("server/routes/pos-settings.routes.js", "utf8");
const posSettingsService = readFileSync("server/services/pos-settings.service.js", "utf8");
const membershipRoutes = readFileSync("server/routes/membership-enterprise.routes.js", "utf8");
const resourceRoutes = readFileSync("server/routes/resource.routes.js", "utf8");
const posSettings = readFileSync("src/app/core/pos-settings.service.ts", "utf8");
const posPage = readFileSync("src/app/pages/pos.component.ts", "utf8");

const posSidebarPaths = [
  "/pos",
  "/pos/invoices",
  "/pos/holds",
  "/pos/tips",
  "/pos/payment-modes",
  "/memberships",
  "/packages"
];

test("POS sidebar exposes the sale-critical billing modules", () => {
  assert.match(appComponent, /id:\s*'pos'/, "POS group should exist");
  assert.match(appComponent, /primaryPath:\s*'\/pos'/, "POS group should open billing first");
  for (const path of posSidebarPaths) {
    assert.match(appComponent, new RegExp(`path:\\s*'${path.replace("/", "\\/")}'`), `${path} should be in POS sidebar`);
  }
});

test("POS Angular routes stay wired to pages and resource modules", () => {
  for (const path of ["pos", "pos/invoices", "pos/holds", "pos/tips", "pos/payment-modes", "memberships", "packages"]) {
    assert.match(appRoutes, new RegExp(`path:\\s*'${path}'`), `${path} route should exist`);
  }
  assert.match(appRoutes, /path:\s*'pos\/invoice-activity'/, "invoice activity route should remain reachable from invoice register");
  assert.match(appRoutes, /path:\s*'packages'[\s\S]*entity:\s*'packages'/, "packages should use the packages resource");
});

test("POS backend APIs are mounted for billing, payments, membership and packages", () => {
  for (const routerName of [
    "billingRouter",
    "billingAnalyticsRouter",
    "billingHealthRouter",
    "paymentRouter",
    "paymentPublicRouter",
    "posSettingsRouter",
    "invoiceLedgerRouter",
    "invoiceNotificationRouter",
    "giftCardRouter",
    "membershipEnterpriseRouter",
    "resourceRouter"
  ]) {
    assert.match(serverApp, new RegExp(`import \\{[^}]*${routerName}[^}]*\\}`), `${routerName} should be imported`);
    assert.match(serverApp, new RegExp(`app\\.use\\("/api(?:/v1)?",(?:\\s*authenticateJwt\\(\\),)?\\s*${routerName}\\)`), `${routerName} should be mounted`);
  }
});

test("POS payment and invoice mutations keep permissions and idempotency gates", () => {
  assert.match(billingRoutes, /requirePermission\("read",\s*\(\) => "invoices"\)/, "invoice reads should require invoice permission");
  assert.match(billingRoutes, /requirePermission\("write",\s*\(\) => "invoices"\)/, "invoice writes should require invoice permission");
  assert.match(billingRoutes, /requirePermission\("write",\s*\(\) => "payments"\),\s*requireIdempotencyKey/, "invoice payments should require payment permission and idempotency");
  assert.match(billingRoutes, /\/billing\/invoices\/:id\/finalize[\s\S]*requireIdempotencyKey/, "finalize should require idempotency");
  assert.match(paymentRoutes, /\/payments\/invoice\/:invoiceId\/split[\s\S]*requirePermission\("write",\s*\(\) => "payments"\)[\s\S]*requireIdempotencyKey/, "split payment should require payment permission and idempotency");
  assert.match(paymentRoutes, /\/payments\/invoice\/:invoiceId\/status[\s\S]*requirePermission\("read",\s*\(\) => "payments"\)/, "payment status should require read permission");
});

test("POS payment modes are backend-persisted with tenant and branch scope", () => {
  assert.match(posSettingsRoutes, /\/pos\/settings\/payment-modes/, "payment mode settings API should exist");
  assert.match(posSettingsRoutes, /requirePermission\("read",\s*\(\) => "payments"\)/, "POS can read payment modes with payment permission");
  assert.match(posSettingsRoutes, /requirePermission\("write",\s*\(\) => "settings"\)/, "payment mode changes should require settings permission");
  assert.match(posSettingsService, /const SETTING_PREFIX = "pos\.paymentModes"/, "payment modes should use a dedicated settings key");
  assert.match(posSettingsService, /tenantIdFrom\(access\)/, "payment modes should require tenant scope");
  assert.match(posSettingsService, /tenantService\.assertBranchAccess\(access,\s*branchId\)/, "payment modes should enforce branch access");
  assert.match(posSettingsService, /ON CONFLICT\(tenantId, key\)/, "payment modes should upsert per tenant and branch key");
});

test("POS membership and package surfaces keep tenant and branch context", () => {
  assert.match(membershipRoutes, /membershipEnterpriseService\.listPlans\(req\.query,\s*req\.access\)/, "membership plans should pass access context");
  assert.match(membershipRoutes, /membershipEnterpriseService\.sellMembership\([^)]*req\.access\)/, "membership sales should pass access context");
  assert.match(resourceRoutes, /tenantId:\s*access\.tenantId/, "generic POS resources should stay tenant scoped");
  assert.match(resourceRoutes, /branchId:\s*row\.branchId \|\| access\.branchId \|\| ""/, "generic POS resources should stay branch scoped");
});

test("POS frontend syncs payment modes through backend with local fallback", () => {
  assert.match(posSettings, /aura\.pos\.\$\{kind\}\.\$\{tenantId\}\.\$\{branchId\}/, "local POS settings should include tenant and branch in storage key");
  assert.match(posSettings, /loadPaymentModesRemote\(\)/, "POS settings should load branch payment modes from backend");
  assert.match(posSettings, /savePaymentModesRemote\(modes: PosPaymentMode\[\]\)/, "POS settings should save branch payment modes to backend");
  assert.match(posSettings, /catchError\(\(\) => of\(this\.loadPaymentModes\(\)\)\)/, "POS settings should keep local fallback");
  assert.match(posPage, /loadPaymentModes\(\)/, "POS billing should load configured payment modes");
  assert.match(posPage, /loadPaymentModesRemote\(\)\.subscribe/, "POS billing should hydrate backend payment modes");
  assert.match(posPage, /routerLink="\/pos\/payment-modes"/, "POS should link operators to payment mode setup");
});
