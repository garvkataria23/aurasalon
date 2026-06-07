CREATE TABLE IF NOT EXISTS membership_plans (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  code TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT DEFAULT '',
  price REAL DEFAULT 0,
  validity_days INTEGER DEFAULT 365,
  discount_percent REAL DEFAULT 0,
  product_discount_percent REAL DEFAULT 0,
  gst_rate REAL DEFAULT 18,
  included_services_json TEXT DEFAULT '[]',
  benefit_rules_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_plans_tenant_code
  ON membership_plans(tenant_id, branch_id, code);
CREATE INDEX IF NOT EXISTS idx_membership_plans_tenant_status
  ON membership_plans(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS client_membership_ledger (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  membership_id TEXT DEFAULT '',
  plan_id TEXT DEFAULT '',
  invoice_id TEXT DEFAULT '',
  sale_id TEXT DEFAULT '',
  action TEXT NOT NULL,
  amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  credits_before INTEGER DEFAULT 0,
  credits_after INTEGER DEFAULT 0,
  starts_on TEXT DEFAULT '',
  expires_on TEXT DEFAULT '',
  snapshot_json TEXT DEFAULT '{}',
  note TEXT DEFAULT '',
  actor_user_id TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_client_membership_ledger_tenant_client
  ON client_membership_ledger(tenant_id, client_id, created_at);
CREATE INDEX IF NOT EXISTS idx_client_membership_ledger_tenant_membership
  ON client_membership_ledger(tenant_id, membership_id, created_at);
CREATE INDEX IF NOT EXISTS idx_client_membership_ledger_tenant_invoice
  ON client_membership_ledger(tenant_id, invoice_id);

CREATE TABLE IF NOT EXISTS membership_family_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  primary_client_id TEXT NOT NULL,
  member_client_id TEXT NOT NULL,
  membership_id TEXT DEFAULT '',
  relationship TEXT DEFAULT '',
  share_benefits INTEGER DEFAULT 1,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_family_unique
  ON membership_family_members(tenant_id, primary_client_id, member_client_id, membership_id);

CREATE TABLE IF NOT EXISTS membership_whatsapp_reminders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  membership_id TEXT DEFAULT '',
  plan_id TEXT DEFAULT '',
  reminder_type TEXT NOT NULL,
  due_on TEXT DEFAULT '',
  days_before INTEGER DEFAULT 0,
  status TEXT DEFAULT 'queued',
  message TEXT DEFAULT '',
  payload_json TEXT DEFAULT '{}',
  approved_by TEXT DEFAULT '',
  sent_at TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_reminders_unique
  ON membership_whatsapp_reminders(tenant_id, client_id, membership_id, reminder_type, due_on);
CREATE INDEX IF NOT EXISTS idx_membership_reminders_status
  ON membership_whatsapp_reminders(tenant_id, branch_id, status, due_on);

CREATE TABLE IF NOT EXISTS membership_audit_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  actor_user_id TEXT DEFAULT '',
  action TEXT NOT NULL,
  target_type TEXT NOT NULL,
  target_id TEXT DEFAULT '',
  before_json TEXT DEFAULT '{}',
  after_json TEXT DEFAULT '{}',
  reason TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_membership_audit_tenant_target
  ON membership_audit_logs(tenant_id, target_type, target_id, created_at);

CREATE TABLE IF NOT EXISTS membership_invoice_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  invoice_id TEXT NOT NULL,
  sale_id TEXT DEFAULT '',
  client_id TEXT NOT NULL,
  membership_id TEXT DEFAULT '',
  plan_id TEXT DEFAULT '',
  plan_name TEXT DEFAULT '',
  discount_percent REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  credits_used INTEGER DEFAULT 0,
  terms_json TEXT DEFAULT '{}',
  invoice_total REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_invoice_snapshot_invoice
  ON membership_invoice_snapshots(tenant_id, invoice_id, membership_id);
CREATE INDEX IF NOT EXISTS idx_membership_invoice_snapshot_client
  ON membership_invoice_snapshots(tenant_id, client_id, created_at);
