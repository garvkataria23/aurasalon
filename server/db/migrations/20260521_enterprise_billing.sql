-- AuraShine Salon OS - Enterprise Billing/POS Migration
-- Prompt 1: Enterprise billing, invoice, payment, refund, ledger, terminal,
-- corporate credit, and reconciliation schema.
--
-- IMPORTANT:
-- Existing production databases may already contain legacy camelCase tables
-- such as invoices and wallet_transactions. This file defines the final
-- enterprise snake_case schema requested by the billing blueprint. If a legacy
-- table already exists, SQLite will not reshape it through CREATE TABLE IF NOT
-- EXISTS. A defensive JS migration runner should add missing columns before
-- enabling live billing flows.
--
-- Protected files are not modified by this migration.

PRAGMA foreign_keys = ON;

-- =========================
-- UP
-- =========================

CREATE TABLE IF NOT EXISTS invoices (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  invoice_no TEXT NOT NULL,
  invoice_type TEXT NOT NULL DEFAULT 'tax_invoice',
  appointment_id TEXT,
  customer_id TEXT,
  corporate_account_id TEXT,
  credit_account_id TEXT,
  status TEXT NOT NULL DEFAULT 'draft',
  payment_status TEXT NOT NULL DEFAULT 'unpaid',
  source TEXT DEFAULT 'pos',
  subtotal REAL DEFAULT 0,
  discount_total REAL DEFAULT 0,
  tax_total REAL DEFAULT 0,
  tip_total REAL DEFAULT 0,
  round_off REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  paid_amount REAL DEFAULT 0,
  due_amount REAL DEFAULT 0,
  refund_amount REAL DEFAULT 0,
  currency TEXT DEFAULT 'INR',
  notes TEXT,
  terms TEXT,
  gstin TEXT,
  place_of_supply TEXT,
  irn TEXT,
  e_invoice_qr TEXT,
  e_invoice_ack_no TEXT,
  e_invoice_ack_date TEXT,
  created_by TEXT,
  voided_by TEXT,
  void_reason TEXT,
  voided_at TEXT,
  locked_at TEXT,
  finalized_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, branch_id, financial_year, invoice_no)
);

CREATE INDEX IF NOT EXISTS idx_invoices_tenant_branch_created
  ON invoices(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_customer
  ON invoices(tenant_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_status
  ON invoices(tenant_id, status, payment_status);
CREATE INDEX IF NOT EXISTS idx_invoices_tenant_appointment
  ON invoices(tenant_id, appointment_id);

CREATE TABLE IF NOT EXISTS invoice_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  item_type TEXT NOT NULL,
  item_id TEXT,
  item_name TEXT NOT NULL,
  category_id TEXT,
  staff_id TEXT,
  quantity REAL NOT NULL DEFAULT 1,
  unit_price REAL NOT NULL DEFAULT 0,
  gross_amount REAL DEFAULT 0,
  discount_type TEXT,
  discount_value REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  taxable_amount REAL DEFAULT 0,
  tax_rate REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  hsn_sac_code TEXT,
  batch_id TEXT,
  appointment_service_id TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_invoice
  ON invoice_items(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_item
  ON invoice_items(tenant_id, item_type, item_id);
CREATE INDEX IF NOT EXISTS idx_invoice_items_tenant_staff
  ON invoice_items(tenant_id, staff_id, created_at);

CREATE TABLE IF NOT EXISTS invoice_payments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_mode TEXT NOT NULL,
  provider TEXT,
  provider_payment_id TEXT,
  provider_order_id TEXT,
  provider_link_id TEXT,
  terminal_id TEXT,
  amount REAL NOT NULL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  paid_at TEXT,
  reference_no TEXT,
  notes TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_invoice_status
  ON invoice_payments(tenant_id, invoice_id, status);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_provider
  ON invoice_payments(tenant_id, provider, provider_payment_id);
CREATE INDEX IF NOT EXISTS idx_invoice_payments_tenant_mode_paid
  ON invoice_payments(tenant_id, payment_mode, paid_at);

CREATE TABLE IF NOT EXISTS invoice_taxes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_item_id TEXT,
  tax_type TEXT NOT NULL,
  tax_rate REAL NOT NULL DEFAULT 0,
  taxable_amount REAL DEFAULT 0,
  tax_amount REAL DEFAULT 0,
  hsn_sac_code TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_taxes_tenant_invoice
  ON invoice_taxes(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_taxes_tenant_hsn
  ON invoice_taxes(tenant_id, hsn_sac_code, tax_type);

CREATE TABLE IF NOT EXISTS invoice_discounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_item_id TEXT,
  discount_type TEXT NOT NULL,
  discount_value REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  reason TEXT,
  coupon_code TEXT,
  approved_by TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_discounts_tenant_invoice
  ON invoice_discounts(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_discounts_tenant_approver
  ON invoice_discounts(tenant_id, approved_by, created_at);

CREATE TABLE IF NOT EXISTS invoice_refunds (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  payment_id TEXT,
  refund_no TEXT NOT NULL,
  refund_type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  tax_reversal_amount REAL DEFAULT 0,
  reason TEXT NOT NULL,
  provider_refund_id TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  approved_by TEXT,
  processed_by TEXT,
  processed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, refund_no)
);

CREATE INDEX IF NOT EXISTS idx_invoice_refunds_tenant_invoice
  ON invoice_refunds(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_refunds_tenant_status
  ON invoice_refunds(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS invoice_voids (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  reason TEXT NOT NULL,
  old_invoice_json TEXT NOT NULL,
  inventory_rollback_done INTEGER DEFAULT 0,
  commission_rollback_done INTEGER DEFAULT 0,
  loyalty_rollback_done INTEGER DEFAULT 0,
  wallet_rollback_done INTEGER DEFAULT 0,
  approved_by TEXT,
  voided_by TEXT NOT NULL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_voids_tenant_invoice
  ON invoice_voids(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_voids_tenant_voided
  ON invoice_voids(tenant_id, voided_by, created_at);

CREATE TABLE IF NOT EXISTS invoice_tips (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  payment_mode TEXT NOT NULL,
  tip_pool_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_tips_tenant_invoice_staff
  ON invoice_tips(tenant_id, invoice_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_invoice_tips_tenant_staff
  ON invoice_tips(tenant_id, staff_id, created_at);

CREATE TABLE IF NOT EXISTS wallet_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT,
  type TEXT NOT NULL,
  amount REAL NOT NULL DEFAULT 0,
  balance_after REAL NOT NULL DEFAULT 0,
  expiry_date TEXT,
  description TEXT,
  reference_type TEXT,
  reference_id TEXT,
  metadata_json TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tenant_customer
  ON wallet_transactions(tenant_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_wallet_transactions_tenant_invoice
  ON wallet_transactions(tenant_id, invoice_id);

CREATE TABLE IF NOT EXISTS loyalty_transactions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  invoice_id TEXT,
  type TEXT NOT NULL,
  points INTEGER NOT NULL DEFAULT 0,
  balance_after INTEGER NOT NULL DEFAULT 0,
  description TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_tenant_customer
  ON loyalty_transactions(tenant_id, customer_id, created_at);
CREATE INDEX IF NOT EXISTS idx_loyalty_transactions_tenant_invoice
  ON loyalty_transactions(tenant_id, invoice_id);

CREATE TABLE IF NOT EXISTS membership_redemptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  membership_id TEXT NOT NULL,
  benefit_id TEXT,
  discount_amount REAL DEFAULT 0,
  service_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_membership_redemptions_tenant_invoice
  ON membership_redemptions(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_membership_redemptions_tenant_customer
  ON membership_redemptions(tenant_id, customer_id, created_at);

CREATE TABLE IF NOT EXISTS package_redemptions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  package_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  sessions_used INTEGER DEFAULT 1,
  amount_redeemed REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_package_redemptions_tenant_invoice
  ON package_redemptions(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_package_redemptions_tenant_customer
  ON package_redemptions(tenant_id, customer_id, created_at);

CREATE TABLE IF NOT EXISTS cash_drawer_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  cashier_id TEXT NOT NULL,
  terminal_id TEXT,
  opening_cash REAL DEFAULT 0,
  closing_cash REAL DEFAULT 0,
  expected_cash REAL DEFAULT 0,
  cash_difference REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'open',
  opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT
);

CREATE INDEX IF NOT EXISTS idx_cash_drawer_sessions_tenant_branch_status
  ON cash_drawer_sessions(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_cash_drawer_sessions_tenant_cashier
  ON cash_drawer_sessions(tenant_id, cashier_id, opened_at);

CREATE TABLE IF NOT EXISTS daily_closing (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  closing_date TEXT NOT NULL,
  total_sales REAL DEFAULT 0,
  cash_total REAL DEFAULT 0,
  upi_total REAL DEFAULT 0,
  card_total REAL DEFAULT 0,
  wallet_total REAL DEFAULT 0,
  refund_total REAL DEFAULT 0,
  discount_total REAL DEFAULT 0,
  tax_total REAL DEFAULT 0,
  tips_total REAL DEFAULT 0,
  opening_cash REAL DEFAULT 0,
  closing_cash REAL DEFAULT 0,
  difference REAL DEFAULT 0,
  closed_by TEXT NOT NULL,
  manager_approved_by TEXT,
  remarks TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, branch_id, closing_date)
);

CREATE INDEX IF NOT EXISTS idx_daily_closing_tenant_branch_date
  ON daily_closing(tenant_id, branch_id, closing_date);

CREATE TABLE IF NOT EXISTS payment_reconciliation (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  provider TEXT NOT NULL,
  provider_settlement_id TEXT,
  settlement_date TEXT NOT NULL,
  expected_amount REAL DEFAULT 0,
  settled_amount REAL DEFAULT 0,
  fees REAL DEFAULT 0,
  tax_on_fees REAL DEFAULT 0,
  refunds REAL DEFAULT 0,
  adjustments REAL DEFAULT 0,
  difference REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'pending',
  raw_payload TEXT,
  reviewed_by TEXT,
  reviewed_at TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_tenant_provider_date
  ON payment_reconciliation(tenant_id, provider, settlement_date);
CREATE INDEX IF NOT EXISTS idx_payment_reconciliation_tenant_status
  ON payment_reconciliation(tenant_id, status, created_at);

CREATE TABLE IF NOT EXISTS invoice_audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT,
  user_id TEXT,
  action TEXT NOT NULL,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_audit_log_tenant_invoice_time
  ON invoice_audit_log(tenant_id, invoice_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_audit_log_tenant_user_time
  ON invoice_audit_log(tenant_id, user_id, created_at);

CREATE TABLE IF NOT EXISTS invoice_number_sequences (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  financial_year TEXT NOT NULL,
  prefix TEXT NOT NULL,
  last_number INTEGER DEFAULT 0,
  reset_policy TEXT DEFAULT 'financial_year',
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, branch_id, financial_year, prefix)
);

CREATE INDEX IF NOT EXISTS idx_invoice_number_sequences_tenant_branch_fy
  ON invoice_number_sequences(tenant_id, branch_id, financial_year);

-- =========================
-- 100x Additions
-- =========================

CREATE TABLE IF NOT EXISTS invoice_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  actor_user_id TEXT,
  source TEXT DEFAULT 'system',
  payload_json TEXT,
  hash TEXT,
  previous_hash TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_events_tenant_invoice_time
  ON invoice_events(tenant_id, invoice_id, created_at);
CREATE INDEX IF NOT EXISTS idx_invoice_events_tenant_type_time
  ON invoice_events(tenant_id, event_type, created_at);

CREATE TABLE IF NOT EXISTS invoice_locks (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  lock_type TEXT NOT NULL,
  reason TEXT NOT NULL,
  locked_by TEXT,
  locked_at TEXT DEFAULT CURRENT_TIMESTAMP,
  released_by TEXT,
  released_at TEXT,
  active INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_invoice_locks_tenant_invoice_active
  ON invoice_locks(tenant_id, invoice_id, active);
CREATE INDEX IF NOT EXISTS idx_invoice_locks_tenant_type
  ON invoice_locks(tenant_id, lock_type, active);

CREATE TABLE IF NOT EXISTS invoice_item_margins (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  invoice_item_id TEXT NOT NULL,
  revenue REAL DEFAULT 0,
  discount REAL DEFAULT 0,
  tax REAL DEFAULT 0,
  product_cost REAL DEFAULT 0,
  service_consumable_cost REAL DEFAULT 0,
  staff_commission REAL DEFAULT 0,
  gross_margin REAL DEFAULT 0,
  margin_pct REAL DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_item_margins_tenant_invoice
  ON invoice_item_margins(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_invoice_item_margins_tenant_item
  ON invoice_item_margins(tenant_id, invoice_item_id);

CREATE TABLE IF NOT EXISTS credit_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  customer_id TEXT,
  corporate_account_id TEXT,
  credit_limit REAL DEFAULT 0,
  outstanding_amount REAL DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 0,
  status TEXT DEFAULT 'active',
  approved_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_credit_accounts_tenant_customer
  ON credit_accounts(tenant_id, customer_id, status);
CREATE INDEX IF NOT EXISTS idx_credit_accounts_tenant_corporate
  ON credit_accounts(tenant_id, corporate_account_id, status);

CREATE TABLE IF NOT EXISTS corporate_accounts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT,
  account_name TEXT NOT NULL,
  gstin TEXT,
  billing_email TEXT,
  billing_phone TEXT,
  contact_person TEXT,
  credit_limit REAL DEFAULT 0,
  outstanding_amount REAL DEFAULT 0,
  payment_terms_days INTEGER DEFAULT 30,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_corporate_accounts_tenant_branch
  ON corporate_accounts(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_corporate_accounts_tenant_name
  ON corporate_accounts(tenant_id, account_name);

CREATE TABLE IF NOT EXISTS terminal_sessions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_id TEXT NOT NULL,
  device_id TEXT,
  cashier_id TEXT NOT NULL,
  cash_drawer_session_id TEXT,
  status TEXT DEFAULT 'active',
  opened_at TEXT DEFAULT CURRENT_TIMESTAMP,
  closed_at TEXT,
  last_heartbeat_at TEXT,
  app_version TEXT,
  device_metadata_json TEXT
);

CREATE INDEX IF NOT EXISTS idx_terminal_sessions_tenant_branch_status
  ON terminal_sessions(tenant_id, branch_id, status);
CREATE INDEX IF NOT EXISTS idx_terminal_sessions_tenant_terminal
  ON terminal_sessions(tenant_id, terminal_id, opened_at);

CREATE TABLE IF NOT EXISTS payment_webhook_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  provider TEXT NOT NULL,
  event_id TEXT NOT NULL,
  event_type TEXT NOT NULL,
  signature TEXT,
  payload_hash TEXT,
  raw_payload TEXT,
  status TEXT DEFAULT 'received',
  processed_at TEXT,
  processing_error TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE (tenant_id, provider, event_id)
);

CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tenant_provider_event
  ON payment_webhook_events(tenant_id, provider, event_id);
CREATE INDEX IF NOT EXISTS idx_payment_webhook_events_tenant_status
  ON payment_webhook_events(tenant_id, status, created_at);

-- =========================
-- DOWN
-- =========================
-- SQLite migrations are normally applied forward only in AuraShine.
-- For a manual rollback in a development database, drop newest/dependent
-- tables first. Do not run this section in production without backup.
--
-- DROP TABLE IF EXISTS payment_webhook_events;
-- DROP TABLE IF EXISTS terminal_sessions;
-- DROP TABLE IF EXISTS corporate_accounts;
-- DROP TABLE IF EXISTS credit_accounts;
-- DROP TABLE IF EXISTS invoice_item_margins;
-- DROP TABLE IF EXISTS invoice_locks;
-- DROP TABLE IF EXISTS invoice_events;
-- DROP TABLE IF EXISTS invoice_number_sequences;
-- DROP TABLE IF EXISTS invoice_audit_log;
-- DROP TABLE IF EXISTS payment_reconciliation;
-- DROP TABLE IF EXISTS daily_closing;
-- DROP TABLE IF EXISTS cash_drawer_sessions;
-- DROP TABLE IF EXISTS package_redemptions;
-- DROP TABLE IF EXISTS membership_redemptions;
-- DROP TABLE IF EXISTS loyalty_transactions;
-- DROP TABLE IF EXISTS wallet_transactions;
-- DROP TABLE IF EXISTS invoice_tips;
-- DROP TABLE IF EXISTS invoice_voids;
-- DROP TABLE IF EXISTS invoice_refunds;
-- DROP TABLE IF EXISTS invoice_discounts;
-- DROP TABLE IF EXISTS invoice_taxes;
-- DROP TABLE IF EXISTS invoice_payments;
-- DROP TABLE IF EXISTS invoice_items;
-- DROP TABLE IF EXISTS invoices;
