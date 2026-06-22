-- AuraShine Client Masters - Flexi-level customer definition layer.
-- Additive schema for reusable CRM master data used by client profiles,
-- consultations, feedback capture, campaigns, loyalty, and future bulk updates.

CREATE TABLE IF NOT EXISTS client_category_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  color TEXT DEFAULT '#2563eb',
  discount_percent REAL DEFAULT 0,
  loyalty_multiplier REAL DEFAULT 1,
  visit_threshold INTEGER DEFAULT 0,
  spend_threshold REAL DEFAULT 0,
  hide INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_client_category_master_scope
  ON client_category_master(tenant_id, branch_id, status, hide);

CREATE TABLE IF NOT EXISTS client_source_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  source_type TEXT DEFAULT 'walk_in',
  default_campaign_id TEXT DEFAULT '',
  referral_required INTEGER DEFAULT 0,
  attribution_window_days INTEGER DEFAULT 30,
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_client_source_master_scope
  ON client_source_master(tenant_id, branch_id, source_type, status, hide);

CREATE TABLE IF NOT EXISTS client_preference_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  preference_type TEXT DEFAULT 'general',
  options_json TEXT DEFAULT '[]',
  risk_level TEXT DEFAULT 'none',
  consent_required INTEGER DEFAULT 0,
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_client_preference_master_scope
  ON client_preference_master(tenant_id, branch_id, preference_type, status, hide);

CREATE TABLE IF NOT EXISTS client_consultation_template_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  template_type TEXT DEFAULT 'general',
  sections_json TEXT DEFAULT '[]',
  consent_required INTEGER DEFAULT 1,
  validity_days INTEGER DEFAULT 180,
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_client_consultation_template_scope
  ON client_consultation_template_master(tenant_id, branch_id, template_type, status, hide);

CREATE TABLE IF NOT EXISTS client_feedback_definition_master (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  feedback_type TEXT DEFAULT 'service',
  trigger_event TEXT DEFAULT 'visit_completed',
  rating_scale INTEGER DEFAULT 5,
  questions_json TEXT DEFAULT '[]',
  score_rules_json TEXT DEFAULT '{}',
  hide INTEGER DEFAULT 0,
  notes TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, code)
);

CREATE INDEX IF NOT EXISTS idx_client_feedback_definition_scope
  ON client_feedback_definition_master(tenant_id, branch_id, feedback_type, status, hide);

CREATE TABLE IF NOT EXISTS client_master_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  actor_user_id TEXT DEFAULT '',
  actor_role TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  before_json TEXT DEFAULT '{}',
  after_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_master_audit_logs_scope
  ON client_master_audit_logs(tenant_id, branch_id, entity_type, entity_id, created_at);
