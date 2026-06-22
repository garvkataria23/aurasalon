-- AuraShine Billing Prompt 22 - Print + Barcode Devices
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS print_devices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_id TEXT,
  device_name TEXT NOT NULL,
  device_type TEXT DEFAULT 'thermal',
  connection_type TEXT DEFAULT 'browser',
  config_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_print_devices_tenant_branch
  ON print_devices(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS print_jobs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_id TEXT,
  invoice_id TEXT,
  device_id TEXT,
  format TEXT DEFAULT 'thermal',
  payload_json TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  last_error TEXT,
  printed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_print_jobs_tenant_status
  ON print_jobs(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS barcode_scan_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  terminal_id TEXT,
  scanned_code TEXT NOT NULL,
  resolved_entity_type TEXT,
  resolved_entity_id TEXT,
  status TEXT DEFAULT 'unresolved',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_barcode_events_tenant_code
  ON barcode_scan_events(tenant_id, scanned_code, created_at);

-- DOWN:
-- DROP TABLE IF EXISTS barcode_scan_events;
-- DROP TABLE IF EXISTS print_jobs;
-- DROP TABLE IF EXISTS print_devices;
