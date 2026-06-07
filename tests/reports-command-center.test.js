import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const reportsComponent = readFileSync("src/app/pages/reports.component.ts", "utf8");
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
