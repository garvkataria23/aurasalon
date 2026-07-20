-- AuraShine Staff OS - Attendance Category and Target Incentive masters.
-- This layer keeps Flexi-style rule/slab definitions tenant-scoped and restart-safe.

CREATE TABLE IF NOT EXISTS staff_target_incentive_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  target_type TEXT NOT NULL,
  assignee_type TEXT NOT NULL DEFAULT 'staff',
  assignee_id TEXT NOT NULL DEFAULT '',
  assignee_name TEXT NOT NULL DEFAULT '',
  role_scope TEXT NOT NULL DEFAULT 'operator',
  slabs_json TEXT NOT NULL DEFAULT '[]',
  notes TEXT DEFAULT '',
  hide INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, target_type, assignee_type, assignee_id, role_scope)
);

CREATE INDEX IF NOT EXISTS idx_staff_target_incentive_master_scope
  ON staff_target_incentive_master(tenant_id, branch_id, target_type, assignee_type, status, hide);
