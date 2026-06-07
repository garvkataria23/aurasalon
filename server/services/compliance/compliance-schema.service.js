import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../db.js";

let ensured = false;

export function ensureStatutoryComplianceSchema() {
  if (ensured) return;
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const migration = readFileSync(join(root, "server", "db", "migrations", "20260522_statutory_compliance.sql"), "utf8");
  db.exec(migration);
  seedDefaultRateMasters();
  ensured = true;
}

function seedDefaultRateMasters(tenantId = "tenant_aura") {
  const pfExists = db.prepare("SELECT id FROM pf_rate_master WHERE tenant_id = ? LIMIT 1").get(tenantId);
  if (!pfExists) {
    db.prepare(`
      INSERT INTO pf_rate_master
        (id, tenant_id, effective_from, employee_pf_pct, employer_pf_pct, employer_eps_pct, edli_pct, pf_admin_charges_pct, edli_admin_charges_pct, wage_ceiling, eps_ceiling)
      VALUES
        ('pf_rate_default_2026', ?, '2026-04-01', 12, 3.67, 8.33, 0.5, 0.5, 0, 15000, 15000)
    `).run(tenantId);
  }

  const esiExists = db.prepare("SELECT id FROM esi_rate_master WHERE tenant_id = ? LIMIT 1").get(tenantId);
  if (!esiExists) {
    db.prepare(`
      INSERT INTO esi_rate_master
        (id, tenant_id, effective_from, employee_esi_pct, employer_esi_pct, wage_ceiling, disabled_wage_ceiling)
      VALUES
        ('esi_rate_default_2026', ?, '2026-04-01', 0.75, 3.25, 21000, 25000)
    `).run(tenantId);
  }

  const tdsExists = db.prepare("SELECT id FROM tds_regime_master WHERE tenant_id = ? AND fy = '2025-26' LIMIT 1").get(tenantId);
  if (!tdsExists) seedTds(tenantId);

  const ptExists = db.prepare("SELECT id FROM pt_slab_master WHERE tenant_id = ? LIMIT 1").get(tenantId);
  if (!ptExists) seedPt(tenantId);

  const lwfExists = db.prepare("SELECT id FROM lwf_rate_master WHERE tenant_id = ? LIMIT 1").get(tenantId);
  if (!lwfExists) seedLwf(tenantId);
}

function seedTds(tenantId) {
  const rows = [
    ["new", 0, 300000, 0, 75000, 700000, 0],
    ["new", 300000, 700000, 5, 75000, 700000, 0],
    ["new", 700000, 1000000, 10, 75000, 700000, 0],
    ["new", 1000000, 1200000, 15, 75000, 700000, 0],
    ["new", 1200000, 1500000, 20, 75000, 700000, 0],
    ["new", 1500000, null, 30, 75000, 700000, 0],
    ["old", 0, 250000, 0, 50000, 500000, 12500],
    ["old", 250000, 500000, 5, 50000, 500000, 12500],
    ["old", 500000, 1000000, 20, 50000, 500000, 12500],
    ["old", 1000000, null, 30, 50000, 500000, 12500]
  ];
  const stmt = db.prepare(`
    INSERT INTO tds_regime_master
      (id, tenant_id, fy, regime_type, slab_min, slab_max, tax_rate, cess_rate, standard_deduction, rebate_limit, rebate_amount)
    VALUES
      (@id, @tenant_id, '2025-26', @regime_type, @slab_min, @slab_max, @tax_rate, 4, @standard_deduction, @rebate_limit, @rebate_amount)
  `);
  for (const [regime_type, slab_min, slab_max, tax_rate, standard_deduction, rebate_limit, rebate_amount] of rows) {
    stmt.run({
      id: `tds_${regime_type}_${slab_min || 0}_${slab_max || "up"}_2025`,
      tenant_id: tenantId,
      regime_type,
      slab_min,
      slab_max,
      tax_rate,
      standard_deduction,
      rebate_limit,
      rebate_amount
    });
  }
}

function seedPt(tenantId) {
  const rows = [
    ["MH", 0, 7500, 0, "all", "", null],
    ["MH", 7500.01, 10000, 175, "male", "", null],
    ["MH", 7500.01, 10000, 0, "female", "", null],
    ["MH", 10000.01, null, 200, "all", "02", 300],
    ["KA", 0, 25000, 0, "all", "", null],
    ["KA", 25000.01, null, 200, "all", "", null],
    ["TN", 0, 21000, 0, "all", "", null],
    ["TN", 21000.01, 30000, 135, "all", "", null],
    ["TN", 30000.01, 45000, 315, "all", "", null],
    ["TN", 45000.01, 60000, 690, "all", "", null],
    ["TN", 60000.01, 75000, 1025, "all", "", null],
    ["TN", 75000.01, null, 1250, "all", "", null],
    ["WB", 0, 10000, 0, "all", "", null],
    ["WB", 10000.01, 15000, 110, "all", "", null],
    ["WB", 15000.01, 25000, 130, "all", "", null],
    ["WB", 25000.01, 40000, 150, "all", "", null],
    ["WB", 40000.01, null, 200, "all", "", null],
    ["TS", 0, 15000, 0, "all", "", null],
    ["TS", 15000.01, 20000, 150, "all", "", null],
    ["TS", 20000.01, null, 200, "all", "", null],
    ["AP", 0, 15000, 0, "all", "", null],
    ["AP", 15000.01, 20000, 150, "all", "", null],
    ["AP", 20000.01, null, 200, "all", "", null],
    ["GJ", 0, 12000, 0, "all", "", null],
    ["GJ", 12000.01, null, 200, "all", "", null]
  ];
  const stmt = db.prepare(`
    INSERT INTO pt_slab_master
      (id, tenant_id, state_code, effective_from, slab_min, slab_max, monthly_tax, gender_specific, special_month, special_month_tax)
    VALUES
      (@id, @tenant_id, @state_code, '2026-04-01', @slab_min, @slab_max, @monthly_tax, @gender_specific, @special_month, @special_month_tax)
  `);
  rows.forEach((row, index) => {
    stmt.run({
      id: `pt_${row[0]}_${index}_2026`,
      tenant_id: tenantId,
      state_code: row[0],
      slab_min: row[1],
      slab_max: row[2],
      monthly_tax: row[3],
      gender_specific: row[4],
      special_month: row[5],
      special_month_tax: row[6]
    });
  });
}

function seedLwf(tenantId) {
  const rows = [
    ["MH", 25, 75, "half_yearly", "06,12"],
    ["KA", 20, 40, "annual", "12"],
    ["TN", 10, 20, "annual", "12"],
    ["WB", 3, 15, "half_yearly", "06,12"],
    ["GJ", 6, 12, "half_yearly", "06,12"],
    ["DL", 0.75, 2.25, "half_yearly", "06,12"]
  ];
  const stmt = db.prepare(`
    INSERT INTO lwf_rate_master
      (id, tenant_id, state_code, employee_contribution, employer_contribution, contribution_frequency, contribution_month, effective_from)
    VALUES
      (@id, @tenant_id, @state_code, @employee_contribution, @employer_contribution, @contribution_frequency, @contribution_month, '2026-04-01')
  `);
  rows.forEach((row) => stmt.run({
    id: `lwf_${row[0]}_2026`,
    tenant_id: tenantId,
    state_code: row[0],
    employee_contribution: row[1],
    employer_contribution: row[2],
    contribution_frequency: row[3],
    contribution_month: row[4]
  }));
}
