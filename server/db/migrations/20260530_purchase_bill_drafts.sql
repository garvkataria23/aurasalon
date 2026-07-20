CREATE TABLE IF NOT EXISTS product_categories (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  name TEXT NOT NULL,
  code TEXT DEFAULT '',
  parent_id TEXT DEFAULT '',
  usage_scope TEXT DEFAULT 'inventory',
  ai_keywords_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, name)
);

CREATE TABLE IF NOT EXISTS product_supplier_aliases (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  supplier_id TEXT DEFAULT '',
  product_id TEXT NOT NULL,
  raw_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  supplier_sku TEXT DEFAULT '',
  confidence REAL DEFAULT 0,
  status TEXT DEFAULT 'active',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, supplier_id, normalized_name)
);

CREATE TABLE IF NOT EXISTS purchase_bill_drafts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  supplier_id TEXT DEFAULT '',
  supplier_key TEXT DEFAULT '',
  supplier_name TEXT DEFAULT '',
  supplier_gstin TEXT DEFAULT '',
  supplier_phone TEXT DEFAULT '',
  supplier_email TEXT DEFAULT '',
  supplier_address TEXT DEFAULT '',
  purchase_order_id TEXT DEFAULT '',
  po_match_json TEXT DEFAULT '{}',
  bill_no TEXT DEFAULT '',
  bill_date TEXT DEFAULT '',
  status TEXT DEFAULT 'draft',
  source_type TEXT DEFAULT 'photo_upload',
  ai_provider TEXT DEFAULT 'local',
  ai_confidence REAL DEFAULT 0,
  subtotal REAL DEFAULT 0,
  gst_amount REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  total_amount REAL DEFAULT 0,
  mismatch_amount REAL DEFAULT 0,
  validation_status TEXT DEFAULT 'needs_review',
  image_path TEXT DEFAULT '',
  original_file_name TEXT DEFAULT '',
  raw_text TEXT DEFAULT '',
  extraction_json TEXT DEFAULT '{}',
  warnings_json TEXT DEFAULT '[]',
  confirmed_at TEXT DEFAULT '',
  confirmed_by TEXT DEFAULT '',
  confirmed_inventory_json TEXT DEFAULT '[]',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS purchase_bill_draft_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  line_no INTEGER DEFAULT 1,
  product_id TEXT DEFAULT '',
  matched_product_id TEXT DEFAULT '',
  match_status TEXT DEFAULT 'new_product',
  match_confidence REAL DEFAULT 0,
  is_new_product INTEGER DEFAULT 1,
  raw_name TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  category_id TEXT DEFAULT '',
  category_name TEXT DEFAULT '',
  usage_type TEXT DEFAULT 'retail',
  stock_unit TEXT DEFAULT 'pcs',
  purchase_unit TEXT DEFAULT 'pcs',
  pack_size REAL DEFAULT 1,
  conversion_factor REAL DEFAULT 1,
  qty REAL DEFAULT 0,
  stock_qty REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  mrp REAL DEFAULT 0,
  hsn_sac TEXT DEFAULT '',
  discount_percent REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  gst_percent REAL DEFAULT 18,
  taxable_amount REAL DEFAULT 0,
  gst_amount REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  line_total REAL DEFAULT 0,
  batch_number TEXT DEFAULT '',
  expiry_date TEXT DEFAULT '',
  supplier_sku TEXT DEFAULT '',
  warnings_json TEXT DEFAULT '[]',
  match_suggestions_json TEXT DEFAULT '[]',
  status TEXT DEFAULT 'open',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(draft_id) REFERENCES purchase_bill_drafts(id)
);

CREATE TABLE IF NOT EXISTS purchase_bill_attachments (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  draft_id TEXT NOT NULL,
  file_path TEXT NOT NULL,
  original_file_name TEXT DEFAULT '',
  mime_type TEXT DEFAULT '',
  file_size INTEGER DEFAULT 0,
  checksum TEXT DEFAULT '',
  status TEXT DEFAULT 'active',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(draft_id) REFERENCES purchase_bill_drafts(id)
);

CREATE INDEX IF NOT EXISTS idx_product_categories_scope ON product_categories(tenant_id, branch_id, status, name);
CREATE INDEX IF NOT EXISTS idx_product_supplier_aliases_scope ON product_supplier_aliases(tenant_id, supplier_id, normalized_name);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_drafts_scope ON purchase_bill_drafts(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_bill_drafts_invoice ON purchase_bill_drafts(tenant_id, branch_id, supplier_key, bill_no);
CREATE UNIQUE INDEX IF NOT EXISTS idx_purchase_bill_confirmed_invoice
  ON purchase_bill_drafts(tenant_id, branch_id, supplier_key, bill_no)
  WHERE status = 'confirmed' AND bill_no <> '' AND supplier_key <> '';
CREATE INDEX IF NOT EXISTS idx_purchase_bill_draft_items_draft ON purchase_bill_draft_items(tenant_id, draft_id, line_no);
