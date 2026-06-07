import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

const migration = readFileSync("server/db/migrations/20260522_statutory_compliance.sql", "utf8");
const app = readFileSync("server/app.js", "utf8");
const pfRoutes = readFileSync("server/routes/compliance/pf.routes.js", "utf8");
const tdsRoutes = readFileSync("server/routes/compliance/tds.routes.js", "utf8");
const dashboardRoutes = readFileSync("server/routes/compliance/dashboard.routes.js", "utf8");
const pfService = readFileSync("server/services/compliance/pf.service.js", "utf8");
const esiService = readFileSync("server/services/compliance/esi.service.js", "utf8");
const ptService = readFileSync("server/services/compliance/pt.service.js", "utf8");
const tdsService = readFileSync("server/services/compliance/tds.service.js", "utf8");
const gratuityService = readFileSync("server/services/compliance/gratuity.service.js", "utf8");

test("statutory migration creates tenant scoped compliance tables", () => {
  const requiredTables = [
    "statutory_establishment",
    "staff_statutory_profile",
    "pf_contributions",
    "esi_contributions",
    "pt_deductions",
    "tds_deductions",
    "gratuity_provisions",
    "bonus_calculations",
    "lwf_contributions",
    "compliance_fy_locks",
    "compliance_audit_events"
  ];
  for (const table of requiredTables) {
    const tableDef = migration.match(new RegExp(`CREATE TABLE IF NOT EXISTS ${table} \\([\\s\\S]*?\\);`))?.[0] || "";
    assert.ok(tableDef, `${table} table exists`);
    assert.match(tableDef, /tenant_id TEXT NOT NULL/, `${table} has tenant_id`);
  }
});

test("statutory routes are mounted and expose core endpoints", () => {
  assert.match(app, /ensureStatutoryComplianceSchema/);
  assert.match(app, /statutoryComplianceRouter/);
  assert.match(pfRoutes, /\/compliance\/pf\/generate-ecr/);
  assert.match(pfRoutes, /\/compliance\/pf\/rate-update/);
  assert.match(tdsRoutes, /\/compliance\/tds\/generate-form-24q/);
  assert.match(tdsRoutes, /\/compliance\/tds\/generate-form-16/);
  assert.match(dashboardRoutes, /\/compliance\/dashboard\/compliance-score/);
});

test("statutory calculation services encode Indian compliance rules", () => {
  assert.match(pfService, /employee_pf_pct \|\| 12/);
  assert.match(pfService, /employer_eps_pct \|\| 8\.33/);
  assert.match(esiService, /employee_esi_pct \|\| 0\.75/);
  assert.match(esiService, /employer_esi_pct \|\| 3\.25/);
  assert.match(ptService, /2500 - Number/);
  assert.match(tdsService, /taxableIncome <= 700000/);
  assert.match(tdsService, /taxableIncome <= 500000/);
  assert.match(gratuityService, /basicDa \* 15 \* years\) \/ 26/);
});
