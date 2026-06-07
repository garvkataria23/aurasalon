-- AuraShine Staff OS - future attendance intelligence layer.
-- Additive tables for gateway agents, consent, fraud/risk, payroll preview and owner alerts.

CREATE TABLE IF NOT EXISTS biometric_gateway_agents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  gateway_code TEXT NOT NULL,
  display_name TEXT DEFAULT '',
  machine_name TEXT DEFAULT '',
  os_user TEXT DEFAULT '',
  provider_scope_json TEXT DEFAULT '[]',
  api_key_hash TEXT DEFAULT '',
  version_label TEXT DEFAULT '',
  health_status TEXT DEFAULT 'unknown',
  last_seen_at TEXT,
  last_ip TEXT DEFAULT '',
  config_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, gateway_code)
);

CREATE INDEX IF NOT EXISTS idx_biometric_gateway_scope
  ON biometric_gateway_agents(tenant_id, branch_id, status, health_status);

CREATE TABLE IF NOT EXISTS staff_biometric_consents (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  consent_type TEXT DEFAULT 'biometric_attendance',
  consent_status TEXT DEFAULT 'granted',
  consent_channel TEXT DEFAULT 'paper',
  consent_text TEXT DEFAULT '',
  retention_days INTEGER DEFAULT 365,
  delete_requested INTEGER DEFAULT 0,
  delete_requested_at TEXT,
  granted_at TEXT,
  revoked_at TEXT,
  metadata_json TEXT DEFAULT '{}',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, consent_type)
);

CREATE INDEX IF NOT EXISTS idx_staff_biometric_consents_scope
  ON staff_biometric_consents(tenant_id, branch_id, consent_status, delete_requested);

CREATE TABLE IF NOT EXISTS staff_attendance_risk_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT DEFAULT '',
  attendance_id TEXT DEFAULT '',
  source_type TEXT DEFAULT 'biometric',
  risk_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  risk_score REAL DEFAULT 0,
  reason TEXT DEFAULT '',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  idempotency_key TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_by TEXT DEFAULT '',
  resolved_at TEXT,
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_risk_scope
  ON staff_attendance_risk_events(tenant_id, branch_id, status, severity, created_at);

CREATE TABLE IF NOT EXISTS staff_attendance_payroll_previews (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  period_start TEXT NOT NULL,
  period_end TEXT NOT NULL,
  present_days REAL DEFAULT 0,
  absent_days REAL DEFAULT 0,
  late_count INTEGER DEFAULT 0,
  half_days REAL DEFAULT 0,
  overtime_minutes REAL DEFAULT 0,
  less_work_minutes REAL DEFAULT 0,
  incentive_hold INTEGER DEFAULT 0,
  gross_amount REAL DEFAULT 0,
  attendance_deduction REAL DEFAULT 0,
  overtime_amount REAL DEFAULT 0,
  net_preview REAL DEFAULT 0,
  rules_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'draft',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, staff_id, period_start, period_end)
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_payroll_preview_scope
  ON staff_attendance_payroll_previews(tenant_id, branch_id, period_start, period_end);

CREATE TABLE IF NOT EXISTS owner_command_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  alert_type TEXT NOT NULL,
  channel TEXT DEFAULT 'whatsapp',
  title TEXT NOT NULL,
  body TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  reference_type TEXT DEFAULT '',
  reference_id TEXT DEFAULT '',
  metadata_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'queued',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  acknowledged_by TEXT DEFAULT '',
  acknowledged_at TEXT,
  idempotency_key TEXT DEFAULT '',
  UNIQUE(tenant_id, idempotency_key)
);

CREATE INDEX IF NOT EXISTS idx_owner_command_alert_scope
  ON owner_command_alerts(tenant_id, branch_id, status, severity, created_at);
