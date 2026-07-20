CREATE TABLE IF NOT EXISTS ai_ceo_daily_briefs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  brief_date TEXT NOT NULL,
  role_scope TEXT DEFAULT 'owner',
  summary TEXT,
  top_actions_json TEXT DEFAULT '[]',
  evidence_json TEXT DEFAULT '{}',
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'generated',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_ceo_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  brief_id TEXT,
  action_type TEXT NOT NULL,
  title TEXT NOT NULL,
  impact_area TEXT DEFAULT '',
  priority INTEGER DEFAULT 5,
  risk_level TEXT DEFAULT 'medium',
  confidence REAL DEFAULT 0,
  evidence_json TEXT DEFAULT '{}',
  recommended_action_json TEXT DEFAULT '{}',
  approval_status TEXT DEFAULT 'pending',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_coo_signals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  signal_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  summary TEXT,
  evidence_json TEXT DEFAULT '{}',
  recommended_action_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS autonomous_approval_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  source_module TEXT NOT NULL,
  source_id TEXT DEFAULT '',
  request_type TEXT NOT NULL,
  title TEXT NOT NULL,
  risk_level TEXT DEFAULT 'medium',
  status TEXT DEFAULT 'pending',
  evidence_json TEXT DEFAULT '{}',
  decision_json TEXT DEFAULT '{}',
  delegated_to TEXT DEFAULT '',
  snoozed_until TEXT DEFAULT '',
  requested_by TEXT DEFAULT '',
  decided_by TEXT DEFAULT '',
  decided_at TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS autonomous_approval_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  request_id TEXT NOT NULL,
  action_type TEXT NOT NULL,
  actor_user_id TEXT DEFAULT '',
  actor_role TEXT DEFAULT '',
  comment TEXT DEFAULT '',
  payload_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS autonomous_approval_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  request_id TEXT NOT NULL,
  evidence_type TEXT DEFAULT 'note',
  evidence_json TEXT DEFAULT '{}',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS autonomous_approval_delegations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  request_id TEXT NOT NULL,
  delegated_to TEXT NOT NULL,
  delegated_by TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_model_providers (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  provider_key TEXT NOT NULL,
  provider_name TEXT NOT NULL,
  model_family TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  cost_per_1k_tokens REAL DEFAULT 0,
  avg_latency_ms INTEGER DEFAULT 0,
  accuracy_score REAL DEFAULT 0,
  credential_ref TEXT DEFAULT '',
  policy_json TEXT DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, provider_key, model_family)
);

CREATE TABLE IF NOT EXISTS ai_model_routes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  route_key TEXT NOT NULL,
  task_type TEXT NOT NULL,
  preferred_provider_id TEXT DEFAULT '',
  fallback_provider_ids_json TEXT DEFAULT '[]',
  selection_policy_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_model_run_metrics (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  provider_id TEXT NOT NULL,
  route_key TEXT DEFAULT '',
  task_type TEXT DEFAULT '',
  latency_ms INTEGER DEFAULT 0,
  token_count INTEGER DEFAULT 0,
  estimated_cost REAL DEFAULT 0,
  accuracy_score REAL DEFAULT 0,
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS ai_model_router_decisions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  task_type TEXT NOT NULL,
  selected_provider_id TEXT NOT NULL,
  selected_provider_key TEXT NOT NULL,
  reason_json TEXT DEFAULT '[]',
  policy_json TEXT DEFAULT '{}',
  estimated_cost REAL DEFAULT 0,
  estimated_latency_ms INTEGER DEFAULT 0,
  confidence REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_ledger_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_version INTEGER DEFAULT 1,
  event_payload_json TEXT DEFAULT '{}',
  metadata_json TEXT DEFAULT '{}',
  actor_user_id TEXT DEFAULT '',
  occurred_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_ledger_replay_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  aggregate_type TEXT DEFAULT '',
  aggregate_id TEXT DEFAULT '',
  event_count INTEGER DEFAULT 0,
  replay_result_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'completed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS event_ledger_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  aggregate_type TEXT NOT NULL,
  aggregate_id TEXT NOT NULL,
  snapshot_version INTEGER DEFAULT 1,
  snapshot_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS war_room_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  snapshot_date TEXT NOT NULL,
  total_branches INTEGER DEFAULT 0,
  revenue_risk_count INTEGER DEFAULT 0,
  manpower_gap_count INTEGER DEFAULT 0,
  fraud_alert_count INTEGER DEFAULT 0,
  stockout_risk_count INTEGER DEFAULT 0,
  burnout_risk_count INTEGER DEFAULT 0,
  pending_cash_close_count INTEGER DEFAULT 0,
  summary_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS war_room_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  title TEXT NOT NULL,
  evidence_json TEXT DEFAULT '{}',
  recommended_action_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS war_room_branch_scores (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  score_date TEXT NOT NULL,
  revenue_score REAL DEFAULT 0,
  manpower_score REAL DEFAULT 0,
  inventory_score REAL DEFAULT 0,
  fraud_score REAL DEFAULT 0,
  staff_wellness_score REAL DEFAULT 0,
  overall_risk_score REAL DEFAULT 0,
  evidence_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digital_twin_v2_scenarios (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  scenario_type TEXT NOT NULL,
  scenario_name TEXT NOT NULL,
  input_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digital_twin_v2_forecasts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  scenario_id TEXT DEFAULT '',
  forecast_type TEXT DEFAULT 'full_business',
  projected_revenue REAL DEFAULT 0,
  projected_profit REAL DEFAULT 0,
  projected_staff_cost REAL DEFAULT 0,
  projected_stock_risk REAL DEFAULT 0,
  projected_campaign_impact REAL DEFAULT 0,
  confidence REAL DEFAULT 0,
  risks_json TEXT DEFAULT '[]',
  recommendations_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS digital_twin_v2_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  forecast_id TEXT NOT NULL,
  title TEXT NOT NULL,
  risk_level TEXT DEFAULT 'medium',
  recommendation_json TEXT DEFAULT '{}',
  requires_approval INTEGER DEFAULT 1,
  status TEXT DEFAULT 'pending',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_super_graph_nodes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  node_type TEXT NOT NULL,
  node_key TEXT NOT NULL,
  node_value TEXT DEFAULT '',
  properties_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_super_graph_edges (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  from_node_id TEXT NOT NULL,
  to_node_id TEXT NOT NULL,
  relationship_type TEXT NOT NULL,
  weight REAL DEFAULT 1,
  properties_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS customer_super_graph_signals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  signal_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  signal_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_receptionist_calls (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  phone TEXT NOT NULL,
  direction TEXT DEFAULT 'inbound',
  language TEXT DEFAULT 'en-IN',
  intent TEXT DEFAULT '',
  status TEXT DEFAULT 'captured',
  summary TEXT DEFAULT '',
  consent_status TEXT DEFAULT 'unknown',
  human_handoff_required INTEGER DEFAULT 0,
  provider_call_id TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_receptionist_transcripts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  call_id TEXT NOT NULL,
  transcript_json TEXT DEFAULT '[]',
  entities_json TEXT DEFAULT '{}',
  redaction_status TEXT DEFAULT 'privacy_checked',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS voice_receptionist_handoffs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  call_id TEXT NOT NULL,
  handoff_to TEXT DEFAULT '',
  reason TEXT DEFAULT '',
  transcript_summary TEXT DEFAULT '',
  status TEXT DEFAULT 'queued',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS computer_vision_sources (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  source_type TEXT NOT NULL,
  source_key TEXT NOT NULL,
  privacy_policy_json TEXT DEFAULT '{}',
  enabled INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS computer_vision_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  source_id TEXT DEFAULT '',
  event_type TEXT NOT NULL,
  severity TEXT DEFAULT 'low',
  privacy_mode TEXT DEFAULT 'metadata_only',
  metadata_json TEXT DEFAULT '{}',
  evidence_ref TEXT DEFAULT '',
  status TEXT DEFAULT 'review_required',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS computer_vision_privacy_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  rule_key TEXT NOT NULL,
  rule_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_commerce_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  phone TEXT NOT NULL,
  session_type TEXT DEFAULT 'commerce',
  status TEXT DEFAULT 'open',
  consent_status TEXT DEFAULT 'unknown',
  last_intent TEXT DEFAULT '',
  cart_total REAL DEFAULT 0,
  payment_status TEXT DEFAULT 'not_started',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_commerce_carts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  session_id TEXT NOT NULL,
  cart_items_json TEXT DEFAULT '[]',
  package_balance_json TEXT DEFAULT '{}',
  invoice_json TEXT DEFAULT '{}',
  total_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS whatsapp_commerce_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  session_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT DEFAULT '{}',
  approval_required INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enterprise_mobile_apps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  app_type TEXT NOT NULL,
  platform TEXT DEFAULT 'pwa',
  version_name TEXT DEFAULT '',
  offline_enabled INTEGER DEFAULT 1,
  push_enabled INTEGER DEFAULT 0,
  policy_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'ready',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS enterprise_mobile_push_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  app_type TEXT NOT NULL,
  recipient_id TEXT DEFAULT '',
  title TEXT NOT NULL,
  body TEXT DEFAULT '',
  payload_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'queued',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS owner_mobile_briefs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  brief_date TEXT NOT NULL,
  summary TEXT DEFAULT '',
  actions_json TEXT DEFAULT '[]',
  metrics_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'ready',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS franchise_units (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  franchise_name TEXT NOT NULL,
  owner_name TEXT DEFAULT '',
  owner_email TEXT DEFAULT '',
  royalty_percent REAL DEFAULT 0,
  territory_json TEXT DEFAULT '{}',
  sop_score REAL DEFAULT 0,
  status TEXT DEFAULT 'onboarding',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS franchise_royalty_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  franchise_id TEXT DEFAULT '',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_revenue REAL DEFAULT 0,
  royalty_percent REAL DEFAULT 0,
  royalty_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'draft',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS franchise_sop_audits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  franchise_id TEXT DEFAULT '',
  audit_type TEXT DEFAULT 'brand_sop',
  score REAL DEFAULT 0,
  findings_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_brain_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  snapshot_date TEXT NOT NULL,
  cash_flow_forecast REAL DEFAULT 0,
  profit_margin REAL DEFAULT 0,
  tax_reserve REAL DEFAULT 0,
  salary_to_revenue_ratio REAL DEFAULT 0,
  product_margin REAL DEFAULT 0,
  service_margin REAL DEFAULT 0,
  metrics_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_brain_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  finding_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  estimated_amount REAL DEFAULT 0,
  evidence_json TEXT DEFAULT '{}',
  recommended_action_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS financial_brain_forecasts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  forecast_json TEXT DEFAULT '{}',
  confidence REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_connectors (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  provider_key TEXT NOT NULL,
  provider_type TEXT NOT NULL,
  display_name TEXT NOT NULL,
  credential_ref TEXT DEFAULT '',
  capabilities_json TEXT DEFAULT '[]',
  health_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS provider_connector_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  connector_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  payload_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'recorded',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_plugins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  plugin_key TEXT NOT NULL,
  plugin_name TEXT NOT NULL,
  category TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  permissions_json TEXT DEFAULT '[]',
  install_policy_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'available',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS marketplace_plugin_installs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  plugin_id TEXT NOT NULL,
  installed_by TEXT DEFAULT '',
  install_state_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'installed',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS cloud_readiness_checks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  check_type TEXT NOT NULL,
  provider_target TEXT DEFAULT 'postgres_supabase',
  status TEXT DEFAULT 'pending',
  score REAL DEFAULT 0,
  findings_json TEXT DEFAULT '[]',
  recommended_actions_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS backup_restore_points (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  backup_type TEXT DEFAULT 'database',
  storage_ref TEXT DEFAULT '',
  checksum TEXT DEFAULT '',
  size_bytes INTEGER DEFAULT 0,
  status TEXT DEFAULT 'created',
  restore_verified INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS disaster_recovery_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  run_type TEXT DEFAULT 'restore_drill',
  backup_id TEXT DEFAULT '',
  status TEXT DEFAULT 'completed',
  rpo_minutes INTEGER DEFAULT 0,
  rto_minutes INTEGER DEFAULT 0,
  result_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS secrets_vault_references (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  secret_key TEXT NOT NULL,
  provider TEXT DEFAULT 'vault',
  reference_uri TEXT NOT NULL,
  rotation_policy_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_ai_ceo_daily_briefs_scope ON ai_ceo_daily_briefs(tenant_id, branch_id, brief_date);
CREATE INDEX IF NOT EXISTS idx_ai_ceo_actions_scope ON ai_ceo_actions(tenant_id, branch_id, approval_status, priority);
CREATE INDEX IF NOT EXISTS idx_autonomous_approvals_scope ON autonomous_approval_requests(tenant_id, branch_id, status, risk_level);
CREATE INDEX IF NOT EXISTS idx_ai_model_providers_scope ON ai_model_providers(tenant_id, enabled, provider_key);
CREATE INDEX IF NOT EXISTS idx_event_ledger_scope ON event_ledger_events(tenant_id, branch_id, aggregate_type, aggregate_id, occurred_at);
CREATE INDEX IF NOT EXISTS idx_war_room_alerts_scope ON war_room_alerts(tenant_id, branch_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_digital_twin_v2_scope ON digital_twin_v2_forecasts(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_customer_super_graph_scope ON customer_super_graph_nodes(tenant_id, branch_id, client_id, node_type);
CREATE INDEX IF NOT EXISTS idx_voice_receptionist_scope ON voice_receptionist_calls(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_computer_vision_scope ON computer_vision_events(tenant_id, branch_id, event_type, status);
CREATE INDEX IF NOT EXISTS idx_whatsapp_commerce_scope ON whatsapp_commerce_sessions(tenant_id, branch_id, phone, status);
CREATE INDEX IF NOT EXISTS idx_owner_mobile_briefs_scope ON owner_mobile_briefs(tenant_id, branch_id, brief_date);
CREATE INDEX IF NOT EXISTS idx_franchise_units_scope ON franchise_units(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_financial_brain_scope ON financial_brain_findings(tenant_id, branch_id, status, severity);
CREATE INDEX IF NOT EXISTS idx_provider_connectors_scope ON provider_connectors(tenant_id, branch_id, provider_type, status);
CREATE INDEX IF NOT EXISTS idx_marketplace_plugins_scope ON marketplace_plugins(tenant_id, branch_id, category, status);
CREATE INDEX IF NOT EXISTS idx_cloud_readiness_scope ON cloud_readiness_checks(tenant_id, branch_id, check_type, status);
