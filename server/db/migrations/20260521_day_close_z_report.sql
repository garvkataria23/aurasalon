-- AuraShine Billing Prompt 23 - Day Close Locking + Z Report
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS day_close_locks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  status TEXT DEFAULT 'locked',
  locked_by TEXT,
  locked_at TEXT,
  reopened_by TEXT,
  reopened_at TEXT,
  reopen_reason TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, branch_id, business_date)
);
CREATE INDEX IF NOT EXISTS idx_day_close_locks_tenant_branch
  ON day_close_locks(tenant_id, branch_id, business_date);

CREATE TABLE IF NOT EXISTS z_reports (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  business_date TEXT NOT NULL,
  report_no TEXT NOT NULL,
  sales_total REAL DEFAULT 0,
  refund_total REAL DEFAULT 0,
  net_sales REAL DEFAULT 0,
  tax_total REAL DEFAULT 0,
  discount_total REAL DEFAULT 0,
  cash_total REAL DEFAULT 0,
  upi_total REAL DEFAULT 0,
  card_total REAL DEFAULT 0,
  wallet_total REAL DEFAULT 0,
  razorpay_total REAL DEFAULT 0,
  tips_total REAL DEFAULT 0,
  invoice_count INTEGER DEFAULT 0,
  void_count INTEGER DEFAULT 0,
  refund_count INTEGER DEFAULT 0,
  opening_cash REAL DEFAULT 0,
  closing_cash REAL DEFAULT 0,
  cash_difference REAL DEFAULT 0,
  generated_by TEXT,
  generated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  report_json TEXT NOT NULL,
  UNIQUE (tenant_id, branch_id, business_date, report_no)
);
CREATE INDEX IF NOT EXISTS idx_z_reports_tenant_branch_date
  ON z_reports(tenant_id, branch_id, business_date);

-- DOWN:
-- DROP TABLE IF EXISTS z_reports;
-- DROP TABLE IF EXISTS day_close_locks;
