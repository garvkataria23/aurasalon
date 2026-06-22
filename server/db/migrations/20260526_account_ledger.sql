CREATE TABLE IF NOT EXISTS account_ledger_entries (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  account_id TEXT NOT NULL,
  account_name TEXT,
  doc_date TEXT NOT NULL,
  entry_type TEXT,
  prefix TEXT,
  doc_no TEXT,
  sno TEXT,
  bill_number TEXT,
  bill_date TEXT,
  particular TEXT,
  debit REAL DEFAULT 0,
  credit REAL DEFAULT 0,
  paymode TEXT,
  cheque_no TEXT,
  remarks TEXT,
  source_module TEXT,
  source_id TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_account_ledger_tenant_branch
  ON account_ledger_entries (tenant_id, branch_id, doc_date);

CREATE INDEX IF NOT EXISTS idx_account_ledger_account
  ON account_ledger_entries (tenant_id, branch_id, account_id, doc_date);

CREATE INDEX IF NOT EXISTS idx_account_ledger_source
  ON account_ledger_entries (tenant_id, source_module, source_id);
