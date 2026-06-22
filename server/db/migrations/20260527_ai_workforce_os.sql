CREATE TABLE IF NOT EXISTS ai_agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_key TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'approved',
  provider_key TEXT DEFAULT 'not_configured',
  autonomy_level TEXT DEFAULT 'approval_required',
  config_json TEXT DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, agent_key)
);

CREATE TABLE IF NOT EXISTS ai_agent_settings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  autonomy_level TEXT DEFAULT 'approval_required',
  approval_required INTEGER DEFAULT 1,
  risk_threshold TEXT DEFAULT 'medium',
  provider_key TEXT DEFAULT 'not_configured',
  model_key TEXT DEFAULT '',
  module_permissions_json TEXT DEFAULT '[]',
  branch_permissions_json TEXT DEFAULT '[]',
  prompt_version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'approved',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_provider_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  provider_key TEXT NOT NULL,
  provider_name TEXT,
  model_key TEXT DEFAULT '',
  status TEXT DEFAULT 'not_configured',
  api_key_ref TEXT DEFAULT '',
  endpoint_url TEXT DEFAULT '',
  config_json TEXT DEFAULT '{}',
  risk_level TEXT DEFAULT 'medium',
  approval_status TEXT DEFAULT 'pending',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, branch_id, provider_key)
);

CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  task_id TEXT,
  run_type TEXT DEFAULT 'manual',
  provider_key TEXT DEFAULT 'not_configured',
  model_key TEXT DEFAULT '',
  prompt_version INTEGER DEFAULT 1,
  status TEXT DEFAULT 'completed',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'not_required',
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  confidence REAL DEFAULT 0,
  safety_score REAL DEFAULT 0,
  safety_classification TEXT DEFAULT 'low',
  approval_required INTEGER DEFAULT 0,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  duration_ms REAL DEFAULT 0,
  error_text TEXT DEFAULT '',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_run_steps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  run_id TEXT NOT NULL,
  agent_id TEXT NOT NULL,
  step_key TEXT NOT NULL,
  step_name TEXT,
  step_order INTEGER DEFAULT 0,
  status TEXT DEFAULT 'pending',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'not_required',
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  error_text TEXT DEFAULT '',
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  schedule_id TEXT,
  playbook_id TEXT,
  task_type TEXT NOT NULL,
  task_name TEXT,
  description TEXT,
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'queued',
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,
  due_at TEXT,
  completed_at TEXT,
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'not_required',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_approval_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  run_id TEXT,
  decision_id TEXT,
  approval_type TEXT DEFAULT 'decision',
  title TEXT NOT NULL,
  summary TEXT,
  proposed_action_json TEXT DEFAULT '{}',
  before_payload_json TEXT DEFAULT '{}',
  after_payload_json TEXT DEFAULT '{}',
  risk_level TEXT DEFAULT 'medium',
  confidence REAL DEFAULT 0,
  safety_score REAL DEFAULT 0,
  approval_status TEXT DEFAULT 'pending',
  status TEXT DEFAULT 'pending',
  requested_by TEXT,
  assigned_to TEXT,
  decided_by TEXT,
  decided_at TEXT,
  decision_notes TEXT,
  due_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT,
  run_id TEXT,
  alert_type TEXT NOT NULL,
  title TEXT NOT NULL,
  message TEXT,
  severity TEXT DEFAULT 'medium',
  risk_level TEXT DEFAULT 'medium',
  approval_status TEXT DEFAULT 'not_required',
  status TEXT DEFAULT 'open',
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolved_by TEXT,
  resolved_at TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT,
  run_id TEXT,
  queue_id TEXT,
  action TEXT NOT NULL,
  target_type TEXT,
  target_id TEXT,
  actor_id TEXT,
  actor_role TEXT,
  before_json TEXT DEFAULT '{}',
  after_json TEXT DEFAULT '{}',
  details_json TEXT DEFAULT '{}',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'not_required',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_schedules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  schedule_name TEXT NOT NULL,
  schedule_type TEXT DEFAULT 'manual',
  cron_expression TEXT,
  timezone TEXT DEFAULT 'Asia/Kolkata',
  next_run_at TEXT,
  last_run_at TEXT,
  status TEXT DEFAULT 'active',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'approved',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_playbooks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  playbook_key TEXT NOT NULL,
  playbook_name TEXT NOT NULL,
  trigger_type TEXT DEFAULT 'condition',
  condition_json TEXT DEFAULT '{}',
  action_json TEXT DEFAULT '{}',
  escalation_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  risk_level TEXT DEFAULT 'medium',
  approval_status TEXT DEFAULT 'pending',
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_prompt_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  prompt_key TEXT DEFAULT 'default',
  version INTEGER DEFAULT 1,
  system_prompt TEXT,
  user_prompt TEXT,
  guardrails_json TEXT DEFAULT '{}',
  provider_key TEXT DEFAULT 'not_configured',
  model_key TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  risk_level TEXT DEFAULT 'medium',
  approval_status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_costs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT,
  run_id TEXT,
  provider_key TEXT DEFAULT 'not_configured',
  model_key TEXT DEFAULT '',
  cost_date TEXT NOT NULL,
  prompt_tokens INTEGER DEFAULT 0,
  completion_tokens INTEGER DEFAULT 0,
  total_tokens INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'recorded',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'not_required',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_kpi_impact (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT,
  run_id TEXT,
  impact_date TEXT NOT NULL,
  kpi_key TEXT NOT NULL,
  kpi_label TEXT,
  baseline_value REAL DEFAULT 0,
  impact_value REAL DEFAULT 0,
  estimated_revenue_impact REAL DEFAULT 0,
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'estimated',
  risk_level TEXT DEFAULT 'low',
  approval_status TEXT DEFAULT 'not_required',
  evidence_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agents_unique_key
  ON ai_agents(tenant_id, agent_key);
CREATE INDEX IF NOT EXISTS idx_ai_agents_scope
  ON ai_agents(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_ai_agents_created
  ON ai_agents(tenant_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agent_settings_agent_scope
  ON ai_agent_settings(tenant_id, agent_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_ai_agent_settings_scope
  ON ai_agent_settings(tenant_id, branch_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_provider_configs_scope
  ON ai_agent_provider_configs(tenant_id, branch_id, provider_key, status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_scope
  ON ai_agent_runs(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_agent
  ON ai_agent_runs(tenant_id, agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_risk
  ON ai_agent_runs(tenant_id, risk_level, approval_status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_run_steps_run
  ON ai_agent_run_steps(tenant_id, run_id, step_order);
CREATE INDEX IF NOT EXISTS idx_ai_agent_run_steps_agent
  ON ai_agent_run_steps(tenant_id, agent_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_scope
  ON ai_agent_tasks(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_agent
  ON ai_agent_tasks(tenant_id, agent_id, task_type, status);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_schedule
  ON ai_agent_tasks(tenant_id, schedule_id, playbook_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agent_approval_unique_decision
  ON ai_agent_approval_queue(tenant_id, run_id, decision_id, approval_type);
CREATE INDEX IF NOT EXISTS idx_ai_agent_approval_scope
  ON ai_agent_approval_queue(tenant_id, branch_id, approval_status, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_approval_agent
  ON ai_agent_approval_queue(tenant_id, agent_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_alerts_scope
  ON ai_agent_alerts(tenant_id, branch_id, status, severity, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_alerts_agent
  ON ai_agent_alerts(tenant_id, agent_id, status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_audit_scope
  ON ai_agent_audit_logs(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_audit_agent
  ON ai_agent_audit_logs(tenant_id, agent_id, created_at);
CREATE INDEX IF NOT EXISTS idx_ai_agent_audit_target
  ON ai_agent_audit_logs(tenant_id, target_type, target_id);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agent_schedules_name
  ON ai_agent_schedules(tenant_id, agent_id, schedule_name);
CREATE INDEX IF NOT EXISTS idx_ai_agent_schedules_next
  ON ai_agent_schedules(tenant_id, branch_id, status, next_run_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agent_playbooks_version
  ON ai_agent_playbooks(tenant_id, agent_id, playbook_key, version);
CREATE INDEX IF NOT EXISTS idx_ai_agent_playbooks_scope
  ON ai_agent_playbooks(tenant_id, branch_id, status);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ai_agent_prompt_versions_agent_version
  ON ai_agent_prompt_versions(tenant_id, agent_id, version);
CREATE INDEX IF NOT EXISTS idx_ai_agent_prompt_versions_scope
  ON ai_agent_prompt_versions(tenant_id, branch_id, status, approval_status);

CREATE INDEX IF NOT EXISTS idx_ai_agent_costs_scope
  ON ai_agent_costs(tenant_id, branch_id, cost_date);
CREATE INDEX IF NOT EXISTS idx_ai_agent_costs_agent
  ON ai_agent_costs(tenant_id, agent_id, run_id);

CREATE INDEX IF NOT EXISTS idx_ai_agent_kpi_impact_scope
  ON ai_agent_kpi_impact(tenant_id, branch_id, impact_date);
CREATE INDEX IF NOT EXISTS idx_ai_agent_kpi_impact_agent
  ON ai_agent_kpi_impact(tenant_id, agent_id, kpi_key);
