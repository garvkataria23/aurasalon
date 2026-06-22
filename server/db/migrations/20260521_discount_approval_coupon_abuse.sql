-- AuraShine Billing Prompt 19 - Coupon Abuse + Discount Approval
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS discount_approval_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  requested_by TEXT NOT NULL,
  approved_by TEXT,
  discount_type TEXT NOT NULL,
  discount_value REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  reason TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  decision_note TEXT,
  requested_at TEXT DEFAULT CURRENT_TIMESTAMP,
  decided_at TEXT
);
CREATE INDEX IF NOT EXISTS idx_discount_requests_tenant_status
  ON discount_approval_requests(tenant_id, status, requested_at);

CREATE TABLE IF NOT EXISTS coupon_usage (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  coupon_code TEXT NOT NULL,
  customer_id TEXT,
  invoice_id TEXT,
  discount_amount REAL DEFAULT 0,
  used_at TEXT DEFAULT CURRENT_TIMESTAMP,
  branch_id TEXT,
  staff_id TEXT
);
CREATE INDEX IF NOT EXISTS idx_coupon_usage_tenant_code
  ON coupon_usage(tenant_id, coupon_code, used_at);

CREATE TABLE IF NOT EXISTS coupon_abuse_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT,
  coupon_code TEXT,
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'warning',
  evidence_json TEXT NOT NULL,
  status TEXT DEFAULT 'open',
  resolved_by TEXT,
  resolved_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_coupon_alerts_tenant_status
  ON coupon_abuse_alerts(tenant_id, status, severity);

-- DOWN:
-- DROP TABLE IF EXISTS coupon_abuse_alerts;
-- DROP TABLE IF EXISTS coupon_usage;
-- DROP TABLE IF EXISTS discount_approval_requests;
