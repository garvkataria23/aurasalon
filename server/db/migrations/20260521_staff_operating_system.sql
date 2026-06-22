-- Aura Salon OS Staff Operating System
-- Idempotent, tenant-safe migration. Existing legacy staff-management tables are left intact.

CREATE TABLE IF NOT EXISTS staff_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  employee_code TEXT,
  first_name TEXT NOT NULL,
  last_name TEXT,
  full_name TEXT NOT NULL,
  mobile TEXT,
  email TEXT,
  gender TEXT,
  dob TEXT,
  profile_photo TEXT,
  joining_date TEXT,
  employment_type TEXT,
  status TEXT DEFAULT 'active',
  role_id TEXT,
  department TEXT,
  designation TEXT,
  emergency_contact_name TEXT,
  emergency_contact_mobile TEXT,
  address TEXT,
  city TEXT,
  state TEXT,
  pincode TEXT,
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, employee_code)
);

CREATE INDEX IF NOT EXISTS idx_staff_master_tenant_branch_status ON staff_master(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_master_tenant_name ON staff_master(tenant_id, full_name);

CREATE TABLE IF NOT EXISTS staff_roles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  role_name TEXT NOT NULL,
  description TEXT,
  priority_level INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, role_name)
);

CREATE TABLE IF NOT EXISTS staff_permissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  role_id TEXT NOT NULL,
  permission_key TEXT NOT NULL,
  permission_value INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, role_id, permission_key)
);

CREATE TABLE IF NOT EXISTS staff_skills (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  skill_level TEXT,
  years_experience REAL DEFAULT 0,
  certified INTEGER DEFAULT 0,
  certification_expiry TEXT,
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, service_id)
);

CREATE TABLE IF NOT EXISTS staff_service_eligibility (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  allowed INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, service_id)
);

CREATE TABLE IF NOT EXISTS staff_documents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  document_type TEXT,
  document_url TEXT,
  verification_status TEXT DEFAULT 'pending',
  expiry_date TEXT,
  uploaded_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_training (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  training_name TEXT,
  trainer_name TEXT,
  certification_name TEXT,
  completion_date TEXT,
  expiry_date TEXT,
  status TEXT DEFAULT 'completed',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_reviews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  customer_id TEXT,
  rating REAL,
  review_text TEXT,
  sentiment TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_targets (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  target_type TEXT,
  target_value REAL,
  achieved_value REAL DEFAULT 0,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_performance_daily (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  branch_id TEXT,
  business_date TEXT,
  appointments_count INTEGER DEFAULT 0,
  completed_services INTEGER DEFAULT 0,
  revenue_generated REAL DEFAULT 0,
  product_sales REAL DEFAULT 0,
  memberships_sold INTEGER DEFAULT 0,
  packages_sold INTEGER DEFAULT 0,
  tips_earned REAL DEFAULT 0,
  utilization_pct REAL DEFAULT 0,
  rebooking_pct REAL DEFAULT 0,
  avg_rating REAL DEFAULT 0,
  cancellations INTEGER DEFAULT 0,
  no_shows INTEGER DEFAULT 0,
  productivity_score REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, business_date)
);

CREATE INDEX IF NOT EXISTS idx_staff_perf_tenant_branch_date ON staff_performance_daily(tenant_id, branch_id, business_date);

CREATE TABLE IF NOT EXISTS staff_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  schedule_date TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  shift_type TEXT DEFAULT 'regular',
  recurrence_rule TEXT,
  status TEXT DEFAULT 'scheduled',
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_schedules_tenant_branch_date ON staff_schedules(tenant_id, branch_id, schedule_date);
CREATE INDEX IF NOT EXISTS idx_staff_schedules_tenant_staff_date ON staff_schedules(tenant_id, staff_id, schedule_date);

CREATE TABLE IF NOT EXISTS staff_shift_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  name TEXT NOT NULL,
  start_time TEXT NOT NULL,
  end_time TEXT NOT NULL,
  break_minutes INTEGER DEFAULT 0,
  color TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_shift_swaps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  schedule_id TEXT NOT NULL,
  from_staff_id TEXT NOT NULL,
  to_staff_id TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_shift_swaps_tenant_status ON staff_shift_swaps(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS staff_branch_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  assignment_type TEXT DEFAULT 'primary',
  starts_at TEXT,
  ends_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, branch_id, assignment_type)
);

CREATE INDEX IF NOT EXISTS idx_staff_branch_assignments_tenant_branch ON staff_branch_assignments(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS staff_availability_blocks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  starts_at TEXT NOT NULL,
  ends_at TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_attendance_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  clock_in_at TEXT,
  clock_out_at TEXT,
  status TEXT DEFAULT 'clocked_in',
  source TEXT DEFAULT 'manual',
  gps_lat REAL,
  gps_lng REAL,
  device_id TEXT,
  selfie_url TEXT,
  late_minutes INTEGER DEFAULT 0,
  early_leave_minutes INTEGER DEFAULT 0,
  overtime_minutes INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_tenant_branch_date ON staff_attendance_logs(tenant_id, branch_id, business_date);
CREATE INDEX IF NOT EXISTS idx_staff_attendance_tenant_staff_date ON staff_attendance_logs(tenant_id, staff_id, business_date);

CREATE TABLE IF NOT EXISTS staff_breaks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  attendance_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  break_type TEXT DEFAULT 'regular',
  started_at TEXT NOT NULL,
  ended_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_corrections (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  attendance_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  requested_by TEXT,
  approved_by TEXT,
  reason TEXT,
  old_value TEXT,
  new_value TEXT,
  status TEXT DEFAULT 'pending',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS attendance_devices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  provider TEXT,
  device_code TEXT NOT NULL,
  device_name TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, device_code)
);

CREATE TABLE IF NOT EXISTS attendance_geo_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  latitude REAL,
  longitude REAL,
  radius_meters INTEGER DEFAULT 150,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_leaves (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  leave_type TEXT DEFAULT 'casual',
  start_date TEXT NOT NULL,
  end_date TEXT NOT NULL,
  reason TEXT,
  status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  rejection_reason TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_leaves_tenant_branch_status ON staff_leaves(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_staff_leaves_tenant_staff_date ON staff_leaves(tenant_id, staff_id, start_date, end_date);

CREATE TABLE IF NOT EXISTS leave_balances (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  leave_type TEXT NOT NULL,
  balance REAL DEFAULT 0,
  used REAL DEFAULT 0,
  period_start TEXT,
  period_end TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, leave_type, period_start)
);

CREATE TABLE IF NOT EXISTS leave_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  leave_type TEXT NOT NULL,
  annual_quota REAL DEFAULT 0,
  carry_forward_allowed INTEGER DEFAULT 0,
  approval_required INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS leave_calendar_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  leave_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  event_date TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_payroll_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  gross_amount REAL DEFAULT 0,
  deductions_amount REAL DEFAULT 0,
  net_amount REAL DEFAULT 0,
  approved_by TEXT,
  approved_at TEXT,
  paid_at TEXT,
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_runs_tenant_period ON staff_payroll_runs(tenant_id, branch_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS staff_payroll_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payroll_run_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  salary_type TEXT DEFAULT 'fixed',
  gross_amount REAL DEFAULT 0,
  overtime_amount REAL DEFAULT 0,
  bonus_amount REAL DEFAULT 0,
  deduction_amount REAL DEFAULT 0,
  net_amount REAL DEFAULT 0,
  statutory_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_components (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  branch_id TEXT,
  component_type TEXT NOT NULL,
  name TEXT NOT NULL,
  amount REAL DEFAULT 0,
  formula TEXT,
  taxable INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_adjustments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  branch_id TEXT,
  payroll_run_id TEXT,
  adjustment_type TEXT,
  amount REAL DEFAULT 0,
  reason TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'pending',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payroll_payouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  payroll_run_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT,
  amount REAL DEFAULT 0,
  payout_mode TEXT,
  reference_no TEXT,
  status TEXT DEFAULT 'pending',
  paid_at TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_commissions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  period_start TEXT,
  period_end TEXT,
  commission_type TEXT DEFAULT 'service',
  base_amount REAL DEFAULT 0,
  commission_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'calculated',
  approved_by TEXT,
  approved_at TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_commissions_tenant_branch_status ON staff_commissions(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS commission_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT,
  role_id TEXT,
  name TEXT NOT NULL,
  commission_type TEXT DEFAULT 'service',
  calculation_type TEXT DEFAULT 'percentage',
  value REAL DEFAULT 0,
  tiers_json TEXT DEFAULT '[]',
  target_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commission_adjustments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  commission_id TEXT,
  amount REAL DEFAULT 0,
  reason TEXT,
  approved_by TEXT,
  status TEXT DEFAULT 'pending',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS commission_run_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  commission_id TEXT NOT NULL,
  source_type TEXT,
  source_id TEXT,
  base_amount REAL DEFAULT 0,
  commission_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_tips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  source_type TEXT DEFAULT 'manual',
  source_id TEXT,
  amount REAL DEFAULT 0,
  tip_mode TEXT DEFAULT 'cash',
  business_date TEXT NOT NULL,
  status TEXT DEFAULT 'collected',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_tips_tenant_branch_date ON staff_tips(tenant_id, branch_id, business_date);

CREATE TABLE IF NOT EXISTS tip_payouts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT,
  period_start TEXT,
  period_end TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  paid_at TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS tip_pool_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  tip_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  share_pct REAL DEFAULT 0,
  share_amount REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT,
  title TEXT NOT NULL,
  description TEXT,
  task_type TEXT DEFAULT 'general',
  priority TEXT DEFAULT 'medium',
  due_at TEXT,
  status TEXT DEFAULT 'open',
  assigned_by TEXT,
  completed_at TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_tasks_tenant_branch_status ON staff_tasks(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS task_comments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  task_id TEXT NOT NULL,
  actor_user_id TEXT,
  comment_text TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_checklists (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  name TEXT NOT NULL,
  checklist_type TEXT DEFAULT 'daily',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS checklist_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  checklist_id TEXT NOT NULL,
  title TEXT NOT NULL,
  sort_order INTEGER DEFAULT 0,
  required INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  actor_user_id TEXT,
  actor_role TEXT,
  action TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  before_json TEXT,
  after_json TEXT,
  details_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_tenant_entity ON staff_audit_logs(tenant_id, entity_type, entity_id);
CREATE INDEX IF NOT EXISTS idx_staff_audit_logs_tenant_created ON staff_audit_logs(tenant_id, created_at);
