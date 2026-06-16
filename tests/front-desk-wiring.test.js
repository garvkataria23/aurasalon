import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const serverApp = readFileSync("server/app.js", "utf8");
const depositRoutes = readFileSync("server/routes/appointment-deposit-gate.routes.js", "utf8");
const enterpriseSchedulerRoutes = readFileSync("server/routes/enterprise-scheduler.routes.js", "utf8");
const smartBookingRoutes = readFileSync("server/routes/smart-booking.routes.js", "utf8");
const bookingPortalRoutes = readFileSync("server/routes/booking-portal.routes.js", "utf8");
const customer360Routes = readFileSync("server/routes/customer-360.routes.js", "utf8");
const clientMasterRoutes = readFileSync("server/routes/client-master.routes.js", "utf8");
const resourceRoutes = readFileSync("server/routes/resource.routes.js", "utf8");

const frontDeskPaths = [
  "/appointments",
  "/appointment-activity",
  "/appointment-deposits",
  "/smart-booking",
  "/salon-3d",
  "/book",
  "/queue-system",
  "/customer-360",
  "/clients",
  "/client-masters"
];

test("Front Desk sidebar exposes every sale-critical module", () => {
  assert.match(appComponent, /id:\s*'frontdesk'/, "frontdesk group should exist");
  assert.match(appComponent, /label:\s*'Front Desk'/, "frontdesk group should keep its label");
  assert.match(appComponent, /primaryPath:\s*'\/appointments'/, "frontdesk should open appointments first");
  for (const path of frontDeskPaths) {
    assert.match(appComponent, new RegExp(`path:\\s*'${path.replace("/", "\\/")}'`), `${path} should be in Front Desk sidebar`);
  }
});

test("Front Desk Angular routes stay wired to pages or module routes", () => {
  const routePaths = [
    "appointments",
    "appointment-activity",
    "appointment-deposits",
    "smart-booking",
    "salon-3d",
    "book",
    "queue-system",
    "customer-360",
    "clients",
    "client-masters"
  ];
  for (const path of routePaths) {
    assert.match(appRoutes, new RegExp(`path:\\s*'${path}'`), `${path} route should exist`);
  }
  assert.match(appRoutes, /path:\s*'appointment-deposits'[\s\S]*permissionGuard[\s\S]*read:appointment_deposits/, "deposit report must stay permission guarded");
  assert.match(appRoutes, /path:\s*'queue-system'[\s\S]*entity:\s*'queueDisplays'/, "queue TV should use the queueDisplays resource");
});

test("Front Desk backend APIs are mounted for legacy and v1 clients", () => {
  for (const routerName of [
    "enterpriseSchedulerRouter",
    "appointmentActivityRouter",
    "appointmentDepositGateRouter",
    "bookingPortalRouter",
    "bookingPortalV2Router",
    "crmRouter",
    "clientMasterRouter",
    "customer360Router",
    "smartBookingRouter",
    "resourceRouter"
  ]) {
    assert.match(serverApp, new RegExp(`import \\{ ${routerName} \\}`), `${routerName} should be imported`);
    assert.match(serverApp, new RegExp(`app\\.use\\("/api(?:/v1)?",(?:\\s*authenticateJwt\\(\\),)?\\s*${routerName}\\)`), `${routerName} should be mounted`);
  }
});

test("Front Desk APIs keep tenant, branch and permission boundaries", () => {
  assert.match(enterpriseSchedulerRoutes, /requirePermission\("read",\s*\(\) => "appointments"\)/, "appointments read permission is required");
  assert.match(enterpriseSchedulerRoutes, /requirePermission\("write",\s*\(\) => "appointments"\)/, "appointments write permission is required");
  assert.match(depositRoutes, /requirePermission\("read",\s*\(\) => "appointment_deposits"\)/, "deposit report read permission is required");
  assert.match(depositRoutes, /requirePermission\("write",\s*\(\) => "appointment_deposits"\)/, "deposit booking write permission is required");
  assert.match(smartBookingRoutes, /requirePermission\("read",\s*\(\) => "smart-booking"\)/, "smart booking read permission is required");
  assert.match(smartBookingRoutes, /requirePermission\("write",\s*\(\) => "smart-booking"\)/, "smart booking write permission is required");
  assert.match(bookingPortalRoutes, /requirePermission\("write",\s*\(\) => "booking-portal"\)/, "booking portal write permission is required");
  assert.match(customer360Routes, /requirePermission\("read",\s*\(\) => "customer-360"\)/, "customer 360 read permission is required");
  assert.match(resourceRoutes, /tenantId:\s*access\.tenantId/, "resource events should stay tenant scoped");
  assert.match(resourceRoutes, /branchId:\s*row\.branchId \|\| access\.branchId \|\| ""/, "resource events should stay branch scoped");
  assert.match(clientMasterRoutes, /clientMasterService\.(list|create|get|update|updateStatus)\([^,]+,[^)]*req\.access\)/, "client masters should pass access context into service calls");
});
