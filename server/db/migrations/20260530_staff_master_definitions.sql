-- AuraShine Staff OS - Flexi-level master definitions.
-- Additive and restart-safe: existing operational attendance, leave, payroll,
-- and roster data remains untouched.

CREATE TABLE IF NOT EXISTS staff_attendance_status_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  day_count REAL DEFAULT 1,
  paid INTEGER DEFAULT 1,
  available_for_appointment INTEGER DEFAULT 0,
  hide INTEGER DEFAULT 0,
  color TEXT DEFAULT '#0f766e',
  sort_order INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_status_master_scope
  ON staff_attendance_status_master(tenant_id, branch_id, status, hide);

CREATE TABLE IF NOT EXISTS staff_leave_type_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  day_count REAL DEFAULT 1,
  paid INTEGER DEFAULT 1,
  available_for_appointment INTEGER DEFAULT 0,
  leave_quota REAL DEFAULT 0,
  quota_period TEXT DEFAULT 'yearly',
  shift_template_id TEXT DEFAULT '',
  shift_name TEXT DEFAULT '',
  carry_forward_allowed INTEGER DEFAULT 0,
  approval_required INTEGER DEFAULT 1,
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_staff_leave_type_master_scope
  ON staff_leave_type_master(tenant_id, branch_id, status, hide);

CREATE TABLE IF NOT EXISTS staff_attendance_category_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  name TEXT NOT NULL,
  working_duration_minutes INTEGER DEFAULT 0,
  in_time TEXT DEFAULT '',
  out_time TEXT DEFAULT '',
  overtime_applicable INTEGER DEFAULT 0,
  minimum_ot_duration_minutes INTEGER DEFAULT 0,
  allowable_late_minutes INTEGER DEFAULT 0,
  late_mark_status_id TEXT DEFAULT '',
  late_mark_after_count INTEGER DEFAULT 0,
  late_mark_mode TEXT DEFAULT 'every_x_late',
  severe_late_status_id TEXT DEFAULT '',
  severe_late_after_minutes INTEGER DEFAULT 0,
  attendance_slab_json TEXT DEFAULT '[]',
  allowable_shift_ids_json TEXT DEFAULT '[]',
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, name)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_category_master_scope
  ON staff_attendance_category_master(tenant_id, branch_id, status, hide);
