import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const appComponent = readFileSync("src/app/app.component.ts", "utf8");
const appRoutes = readFileSync("src/app/app.routes.ts", "utf8");
const appsLaunchpad = readFileSync("src/app/pages/apps-launchpad.component.ts", "utf8");
const staffOsRoutes = readFileSync("src/app/features/staff-os/staff-os.routes.ts", "utf8");
const serverApp = readFileSync("server/app.js", "utf8");
const staffOsRouter = readFileSync("server/routes/staff-os.routes.js", "utf8");
const staffMasterRoutes = readFileSync("server/routes/staff-master.routes.js", "utf8");
const staffAttendanceRoutes = readFileSync("server/routes/staff-attendance.routes.js", "utf8");
const staffPayrollRoutes = readFileSync("server/routes/staff-payroll.routes.js", "utf8");
const staffCommissionRoutes = readFileSync("server/routes/staff-commission.routes.js", "utf8");
const staffSelfRoutes = readFileSync("server/routes/staff-self.routes.js", "utf8");
const staffMasterService = readFileSync("server/services/staff-master.service.js", "utf8");
const staffOsService = readFileSync("server/services/staff-os.service.js", "utf8");
const staffPayrollService = readFileSync("server/services/staff-payroll.service.js", "utf8");
const staffAttendanceService = readFileSync("server/services/staff-attendance.service.js", "utf8");

const staffSidebarPaths = [
  "/staff/my-work",
  "/staff-os/salary-workspace",
  "/staff-os/staff-list",
  "/staff-os/staff-categories",
  "/staff-os/employee-masters",
  "/staff-os/attendance-master",
  "/staff-os/leave-master",
  "/staff-os/shift-master",
  "/staff-os/attendance-category",
  "/staff-os/face-punch",
  "/staff-os/service-assignment",
  "/staff-os/attendance-dashboard",
  "/staff-os/roster-calendar",
  "/staff-os/leave-management",
  "/staff-os/payroll-rules",
  "/staff-os/salary-generate",
  "/staff-os/payroll-dashboard",
  "/staff-os/fines-penalties",
  "/staff-os/allowance-deduction",
  "/staff-os/payroll-salary-structure",
  "/pos/tips",
  "/commissions",
  "/staff-os/commission-dashboard",
  "/staff-os/target-incentives/service",
  "/reports/commission-preview",
  "/reports/staff-sales",
  "/reports/invoices",
  "/staff-os/training-center"
];

const topLevelStaffRoutes = [
  "staff/my-work",
  "staff/connected-modules",
  "staff",
  "staff-enterprise",
  "staff-os",
  "commissions",
  "reports/commission-preview",
  "reports/staff-sales",
  "reports/invoices",
  "pos/tips",
  "training-academy"
];

const staffOsChildRoutes = [
  "staff-list",
  "salary-workspace",
  "staff-categories",
  "staff-profile",
  "employee-masters",
  "attendance-master",
  "leave-master",
  "shift-master",
  "attendance-category",
  "face-punch",
  "service-assignment",
  "bulk-employee-update",
  "attendance-dashboard",
  "roster-calendar",
  "leave-management",
  "payroll-dashboard",
  "payroll-rules",
  "salary-generate",
  "fines-penalties",
  "allowance-deduction",
  "payroll-salary-structure",
  "commission-dashboard",
  "target-incentives/service",
  "target-incentives/product",
  "target-incentives/membership",
  "target-incentives/branch-admin",
  "target-incentives/admin",
  "target-incentives/all-transaction",
  "performance-dashboard",
  "leaderboard",
  "training-center",
  "task-board",
  "mobile-preview",
  "heatmaps/roster",
  "heatmaps/attendance",
  "heatmaps/utilization",
  "heatmaps/payroll-cost",
  "heatmaps/leave-calendar"
];

test("Staff sidebar exposes every Staff OS route needed for sale-ready HR operations", () => {
  assert.match(appComponent, /id:\s*'staff'/, "Staff sidebar group should exist");
  assert.match(appComponent, /primaryPath:\s*'\/staff-os\/employee-masters'/, "Staff group should open employee masters");
  assert.match(appComponent, /path:\s*'\/staff-os\/employee-masters'[\s\S]*label:\s*'Staff OS'/, "top quick Staff OS action should open employee masters");
  for (const path of staffSidebarPaths) {
    assert.match(appComponent, new RegExp(`path:\\s*'${path.replace("/", "\\/")}'`), `${path} should be in Staff sidebar`);
  }
  assert.doesNotMatch(appComponent, /path:\s*'\/staff'/, "legacy staff directory should not be a direct sidebar duplicate");
  assert.doesNotMatch(appComponent, /path:\s*'\/staff-enterprise'/, "legacy staff enterprise should not be a direct sidebar duplicate");
  assert.doesNotMatch(appComponent, /path:\s*'\/staff-os'/, "Staff OS shell route should not compete with concrete Staff OS pages");
});

test("Staff Angular routes and lazy Staff OS child routes stay wired", () => {
  for (const path of topLevelStaffRoutes) {
    assert.match(appRoutes, new RegExp(`path:\\s*'${path}'`), `${path} top-level route should exist`);
  }
  for (const path of staffOsChildRoutes) {
    assert.match(staffOsRoutes, new RegExp(`path:\\s*'${path}'`), `${path} Staff OS child route should exist`);
  }
  assert.match(appRoutes, /staff-os[\s\S]*permissionGuard[\s\S]*read:staff/, "Staff OS shell should be permission guarded");
  assert.match(appRoutes, /staff\/my-work[\s\S]*permissionGuard[\s\S]*read:appointments/, "My Work should be appointment-read guarded");
  assert.match(appRoutes, /path:\s*'staff'[\s\S]*redirectTo:\s*'staff-os\/employee-masters'/, "legacy /staff should redirect to Staff OS");
  assert.match(appRoutes, /path:\s*'staff-enterprise'[\s\S]*redirectTo:\s*'staff-os\/employee-masters'/, "legacy /staff-enterprise should redirect to Staff OS");
  assert.doesNotMatch(appsLaunchpad, /path:\s*'\/staff-enterprise'/, "Apps launchpad should not expose legacy Staff Enterprise duplicate");
  assert.doesNotMatch(appsLaunchpad, /path:\s*'\/staff'[\s,}]/, "Apps launchpad should not expose legacy Smart Staff duplicate");
  assert.match(appsLaunchpad, /path:\s*'\/staff-os\/employee-masters'[\s\S]*label:\s*'Staff OS'/, "Apps launchpad should open canonical Staff OS");
});

test("Staff backend routers are mounted for v1 and legacy clients", () => {
  for (const routerName of ["staffManagementRouter", "staffOsRouter", "staffEnterpriseRouter", "staffSelfRouter", "staffSalesReportRouter"]) {
    assert.match(serverApp, new RegExp(`import \\{ ${routerName} \\}`), `${routerName} should be imported`);
  }
  for (const routerName of ["staffManagementRouter", "staffOsRouter", "staffEnterpriseRouter", "staffSelfRouter"]) {
    assert.match(serverApp, new RegExp(`app\\.use\\("/api/v1", authenticateJwt\\(\\), ${routerName}\\)`), `${routerName} should be authenticated on /api/v1`);
  }
  assert.match(serverApp, /app\.use\("\/api", staffOsRouter\)/, "legacy Staff OS API should stay mounted");
  assert.match(serverApp, /app\.use\("\/api", staffEnterpriseRouter\)/, "legacy Staff Enterprise API should stay mounted");
  assert.match(staffSelfRoutes, /authenticateJwt\(\)[\s\S]*requirePermission\("read",\s*\(\) => "appointments"\)/, "staff self dashboard should require auth and appointment read");
});

test("Staff OS route composition covers masters, attendance, payroll, commission and advanced modules", () => {
  for (const routerName of [
    "staffMasterRouter",
    "staffScheduleRouter",
    "staffAttendanceRouter",
    "staffLeaveRouter",
    "staffPayrollRouter",
    "staffCommissionRouter",
    "staffTipsRouter",
    "staffPerformanceRouter",
    "staffTaskRouter",
    "staffReportsRouter",
    "staffBiometricRouter",
    "staffWhatsappNotificationRouter",
    "staffApprovalRouter",
    "staffRosterOptimizerRouter",
    "staffManpowerForecastRouter"
  ]) {
    assert.match(staffOsRouter, new RegExp(`staffOsRouter\\.use\\(${routerName}\\)`), `${routerName} should be composed into Staff OS`);
  }
});

test("Staff APIs expose critical HR workflows and pass access context", () => {
  for (const endpoint of [
    "/staff-os/staff",
    "/staff-os/staff-categories",
    "/staff-os/attendance-masters",
    "/staff-os/leave-masters",
    "/staff-os/shift-masters",
    "/staff-os/attendance-categories",
    "/staff-os/target-incentives",
    "/staff-os/service-assignments",
    "/staff-os/fine-penalties",
    "/staff-os/allowance-deductions",
    "/staff-os/payroll-structures",
    "/staff-os/bulk-employee-update"
  ]) {
    assert.ok(staffMasterRoutes.includes(endpoint), `${endpoint} should be routed`);
  }
  assert.match(staffAttendanceRoutes, /staffAttendanceService\.clockIn\(req\.body,\s*req\.access\)/, "attendance should pass access context");
  assert.match(staffPayrollRoutes, /staffPayrollService\.generatePayroll\(req\.body,\s*req\.access\)/, "payroll should pass access context");
  assert.match(staffCommissionRoutes, /staffOsService\.calculateCommission\(req\.body,\s*req\.access\)/, "commission should pass access context");
});

test("Staff services keep tenant, branch and sensitive payroll boundaries", () => {
  assert.match(staffMasterService, /staffOsService as staffMasterService/, "staff master service should use the Staff OS service implementation");
  assert.match(staffOsService, /tenantId:\s*access\.tenantId/, "staff masters should persist tenant scope");
  assert.match(staffOsService, /assertBranchAccess|branchIdFrom|branchId/, "staff masters should preserve branch context");
  assert.match(staffOsService, /tenant_id = \?|tenantId = \?/g, "Staff OS service should filter by tenant");
  assert.match(staffPayrollService, /staffOsService as staffPayrollService/, "staff payroll service should use the Staff OS service implementation");
  assert.match(staffAttendanceService, /staffOsService as staffAttendanceService/, "staff attendance service should use the Staff OS service implementation");
  assert.match(staffOsService, /staff\.payroll_generated/, "payroll generation should audit sensitive payroll actions");
  assert.match(staffOsService, /Payroll can be generated only by owner\/admin\/accountant/, "payroll should block ordinary staff generation");
  assert.match(staffOsService, /Only manager\/admin\/owner can correct attendance/, "attendance correction should block ordinary staff");
});
