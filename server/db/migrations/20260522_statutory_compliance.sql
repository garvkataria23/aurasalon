-- Aura Salon OS - Step 19 Indian Statutory Compliance Engine
-- UP migration. All statutory tables are tenant scoped. Rate changes are
-- insert-only by design; services never UPDATE rate master rows.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS statutory_establishment (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  legal_entity_name TEXT NOT NULL,
  pan TEXT NOT NULL,
  tan TEXT,
  gstin TEXT,
  pf_establishment_code TEXT,
  esi_establishment_code TEXT,
  pt_registration_number TEXT,
  pt_enrollment_number TEXT,
  lwf_registration_number TEXT,
  shop_act_number TEXT,
  state_code TEXT NOT NULL,
  signatory_name TEXT,
  signatory_designation TEXT,
  signatory_pan TEXT,
  registered_address TEXT,
  pf_applicable INTEGER DEFAULT 1,
  esi_applicable INTEGER DEFAULT 1,
  pt_applicable INTEGER DEFAULT 1,
  lwf_applicable INTEGER DEFAULT 1,
  bonus_applicable INTEGER DEFAULT 1,
  gratuity_applicable INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_stat_est_tenant_branch ON statutory_establishment(tenant_id, branch_id);

CREATE TABLE IF NOT EXISTS staff_statutory_profile (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  pan TEXT,
  aadhaar_masked TEXT,
  uan TEXT,
  pf_account_number TEXT,
  esi_number TEXT,
  pt_state TEXT,
  pf_applicable INTEGER DEFAULT 1,
  esi_applicable INTEGER DEFAULT 1,
  pt_applicable INTEGER DEFAULT 1,
  lwf_applicable INTEGER DEFAULT 1,
  tax_regime TEXT DEFAULT 'new',
  vpf_percentage REAL DEFAULT 0,
  international_worker INTEGER DEFAULT 0,
  excluded_employee INTEGER DEFAULT 0,
  excluded_reason TEXT,
  bank_account_number TEXT,
  bank_ifsc TEXT,
  bank_name TEXT,
  account_holder_name TEXT,
  nominee_name TEXT,
  nominee_relation TEXT,
  pf_join_date TEXT,
  esi_join_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_stat_profile_tenant_staff ON staff_statutory_profile(tenant_id, staff_id);

CREATE TABLE IF NOT EXISTS pf_rate_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  employee_pf_pct REAL DEFAULT 12.0,
  employer_pf_pct REAL DEFAULT 3.67,
  employer_eps_pct REAL DEFAULT 8.33,
  edli_pct REAL DEFAULT 0.5,
  pf_admin_charges_pct REAL DEFAULT 0.5,
  edli_admin_charges_pct REAL DEFAULT 0.0,
  wage_ceiling REAL DEFAULT 15000,
  eps_ceiling REAL DEFAULT 15000,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pf_rate_tenant_effective ON pf_rate_master(tenant_id, effective_from);

CREATE TABLE IF NOT EXISTS pf_contributions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  payroll_id TEXT NOT NULL,
  wage_month TEXT NOT NULL,
  fy TEXT NOT NULL,
  pf_wages REAL DEFAULT 0,
  eps_wages REAL DEFAULT 0,
  edli_wages REAL DEFAULT 0,
  employee_pf REAL DEFAULT 0,
  employer_pf REAL DEFAULT 0,
  employer_eps REAL DEFAULT 0,
  vpf_amount REAL DEFAULT 0,
  edli_contribution REAL DEFAULT 0,
  pf_admin_charges REAL DEFAULT 0,
  edli_admin_charges REAL DEFAULT 0,
  total_employee REAL DEFAULT 0,
  total_employer REAL DEFAULT 0,
  ncp_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  ecr_file_id TEXT,
  trrn TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, payroll_id, wage_month)
);

CREATE INDEX IF NOT EXISTS idx_pf_contrib_tenant_month ON pf_contributions(tenant_id, branch_id, wage_month);
CREATE INDEX IF NOT EXISTS idx_pf_contrib_staff ON pf_contributions(tenant_id, staff_id, wage_month);

CREATE TABLE IF NOT EXISTS pf_ecr_files (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  wage_month TEXT NOT NULL,
  file_path TEXT NOT NULL,
  total_employees INTEGER,
  total_pf_wages REAL,
  total_employee_share REAL,
  total_employer_share REAL,
  total_eps_share REAL,
  total_edli REAL,
  total_admin_charges REAL,
  total_challan_amount REAL,
  trrn TEXT,
  challan_status TEXT DEFAULT 'generated',
  generated_by TEXT,
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pf_ecr_tenant_month ON pf_ecr_files(tenant_id, branch_id, wage_month);

CREATE TABLE IF NOT EXISTS esi_rate_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  employee_esi_pct REAL DEFAULT 0.75,
  employer_esi_pct REAL DEFAULT 3.25,
  wage_ceiling REAL DEFAULT 21000,
  disabled_wage_ceiling REAL DEFAULT 25000,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_esi_rate_tenant_effective ON esi_rate_master(tenant_id, effective_from);

CREATE TABLE IF NOT EXISTS esi_contributions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  payroll_id TEXT NOT NULL,
  wage_month TEXT NOT NULL,
  fy TEXT NOT NULL,
  contribution_period TEXT NOT NULL,
  benefit_period TEXT,
  esi_wages REAL DEFAULT 0,
  employee_esi REAL DEFAULT 0,
  employer_esi REAL DEFAULT 0,
  total_esi REAL DEFAULT 0,
  working_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  return_file_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, payroll_id, wage_month)
);

CREATE INDEX IF NOT EXISTS idx_esi_contrib_tenant_period ON esi_contributions(tenant_id, branch_id, contribution_period);

CREATE TABLE IF NOT EXISTS esi_returns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  contribution_period TEXT NOT NULL,
  file_path TEXT NOT NULL,
  total_employees INTEGER,
  total_wages REAL,
  total_contribution REAL,
  challan_number TEXT,
  status TEXT DEFAULT 'generated',
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_esi_returns_tenant_period ON esi_returns(tenant_id, branch_id, contribution_period);

CREATE TABLE IF NOT EXISTS pt_slab_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  slab_min REAL NOT NULL,
  slab_max REAL,
  monthly_tax REAL NOT NULL,
  gender_specific TEXT DEFAULT 'all',
  special_month TEXT,
  special_month_tax REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pt_slab_tenant_state ON pt_slab_master(tenant_id, state_code, effective_from);

CREATE TABLE IF NOT EXISTS pt_deductions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  payroll_id TEXT NOT NULL,
  wage_month TEXT NOT NULL,
  state_code TEXT NOT NULL,
  gross_wages REAL,
  pt_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, payroll_id, wage_month)
);

CREATE INDEX IF NOT EXISTS idx_pt_deductions_tenant_month ON pt_deductions(tenant_id, branch_id, wage_month);

CREATE TABLE IF NOT EXISTS pt_returns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  return_period TEXT NOT NULL,
  return_type TEXT,
  file_path TEXT,
  total_employees INTEGER,
  total_pt REAL,
  status TEXT DEFAULT 'generated',
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_pt_returns_tenant_period ON pt_returns(tenant_id, state_code, return_period);

CREATE TABLE IF NOT EXISTS tds_regime_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  fy TEXT NOT NULL,
  regime_type TEXT NOT NULL,
  slab_min REAL,
  slab_max REAL,
  tax_rate REAL,
  surcharge_threshold REAL,
  surcharge_rate REAL,
  cess_rate REAL DEFAULT 4.0,
  standard_deduction REAL DEFAULT 50000,
  rebate_limit REAL,
  rebate_amount REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_tds_regime_tenant_fy ON tds_regime_master(tenant_id, fy, regime_type);

CREATE TABLE IF NOT EXISTS staff_tax_declaration (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  fy TEXT NOT NULL,
  regime TEXT DEFAULT 'new',
  hra_received REAL DEFAULT 0,
  rent_paid REAL DEFAULT 0,
  metro_city INTEGER DEFAULT 0,
  lta_claimed REAL DEFAULT 0,
  sec_80c REAL DEFAULT 0,
  sec_80d_self REAL DEFAULT 0,
  sec_80d_parents REAL DEFAULT 0,
  sec_80ccd_1b REAL DEFAULT 0,
  sec_80e REAL DEFAULT 0,
  sec_80g REAL DEFAULT 0,
  sec_80tta REAL DEFAULT 0,
  home_loan_interest REAL DEFAULT 0,
  other_income REAL DEFAULT 0,
  previous_employer_income REAL DEFAULT 0,
  previous_employer_tds REAL DEFAULT 0,
  proof_submitted INTEGER DEFAULT 0,
  proof_verified INTEGER DEFAULT 0,
  locked INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, fy)
);

CREATE INDEX IF NOT EXISTS idx_staff_tax_decl_tenant_staff ON staff_tax_declaration(tenant_id, staff_id, fy);

CREATE TABLE IF NOT EXISTS tds_deductions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  payroll_id TEXT NOT NULL,
  wage_month TEXT NOT NULL,
  fy TEXT NOT NULL,
  projected_annual_income REAL,
  projected_annual_tax REAL,
  tax_already_deducted REAL,
  months_remaining INTEGER,
  tds_this_month REAL DEFAULT 0,
  regime_used TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, payroll_id, wage_month)
);

CREATE INDEX IF NOT EXISTS idx_tds_deductions_tenant_month ON tds_deductions(tenant_id, branch_id, wage_month);

CREATE TABLE IF NOT EXISTS form_24q (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  fy TEXT NOT NULL,
  quarter TEXT NOT NULL,
  file_path TEXT,
  total_deductees INTEGER,
  total_tds REAL,
  status TEXT DEFAULT 'generated',
  rrr_number TEXT,
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_form24q_tenant_qtr ON form_24q(tenant_id, branch_id, fy, quarter);

CREATE TABLE IF NOT EXISTS form_16 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  fy TEXT NOT NULL,
  part_a_pdf TEXT,
  part_b_pdf TEXT,
  total_salary REAL,
  total_tds REAL,
  issued_at TEXT,
  digital_signature TEXT,
  UNIQUE (tenant_id, staff_id, fy)
);

CREATE INDEX IF NOT EXISTS idx_form16_tenant_staff ON form_16(tenant_id, staff_id, fy);

CREATE TABLE IF NOT EXISTS gratuity_provisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  fy TEXT NOT NULL,
  years_of_service REAL,
  last_drawn_basic REAL,
  last_drawn_da REAL,
  gratuity_eligible_amount REAL,
  provisioned_amount REAL,
  cumulative_provision REAL,
  status TEXT DEFAULT 'provisioned',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_gratuity_provisions_tenant_fy ON gratuity_provisions(tenant_id, fy, staff_id);

CREATE TABLE IF NOT EXISTS gratuity_payouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  exit_date TEXT,
  years_of_service REAL,
  last_drawn_basic_da REAL,
  gratuity_calculated REAL,
  gratuity_exempt REAL,
  gratuity_taxable REAL,
  payout_status TEXT,
  paid_on TEXT,
  fnf_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_gratuity_payouts_tenant_staff ON gratuity_payouts(tenant_id, staff_id);

CREATE TABLE IF NOT EXISTS bonus_calculations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  fy TEXT NOT NULL,
  bonus_wages REAL,
  working_days INTEGER,
  bonus_percentage REAL DEFAULT 8.33,
  bonus_amount REAL,
  exgratia_amount REAL DEFAULT 0,
  total_payable REAL,
  paid_date TEXT,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, fy)
);

CREATE INDEX IF NOT EXISTS idx_bonus_calc_tenant_fy ON bonus_calculations(tenant_id, fy, staff_id);

CREATE TABLE IF NOT EXISTS lwf_rate_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  state_code TEXT NOT NULL,
  employee_contribution REAL,
  employer_contribution REAL,
  contribution_frequency TEXT,
  contribution_month TEXT,
  effective_from TEXT NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_lwf_rate_tenant_state ON lwf_rate_master(tenant_id, state_code, effective_from);

CREATE TABLE IF NOT EXISTS lwf_contributions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  payroll_id TEXT NOT NULL,
  contribution_period TEXT,
  employee_amount REAL,
  employer_amount REAL,
  total_amount REAL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, staff_id, payroll_id, contribution_period)
);

CREATE INDEX IF NOT EXISTS idx_lwf_contrib_tenant_period ON lwf_contributions(tenant_id, branch_id, contribution_period);

CREATE TABLE IF NOT EXISTS compliance_fy_locks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  fy TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  closed_by TEXT,
  closed_at TEXT,
  reopened_by TEXT,
  reopened_at TEXT,
  reopen_reason TEXT,
  archive_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, fy)
);

CREATE TABLE IF NOT EXISTS compliance_audit_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  module TEXT NOT NULL,
  action TEXT NOT NULL,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  actor_user_id TEXT,
  actor_role TEXT,
  severity TEXT DEFAULT 'info',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_compliance_audit_tenant_time ON compliance_audit_events(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_compliance_audit_module ON compliance_audit_events(tenant_id, module, action);

-- DOWN:
-- DROP TABLEs in reverse order. Not executed automatically because payroll and
-- statutory history must be retained for Indian compliance audits.
