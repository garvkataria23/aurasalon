-- AuraShine Engagement Command Center foundation.
-- Additive only: no existing table changes, no hard deletes.

CREATE TABLE IF NOT EXISTS engagement_threads (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  primary_channel TEXT NOT NULL DEFAULT 'whatsapp',
  source TEXT DEFAULT '',
  subject TEXT DEFAULT '',
  display_name TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  email TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  risk_level TEXT NOT NULL DEFAULT 'low',
  sla_status TEXT NOT NULL DEFAULT 'on_track',
  last_message_at TEXT DEFAULT '',
  last_message_preview TEXT DEFAULT '',
  unread_count INTEGER NOT NULL DEFAULT 0,
  tags_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_messages (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT NOT NULL DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  provider_account_id TEXT DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  direction TEXT NOT NULL DEFAULT 'outbound',
  message_type TEXT NOT NULL DEFAULT 'text',
  event_type TEXT DEFAULT '',
  provider_message_id TEXT DEFAULT '',
  external_conversation_id TEXT DEFAULT '',
  sender_user_id TEXT DEFAULT '',
  sender_role TEXT DEFAULT '',
  recipient_name TEXT DEFAULT '',
  recipient_address TEXT DEFAULT '',
  body TEXT DEFAULT '',
  body_preview TEXT DEFAULT '',
  template_id TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'queued',
  delivery_status TEXT NOT NULL DEFAULT 'pending',
  approval_status TEXT NOT NULL DEFAULT 'not_required',
  risk_level TEXT NOT NULL DEFAULT 'low',
  consent_status TEXT NOT NULL DEFAULT 'unknown',
  opt_out_checked INTEGER NOT NULL DEFAULT 0,
  provider_payload_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT DEFAULT '',
  sent_at TEXT DEFAULT '',
  delivered_at TEXT DEFAULT '',
  read_at TEXT DEFAULT '',
  failed_at TEXT DEFAULT '',
  failure_reason TEXT DEFAULT '',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_call_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  provider_account_id TEXT DEFAULT '',
  direction TEXT NOT NULL DEFAULT 'inbound',
  phone TEXT NOT NULL DEFAULT '',
  caller_name TEXT DEFAULT '',
  call_provider TEXT DEFAULT '',
  provider_call_id TEXT DEFAULT '',
  started_at TEXT DEFAULT '',
  ended_at TEXT DEFAULT '',
  duration_seconds INTEGER NOT NULL DEFAULT 0,
  recording_uri TEXT DEFAULT '',
  transcript_json TEXT NOT NULL DEFAULT '[]',
  intent TEXT DEFAULT '',
  outcome TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'logged',
  follow_up_required INTEGER NOT NULL DEFAULT 0,
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT DEFAULT '',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_drafts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  message_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  provider_account_id TEXT DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  draft_type TEXT NOT NULL DEFAULT 'reply',
  source TEXT NOT NULL DEFAULT 'manual',
  prompt TEXT DEFAULT '',
  incoming_message TEXT DEFAULT '',
  suggested_body TEXT DEFAULT '',
  edited_body TEXT DEFAULT '',
  detected_intent TEXT DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  approval_required INTEGER NOT NULL DEFAULT 1,
  approval_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'draft',
  risk_level TEXT NOT NULL DEFAULT 'low',
  risk_reasons_json TEXT NOT NULL DEFAULT '[]',
  audit_trail_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  created_by TEXT DEFAULT '',
  approved_by TEXT DEFAULT '',
  approved_at TEXT DEFAULT '',
  copied_at TEXT DEFAULT '',
  sent_manually_at TEXT DEFAULT '',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  template_key TEXT NOT NULL,
  name TEXT NOT NULL,
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  category TEXT NOT NULL DEFAULT 'service',
  language TEXT NOT NULL DEFAULT 'en',
  purpose TEXT DEFAULT '',
  body TEXT NOT NULL DEFAULT '',
  variables_json TEXT NOT NULL DEFAULT '[]',
  provider_template_id TEXT DEFAULT '',
  provider_status TEXT NOT NULL DEFAULT 'not_configured',
  approval_status TEXT NOT NULL DEFAULT 'pending',
  status TEXT NOT NULL DEFAULT 'draft',
  quiet_hours_json TEXT NOT NULL DEFAULT '{}',
  consent_required INTEGER NOT NULL DEFAULT 1,
  opt_out_required INTEGER NOT NULL DEFAULT 1,
  created_by TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, template_key)
);

CREATE TABLE IF NOT EXISTS engagement_assignments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT NOT NULL DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT NOT NULL DEFAULT '',
  assigned_role TEXT DEFAULT '',
  assigned_by TEXT DEFAULT '',
  assignment_reason TEXT DEFAULT '',
  queue_name TEXT NOT NULL DEFAULT 'front_desk',
  priority TEXT NOT NULL DEFAULT 'normal',
  sla_due_at TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'assigned',
  accepted_at TEXT DEFAULT '',
  resolved_at TEXT DEFAULT '',
  resolution_note TEXT DEFAULT '',
  handoff_from TEXT DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_sla_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  message_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  event_type TEXT NOT NULL DEFAULT 'response_due',
  sla_policy_key TEXT NOT NULL DEFAULT 'default',
  due_at TEXT DEFAULT '',
  breached_at TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'open',
  severity TEXT NOT NULL DEFAULT 'normal',
  response_time_seconds INTEGER NOT NULL DEFAULT 0,
  resolution_time_seconds INTEGER NOT NULL DEFAULT 0,
  evidence_json TEXT NOT NULL DEFAULT '{}',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  message_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  actor_user_id TEXT DEFAULT '',
  actor_role TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT DEFAULT '',
  before_json TEXT NOT NULL DEFAULT '{}',
  after_json TEXT NOT NULL DEFAULT '{}',
  details_json TEXT NOT NULL DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  severity TEXT NOT NULL DEFAULT 'info',
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_client_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  client_id TEXT NOT NULL DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  alert_type TEXT NOT NULL,
  alert_source TEXT NOT NULL DEFAULT 'engagement',
  title TEXT NOT NULL DEFAULT '',
  summary TEXT DEFAULT '',
  risk_level TEXT NOT NULL DEFAULT 'low',
  risk_score INTEGER NOT NULL DEFAULT 0,
  priority TEXT NOT NULL DEFAULT 'normal',
  status TEXT NOT NULL DEFAULT 'open',
  review_status TEXT NOT NULL DEFAULT 'unreviewed',
  suggested_action TEXT DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  due_at TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  reviewed_by TEXT DEFAULT '',
  reviewed_at TEXT DEFAULT '',
  resolved_at TEXT DEFAULT '',
  resolution_note TEXT DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_recovery_opportunities (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  opportunity_type TEXT NOT NULL,
  source_event_id TEXT DEFAULT '',
  source_channel TEXT DEFAULT '',
  title TEXT NOT NULL DEFAULT '',
  reason TEXT DEFAULT '',
  suggested_action TEXT DEFAULT '',
  expected_value REAL NOT NULL DEFAULT 0,
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  priority TEXT NOT NULL DEFAULT 'normal',
  conversion_id TEXT DEFAULT '',
  due_at TEXT DEFAULT '',
  recovered_at TEXT DEFAULT '',
  lost_at TEXT DEFAULT '',
  outcome TEXT DEFAULT '',
  evidence_json TEXT NOT NULL DEFAULT '[]',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_ai_summaries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  summary_scope TEXT NOT NULL DEFAULT 'client',
  summary_text TEXT NOT NULL DEFAULT '',
  highlights_json TEXT NOT NULL DEFAULT '[]',
  risks_json TEXT NOT NULL DEFAULT '[]',
  next_best_actions_json TEXT NOT NULL DEFAULT '[]',
  data_sources_json TEXT NOT NULL DEFAULT '[]',
  model_provider TEXT DEFAULT '',
  model_name TEXT DEFAULT '',
  confidence REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'generated',
  generated_by TEXT DEFAULT '',
  reviewed_by TEXT DEFAULT '',
  reviewed_at TEXT DEFAULT '',
  expires_at TEXT DEFAULT '',
  metadata_json TEXT NOT NULL DEFAULT '{}',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_conversions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  thread_id TEXT DEFAULT '',
  message_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  appointment_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  membership_id TEXT DEFAULT '',
  package_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  assigned_to TEXT DEFAULT '',
  conversion_type TEXT NOT NULL,
  source_channel TEXT DEFAULT '',
  source_event_id TEXT DEFAULT '',
  campaign_id TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  converted_at TEXT DEFAULT '',
  attribution_json TEXT NOT NULL DEFAULT '{}',
  notes TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS engagement_provider_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  provider_type TEXT NOT NULL DEFAULT 'whatsapp',
  provider_name TEXT NOT NULL DEFAULT '',
  channel TEXT NOT NULL DEFAULT 'whatsapp',
  account_label TEXT DEFAULT '',
  business_phone TEXT DEFAULT '',
  sender_id TEXT DEFAULT '',
  from_email TEXT DEFAULT '',
  provider_status TEXT NOT NULL DEFAULT 'not_configured',
  direct_send_enabled INTEGER NOT NULL DEFAULT 0,
  approval_required INTEGER NOT NULL DEFAULT 1,
  config_json TEXT NOT NULL DEFAULT '{}',
  rate_limit_json TEXT NOT NULL DEFAULT '{}',
  last_health_status TEXT DEFAULT '',
  last_checked_at TEXT DEFAULT '',
  status TEXT NOT NULL DEFAULT 'inactive',
  created_by TEXT DEFAULT '',
  updated_by TEXT DEFAULT '',
  archived_at TEXT DEFAULT '',
  archived_by TEXT DEFAULT '',
  archive_reason TEXT DEFAULT '',
  version INTEGER NOT NULL DEFAULT 1,
  created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_engagement_threads_scope_status
  ON engagement_threads(tenant_id, branch_id, status, updated_at);
CREATE INDEX IF NOT EXISTS idx_engagement_threads_client
  ON engagement_threads(tenant_id, client_id, updated_at);
CREATE INDEX IF NOT EXISTS idx_engagement_threads_assignee
  ON engagement_threads(tenant_id, assigned_to, status);

CREATE INDEX IF NOT EXISTS idx_engagement_messages_thread
  ON engagement_messages(tenant_id, thread_id, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_messages_scope_status
  ON engagement_messages(tenant_id, branch_id, channel, status, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_messages_client
  ON engagement_messages(tenant_id, client_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_call_logs_scope
  ON engagement_call_logs(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_call_logs_client
  ON engagement_call_logs(tenant_id, client_id, started_at);

CREATE INDEX IF NOT EXISTS idx_engagement_drafts_scope_status
  ON engagement_drafts(tenant_id, branch_id, approval_status, status, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_drafts_thread
  ON engagement_drafts(tenant_id, thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_templates_scope
  ON engagement_templates(tenant_id, branch_id, channel, status);

CREATE INDEX IF NOT EXISTS idx_engagement_assignments_scope
  ON engagement_assignments(tenant_id, branch_id, assigned_to, status);
CREATE INDEX IF NOT EXISTS idx_engagement_assignments_thread
  ON engagement_assignments(tenant_id, thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_sla_events_scope
  ON engagement_sla_events(tenant_id, branch_id, status, due_at);
CREATE INDEX IF NOT EXISTS idx_engagement_sla_events_thread
  ON engagement_sla_events(tenant_id, thread_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_audit_logs_scope
  ON engagement_audit_logs(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_audit_logs_entity
  ON engagement_audit_logs(tenant_id, entity_type, entity_id, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_audit_logs_actor
  ON engagement_audit_logs(tenant_id, actor_user_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_client_alerts_scope
  ON engagement_client_alerts(tenant_id, branch_id, status, risk_level, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_client_alerts_client
  ON engagement_client_alerts(tenant_id, client_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_recovery_scope
  ON engagement_recovery_opportunities(tenant_id, branch_id, status, priority, due_at);
CREATE INDEX IF NOT EXISTS idx_engagement_recovery_client
  ON engagement_recovery_opportunities(tenant_id, client_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_ai_summaries_scope
  ON engagement_ai_summaries(tenant_id, branch_id, summary_scope, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_ai_summaries_client
  ON engagement_ai_summaries(tenant_id, client_id, created_at);

CREATE INDEX IF NOT EXISTS idx_engagement_conversions_scope
  ON engagement_conversions(tenant_id, branch_id, conversion_type, status, created_at);
CREATE INDEX IF NOT EXISTS idx_engagement_conversions_client
  ON engagement_conversions(tenant_id, client_id, converted_at);

CREATE INDEX IF NOT EXISTS idx_engagement_provider_accounts_scope
  ON engagement_provider_accounts(tenant_id, branch_id, channel, status);

CREATE TRIGGER IF NOT EXISTS trg_engagement_threads_no_delete
BEFORE DELETE ON engagement_threads
BEGIN
  SELECT RAISE(ABORT, 'engagement_threads is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_messages_no_delete
BEFORE DELETE ON engagement_messages
BEGIN
  SELECT RAISE(ABORT, 'engagement_messages is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_call_logs_no_delete
BEFORE DELETE ON engagement_call_logs
BEGIN
  SELECT RAISE(ABORT, 'engagement_call_logs is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_drafts_no_delete
BEFORE DELETE ON engagement_drafts
BEGIN
  SELECT RAISE(ABORT, 'engagement_drafts is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_templates_no_delete
BEFORE DELETE ON engagement_templates
BEGIN
  SELECT RAISE(ABORT, 'engagement_templates is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_assignments_no_delete
BEFORE DELETE ON engagement_assignments
BEGIN
  SELECT RAISE(ABORT, 'engagement_assignments is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_sla_events_no_delete
BEFORE DELETE ON engagement_sla_events
BEGIN
  SELECT RAISE(ABORT, 'engagement_sla_events is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_audit_logs_no_update
BEFORE UPDATE ON engagement_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'engagement_audit_logs is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_audit_logs_no_delete
BEFORE DELETE ON engagement_audit_logs
BEGIN
  SELECT RAISE(ABORT, 'engagement_audit_logs is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_client_alerts_no_delete
BEFORE DELETE ON engagement_client_alerts
BEGIN
  SELECT RAISE(ABORT, 'engagement_client_alerts is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_recovery_no_delete
BEFORE DELETE ON engagement_recovery_opportunities
BEGIN
  SELECT RAISE(ABORT, 'engagement_recovery_opportunities is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_ai_summaries_no_delete
BEFORE DELETE ON engagement_ai_summaries
BEGIN
  SELECT RAISE(ABORT, 'engagement_ai_summaries is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_conversions_no_delete
BEFORE DELETE ON engagement_conversions
BEGIN
  SELECT RAISE(ABORT, 'engagement_conversions is soft-delete only');
END;

CREATE TRIGGER IF NOT EXISTS trg_engagement_provider_accounts_no_delete
BEFORE DELETE ON engagement_provider_accounts
BEGIN
  SELECT RAISE(ABORT, 'engagement_provider_accounts is soft-delete only');
END;
