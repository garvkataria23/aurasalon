-- AuraShine Staff OS - Flexi Employee Masters completion.
-- Additive tables for service assignment, payroll definitions, statutory setup,
-- and bulk employee master updates.

CREATE TABLE IF NOT EXISTS staff_service_assignment_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  staff_id TEXT NOT NULL,
  staff_name TEXT NOT NULL DEFAULT '',
  role_scope TEXT NOT NULL DEFAULT 'operator',
  service_ids_json TEXT DEFAULT '[]',
  service_snapshot_json TEXT DEFAULT '[]',
  category_filter_json TEXT DEFAULT '[]',
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, staff_id, role_scope)
);

CREATE INDEX IF NOT EXISTS idx_staff_service_assignment_scope
  ON staff_service_assignment_master(tenant_id, branch_id, role_scope, status, hide);

CREATE TABLE IF NOT EXISTS staff_fine_penalty_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  amount REAL DEFAULT 0,
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, name)
);

CREATE INDEX IF NOT EXISTS idx_staff_fine_penalty_scope
  ON staff_fine_penalty_master(tenant_id, branch_id, status, hide);

CREATE TABLE IF NOT EXISTS staff_allowance_deduction_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  description TEXT NOT NULL,
  entry_type TEXT NOT NULL DEFAULT 'allowance',
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, entry_type, description)
);

CREATE INDEX IF NOT EXISTS idx_staff_allowance_deduction_scope
  ON staff_allowance_deduction_master(tenant_id, branch_id, entry_type, status, hide);

CREATE TABLE IF NOT EXISTS staff_payroll_salary_structure_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL DEFAULT 'Default Payroll Salary Structure',
  provident_fund_json TEXT DEFAULT '{}',
  professional_tax_json TEXT DEFAULT '{}',
  esic_json TEXT DEFAULT '{}',
  tds_json TEXT DEFAULT '{}',
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_structure_scope
  ON staff_payroll_salary_structure_master(tenant_id, branch_id, status, hide);

CREATE TABLE IF NOT EXISTS staff_bulk_employee_update_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  total_rows INTEGER DEFAULT 0,
  updated_rows INTEGER DEFAULT 0,
  failed_rows INTEGER DEFAULT 0,
  results_json TEXT DEFAULT '[]',
  requested_by TEXT DEFAULT '',
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_bulk_employee_update_jobs_scope
  ON staff_bulk_employee_update_jobs(tenant_id, branch_id, created_at);
