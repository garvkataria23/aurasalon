-- UP
CREATE TABLE IF NOT EXISTS daily_summary (
  tenant_id TEXT NOT NULL,
  date TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  revenue REAL DEFAULT 0,
  appointments_count INTEGER DEFAULT 0,
  walkin_count INTEGER DEFAULT 0,
  cancellations INTEGER DEFAULT 0,
  noshows INTEGER DEFAULT 0,
  new_customers INTEGER DEFAULT 0,
  repeat_customers INTEGER DEFAULT 0,
  avg_ticket REAL DEFAULT 0,
  chair_utilization_pct REAL DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, date, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_daily_tenant_date ON daily_summary(tenant_id, date);

CREATE TABLE IF NOT EXISTS hourly_summary (
  tenant_id TEXT NOT NULL,
  datetime_hour TEXT NOT NULL,
  branch_id TEXT NOT NULL,
  revenue REAL DEFAULT 0,
  appointments_count INTEGER DEFAULT 0,
  PRIMARY KEY (tenant_id, datetime_hour, branch_id)
);
CREATE INDEX IF NOT EXISTS idx_hourly_tenant_hour ON hourly_summary(tenant_id, datetime_hour);

CREATE TABLE IF NOT EXISTS staff_daily_summary (
  tenant_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  date TEXT NOT NULL,
  services_completed INTEGER DEFAULT 0,
  revenue_generated REAL DEFAULT 0,
  tips_received REAL DEFAULT 0,
  retention_count INTEGER DEFAULT 0,
  PRIMARY KEY (tenant_id, staff_id, date)
);
CREATE INDEX IF NOT EXISTS idx_staff_daily_tenant_staff_date ON staff_daily_summary(tenant_id, staff_id, date);

CREATE TABLE IF NOT EXISTS customer_metrics (
  tenant_id TEXT NOT NULL,
  customer_id TEXT NOT NULL,
  total_visits INTEGER DEFAULT 0,
  total_spent REAL DEFAULT 0,
  last_visit_date TEXT,
  avg_gap_days REAL,
  rfm_recency INTEGER,
  rfm_frequency INTEGER,
  rfm_monetary INTEGER,
  segment TEXT,
  clv REAL,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, customer_id)
);
CREATE INDEX IF NOT EXISTS idx_customer_metrics_segment ON customer_metrics(tenant_id, segment);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT DEFAULT '',
  action TEXT NOT NULL,
  entity_type TEXT DEFAULT '',
  entity_id TEXT DEFAULT '',
  old_value TEXT DEFAULT '{}',
  new_value TEXT DEFAULT '{}',
  ip_address TEXT DEFAULT '',
  user_agent TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON audit_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT DEFAULT '',
  type TEXT NOT NULL,
  severity TEXT DEFAULT 'info',
  title TEXT NOT NULL,
  message TEXT DEFAULT '',
  entity_ref TEXT DEFAULT '',
  status TEXT DEFAULT 'open',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  resolved_at TEXT DEFAULT ''
);
CREATE INDEX IF NOT EXISTS idx_alerts_tenant_status ON alerts(tenant_id, status);

-- DOWN
DROP INDEX IF EXISTS idx_alerts_tenant_status;
DROP INDEX IF EXISTS idx_audit_log_entity;
DROP INDEX IF EXISTS idx_audit_log_tenant_created;
DROP INDEX IF EXISTS idx_customer_metrics_segment;
DROP INDEX IF EXISTS idx_staff_daily_tenant_staff_date;
DROP INDEX IF EXISTS idx_hourly_tenant_hour;
DROP INDEX IF EXISTS idx_daily_tenant_date;
DROP TABLE IF EXISTS alerts;
DROP TABLE IF EXISTS audit_log;
DROP TABLE IF EXISTS customer_metrics;
DROP TABLE IF EXISTS staff_daily_summary;
DROP TABLE IF EXISTS hourly_summary;
DROP TABLE IF EXISTS daily_summary;
