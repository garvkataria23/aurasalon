CREATE TABLE IF NOT EXISTS business_notification_profiles (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  business_name TEXT DEFAULT '',
  logo_url TEXT DEFAULT '',
  admin_email TEXT DEFAULT '',
  reporting_emails_json TEXT DEFAULT '[]',
  owner_emails_json TEXT DEFAULT '[]',
  owner_mobiles_json TEXT DEFAULT '[]',
  client_channels_json TEXT DEFAULT '["whatsapp","sms","email"]',
  owner_channels_json TEXT DEFAULT '["email","sms"]',
  mobile_number TEXT DEFAULT '',
  telephone_number TEXT DEFAULT '',
  appointment_number TEXT DEFAULT '',
  address TEXT DEFAULT '',
  country TEXT DEFAULT 'India - IN',
  state TEXT DEFAULT '',
  city TEXT DEFAULT '',
  postal_code TEXT DEFAULT '',
  about_us TEXT DEFAULT '',
  social_links_json TEXT DEFAULT '{}',
  business_hours_json TEXT DEFAULT '{}',
  provider_mode TEXT DEFAULT 'queued',
  invoice_client_enabled INTEGER DEFAULT 1,
  invoice_owner_enabled INTEGER DEFAULT 1,
  version INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_business_notification_profiles_scope
  ON business_notification_profiles(tenant_id, branch_id);

CREATE INDEX IF NOT EXISTS idx_business_notification_profiles_tenant
  ON business_notification_profiles(tenant_id);

CREATE TABLE IF NOT EXISTS invoice_notification_queue (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  invoice_id TEXT NOT NULL,
  sale_id TEXT DEFAULT '',
  client_id TEXT DEFAULT '',
  invoice_no TEXT DEFAULT '',
  recipient_type TEXT NOT NULL,
  recipient_name TEXT DEFAULT '',
  channel TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  message_subject TEXT DEFAULT '',
  message_body TEXT NOT NULL,
  status TEXT DEFAULT 'queued',
  provider_mode TEXT DEFAULT 'queued',
  requires_manual_send INTEGER DEFAULT 1,
  attempts INTEGER DEFAULT 0,
  provider_payload_json TEXT DEFAULT '{}',
  metadata_json TEXT DEFAULT '{}',
  queued_at TEXT DEFAULT CURRENT_TIMESTAMP,
  sent_at TEXT DEFAULT '',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_invoice_notification_queue_unique_recipient
  ON invoice_notification_queue(tenant_id, invoice_id, recipient_type, channel, recipient_address);

CREATE INDEX IF NOT EXISTS idx_invoice_notification_queue_status
  ON invoice_notification_queue(tenant_id, branch_id, status, created_at);

CREATE INDEX IF NOT EXISTS idx_invoice_notification_queue_invoice
  ON invoice_notification_queue(tenant_id, invoice_id);

CREATE TABLE IF NOT EXISTS invoice_notification_delivery_logs (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  queue_id TEXT NOT NULL,
  invoice_id TEXT NOT NULL,
  channel TEXT NOT NULL,
  recipient_address TEXT NOT NULL,
  status TEXT NOT NULL,
  provider TEXT DEFAULT '',
  provider_response_json TEXT DEFAULT '{}',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_invoice_notification_delivery_logs_invoice
  ON invoice_notification_delivery_logs(tenant_id, invoice_id, created_at);
