-- Staff category master for Staff OS.
-- Additive tables only: role permissions remain separate from operational staff categories.

CREATE TABLE IF NOT EXISTS staff_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  scope TEXT NOT NULL DEFAULT 'staff',
  department TEXT,
  default_designation TEXT,
  default_employment_type TEXT DEFAULT 'full_time',
  fixed_incentive_amount REAL DEFAULT 0,
  fixed_incentive_percent REAL DEFAULT 0,
  service_eligibility_json TEXT DEFAULT '[]',
  skill_license_json TEXT DEFAULT '[]',
  notes TEXT,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, scope, name)
);

CREATE INDEX IF NOT EXISTS idx_staff_categories_tenant_branch_scope
  ON staff_categories(tenant_id, branch_id, scope, status);

CREATE TABLE IF NOT EXISTS staff_category_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  staff_id TEXT NOT NULL,
  category_id TEXT NOT NULL,
  assigned_at TEXT DEFAULT CURRENT_TIMESTAMP,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, category_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_category_assignments_staff
  ON staff_category_assignments(tenant_id, staff_id, status);
