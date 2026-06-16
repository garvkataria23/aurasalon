import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const serverApp = readFileSync("server/app.js", "utf8");
const authSession = readFileSync("src/app/core/auth-session.service.ts", "utf8");
const apiService = readFileSync("src/app/core/api.service.ts", "utf8");
const twoFactorPage = readFileSync("src/app/pages/two-factor-setup.component.ts", "utf8");
const policyCenterPage = readFileSync("src/app/pages/security-policy-center.component.ts", "utf8");
const securityShieldPage = readFileSync("src/app/pages/enterprise-security-shield.component.ts", "utf8");
const permissionPage = readFileSync("src/app/pages/permission-matrix.component.ts", "utf8");
const twoFactorRoutes = readFileSync("server/routes/two-factor.routes.js", "utf8");
const securityRoutes = readFileSync("server/routes/security.routes.js", "utf8");
const securityAdvancedRoutes = readFileSync("server/routes/security-advanced.routes.js", "utf8");
const securityAlertsRoutes = readFileSync("server/routes/security-alerts.routes.js", "utf8");
const securityBlocklistRoutes = readFileSync("server/routes/security-blocklist.routes.js", "utf8");
const securityAdvancedService = readFileSync("server/services/security-advanced.service.js", "utf8");
const securityBlocklistService = readFileSync("server/services/security-blocklist.service.js", "utf8");
const superAdminService = readFileSync("server/services/super-admin.service.js", "utf8");
const resourceRoutes = readFileSync("server/routes/resource.routes.js", "utf8");

const adminSidebarPaths = [
  "/super-admin",
  "/saas",
  "/branches",
  "/settings",
  "/permissions",
  "/security",
  "/enterprise-security-shield",
  "/security-alerts",
  "/security-blocklist",
  "/security-policy-center",
  "/two-factor",
  "/audit-logs",
  "/business-details",
  "/data-migration",
  "/deployment",
  "/offline",
  "/white-label",
  "/quality"
];

test("Admin sidebar exposes sale-ready settings and security modules", () => {
  assert.match(appComponent, /id:\s*'admin'/, "Admin sidebar group should exist");
  assert.match(appComponent, /primaryPath:\s*'\/settings'/, "Admin group should open Settings");
  for (const path of adminSidebarPaths) {
    assert.ok(appComponent.includes(`path: '${path}'`), `${path} should be in Admin sidebar`);
  }
});

test("Admin Angular routes stay wired to settings, tenant and security pages", () => {
  for (const path of [
    "super-admin",
    "saas",
    "branches",
    "settings",
    "permissions",
    "security",
    "enterprise-security-shield",
    "security-alerts",
    "security-blocklist",
    "security-policy-center",
    "two-factor",
    "audit-logs",
    "business-details",
    "data-migration",
    "deployment",
    "offline",
    "white-label",
    "quality"
  ]) {
    assert.ok(appRoutes.includes(`path: '${path}'`), `${path} route should exist`);
  }
  assert.match(appRoutes, /permissions[\s\S]*PermissionMatrixComponent/, "Permissions should load PermissionMatrixComponent");
  assert.match(appRoutes, /two-factor[\s\S]*TwoFactorSetupComponent/, "Two-Factor route should load TwoFactorSetupComponent");
  assert.match(appRoutes, /security-policy-center[\s\S]*SecurityPolicyCenterComponent/, "Policy Center route should load SecurityPolicyCenterComponent");
});

test("Admin backend routers, schemas and middleware are mounted", () => {
  for (const schema of ["ensureTwoFactorSchema", "ensureSecurityAlertsSchema", "ensureSecurityBlocklistSchema", "ensureSecurityAdvancedSchema"]) {
    assert.match(serverApp, new RegExp(`${schema}\\(\\)`), `${schema} should run during app startup`);
  }
  for (const middleware of ["securityBlocklistMiddleware", "securityHeadersPlus", "sessionKillSwitchMiddleware", "subscriptionGuardMiddleware", "exportProtectionMiddleware"]) {
    assert.ok(serverApp.includes(middleware), `${middleware} should be wired`);
  }
  for (const routerName of [
    "twoFactorRouter",
    "securityAlertsRouter",
    "securityBlocklistRouter",
    "securityAdvancedRouter",
    "securityRouter",
    "superAdminRouter",
    "saasRouter",
    "offlineRouter",
    "whiteLabelRouter",
    "qualityRouter",
    "deploymentRouter",
    "migrationRouter",
    "resourceRouter"
  ]) {
    assert.match(serverApp, new RegExp(`import \\{ ${routerName} \\}`), `${routerName} should be imported`);
    assert.match(serverApp, new RegExp(`app\\.use\\("/api(?:/v1)?",(?:\\s*authenticateJwt\\(\\),)?\\s*${routerName}\\)`), `${routerName} should be mounted`);
  }
  assert.match(serverApp, /app\.use\("\/api\/v1", twoFactorRouter\)/, "2FA should be mounted on /api/v1");
  assert.match(serverApp, /app\.use\("\/api", twoFactorRouter\)/, "2FA should be mounted on legacy /api");
});

test("Security and settings APIs keep auth, permission and role boundaries", () => {
  assert.match(twoFactorRoutes, /authenticateJwt\(\)/, "2FA routes should require JWT auth");
  assert.match(twoFactorRoutes, /owner", "admin", "superAdmin"/, "2FA should be owner/admin/superAdmin only");
  assert.match(twoFactorRoutes, /auth\.2fa\.enabled/, "2FA enable should be audited");
  assert.match(twoFactorRoutes, /auth\.2fa\.disabled/, "2FA disable should be audited");
  assert.match(securityRoutes, /\/security\/permission-matrix[\s\S]*requirePermission\("read",\s*\(\) => "security"\)/, "Permission matrix should require read security");
  assert.match(securityRoutes, /\/security\/roles[\s\S]*requirePermission\("write",\s*\(\) => "security"\)/, "Role updates should require write security");
  assert.match(securityAdvancedRoutes, /securityAdvancedRouter\.use\("\/security", authenticateJwt\(\)/, "Advanced security routes should require auth");
  assert.match(securityAlertsRoutes, /authenticateJwt\(\)/, "Security alerts should require auth");
  assert.match(securityBlocklistRoutes, /authenticateJwt\(\)/, "Security blocklist should require auth");
  assert.match(superAdminService, /access\.role !== "superAdmin"/, "Super Admin service should enforce superAdmin role");
  assert.match(resourceRoutes, /requirePermission\("read"\)/, "Resource reads should require permission");
  assert.match(resourceRoutes, /requirePermission\("write"\)/, "Resource writes should require permission");
});

test("Admin security pages call the protected backend surfaces", () => {
  for (const method of ["twoFactorStatus", "twoFactorSetup", "twoFactorEnable", "twoFactorDisable"]) {
    assert.ok(twoFactorPage.includes(method), `Two-Factor page should call ${method}`);
  }
  assert.match(authSession, /secureApiBaseUrl[\s\S]*auth\/2fa\/status/, "2FA status should use secure API base");
  assert.match(authSession, /secureApiBaseUrl[\s\S]*auth\/2fa\/setup/, "2FA setup should use secure API base");
  assert.match(permissionPage, /security\/permission-matrix/, "Permissions page should load security permission matrix");
  for (const endpoint of [
    "security/policy",
    "security/access/devices",
    "security/approvals",
    "security/access-rules",
    "security/data-masks",
    "security/sso-settings",
    "security/api-clients",
    "security/payment-guard",
    "security/privacy-requests",
    "security/account-sharing",
    "security/fraud-warnings",
    "security/disclosure-reports"
  ]) {
    assert.ok(policyCenterPage.includes(endpoint), `${endpoint} should be wired in Policy Center`);
  }
  assert.match(securityShieldPage, /Level 28/, "Security Shield should show the full 28-layer surface");
});

test("Security services remain tenant and branch scoped", () => {
  assert.match(apiService, /x-tenant-id/, "API service should send tenant scope");
  assert.match(apiService, /x-branch-id/, "API service should send branch scope");
  assert.match(securityAdvancedService, /WHERE tenantId = \? AND \(branchId = '' OR branchId = \?\)/, "Advanced security reads should be tenant and branch scoped");
  assert.match(securityAdvancedService, /tenantId: access\.tenantId/, "Advanced security writes should store tenant scope");
  assert.match(securityAdvancedService, /branchId: access\.branchId \|\| ""/, "Advanced security writes should store branch scope");
  assert.match(securityBlocklistService, /WHERE tenantId = \?/, "Blocklist reads should filter by tenant");
  assert.match(securityBlocklistService, /\(branchId = '' OR branchId = \?\)/, "Blocklist reads should include branch scope");
});
