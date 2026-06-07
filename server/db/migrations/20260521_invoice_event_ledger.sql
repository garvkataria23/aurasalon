-- AuraShine Billing Prompt 20 - Immutable Invoice Event Ledger
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS invoice_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  actor_role TEXT,
  event_payload_json TEXT,
  previous_hash TEXT,
  event_hash TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoice_events_tenant_invoice
  ON invoice_events(tenant_id, invoice_id, created_at);

CREATE TABLE IF NOT EXISTS invoice_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  snapshot_json TEXT NOT NULL,
  snapshot_hash TEXT NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_invoice_snapshots_tenant_invoice
  ON invoice_snapshots(tenant_id, invoice_id, created_at);

-- DOWN:
-- DROP TABLE IF EXISTS invoice_snapshots;
-- DROP TABLE IF EXISTS invoice_events;
