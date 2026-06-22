CREATE TABLE IF NOT EXISTS purchase_orders (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  supplier_id TEXT DEFAULT '',
  po_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  source_type TEXT DEFAULT 'manual',
  recommendation_id TEXT DEFAULT '',
  total_estimated_cost REAL DEFAULT 0,
  total_received_cost REAL DEFAULT 0,
  subtotal_amount REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  taxable_amount REAL DEFAULT 0,
  gst_amount REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  round_off REAL DEFAULT 0,
  grand_total REAL DEFAULT 0,
  notes TEXT DEFAULT '',
  expected_delivery_date TEXT DEFAULT '',
  supplier_invoice_no TEXT DEFAULT '',
  supplier_invoice_date TEXT DEFAULT '',
  challan_no TEXT DEFAULT '',
  grn_number TEXT DEFAULT '',
  grn_date TEXT DEFAULT '',
  received_by TEXT DEFAULT '',
  approval_note TEXT DEFAULT '',
  rejection_reason TEXT DEFAULT '',
  payment_terms TEXT DEFAULT '',
  delivery_terms TEXT DEFAULT '',
  variance_json TEXT DEFAULT '[]',
  status_history_json TEXT DEFAULT '[]',
  approval_status TEXT DEFAULT 'not_requested',
  approved_by TEXT DEFAULT '',
  approved_at TEXT,
  sent_at TEXT,
  closed_at TEXT,
  whatsapp_queue_id TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, po_number)
);

CREATE TABLE IF NOT EXISTS purchase_order_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  purchase_order_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT DEFAULT '',
  hsn_sac TEXT DEFAULT '',
  unit TEXT DEFAULT 'pcs',
  mrp REAL DEFAULT 0,
  discount_percent REAL DEFAULT 0,
  discount_amount REAL DEFAULT 0,
  gst_percent REAL DEFAULT 18,
  taxable_amount REAL DEFAULT 0,
  gst_amount REAL DEFAULT 0,
  cgst_amount REAL DEFAULT 0,
  sgst_amount REAL DEFAULT 0,
  igst_amount REAL DEFAULT 0,
  line_total REAL DEFAULT 0,
  requested_qty REAL DEFAULT 0,
  received_qty REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  estimated_total REAL DEFAULT 0,
  received_total REAL DEFAULT 0,
  received_taxable_amount REAL DEFAULT 0,
  received_gst_amount REAL DEFAULT 0,
  damaged_qty REAL DEFAULT 0,
  short_qty REAL DEFAULT 0,
  excess_qty REAL DEFAULT 0,
  variance_json TEXT DEFAULT '[]',
  batch_number TEXT DEFAULT '',
  expiry_date TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(purchase_order_id) REFERENCES purchase_orders(id)
);

CREATE TABLE IF NOT EXISTS service_recipes (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  service_id TEXT NOT NULL,
  service_name TEXT DEFAULT '',
  recipe_name TEXT DEFAULT '',
  service_category TEXT DEFAULT '',
  service_price REAL DEFAULT 0,
  expected_cost REAL DEFAULT 0,
  expected_margin REAL DEFAULT 0,
  expected_margin_pct REAL DEFAULT 0,
  margin_floor_pct REAL DEFAULT 0,
  approval_status TEXT DEFAULT 'approved',
  approved_by TEXT DEFAULT '',
  approved_at TEXT,
  submitted_by TEXT DEFAULT '',
  submitted_at TEXT,
  usage_modifiers_json TEXT DEFAULT '[]',
  substitute_policy_json TEXT DEFAULT '{}',
  ai_suggestion_json TEXT DEFAULT '{}',
  version_note TEXT DEFAULT '',
  last_consumed_at TEXT,
  active INTEGER DEFAULT 1,
  notes TEXT DEFAULT '',
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, branch_id, service_id)
);

CREATE TABLE IF NOT EXISTS service_recipe_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  recipe_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT DEFAULT '',
  product_type TEXT DEFAULT '',
  quantity_per_service REAL DEFAULT 0,
  unit TEXT DEFAULT 'pcs',
  min_quantity_per_service REAL DEFAULT 0,
  max_quantity_per_service REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  wastage_pct REAL DEFAULT 0,
  required INTEGER DEFAULT 1,
  sort_order INTEGER DEFAULT 0,
  allowed_substitutes_json TEXT DEFAULT '[]',
  actual_tracking_mode TEXT DEFAULT 'expected',
  ai_confidence REAL DEFAULT 0,
  notes TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(recipe_id) REFERENCES service_recipes(id)
);

CREATE TABLE IF NOT EXISTS service_recipe_versions (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  recipe_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  version INTEGER DEFAULT 1,
  action TEXT DEFAULT 'saved',
  approval_status TEXT DEFAULT 'approved',
  changed_by TEXT DEFAULT '',
  change_note TEXT DEFAULT '',
  snapshot_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_recipe_usage_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  service_name TEXT DEFAULT '',
  recipe_id TEXT DEFAULT '',
  reference_type TEXT DEFAULT '',
  reference_id TEXT DEFAULT '',
  staff_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  service_quantity REAL DEFAULT 1,
  usage_modifier_key TEXT DEFAULT 'standard',
  usage_modifier_multiplier REAL DEFAULT 1,
  expected_qty_total REAL DEFAULT 0,
  actual_qty_total REAL DEFAULT 0,
  expected_cost REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  variance_pct REAL DEFAULT 0,
  overuse_flag INTEGER DEFAULT 0,
  status TEXT DEFAULT 'deducted',
  ai_flags_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_recipe_usage_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  usage_log_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  service_id TEXT NOT NULL,
  recipe_id TEXT DEFAULT '',
  product_id TEXT NOT NULL,
  product_name TEXT DEFAULT '',
  unit TEXT DEFAULT 'pcs',
  expected_qty REAL DEFAULT 0,
  actual_qty REAL DEFAULT 0,
  wastage_pct REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  expected_cost REAL DEFAULT 0,
  actual_cost REAL DEFAULT 0,
  variance_pct REAL DEFAULT 0,
  overuse_flag INTEGER DEFAULT 0,
  batch_json TEXT DEFAULT '[]',
  transaction_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(usage_log_id) REFERENCES service_recipe_usage_logs(id)
);

CREATE TABLE IF NOT EXISTS service_recipe_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  service_id TEXT DEFAULT '',
  product_id TEXT DEFAULT '',
  alert_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  title TEXT DEFAULT '',
  message TEXT DEFAULT '',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS service_recipe_templates (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  template_key TEXT NOT NULL,
  template_name TEXT NOT NULL,
  service_category TEXT DEFAULT '',
  usage_modifiers_json TEXT DEFAULT '[]',
  items_json TEXT DEFAULT '[]',
  ai_suggestion_json TEXT DEFAULT '{}',
  active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, template_key)
);

CREATE TABLE IF NOT EXISTS stock_counts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  count_number TEXT NOT NULL,
  status TEXT DEFAULT 'draft',
  counted_by TEXT DEFAULT '',
  submitted_by TEXT DEFAULT '',
  submitted_at TEXT,
  notes TEXT DEFAULT '',
  total_variance_qty REAL DEFAULT 0,
  total_variance_value REAL DEFAULT 0,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenant_id, count_number)
);

CREATE TABLE IF NOT EXISTS stock_count_items (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  stock_count_id TEXT NOT NULL,
  product_id TEXT NOT NULL,
  product_name TEXT DEFAULT '',
  system_qty REAL DEFAULT 0,
  counted_qty REAL DEFAULT 0,
  variance_qty REAL DEFAULT 0,
  unit_cost REAL DEFAULT 0,
  variance_value REAL DEFAULT 0,
  reason TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY(stock_count_id) REFERENCES stock_counts(id)
);

CREATE TABLE IF NOT EXISTS stock_variance_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  stock_count_id TEXT DEFAULT '',
  product_id TEXT NOT NULL,
  variance_qty REAL DEFAULT 0,
  variance_value REAL DEFAULT 0,
  severity TEXT DEFAULT 'medium',
  reason TEXT DEFAULT '',
  evidence_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_theft_findings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  product_id TEXT DEFAULT '',
  finding_type TEXT NOT NULL,
  severity TEXT DEFAULT 'medium',
  risk_score REAL DEFAULT 0,
  estimated_loss REAL DEFAULT 0,
  evidence_json TEXT DEFAULT '{}',
  recommended_action TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS branch_transfer_requests (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  source_branch_id TEXT NOT NULL,
  target_branch_id TEXT NOT NULL,
  source_product_id TEXT NOT NULL,
  target_product_id TEXT DEFAULT '',
  product_name TEXT DEFAULT '',
  quantity REAL DEFAULT 0,
  reason TEXT DEFAULT '',
  recommendation_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'pending_approval',
  approved_by TEXT DEFAULT '',
  approved_at TEXT,
  completed_at TEXT,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS barcode_scan_events (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  terminal_id TEXT DEFAULT '',
  scanned_code TEXT DEFAULT '',
  resolved_entity_type TEXT DEFAULT '',
  resolved_entity_id TEXT DEFAULT '',
  code TEXT NOT NULL,
  scan_type TEXT DEFAULT 'lookup',
  matched_product_id TEXT DEFAULT '',
  result_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'received',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS inventory_report_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  report_type TEXT NOT NULL,
  period_start TEXT DEFAULT '',
  period_end TEXT DEFAULT '',
  metrics_json TEXT DEFAULT '{}',
  rows_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS supplier_whatsapp_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  supplier_id TEXT DEFAULT '',
  purchase_order_id TEXT DEFAULT '',
  phone TEXT DEFAULT '',
  message TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  requires_manual_send INTEGER DEFAULT 1,
  sent_at TEXT,
  provider_response_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_purchase_orders_scope ON purchase_orders(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_purchase_order_items_po ON purchase_order_items(tenant_id, purchase_order_id, product_id);
CREATE INDEX IF NOT EXISTS idx_service_recipes_scope ON service_recipes(tenant_id, branch_id, service_id, active);
CREATE INDEX IF NOT EXISTS idx_service_recipe_items_recipe ON service_recipe_items(tenant_id, recipe_id, product_id);
CREATE INDEX IF NOT EXISTS idx_service_recipe_versions_recipe ON service_recipe_versions(tenant_id, recipe_id, version);
CREATE INDEX IF NOT EXISTS idx_service_recipe_usage_scope ON service_recipe_usage_logs(tenant_id, branch_id, service_id, created_at);
CREATE INDEX IF NOT EXISTS idx_service_recipe_usage_items_log ON service_recipe_usage_items(tenant_id, usage_log_id, product_id);
CREATE INDEX IF NOT EXISTS idx_service_recipe_alerts_scope ON service_recipe_alerts(tenant_id, branch_id, alert_type, status);
CREATE INDEX IF NOT EXISTS idx_service_recipe_templates_scope ON service_recipe_templates(tenant_id, service_category, active);
CREATE INDEX IF NOT EXISTS idx_stock_counts_scope ON stock_counts(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_stock_variance_scope ON stock_variance_findings(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_theft_scope ON inventory_theft_findings(tenant_id, branch_id, status, created_at);
CREATE INDEX IF NOT EXISTS idx_branch_transfer_scope ON branch_transfer_requests(tenant_id, source_branch_id, target_branch_id, status);
CREATE INDEX IF NOT EXISTS idx_barcode_scan_scope ON barcode_scan_events(tenant_id, branch_id, created_at);
CREATE INDEX IF NOT EXISTS idx_inventory_report_scope ON inventory_report_snapshots(tenant_id, branch_id, report_type, created_at);
CREATE INDEX IF NOT EXISTS idx_supplier_whatsapp_queue_scope ON supplier_whatsapp_queue(tenant_id, branch_id, status, created_at);
