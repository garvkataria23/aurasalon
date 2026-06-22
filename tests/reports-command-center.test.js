import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reportsComponent = readFileSync("src/app/pages/reports.component.ts", "utf8");
const analyticsComponent = readFileSync("src/app/pages/analytics-engine.component.ts", "utf8");
const kpiDetailComponent = readFileSync("src/app/pages/kpi-detail.component.ts", "utf8");
const analyticsRoutes = readFileSync("server/routes/analytics.routes.js", "utf8");
const advancedAnalyticsService = readFileSync("server/services/advanced-analytics.service.js", "utf8");
const operationsRoutes = readFileSync("server/routes/operations.routes.js", "utf8");
const salonOperations = readFileSync("server/services/salon-operations.service.js", "utf8");
const staffSalesReport = readFileSync("server/services/staff-sales-report.service.js", "utf8");
const commissionPreview = readFileSync("server/services/staff-commission-preview.service.js", "utf8");

test("Reports command center sends branch and date filters to the advanced report API", () => {
  assert.match(reportsComponent, /FormsModule/, "reports filters should be editable");
  assert.match(reportsComponent, /this\.api\.report<ApiRecord>\('advanced',\s*\{[\s\S]*branchId:\s*this\.branchId,[\s\S]*from:\s*this\.from,[\s\S]*to:\s*this\.to/s, "advanced report should receive branch/date params");
  assert.match(reportsComponent, /\/reports\/staff-sales/, "staff sales report should stay linked");
  assert.match(reportsComponent, /\/reports\/commission-preview/, "commission preview should stay linked");
  assert.match(reportsComponent, /\/inventory\/reports/, "inventory report should be reachable");
  assert.match(reportsComponent, /\/appointment-activity/, "appointment activity report should be reachable");
});

test("Advanced report route passes query params into the service", () => {
  assert.match(operationsRoutes, /salonOperationsService\.advancedReport\(req\.query,\s*req\.access\)/, "route must not ignore selected branch/date filters");
});

test("Advanced report service is Staff OS aware and branch/date scoped", () => {
  assert.match(salonOperations, /import \{ staffOsService \} from "\.\/staff-os\.service\.js";/, "advanced report should be able to read Staff OS records");
  assert.match(salonOperations, /function listOperationalStaff/, "operational staff lookup should merge Staff OS and legacy records");
  assert.match(salonOperations, /const range = dateRange\(query\);/, "advanced report should normalize date filters");
  assert.match(salonOperations, /repositories\.sales[\s\S]*\.filter\(\(sale\) => dateInRange\(sale,\s*range\)\)/, "sales should be date scoped");
  assert.match(salonOperations, /staffOsService\.listStaff\(\{ branchId,\s*status: query\.status \|\| "active"/, "Staff OS active staff should be available for report rows");
});

test("Staff sales and commission reports resolve Staff OS staff IDs", () => {
  assert.match(staffSalesReport, /staffOsService\.listStaff\(\{ branchId,\s*status: "active"/, "staff sales should resolve Staff OS names");
  assert.match(commissionPreview, /staffOsService\.listStaff\(\{ branchId,\s*status: "active"/, "commission preview should resolve Staff OS incentive profiles");
  assert.match(commissionPreview, /function incentiveRuleFor/, "Staff OS incentive details should be converted into preview rules");
});

test("Reports analytics advanced controls are wired end to end", () => {
  for (const endpoint of [
    "/analytics/report-command-center",
    "/analytics/kpi-detail/:module/:kpiKey",
    "/analytics/export-controls",
    "/analytics/report-schedules",
    "/analytics/anomalies/run"
  ]) {
    assert.ok(analyticsRoutes.includes(endpoint), `${endpoint} should be routed`);
  }
  for (const method of [
    "reportCommandCenter",
    "kpiDetail",
    "createSchedule",
    "exportControls",
    "runAnomalyDetection",
    "aiInsights",
    "reportDrilldowns",
    "kpiDetailMap"
  ]) {
    assert.match(advancedAnalyticsService, new RegExp(`${method}\\(`), `${method} should exist in analytics service`);
  }
  assert.match(advancedAnalyticsService, /anomalyDetectionService/, "Analytics service should use anomaly detection");
  assert.match(reportsComponent, /analytics\/report-command-center/, "Reports page should load advanced command center");
  assert.match(reportsComponent, /analytics\/report-schedules/, "Reports page should create scheduled reports");
  assert.match(reportsComponent, /analytics\/anomalies\/run/, "Reports page should trigger anomaly scan");
  assert.match(reportsComponent, /kpiDetailMap/, "Reports page should render KPI detail mapping");
  assert.match(analyticsComponent, /commandCenter/, "Analytics page should show command center state");
  assert.match(analyticsComponent, /createSchedule/, "Analytics page should expose scheduled report action");
  assert.match(analyticsComponent, /runAnomalyScan/, "Analytics page should expose anomaly action");
  assert.match(kpiDetailComponent, /analytics\/kpi-detail\/\$\{this\.moduleName\(\)\}\/\$\{this\.kpiKey\(\)\}/, "Generic KPI page should load mapped drilldown data");
  assert.match(kpiDetailComponent, /Mapped KPI drill-down/, "Generic KPI page should no longer be a placeholder");
});
