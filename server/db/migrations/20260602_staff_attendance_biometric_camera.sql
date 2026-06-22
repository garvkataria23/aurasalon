-- AuraShine Staff OS - advanced attendance biometric and camera evidence.
-- Additive only: legacy attendance and biometric tables remain unchanged.

CREATE TABLE IF NOT EXISTS staff_attendance_camera_evidence (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  attendance_id TEXT,
  device_id TEXT,
  capture_type TEXT NOT NULL DEFAULT 'clock_in',
  captured_at TEXT NOT NULL,
  business_date TEXT NOT NULL,
  image_data_url TEXT DEFAULT '',
  image_hash TEXT NOT NULL,
  liveness_score REAL DEFAULT 0,
  match_score REAL DEFAULT 0,
  gps_lat REAL,
  gps_lng REAL,
  source TEXT DEFAULT 'camera',
  review_status TEXT DEFAULT 'auto_accepted',
  suspicious INTEGER DEFAULT 0,
  suspicious_reason TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_camera_scope
  ON staff_attendance_camera_evidence(tenant_id, branch_id, business_date, review_status);

CREATE INDEX IF NOT EXISTS idx_staff_attendance_camera_staff
  ON staff_attendance_camera_evidence(tenant_id, staff_id, captured_at);

CREATE TABLE IF NOT EXISTS biometric_provider_configs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  display_name TEXT NOT NULL,
  connection_mode TEXT DEFAULT 'api',
  endpoint_url TEXT DEFAULT '',
  enabled INTEGER DEFAULT 1,
  health_status TEXT DEFAULT 'unknown',
  last_checked_at TEXT,
  config_json TEXT DEFAULT '{}',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, provider)
);

CREATE INDEX IF NOT EXISTS idx_biometric_provider_configs_scope
  ON biometric_provider_configs(tenant_id, branch_id, enabled, health_status);
