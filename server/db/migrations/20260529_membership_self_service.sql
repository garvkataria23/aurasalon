CREATE TABLE IF NOT EXISTS membership_self_service_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  membership_id TEXT DEFAULT '',
  request_type TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  reason TEXT DEFAULT '',
  token TEXT DEFAULT '',
  token_expires_at TEXT DEFAULT '',
  request_payload_json TEXT DEFAULT '{}',
  response_payload_json TEXT DEFAULT '{}',
  approval_required INTEGER DEFAULT 1,
  requested_by TEXT DEFAULT 'client',
  requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewed_by TEXT DEFAULT '',
  reviewed_role TEXT DEFAULT '',
  reviewed_at TEXT DEFAULT '',
  rejection_reason TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_membership_self_service_scope
  ON membership_self_service_requests(tenant_id, branch_id, status, request_type, created_at);

CREATE INDEX IF NOT EXISTS idx_membership_self_service_client
  ON membership_self_service_requests(tenant_id, client_id, membership_id, created_at);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_self_service_token
  ON membership_self_service_requests(token)
  WHERE token <> '';

CREATE TRIGGER IF NOT EXISTS trg_membership_self_service_no_delete
BEFORE DELETE ON membership_self_service_requests
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for membership_self_service_requests');
END;
