-- Additive Employee Master detail storage for Staff OS.
-- Existing staff_master remains the source of core staff identity.

CREATE TABLE IF NOT EXISTS staff_employee_details (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  staff_id TEXT NOT NULL,
  short_name TEXT DEFAULT '',
  last_working_date TEXT DEFAULT '',
  anniversary_date TEXT DEFAULT '',
  hide_from_roster INTEGER DEFAULT 0,
  allow_skip_otp INTEGER DEFAULT 0,
  entry_pin_salt TEXT DEFAULT '',
  entry_pin_hash TEXT DEFAULT '',
  entry_pin_set INTEGER DEFAULT 0,
  multi_branch_access_json TEXT DEFAULT '[]',
  contact_json TEXT DEFAULT '{}',
  emergency_contact_json TEXT DEFAULT '{}',
  native_contact_json TEXT DEFAULT '{}',
  incentive_json TEXT DEFAULT '{}',
  attendance_salary_json TEXT DEFAULT '{}',
  remarks TEXT DEFAULT '',
  imei_no TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id)
);

CREATE INDEX IF NOT EXISTS idx_staff_employee_details_tenant_branch
  ON staff_employee_details(tenant_id, branch_id, staff_id);
