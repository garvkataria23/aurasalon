-- AuraShine Billing Prompt 21 - Terminal / Device Management
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS pos_terminals (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_code TEXT NOT NULL,
  terminal_name TEXT NOT NULL,
  device_fingerprint TEXT,
  assigned_counter TEXT,
  status TEXT DEFAULT 'active',
  last_seen_at TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, terminal_code)
);
CREATE INDEX IF NOT EXISTS idx_pos_terminals_tenant_branch
  ON pos_terminals(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS terminal_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  user_id TEXT NOT NULL,
  session_status TEXT DEFAULT 'active',
  opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  opening_cash_drawer_id TEXT,
  closing_cash_drawer_id TEXT,
  ip_address TEXT,
  user_agent TEXT
);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_tenant_terminal
  ON terminal_sessions(tenant_id, terminal_id, session_status);

CREATE TABLE IF NOT EXISTS terminal_device_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  event_payload_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_terminal_events_tenant_terminal
  ON terminal_device_events(tenant_id, terminal_id, created_at);

-- DOWN:
-- DROP TABLE IF EXISTS terminal_device_events;
-- DROP TABLE IF EXISTS terminal_sessions;
-- DROP TABLE IF EXISTS pos_terminals;
