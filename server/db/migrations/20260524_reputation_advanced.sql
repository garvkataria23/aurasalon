CREATE TABLE IF NOT EXISTS review_platforms (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  platform_code TEXT NOT NULL,
  platform_name TEXT,
  platform_url TEXT,
  business_listing_id TEXT,
  business_listing_url TEXT,
  oauth_token_encrypted TEXT,
  oauth_refresh_token_encrypted TEXT,
  oauth_expires_at TEXT,
  auto_sync_enabled INTEGER DEFAULT 1,
  last_synced_at TEXT,
  last_sync_status TEXT,
  rate_limit_per_day INTEGER DEFAULT 100,
  rate_limit_used_today INTEGER DEFAULT 0,
  rate_limit_window_start TEXT,
  provider_config_json TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reviews_v2 (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  platform_id TEXT NOT NULL,
  platform_review_id TEXT,
  reviewer_name TEXT,
  reviewer_avatar TEXT,
  reviewer_platform_id TEXT,
  reviewer_verified INTEGER DEFAULT 0,
  reviewer_review_count INTEGER,
  customer_id TEXT,
  appointment_id TEXT,
  invoice_id TEXT,
  primary_staff_id TEXT,
  service_ids TEXT DEFAULT '[]',
  rating REAL NOT NULL,
  rating_max REAL DEFAULT 5,
  title TEXT,
  review_text TEXT,
  review_language TEXT,
  review_translated_text TEXT,
  photos_json TEXT DEFAULT '[]',
  videos_json TEXT DEFAULT '[]',
  sentiment TEXT,
  sentiment_score REAL,
  sentiment_confidence REAL,
  ai_analyzed_at TEXT,
  ai_provider TEXT,
  ai_model_used TEXT,
  ai_prompt_version TEXT,
  emotion_primary TEXT,
  topics_json TEXT DEFAULT '[]',
  aspects_json TEXT DEFAULT '{}',
  intent_detected TEXT,
  toxicity_score REAL DEFAULT 0,
  fake_probability REAL DEFAULT 0,
  is_competitor_smear INTEGER DEFAULT 0,
  recovery_opportunity_json TEXT DEFAULT '{}',
  status TEXT DEFAULT 'new',
  priority TEXT DEFAULT 'normal',
  assigned_to TEXT,
  resolution_required INTEGER DEFAULT 0,
  resolved_at TEXT,
  resolved_by TEXT,
  has_reply INTEGER DEFAULT 0,
  reply_text TEXT,
  reply_posted_at TEXT,
  reply_by TEXT,
  reply_ai_generated INTEGER DEFAULT 0,
  reply_approval_status TEXT DEFAULT 'pending',
  helpful_count INTEGER DEFAULT 0,
  views_count INTEGER DEFAULT 0,
  reviewed_at TEXT,
  imported_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  is_featured INTEGER DEFAULT 0,
  is_hidden INTEGER DEFAULT 0,
  is_flagged INTEGER DEFAULT 0,
  flagged_reason TEXT
);

CREATE TABLE IF NOT EXISTS review_replies (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  review_id TEXT NOT NULL,
  reply_text TEXT,
  reply_language TEXT,
  ai_generated INTEGER DEFAULT 0,
  ai_model_used TEXT,
  ai_prompt_version TEXT,
  approval_status TEXT DEFAULT 'pending',
  approved_by TEXT,
  approved_at TEXT,
  posted_to_platform INTEGER DEFAULT 0,
  posted_at TEXT,
  platform_response_id TEXT,
  created_by TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_request_campaigns (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  campaign_name TEXT,
  trigger_type TEXT,
  trigger_delay_hours INTEGER DEFAULT 2,
  channel TEXT,
  message_template TEXT,
  target_platforms TEXT DEFAULT '[]',
  smart_routing INTEGER DEFAULT 1,
  max_attempts INTEGER DEFAULT 2,
  incentive_json TEXT DEFAULT '{}',
  timing_rules_json TEXT DEFAULT '{}',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS review_requests_sent (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  campaign_id TEXT,
  customer_id TEXT,
  appointment_id TEXT,
  channel TEXT,
  attempt_count INTEGER DEFAULT 1,
  idempotency_key TEXT,
  sent_at TEXT,
  delivered INTEGER DEFAULT 0,
  delivered_at TEXT,
  opened INTEGER DEFAULT 0,
  opened_at TEXT,
  clicked INTEGER DEFAULT 0,
  clicked_at TEXT,
  review_submitted INTEGER DEFAULT 0,
  submitted_platform TEXT,
  submitted_review_id TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS negative_review_alerts (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  review_id TEXT NOT NULL,
  severity TEXT,
  alert_sent_to TEXT,
  alert_channel TEXT,
  alert_sent_at TEXT,
  acknowledged INTEGER DEFAULT 0,
  acknowledged_by TEXT,
  acknowledged_at TEXT,
  resolution_action TEXT,
  resolved_at TEXT,
  resolved_by TEXT,
  recovery_offer_sent INTEGER DEFAULT 0,
  recovery_offer_type TEXT,
  recovery_outcome TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS staff_review_attribution (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  review_id TEXT NOT NULL,
  staff_id TEXT NOT NULL,
  service_id TEXT,
  attribution_type TEXT,
  attribution_confidence REAL,
  rating_attributed REAL,
  mentioned_by_name INTEGER DEFAULT 0,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competitor_listings (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  competitor_name TEXT,
  platform_code TEXT,
  listing_url TEXT,
  current_rating REAL,
  current_review_count INTEGER,
  last_scraped_at TEXT,
  data_source TEXT DEFAULT 'manual',
  is_active INTEGER DEFAULT 1,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS competitor_snapshots (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  competitor_id TEXT NOT NULL,
  snapshot_date TEXT,
  rating REAL,
  review_count INTEGER,
  new_reviews_count INTEGER,
  avg_sentiment REAL,
  top_complaints_json TEXT DEFAULT '[]',
  top_praises_json TEXT DEFAULT '[]',
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS reputation_scores_daily (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  branch_id TEXT NOT NULL DEFAULT '',
  score_date TEXT,
  overall_score REAL,
  google_rating REAL,
  google_count INTEGER,
  justdial_rating REAL,
  zomato_rating REAL,
  avg_rating REAL,
  total_reviews INTEGER,
  new_reviews_today INTEGER,
  positive_pct REAL,
  negative_pct REAL,
  reply_rate REAL,
  avg_reply_time_hours REAL,
  trend_7d REAL,
  trend_30d REAL,
  rank_in_area INTEGER,
  net_promoter_score REAL,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_review_platforms_tenant_branch ON review_platforms(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_review_platforms_code ON review_platforms(tenant_id, platform_code, is_active);
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_platform_listing ON review_platforms(tenant_id, branch_id, platform_code, business_listing_id)
  WHERE business_listing_id IS NOT NULL AND business_listing_id <> '';

CREATE INDEX IF NOT EXISTS idx_reviews_v2_tenant_branch ON reviews_v2(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_platform ON reviews_v2(tenant_id, platform_id, reviewed_at);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_customer ON reviews_v2(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_appointment ON reviews_v2(tenant_id, appointment_id);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_invoice ON reviews_v2(tenant_id, invoice_id);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_staff ON reviews_v2(tenant_id, primary_staff_id);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_status ON reviews_v2(tenant_id, branch_id, status, priority);
CREATE INDEX IF NOT EXISTS idx_reviews_v2_sentiment ON reviews_v2(tenant_id, branch_id, sentiment, reviewed_at);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reviews_v2_platform_review ON reviews_v2(tenant_id, platform_id, platform_review_id)
  WHERE platform_review_id IS NOT NULL AND platform_review_id <> '';

CREATE INDEX IF NOT EXISTS idx_review_replies_tenant_branch ON review_replies(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_review_replies_review ON review_replies(tenant_id, review_id, created_at);
CREATE INDEX IF NOT EXISTS idx_review_replies_approval ON review_replies(tenant_id, branch_id, approval_status);

CREATE INDEX IF NOT EXISTS idx_review_request_campaigns_tenant_branch ON review_request_campaigns(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_review_request_campaigns_trigger ON review_request_campaigns(tenant_id, branch_id, trigger_type, is_active);

CREATE INDEX IF NOT EXISTS idx_review_requests_sent_tenant_branch ON review_requests_sent(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_sent_campaign ON review_requests_sent(tenant_id, campaign_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_sent_customer ON review_requests_sent(tenant_id, customer_id);
CREATE INDEX IF NOT EXISTS idx_review_requests_sent_appointment ON review_requests_sent(tenant_id, appointment_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_review_requests_sent_idempotency ON review_requests_sent(tenant_id, idempotency_key)
  WHERE idempotency_key IS NOT NULL AND idempotency_key <> '';

CREATE INDEX IF NOT EXISTS idx_negative_review_alerts_tenant_branch ON negative_review_alerts(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_negative_review_alerts_review ON negative_review_alerts(tenant_id, review_id);
CREATE INDEX IF NOT EXISTS idx_negative_review_alerts_open ON negative_review_alerts(tenant_id, branch_id, acknowledged, severity);

CREATE INDEX IF NOT EXISTS idx_staff_review_attribution_tenant_branch ON staff_review_attribution(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_staff_review_attribution_review ON staff_review_attribution(tenant_id, review_id);
CREATE INDEX IF NOT EXISTS idx_staff_review_attribution_staff ON staff_review_attribution(tenant_id, staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_review_attribution_service ON staff_review_attribution(tenant_id, service_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_staff_review_attribution ON staff_review_attribution(tenant_id, review_id, staff_id, COALESCE(service_id, ''));

CREATE INDEX IF NOT EXISTS idx_competitor_listings_tenant_branch ON competitor_listings(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_competitor_listings_platform ON competitor_listings(tenant_id, branch_id, platform_code, is_active);

CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_tenant_branch ON competitor_snapshots(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_competitor_snapshots_competitor ON competitor_snapshots(tenant_id, competitor_id, snapshot_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_competitor_snapshot_date ON competitor_snapshots(tenant_id, competitor_id, snapshot_date);

CREATE INDEX IF NOT EXISTS idx_reputation_scores_daily_tenant_branch ON reputation_scores_daily(tenant_id, branch_id);
CREATE INDEX IF NOT EXISTS idx_reputation_scores_daily_date ON reputation_scores_daily(tenant_id, branch_id, score_date);
CREATE UNIQUE INDEX IF NOT EXISTS uq_reputation_scores_daily_date ON reputation_scores_daily(tenant_id, branch_id, score_date);
