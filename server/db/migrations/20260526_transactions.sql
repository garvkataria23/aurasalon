CREATE TABLE IF NOT EXISTS outgoing_fund_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  entry_no TEXT,
  entry_date TEXT NOT NULL,
  expense_branch_id TEXT,
  expense_branch_name TEXT,
  paid_from_account_id TEXT,
  paid_from_account_name TEXT,
  paid_to_account_id TEXT,
  paid_to_account_name TEXT,
  payee_name TEXT,
  amount REAL NOT NULL DEFAULT 0,
  payment_mode TEXT,
  cheque_date TEXT,
  reference_no TEXT,
  cheque_no TEXT,
  transaction_type TEXT,
  salary_month_year TEXT,
  line_items_json TEXT,
  remarks TEXT,
  status TEXT DEFAULT 'draft',
  posted_to_ledger INTEGER DEFAULT 0,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_outgoing_fund_entries_tenant_branch_date
  ON outgoing_fund_entries (tenant_id, branch_id, entry_date);

CREATE INDEX IF NOT EXISTS idx_outgoing_fund_entries_paid_from
  ON outgoing_fund_entries (tenant_id, paid_from_account_id);

CREATE INDEX IF NOT EXISTS idx_outgoing_fund_entries_paid_to
  ON outgoing_fund_entries (tenant_id, paid_to_account_id);

CREATE INDEX IF NOT EXISTS idx_outgoing_fund_entries_status
  ON outgoing_fund_entries (tenant_id, branch_id, status);
