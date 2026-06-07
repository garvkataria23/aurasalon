CREATE TABLE IF NOT EXISTS account_master_groups (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  group_code TEXT NOT NULL,
  group_name TEXT NOT NULL,
  parent_group_id TEXT,
  account_type TEXT,
  normal_balance TEXT DEFAULT 'Dr',
  system_group INTEGER DEFAULT 0,
  is_active INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1,
  UNIQUE (tenant_id, branch_id, group_code)
);

CREATE TABLE IF NOT EXISTS account_masters (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  account_code TEXT,
  account_name TEXT NOT NULL,
  short_name TEXT,
  group_id TEXT,
  group_name TEXT,
  opening_balance REAL DEFAULT 0,
  opening_balance_type TEXT DEFAULT 'Dr',
  is_hidden INTEGER DEFAULT 0,
  igst_pct REAL DEFAULT 0,
  gst_pct REAL DEFAULT 0,
  utgst_pct REAL DEFAULT 0,
  hsn_sac_code TEXT,
  hsn_sac_description TEXT,
  description TEXT,
  contact_person TEXT,
  mobile TEXT,
  phone TEXT,
  fax TEXT,
  address_line1 TEXT,
  address_line2 TEXT,
  address_line3 TEXT,
  landmark TEXT,
  city TEXT,
  pin TEXT,
  state TEXT,
  country TEXT DEFAULT 'India',
  area TEXT,
  email TEXT,
  web TEXT,
  gstin TEXT,
  pan_no TEXT,
  vat_no TEXT,
  cst_no TEXT,
  tin_no TEXT,
  status TEXT DEFAULT 'active',
  notes TEXT,
  created_by TEXT,
  updated_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1,
  UNIQUE (tenant_id, branch_id, account_name)
);

CREATE INDEX IF NOT EXISTS idx_account_master_groups_tenant_branch
  ON account_master_groups (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_account_master_groups_name
  ON account_master_groups (tenant_id, branch_id, group_name);

CREATE INDEX IF NOT EXISTS idx_account_masters_tenant_branch
  ON account_masters (tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_account_masters_group
  ON account_masters (tenant_id, branch_id, group_id);

CREATE INDEX IF NOT EXISTS idx_account_masters_name
  ON account_masters (tenant_id, branch_id, account_name);

CREATE INDEX IF NOT EXISTS idx_account_masters_tax
  ON account_masters (tenant_id, gstin, pan_no);
