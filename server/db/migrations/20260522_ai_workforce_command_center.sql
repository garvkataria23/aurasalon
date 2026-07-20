CREATE TABLE IF NOT EXISTS ai_agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_key TEXT NOT NULL,
  agent_name TEXT NOT NULL,
  agent_type TEXT NOT NULL,
  description TEXT,
  status TEXT DEFAULT 'active',
  config_json TEXT DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, agent_key)
);
CREATE INDEX IF NOT EXISTS idx_ai_agents_tenant_status ON ai_agents(tenant_id, status);

CREATE TABLE IF NOT EXISTS ai_agent_tasks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  task_type TEXT NOT NULL,
  input_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'queued',
  risk_level TEXT DEFAULT 'low',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_tasks_scope ON ai_agent_tasks(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS ai_agent_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  task_id TEXT,
  status TEXT DEFAULT 'completed',
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  confidence REAL DEFAULT 0,
  safety_classification TEXT DEFAULT 'low',
  approval_required INTEGER DEFAULT 0,
  started_at TEXT,
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_runs_scope ON ai_agent_runs(tenant_id, branch_id, created_at);

CREATE TABLE IF NOT EXISTS ai_agent_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  agent_id TEXT NOT NULL,
  run_id TEXT,
  decision_type TEXT NOT NULL,
  summary TEXT,
  reasons_json TEXT DEFAULT '[]',
  risks_json TEXT DEFAULT '[]',
  recommended_actions_json TEXT DEFAULT '[]',
  confidence REAL DEFAULT 0,
  risk_level TEXT DEFAULT 'low',
  approval_required INTEGER DEFAULT 0,
  status TEXT DEFAULT 'recommended',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_ai_agent_decisions_scope ON ai_agent_decisions(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS ai_agent_feedback (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  decision_id TEXT,
  run_id TEXT,
  rating INTEGER,
  feedback_text TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_agent_safety_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  rule_key TEXT NOT NULL,
  risk_level TEXT DEFAULT 'medium',
  approval_required INTEGER DEFAULT 1,
  description TEXT,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, rule_key)
);

CREATE TABLE IF NOT EXISTS revenue_leak_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  leak_type TEXT NOT NULL,
  threshold_json TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS revenue_leak_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  leak_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  estimated_revenue_loss REAL DEFAULT 0,
  recommended_action TEXT,
  confidence REAL DEFAULT 0,
  evidence_json TEXT DEFAULT '{}',
  requires_approval INTEGER DEFAULT 1,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_revenue_leak_findings_scope ON revenue_leak_findings(tenant_id, branch_id, status);
CREATE TABLE IF NOT EXISTS revenue_leak_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  finding_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending_approval',
  approved_by TEXT,
  approved_at TEXT,
  details_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS revenue_recovery_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  status TEXT DEFAULT 'completed',
  summary_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);

CREATE TABLE IF NOT EXISTS digital_twin_models (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  model_version TEXT DEFAULT 'v1',
  assumptions_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, branch_id, model_version)
);
CREATE TABLE IF NOT EXISTS digital_twin_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  snapshot_date TEXT NOT NULL,
  metrics_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_digital_twin_snapshots_scope ON digital_twin_snapshots(tenant_id, branch_id, snapshot_date);
CREATE TABLE IF NOT EXISTS digital_twin_simulations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  scenario TEXT NOT NULL,
  input_json TEXT DEFAULT '{}',
  output_json TEXT DEFAULT '{}',
  confidence REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS digital_twin_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  simulation_id TEXT,
  recommendation_type TEXT,
  recommendation_text TEXT,
  risk_level TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'recommended',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owner_commands (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  command_text TEXT NOT NULL,
  status TEXT DEFAULT 'planned',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS owner_command_intents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  command_id TEXT NOT NULL,
  intent_key TEXT NOT NULL,
  confidence REAL DEFAULT 0,
  entities_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS owner_command_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  command_id TEXT NOT NULL,
  plan_json TEXT DEFAULT '{}',
  risk_level TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending_approval',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS owner_command_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  plan_id TEXT NOT NULL,
  action_key TEXT NOT NULL,
  action_label TEXT,
  risk_level TEXT DEFAULT 'medium',
  requires_approval INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending_approval',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS owner_command_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  action_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  comment TEXT,
  decided_by TEXT,
  decided_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_campaign_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  campaign_type TEXT NOT NULL,
  title TEXT NOT NULL,
  objective TEXT,
  status TEXT DEFAULT 'draft',
  requires_approval INTEGER DEFAULT 1,
  quiet_hours_json TEXT DEFAULT '{}',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS whatsapp_campaign_segments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  plan_id TEXT NOT NULL,
  segment_key TEXT NOT NULL,
  criteria_json TEXT DEFAULT '{}',
  audience_count INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS whatsapp_campaign_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  plan_id TEXT NOT NULL,
  language TEXT DEFAULT 'en',
  message_text TEXT NOT NULL,
  policy_safe INTEGER DEFAULT 1,
  opt_out_checked INTEGER DEFAULT 1,
  consent_checked INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS whatsapp_campaign_approvals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  plan_id TEXT NOT NULL,
  decision TEXT NOT NULL,
  decided_by TEXT,
  decided_at TEXT DEFAULT CURRENT_TIMESTAMP,
  comment TEXT
);
CREATE TABLE IF NOT EXISTS whatsapp_campaign_outcomes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  plan_id TEXT NOT NULL,
  sent_count INTEGER DEFAULT 0,
  delivered_count INTEGER DEFAULT 0,
  reply_count INTEGER DEFAULT 0,
  booking_count INTEGER DEFAULT 0,
  revenue_attributed REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS client_memory_nodes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_key TEXT NOT NULL,
  value_json TEXT DEFAULT '{}',
  confidence REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_client_memory_nodes_scope ON client_memory_nodes(tenant_id, client_id, node_type);
CREATE TABLE IF NOT EXISTS client_memory_edges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  edge_type TEXT NOT NULL,
  weight REAL DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS client_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  preference_key TEXT NOT NULL,
  preference_value TEXT,
  confidence REAL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS client_risk_signals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS client_next_best_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  action_text TEXT NOT NULL,
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'recommended',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS client_lifetime_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_json TEXT DEFAULT '{}',
  occurred_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_coaching_insights (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  staff_id TEXT NOT NULL,
  insight_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  insight_text TEXT NOT NULL,
  evidence_json TEXT DEFAULT '{}',
  manager_only INTEGER DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_coaching_goals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  staff_id TEXT NOT NULL,
  goal_type TEXT NOT NULL,
  target_value REAL DEFAULT 0,
  current_value REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  due_date TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_coaching_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  goal_id TEXT,
  staff_id TEXT NOT NULL,
  action_text TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  completed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS staff_skill_gap_analysis (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  staff_id TEXT NOT NULL,
  skill_key TEXT NOT NULL,
  gap_level TEXT DEFAULT 'medium',
  recommendation TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_autopilot_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  rule_key TEXT NOT NULL,
  config_json TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inventory_risk_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  product_id TEXT,
  risk_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS inventory_purchase_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  product_id TEXT,
  recommendation_text TEXT NOT NULL,
  quantity REAL DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  status TEXT DEFAULT 'pending_approval',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT
);
CREATE TABLE IF NOT EXISTS inventory_waste_predictions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  product_id TEXT,
  waste_risk REAL DEFAULT 0,
  evidence_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS payment_risk_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  rule_key TEXT NOT NULL,
  config_json TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS payment_risk_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  risk_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  amount REAL DEFAULT 0,
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);
CREATE TABLE IF NOT EXISTS refund_risk_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  refund_id TEXT,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS discount_abuse_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  actor_user_id TEXT,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS cash_variance_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  variance_amount REAL DEFAULT 0,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS system_health_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  status TEXT DEFAULT 'healthy',
  metrics_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS api_latency_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  route TEXT NOT NULL,
  method TEXT DEFAULT 'GET',
  latency_ms REAL DEFAULT 0,
  status_code INTEGER DEFAULT 200,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS job_run_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  job_key TEXT NOT NULL,
  status TEXT DEFAULT 'completed',
  duration_ms REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS error_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  source TEXT NOT NULL,
  message TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  details_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS tenant_usage_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  metric_key TEXT NOT NULL,
  metric_value REAL DEFAULT 0,
  period_start TEXT,
  period_end TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS security_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  policy_key TEXT NOT NULL,
  config_json TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS suspicious_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  user_id TEXT,
  signal_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS api_abuse_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  route TEXT,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS data_access_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  entity_type TEXT,
  severity TEXT DEFAULT 'medium',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS security_review_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  finding_type TEXT NOT NULL,
  finding_id TEXT,
  priority TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT
);

CREATE TABLE IF NOT EXISTS warehouse_facts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  fact_type TEXT NOT NULL,
  grain TEXT DEFAULT 'daily',
  fact_date TEXT NOT NULL,
  metrics_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS warehouse_dimensions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  dimension_type TEXT NOT NULL,
  source_id TEXT,
  attributes_json TEXT DEFAULT '{}',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS warehouse_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  snapshot_type TEXT NOT NULL,
  snapshot_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS warehouse_refresh_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  status TEXT DEFAULT 'completed',
  facts_created INTEGER DEFAULT 0,
  kpis_created INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT
);
CREATE TABLE IF NOT EXISTS kpi_definitions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  kpi_key TEXT NOT NULL,
  label TEXT NOT NULL,
  formula TEXT,
  target_value REAL DEFAULT 0,
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, kpi_key)
);
CREATE TABLE IF NOT EXISTS kpi_scores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  kpi_key TEXT NOT NULL,
  score_value REAL DEFAULT 0,
  score_date TEXT NOT NULL,
  evidence_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_kpi_scores_scope ON kpi_scores(tenant_id, branch_id, score_date);
