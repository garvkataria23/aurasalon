-- AuraShine Salon OS - Invoice Payment Collection & Reconciliation
-- Adds gateway-safe payment links, webhook event timeline, and reconciliation runs.

PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS invoice_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  provider TEXT DEFAULT '',
  provider_payment_id TEXT DEFAULT '',
  provider_order_id TEXT DEFAULT '',
  provider_link_id TEXT DEFAULT '',
  terminal_id TEXT DEFAULT '',
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT DEFAULT '',
  reference_no TEXT DEFAULT '',
  notes TEXT DEFAULT '',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_invoice_status
  ON invoice_payments(tenant_id, invoice_id, status);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_provider
  ON invoice_payments(tenant_id, provider, provider_payment_id);

CREATE TABLE IF NOT EXISTS invoice_payment_links (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  invoice_id TEXT NOT NULL,
  provider TEXT NOT NULL DEFAULT 'razorpay',
  provider_link_id TEXT NOT NULL,
  link_url TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  balance_due_at_creation REAL NOT NULL DEFAULT 0,
  currency TEXT NOT NULL DEFAULT 'INR',
  status TEXT NOT NULL DEFAULT 'pending',
  expires_at TEXT,
  sent_at TEXT,
  sent_channel TEXT DEFAULT '',
  reminder_count INTEGER DEFAULT 0,
  provider_payload_json TEXT DEFAULT '{}',
  metadata_json TEXT DEFAULT '{}',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, provider, provider_link_id)
);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_links_tenant_invoice
  ON invoice_payment_links(tenant_id, invoice_id, status);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_links_tenant_status
  ON invoice_payment_links(tenant_id, status, expires_at);

CREATE TABLE IF NOT EXISTS invoice_payment_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  invoice_id TEXT NOT NULL,
  link_id TEXT DEFAULT '',
  provider TEXT DEFAULT '',
  event_type TEXT NOT NULL,
  event_source TEXT NOT NULL DEFAULT 'system',
  provider_event_id TEXT DEFAULT '',
  provider_payment_id TEXT DEFAULT '',
  provider_order_id TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  status TEXT DEFAULT '',
  idempotency_key TEXT DEFAULT '',
  signature_verified INTEGER DEFAULT 0,
  message TEXT DEFAULT '',
  payload_json TEXT DEFAULT '{}',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_events_tenant_invoice
  ON invoice_payment_events(tenant_id, invoice_id, created_at);

CREATE INDEX IF NOT EXISTS idx_invoice_payment_events_tenant_provider_event
  ON invoice_payment_events(tenant_id, provider, provider_event_id);

CREATE UNIQUE INDEX IF NOT EXISTS uq_invoice_payment_events_idempotency
  ON invoice_payment_events(tenant_id, idempotency_key)
  WHERE idempotency_key <> '';

CREATE TABLE IF NOT EXISTS payment_reconciliation_runs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  provider TEXT NOT NULL DEFAULT 'razorpay',
  run_type TEXT NOT NULL DEFAULT 'manual',
  invoice_id TEXT DEFAULT '',
  link_id TEXT DEFAULT '',
  checked_count INTEGER DEFAULT 0,
  fixed_count INTEGER DEFAULT 0,
  mismatch_count INTEGER DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'completed',
  summary_json TEXT DEFAULT '{}',
  created_by TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_runs_tenant_created
  ON payment_reconciliation_runs(tenant_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_runs_tenant_invoice
  ON payment_reconciliation_runs(tenant_id, invoice_id, created_at);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  link_id TEXT DEFAULT '',
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature TEXT DEFAULT '',
  payload_hash TEXT DEFAULT '',
  raw_payload TEXT DEFAULT '{}',
  provider_payment_id TEXT DEFAULT '',
  provider_link_id TEXT DEFAULT '',
  amount REAL DEFAULT 0,
  signature_verified INTEGER DEFAULT 0,
  status TEXT DEFAULT 'received',
  processed_at TEXT DEFAULT '',
  processing_error TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT '',
  UNIQUE (tenant_id, provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tenant_provider_event
  ON payment_webhook_events(tenant_id, provider, event_id);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tenant_invoice
  ON payment_webhook_events(tenant_id, invoice_id, created_at);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tenant_status
  ON payment_webhook_events(tenant_id, status, created_at);
