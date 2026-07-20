-- AuraShine Billing Prompt 18 - Gift Card + Store Credit
PRAGMA foreign_keys = ON;

CREATE TABLE IF NOT EXISTS gift_cards (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  code_hash TEXT NOT NULL,
  display_code_last4 TEXT NOT NULL,
  customer_id TEXT,
  purchaser_customer_id TEXT,
  initial_value REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  expiry_date TEXT,
  status TEXT DEFAULT 'active',
  created_invoice_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gift_cards_tenant_hash
  ON gift_cards(tenant_id, code_hash);

CREATE TABLE IF NOT EXISTS gift_card_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  gift_card_id TEXT NOT NULL,
  invoice_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  description TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_gc_tx_tenant_card
  ON gift_card_transactions(tenant_id, gift_card_id, created_at);

CREATE TABLE IF NOT EXISTS store_credits (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  source_invoice_id TEXT,
  source_refund_id TEXT,
  amount REAL DEFAULT 0,
  balance REAL DEFAULT 0,
  expiry_date TEXT,
  reason TEXT,
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_store_credits_tenant_customer
  ON store_credits(tenant_id, customer_id, status);

CREATE TABLE IF NOT EXISTS store_credit_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  store_credit_id TEXT NOT NULL,
  invoice_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL,
  balance_after REAL NOT NULL,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_store_credit_tx_tenant_credit
  ON store_credit_transactions(tenant_id, store_credit_id, created_at);

-- DOWN:
-- DROP TABLE IF EXISTS store_credit_transactions;
-- DROP TABLE IF EXISTS store_credits;
-- DROP TABLE IF EXISTS gift_card_transactions;
-- DROP TABLE IF EXISTS gift_cards;
