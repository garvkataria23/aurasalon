-- Aura Salon OS Staff OS Advanced Modules
-- Phases 19-30: biometric, staff WhatsApp, statutory payroll, approvals,
-- replacement, offline mobile sync, roster optimization, and manpower forecast.

CREATE TABLE IF NOT EXISTS biometric_devices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  device_code TEXT NOT NULL,
  device_name TEXT,
  device_type TEXT DEFAULT 'biometric',
  location_label TEXT,
  connection_mode TEXT DEFAULT 'offline_sync',
  credentials_encrypted TEXT,
  last_health_status TEXT DEFAULT 'unknown',
  last_seen_at TEXT,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, device_code)
);

CREATE INDEX IF NOT EXISTS idx_biometric_devices_tenant_branch ON biometric_devices(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS biometric_device_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  staff_id TEXT,
  external_user_id TEXT,
  external_event_id TEXT,
  punch_type TEXT DEFAULT 'punch',
  punch_at TEXT NOT NULL,
  raw_event_json TEXT DEFAULT '{}',
  duplicate_of_id TEXT,
  suspicious INTEGER DEFAULT 0,
  suspicious_reason TEXT,
  status TEXT DEFAULT 'received',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, device_id, external_event_id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_logs_tenant_branch_time ON biometric_device_logs(tenant_id, branch_id, punch_at);

CREATE TABLE IF NOT EXISTS biometric_staff_mappings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  external_user_id TEXT NOT NULL,
  mapping_type TEXT DEFAULT 'device_user',
  status TEXT DEFAULT 'pending',
  requested_by TEXT,
  approved_by TEXT,
  approved_at TEXT,
  notes TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, device_id, external_user_id)
);

CREATE INDEX IF NOT EXISTS idx_biometric_mappings_tenant_staff ON biometric_staff_mappings(tenant_id, staff_id, status);

CREATE TABLE IF NOT EXISTS biometric_sync_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  device_id TEXT NOT NULL,
  status TEXT DEFAULT 'running',
  started_at TEXT DEFAULT CURRENT_TIMESTAMP,
  completed_at TEXT,
  total_events INTEGER DEFAULT 0,
  accepted_events INTEGER DEFAULT 0,
  duplicate_events INTEGER DEFAULT 0,
  suspicious_events INTEGER DEFAULT 0,
  error_message TEXT,
  created_by TEXT
);

CREATE TABLE IF NOT EXISTS biometric_event_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  sync_run_id TEXT,
  biometric_log_id TEXT,
  staff_id TEXT,
  event_type TEXT DEFAULT 'attendance_punch',
  payload_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'queued',
  idempotency_key TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS staff_notification_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  notification_type TEXT NOT NULL,
  language TEXT DEFAULT 'en-IN',
  title TEXT NOT NULL,
  body_template TEXT NOT NULL,
  sensitive INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, notification_type, language)
);

CREATE TABLE IF NOT EXISTS staff_notification_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  notification_type TEXT NOT NULL,
  template_id TEXT,
  channel TEXT DEFAULT 'whatsapp',
  language TEXT DEFAULT 'en-IN',
  message_preview TEXT NOT NULL,
  sensitive INTEGER DEFAULT 0,
  requires_approval INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',
  quiet_hours_deferred INTEGER DEFAULT 0,
  scheduled_at TEXT,
  approved_by TEXT,
  approved_at TEXT,
  provider_message_id TEXT,
  metadata_json TEXT DEFAULT '{}',
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_notification_queue_tenant_status ON staff_notification_queue(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS staff_notification_preferences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  whatsapp_opt_in INTEGER DEFAULT 1,
  language TEXT DEFAULT 'en-IN',
  quiet_hours_start TEXT DEFAULT '21:00',
  quiet_hours_end TEXT DEFAULT '08:00',
  allow_payroll_amounts INTEGER DEFAULT 0,
  manager_alerts INTEGER DEFAULT 1,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id)
);

CREATE TABLE IF NOT EXISTS staff_notification_delivery_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  queue_id TEXT NOT NULL,
  provider TEXT DEFAULT 'manual',
  provider_message_id TEXT,
  status TEXT NOT NULL,
  error_message TEXT,
  payload_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS statutory_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  branch_id TEXT,
  uan_reference TEXT,
  esi_reference TEXT,
  pan_reference TEXT,
  pf_enabled INTEGER DEFAULT 1,
  esic_enabled INTEGER DEFAULT 1,
  tds_enabled INTEGER DEFAULT 1,
  professional_tax_state TEXT,
  gratuity_eligible INTEGER DEFAULT 0,
  bonus_eligible INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id)
);

CREATE TABLE IF NOT EXISTS payroll_statutory_rules (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  rule_type TEXT NOT NULL,
  state_code TEXT,
  rule_json TEXT DEFAULT '{}',
  effective_from TEXT NOT NULL,
  effective_to TEXT,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_stat_rules_tenant_type ON payroll_statutory_rules(tenant_id, rule_type, state_code, status);

CREATE TABLE IF NOT EXISTS payroll_statutory_calculations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  payroll_run_id TEXT,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  gross_amount REAL DEFAULT 0,
  pf_employee REAL DEFAULT 0,
  pf_employer REAL DEFAULT 0,
  esic_employee REAL DEFAULT 0,
  esic_employer REAL DEFAULT 0,
  professional_tax REAL DEFAULT 0,
  tds_amount REAL DEFAULT 0,
  gratuity_accrual REAL DEFAULT 0,
  bonus_accrual REAL DEFAULT 0,
  net_statutory_deduction REAL DEFAULT 0,
  snapshot_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'calculated',
  frozen INTEGER DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payroll_stat_calcs_tenant_period ON payroll_statutory_calculations(tenant_id, branch_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS payroll_tax_declarations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  declarations_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, financial_year)
);

CREATE TABLE IF NOT EXISTS payroll_compliance_exports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  export_type TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  export_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'created',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS salary_revision_history (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  effective_date TEXT NOT NULL,
  old_ctc REAL DEFAULT 0,
  new_ctc REAL DEFAULT 0,
  old_components_json TEXT DEFAULT '{}',
  new_components_json TEXT DEFAULT '{}',
  reason TEXT,
  requested_by TEXT,
  approved_by TEXT,
  rejected_by TEXT,
  approval_status TEXT DEFAULT 'pending',
  requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  approved_at TEXT,
  rejected_at TEXT,
  correction_of_id TEXT,
  payroll_run_id TEXT,
  payslip_id TEXT,
  document_url TEXT,
  immutable_hash TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_salary_revision_tenant_staff_effective ON salary_revision_history(tenant_id, staff_id, effective_date);

CREATE TABLE IF NOT EXISTS staff_replacement_recommendations (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  absent_staff_id TEXT,
  appointment_id TEXT,
  service_id TEXT,
  client_id TEXT,
  recommended_staff_id TEXT,
  confidence REAL DEFAULT 0,
  requires_manager_approval INTEGER DEFAULT 1,
  ranked_options_json TEXT DEFAULT '[]',
  reasons_json TEXT DEFAULT '[]',
  risks_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'recommended',
  approved_by TEXT,
  rejected_by TEXT,
  decision_reason TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_mobile_devices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  device_uid TEXT NOT NULL,
  platform TEXT,
  sync_token TEXT NOT NULL,
  last_sync_at TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, device_uid)
);

CREATE TABLE IF NOT EXISTS staff_mobile_sync_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  device_id TEXT,
  action_type TEXT NOT NULL,
  idempotency_key TEXT NOT NULL,
  payload_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'received',
  result_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  processed_at TEXT,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE TABLE IF NOT EXISTS staff_mobile_conflicts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  device_id TEXT,
  sync_queue_id TEXT,
  conflict_type TEXT NOT NULL,
  local_payload_json TEXT DEFAULT '{}',
  server_payload_json TEXT DEFAULT '{}',
  resolution TEXT DEFAULT 'server_wins',
  status TEXT DEFAULT 'open',
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_mobile_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  staff_id TEXT NOT NULL,
  snapshot_json TEXT DEFAULT '{}',
  sync_token TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_policies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  policy_key TEXT NOT NULL,
  policy_name TEXT NOT NULL,
  applies_to TEXT NOT NULL,
  amount_threshold REAL DEFAULT 0,
  steps_json TEXT DEFAULT '[]',
  escalation_hours INTEGER DEFAULT 24,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, policy_key)
);

CREATE TABLE IF NOT EXISTS approval_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  policy_id TEXT,
  request_type TEXT NOT NULL,
  entity_type TEXT,
  entity_id TEXT,
  amount REAL DEFAULT 0,
  status TEXT DEFAULT 'pending',
  requested_by TEXT,
  expires_at TEXT,
  payload_json TEXT DEFAULT '{}',
  current_step INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_approval_requests_tenant_status ON approval_requests(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS approval_steps (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  approval_request_id TEXT NOT NULL,
  step_order INTEGER NOT NULL,
  approver_role TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  assigned_to TEXT,
  decided_by TEXT,
  decided_at TEXT,
  comments TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS approval_actions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  approval_request_id TEXT NOT NULL,
  step_id TEXT,
  action TEXT NOT NULL,
  actor_user_id TEXT,
  actor_role TEXT,
  comments TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_roster_drafts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  roster_json TEXT DEFAULT '[]',
  coverage_score REAL DEFAULT 0,
  cost_score REAL DEFAULT 0,
  utilization_score REAL DEFAULT 0,
  gaps_json TEXT DEFAULT '[]',
  overtime_risks_json TEXT DEFAULT '[]',
  recommendations_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'draft',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_manpower_forecasts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  required_staff_hours REAL DEFAULT 0,
  required_staff_by_skill_json TEXT DEFAULT '{}',
  shortage_risks_json TEXT DEFAULT '[]',
  overstaffing_risks_json TEXT DEFAULT '[]',
  hiring_recommendations_json TEXT DEFAULT '[]',
  roster_recommendations_json TEXT DEFAULT '[]',
  confidence_level TEXT DEFAULT 'low',
  explanation_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'calculated',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_manpower_forecasts_tenant_branch ON staff_manpower_forecasts(tenant_id, branch_id, period_start, period_end);
