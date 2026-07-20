-- AuraShine Billing Prompt 17 - Corporate / Credit Billing
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS corporate_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  company_name TEXT,
  gstin TEXT,
  billing_email TEXT,
  phone TEXT,
  credit_limit REAL DEFAULT 0,
  current_outstanding REAL DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  status TEXT DEFAULT 'active',
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_corporate_accounts_tenant_branch
  ON corporate_accounts(tenant_id, branch_id, status);

CREATE TABLE IF NOT EXISTS corporate_account_members (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  corporate_account_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  employee_code TEXT,
  department TEXT,
  spending_limit REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_corp_members_tenant_account
  ON corporate_account_members(tenant_id, corporate_account_id, status);

CREATE TABLE IF NOT EXISTS credit_invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  corporate_account_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  due_date TEXT NOT NULL,
  credit_amount REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  outstanding_amount REAL DEFAULT 0,
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_credit_invoices_tenant_account
  ON credit_invoices(tenant_id, corporate_account_id, status);

CREATE TABLE IF NOT EXISTS credit_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  corporate_account_id TEXT NOT NULL,
  amount REAL NOT NULL,
  payment_mode TEXT NOT NULL,
  reference_no TEXT,
  allocated_invoice_ids_json TEXT DEFAULT '[]',
  received_by TEXT,
  received_at TEXT DEFAULT CURRENT_TIMESTAMP,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_credit_payments_tenant_account
  ON credit_payments(tenant_id, corporate_account_id, received_at);

-- DOWN:
-- DROP TABLE IF EXISTS credit_payments;
-- DROP TABLE IF EXISTS credit_invoices;
-- DROP TABLE IF EXISTS corporate_account_members;
-- DROP TABLE IF EXISTS corporate_accounts;
