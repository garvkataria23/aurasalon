-- AuraShine Billing Prompt 16 - Offline POS Sync
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS offline_sync_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_id TEXT,
  device_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  operation TEXT NOT NULL,
  payload_json TEXT NOT NULL,
  local_created_at TEXT,
  sync_status TEXT DEFAULT 'pending',
  conflict_status TEXT DEFAULT 'none',
  server_version INTEGER DEFAULT 0,
  client_version INTEGER DEFAULT 0,
  error_message TEXT,
  synced_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_offline_sync_queue_tenant_status
  ON offline_sync_queue(tenant_id, sync_status, created_at);
CREATE UNIQUE INDEX IF NOT EXISTS idx_offline_sync_queue_tenant_device_op
  ON offline_sync_queue(tenant_id, device_id, id);

CREATE TABLE IF NOT EXISTS offline_conflicts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_id TEXT,
  entity_type TEXT NOT NULL,
  entity_id TEXT NOT NULL,
  client_payload TEXT NOT NULL,
  server_payload TEXT NOT NULL,
  conflict_type TEXT NOT NULL,
  resolution_strategy TEXT DEFAULT 'server_wins',
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_offline_conflicts_tenant_status
  ON offline_conflicts(tenant_id, resolution_strategy, created_at);

-- DOWN:
-- DROP TABLE IF EXISTS offline_conflicts;
-- DROP TABLE IF EXISTS offline_sync_queue;
