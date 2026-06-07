import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let ensured = false;

export function ensureGrowthRankBotSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS growth_rank_bot_audits (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      business_name TEXT NOT NULL,
      industry TEXT NOT NULL DEFAULT '',
      city TEXT NOT NULL DEFAULT '',
      target_area TEXT NOT NULL DEFAULT '',
      instagram_url TEXT NOT NULL DEFAULT '',
      facebook_url TEXT NOT NULL DEFAULT '',
      google_profile_url TEXT NOT NULL DEFAULT '',
      goal TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      score INTEGER NOT NULL DEFAULT 0,
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_by TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_scope
      ON growth_rank_bot_audits (tenant_id, branch_id, created_at);

    CREATE TABLE IF NOT EXISTS growth_rank_bot_clients (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      business_name TEXT NOT NULL,
      package_name TEXT NOT NULL DEFAULT 'Growth Pro',
      monthly_fee REAL NOT NULL DEFAULT 0,
      renewal_at TEXT NOT NULL DEFAULT '',
      portal_token TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_tasks (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      title TEXT NOT NULL,
      channel TEXT NOT NULL DEFAULT '',
      due_date TEXT NOT NULL DEFAULT '',
      owner_role TEXT NOT NULL DEFAULT 'growth-manager',
      priority TEXT NOT NULL DEFAULT 'medium',
      status TEXT NOT NULL DEFAULT 'open',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_leads (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      source TEXT NOT NULL,
      lead_name TEXT NOT NULL DEFAULT '',
      intent TEXT NOT NULL DEFAULT '',
      stage TEXT NOT NULL DEFAULT 'new',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_content_approvals (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      content_type TEXT NOT NULL,
      title TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'draft',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_reports (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      report_type TEXT NOT NULL DEFAULT 'weekly',
      title TEXT NOT NULL,
      portal_token TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'ready',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_integrations (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      provider TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'not_connected',
      scopes TEXT NOT NULL DEFAULT '',
      metrics_json TEXT NOT NULL DEFAULT '{}',
      last_sync_at TEXT NOT NULL DEFAULT '',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_rank_keywords (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      keyword TEXT NOT NULL,
      target_area TEXT NOT NULL DEFAULT '',
      target_url TEXT NOT NULL DEFAULT '',
      best_rank INTEGER NOT NULL DEFAULT 0,
      current_rank INTEGER NOT NULL DEFAULT 0,
      previous_rank INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'tracking_ready',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_rank_snapshots (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      keyword_id TEXT NOT NULL DEFAULT '',
      keyword TEXT NOT NULL,
      rank_position INTEGER NOT NULL DEFAULT 0,
      checked_at TEXT NOT NULL DEFAULT '',
      source TEXT NOT NULL DEFAULT 'manual_or_api_import',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_competitor_signals (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      competitor_name TEXT NOT NULL,
      google_strength INTEGER NOT NULL DEFAULT 0,
      review_score REAL NOT NULL DEFAULT 0,
      review_count INTEGER NOT NULL DEFAULT 0,
      content_frequency TEXT NOT NULL DEFAULT '',
      offer_signal TEXT NOT NULL DEFAULT '',
      instagram_activity TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_content_factory (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      day_number INTEGER NOT NULL DEFAULT 1,
      channel TEXT NOT NULL DEFAULT '',
      format TEXT NOT NULL DEFAULT '',
      topic TEXT NOT NULL DEFAULT '',
      script TEXT NOT NULL DEFAULT '',
      caption TEXT NOT NULL DEFAULT '',
      carousel_text TEXT NOT NULL DEFAULT '',
      hashtags TEXT NOT NULL DEFAULT '',
      offer_copy TEXT NOT NULL DEFAULT '',
      festival TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_attribution_events (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      source TEXT NOT NULL,
      lead_name TEXT NOT NULL DEFAULT '',
      event_type TEXT NOT NULL DEFAULT '',
      booking_id TEXT NOT NULL DEFAULT '',
      estimated_value REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'attributed',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_review_engine (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      review_type TEXT NOT NULL DEFAULT '',
      customer_name TEXT NOT NULL DEFAULT '',
      rating INTEGER NOT NULL DEFAULT 0,
      sentiment TEXT NOT NULL DEFAULT '',
      request_script TEXT NOT NULL DEFAULT '',
      ai_reply TEXT NOT NULL DEFAULT '',
      risk_level TEXT NOT NULL DEFAULT 'normal',
      status TEXT NOT NULL DEFAULT 'draft',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_proposals (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      title TEXT NOT NULL,
      monthly_fee REAL NOT NULL DEFAULT 0,
      package_name TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      renewal_at TEXT NOT NULL DEFAULT '',
      invoice_status TEXT NOT NULL DEFAULT 'draft',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_portal_sessions (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      portal_token TEXT NOT NULL,
      client_email TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'active',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_copilot_chats (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      question TEXT NOT NULL,
      answer TEXT NOT NULL,
      intent TEXT NOT NULL DEFAULT 'growth_advice',
      confidence INTEGER NOT NULL DEFAULT 80,
      status TEXT NOT NULL DEFAULT 'answered',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_campaign_profit (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      campaign_name TEXT NOT NULL,
      source TEXT NOT NULL DEFAULT '',
      spend REAL NOT NULL DEFAULT 0,
      leads INTEGER NOT NULL DEFAULT 0,
      bookings INTEGER NOT NULL DEFAULT 0,
      revenue REAL NOT NULL DEFAULT 0,
      profit REAL NOT NULL DEFAULT 0,
      roi_percent REAL NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'tracking',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_publishing_planner (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      content_id TEXT NOT NULL DEFAULT '',
      channel TEXT NOT NULL DEFAULT '',
      title TEXT NOT NULL,
      scheduled_for TEXT NOT NULL DEFAULT '',
      approval_status TEXT NOT NULL DEFAULT 'pending_approval',
      publish_status TEXT NOT NULL DEFAULT 'draft',
      provider TEXT NOT NULL DEFAULT '',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_seo_pages (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      page_type TEXT NOT NULL DEFAULT '',
      slug TEXT NOT NULL,
      title TEXT NOT NULL,
      target_keyword TEXT NOT NULL DEFAULT '',
      whatsapp_cta TEXT NOT NULL DEFAULT '',
      tracking_url TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'draft',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS growth_rank_bot_competitor_alerts (
      id TEXT PRIMARY KEY,
      tenant_id TEXT NOT NULL,
      branch_id TEXT NOT NULL DEFAULT '',
      audit_id TEXT NOT NULL,
      competitor_name TEXT NOT NULL,
      signal_type TEXT NOT NULL DEFAULT '',
      severity TEXT NOT NULL DEFAULT 'medium',
      recommended_action TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'open',
      payload_json TEXT NOT NULL DEFAULT '{}',
      created_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updated_at TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_clients_scope
      ON growth_rank_bot_clients (tenant_id, branch_id, audit_id);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_tasks_scope
      ON growth_rank_bot_tasks (tenant_id, branch_id, audit_id, status);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_leads_scope
      ON growth_rank_bot_leads (tenant_id, branch_id, audit_id, stage);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_approvals_scope
      ON growth_rank_bot_content_approvals (tenant_id, branch_id, audit_id, status);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_reports_scope
      ON growth_rank_bot_reports (tenant_id, branch_id, audit_id);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_integrations_scope
      ON growth_rank_bot_integrations (tenant_id, branch_id, audit_id);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_keywords_scope
      ON growth_rank_bot_rank_keywords (tenant_id, branch_id, audit_id, status);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_snapshots_scope
      ON growth_rank_bot_rank_snapshots (tenant_id, branch_id, audit_id, keyword_id);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_competitor_signals_scope
      ON growth_rank_bot_competitor_signals (tenant_id, branch_id, audit_id);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_content_factory_scope
      ON growth_rank_bot_content_factory (tenant_id, branch_id, audit_id, status);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_attribution_scope
      ON growth_rank_bot_attribution_events (tenant_id, branch_id, audit_id, source);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_review_engine_scope
      ON growth_rank_bot_review_engine (tenant_id, branch_id, audit_id, risk_level);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_proposals_scope
      ON growth_rank_bot_proposals (tenant_id, branch_id, audit_id, status);
    CREATE UNIQUE INDEX IF NOT EXISTS idx_growth_rank_bot_portal_token
      ON growth_rank_bot_portal_sessions (tenant_id, portal_token);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_copilot_scope
      ON growth_rank_bot_copilot_chats (tenant_id, branch_id, audit_id, created_at);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_campaign_profit_scope
      ON growth_rank_bot_campaign_profit (tenant_id, branch_id, audit_id, source);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_publishing_scope
      ON growth_rank_bot_publishing_planner (tenant_id, branch_id, audit_id, publish_status);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_seo_pages_scope
      ON growth_rank_bot_seo_pages (tenant_id, branch_id, audit_id, page_type);
    CREATE INDEX IF NOT EXISTS idx_growth_rank_bot_competitor_alerts_scope
      ON growth_rank_bot_competitor_alerts (tenant_id, branch_id, audit_id, status);
  `);
  ensured = true;
  logger.info("growth_rank_bot_schema_ensured");
}
