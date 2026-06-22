-- UP
-- Aura Salon OS online-booking master migration.
-- NOTE: SQLite does not support "ALTER TABLE ADD COLUMN IF NOT EXISTS".
-- Column additions are applied defensively by server/services/appointment-schema.service.js
-- through tableHasColumn() checks. This file is the SQL reference and the
-- idempotent table/index portion of the online-booking schema.

-- Existing-table columns ensured by appointment-schema.service.js:
-- appointments: version, sourceChannel, sourceCampaign, sourceMedium,
-- utmSource, utmMedium, utmCampaign, referrerCustomerId, isTouchup,
-- touchupOfAppointmentId, warrantyUntil, bookingGroupId, groupMemberRole,
-- idempotencyKey, reservedFromSlotId, timezone, depositStatus,
-- noShowRiskScore, bookingScore.
-- clients: preferredLanguage, preferredChannel, primaryAccountId,
-- relationship, consolidateCommunications, consolidateLoyalty,
-- noShowCount, cancellationCount, tier.
-- services: warrantyDays, warrantyPolicy, hsnCode, genderPreference,
-- minAge, maxAge, processingTimeMin, cleanupTimeMin, onlineBookable,
-- requiresConsultation.
-- branches: timezone, tierAdvanceBookingDays, peakSlotsReservedPct,
-- peakHoursDefinition, onlineBookingEnabled, slug, themeConfig, seoConfig.

CREATE INDEX IF NOT EXISTS idx_apt_source ON appointments(sourceChannel, sourceCampaign);
CREATE INDEX IF NOT EXISTS idx_apt_group ON appointments(bookingGroupId);
CREATE INDEX IF NOT EXISTS idx_apt_touchup ON appointments(touchupOfAppointmentId);

CREATE TABLE IF NOT EXISTS slot_reservations (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT NOT NULL,
  staffId TEXT DEFAULT '',
  chairId TEXT DEFAULT '',
  roomId TEXT DEFAULT '',
  serviceIdsJson TEXT DEFAULT '[]',
  startTime TEXT NOT NULL,
  endTime TEXT NOT NULL,
  customerId TEXT DEFAULT '',
  sessionId TEXT DEFAULT '',
  reservedUntil TEXT NOT NULL,
  status TEXT DEFAULT 'holding',
  appointmentId TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_slot_res_tenant_time ON slot_reservations(tenantId, startTime, status);
CREATE INDEX IF NOT EXISTS idx_slot_res_expiry ON slot_reservations(reservedUntil, status);
CREATE INDEX IF NOT EXISTS idx_slot_res_session ON slot_reservations(sessionId);

CREATE TABLE IF NOT EXISTS idempotency_keys (
  key TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  endpoint TEXT NOT NULL,
  requestHash TEXT NOT NULL,
  responseStatus INTEGER,
  responseBody TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  expiresAt TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_idempotency_expiry ON idempotency_keys(expiresAt);
CREATE INDEX IF NOT EXISTS idx_idempotency_tenant_endpoint ON idempotency_keys(tenantId, endpoint);

CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  jobType TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  maxAttempts INTEGER DEFAULT 3,
  scheduledAt TEXT DEFAULT CURRENT_TIMESTAMP,
  startedAt TEXT,
  lastError TEXT,
  completedAt TEXT,
  priority INTEGER DEFAULT 5,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_sched ON job_queue(status, scheduledAt);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_type ON job_queue(tenantId, jobType);

CREATE TABLE IF NOT EXISTS audit_log (
  id TEXT PRIMARY KEY,
  tenant_id TEXT NOT NULL,
  user_id TEXT,
  action TEXT NOT NULL,
  entity_type TEXT NOT NULL,
  entity_id TEXT,
  old_value TEXT,
  new_value TEXT,
  ip_address TEXT,
  user_agent TEXT,
  created_at TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_created ON audit_log(tenant_id, created_at);
CREATE INDEX IF NOT EXISTS idx_audit_log_entity ON audit_log(entity_type, entity_id);

CREATE TABLE IF NOT EXISTS online_booking_sessions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT NOT NULL,
  customerId TEXT DEFAULT '',
  sessionToken TEXT UNIQUE NOT NULL,
  source TEXT DEFAULT '',
  deviceType TEXT DEFAULT '',
  ipAddress TEXT DEFAULT '',
  userAgent TEXT DEFAULT '',
  utmSource TEXT DEFAULT '',
  utmMedium TEXT DEFAULT '',
  utmCampaign TEXT DEFAULT '',
  startedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  completedAt TEXT,
  status TEXT DEFAULT 'active'
);
CREATE INDEX IF NOT EXISTS idx_online_booking_sessions_tenant_time ON online_booking_sessions(tenantId, startedAt);
CREATE INDEX IF NOT EXISTS idx_online_booking_sessions_token ON online_booking_sessions(sessionToken);

CREATE TABLE IF NOT EXISTS booking_funnel_events (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  eventName TEXT NOT NULL,
  eventData TEXT DEFAULT '{}',
  stepOrder INTEGER DEFAULT 0,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_funnel_session ON booking_funnel_events(tenantId, sessionId, eventName);
CREATE INDEX IF NOT EXISTS idx_booking_funnel_time ON booking_funnel_events(tenantId, createdAt);

CREATE TABLE IF NOT EXISTS booking_wizard_state (
  sessionId TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  customerId TEXT DEFAULT '',
  step INTEGER NOT NULL,
  stateJson TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_wizard_expiry ON booking_wizard_state(expiresAt);

CREATE TABLE IF NOT EXISTS online_booking_otps (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  mobile TEXT NOT NULL,
  otpHash TEXT NOT NULL,
  purpose TEXT NOT NULL,
  expiresAt TEXT NOT NULL,
  verifiedAt TEXT,
  attempts INTEGER DEFAULT 0,
  maxAttempts INTEGER DEFAULT 5,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_online_booking_otp_lookup ON online_booking_otps(tenantId, mobile, purpose);
CREATE INDEX IF NOT EXISTS idx_online_booking_otp_expiry ON online_booking_otps(expiresAt);

CREATE TABLE IF NOT EXISTS booking_payment_links (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  appointmentId TEXT DEFAULT '',
  sessionId TEXT DEFAULT '',
  provider TEXT NOT NULL,
  providerOrderId TEXT DEFAULT '',
  providerLinkId TEXT DEFAULT '',
  providerPaymentId TEXT DEFAULT '',
  providerEventId TEXT DEFAULT '',
  paymentLink TEXT DEFAULT '',
  amount REAL NOT NULL,
  currency TEXT DEFAULT 'INR',
  status TEXT DEFAULT 'pending',
  webhookReceivedAt TEXT,
  rawEventJson TEXT DEFAULT '{}',
  expiresAt TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_payment_links_tenant_status ON booking_payment_links(tenantId, status);
CREATE INDEX IF NOT EXISTS idx_booking_payment_links_appointment ON booking_payment_links(appointmentId);

CREATE TABLE IF NOT EXISTS booking_rules (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT DEFAULT '',
  ruleType TEXT NOT NULL,
  ruleName TEXT NOT NULL,
  ruleConfig TEXT NOT NULL,
  priority INTEGER DEFAULT 100,
  isActive INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_rules_tenant_type ON booking_rules(tenantId, ruleType, isActive);

CREATE TABLE IF NOT EXISTS booking_abandonments (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  sessionId TEXT NOT NULL,
  customerMobile TEXT DEFAULT '',
  customerEmail TEXT DEFAULT '',
  lastStep INTEGER DEFAULT 0,
  cartValue REAL DEFAULT 0,
  abandonedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  recoveryStatus TEXT DEFAULT 'pending',
  recoveryMessageSentAt TEXT,
  recoveryAttempts INTEGER DEFAULT 0,
  convertedAppointmentId TEXT DEFAULT '',
  convertedAt TEXT
);
CREATE INDEX IF NOT EXISTS idx_booking_abandonments_recovery ON booking_abandonments(tenantId, recoveryStatus, abandonedAt);

CREATE TABLE IF NOT EXISTS public_action_tokens (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  appointmentId TEXT NOT NULL,
  actionType TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  used INTEGER DEFAULT 0,
  usedAt TEXT,
  expiresAt TEXT NOT NULL,
  attempts INTEGER DEFAULT 0,
  ipHistory TEXT DEFAULT '[]',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_public_action_token_lookup ON public_action_tokens(token, actionType);
CREATE INDEX IF NOT EXISTS idx_public_action_token_expiry ON public_action_tokens(expiresAt);
CREATE INDEX IF NOT EXISTS idx_public_action_token_appointment ON public_action_tokens(tenantId, appointmentId);

CREATE TABLE IF NOT EXISTS service_dependencies (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  serviceId TEXT NOT NULL,
  requiredServiceId TEXT NOT NULL,
  dependencyType TEXT NOT NULL,
  autoAdd INTEGER DEFAULT 1,
  isChargeable INTEGER DEFAULT 1,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_dependencies_tenant_service ON service_dependencies(tenantId, serviceId);

CREATE TABLE IF NOT EXISTS service_restrictions (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  serviceAId TEXT NOT NULL,
  serviceBId TEXT NOT NULL,
  restrictionType TEXT NOT NULL,
  minGapDays INTEGER,
  warningMessage TEXT NOT NULL,
  allowOverride INTEGER DEFAULT 1,
  overrideRole TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_service_restrictions_tenant_services ON service_restrictions(tenantId, serviceAId, serviceBId);

CREATE TABLE IF NOT EXISTS booking_groups (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  groupName TEXT DEFAULT '',
  coordinatorCustomerId TEXT NOT NULL,
  groupType TEXT NOT NULL,
  parallelStart INTEGER DEFAULT 1,
  consolidatedBilling INTEGER DEFAULT 0,
  totalMembers INTEGER NOT NULL,
  membersJson TEXT DEFAULT '[]',
  planJson TEXT DEFAULT '[]',
  confirmedSlotsJson TEXT DEFAULT '[]',
  status TEXT DEFAULT 'planning',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_groups_tenant_status ON booking_groups(tenantId, status);

CREATE TABLE IF NOT EXISTS blackout_dates (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT DEFAULT '',
  blackoutDate TEXT NOT NULL,
  blackoutUntil TEXT,
  reason TEXT NOT NULL,
  blockOnline INTEGER DEFAULT 1,
  blockWalkin INTEGER DEFAULT 1,
  allowExisting INTEGER DEFAULT 0,
  createdBy TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_blackout_tenant_branch_date ON blackout_dates(tenantId, branchId, blackoutDate);

CREATE TABLE IF NOT EXISTS calendar_export_tokens (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  scope TEXT NOT NULL,
  scopeId TEXT NOT NULL,
  token TEXT UNIQUE NOT NULL,
  active INTEGER DEFAULT 1,
  privacyMode TEXT DEFAULT 'busy',
  lastAccessedAt TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_calendar_export_scope ON calendar_export_tokens(tenantId, scope, scopeId);

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
  online_bookings INTEGER DEFAULT 0,
  walkin_bookings INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, date, branch_id)
);

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
  no_show_history_score INTEGER DEFAULT 0,
  updated_at TEXT DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (tenant_id, customer_id)
);

-- DOWN (manual rollback reference)
-- SQLite column rollback requires table rebuilds, so only new tables are listed.
-- DROP TABLE IF EXISTS customer_metrics;
-- DROP TABLE IF EXISTS daily_summary;
-- DROP TABLE IF EXISTS calendar_export_tokens;
-- DROP TABLE IF EXISTS blackout_dates;
-- DROP TABLE IF EXISTS booking_groups;
-- DROP TABLE IF EXISTS service_restrictions;
-- DROP TABLE IF EXISTS service_dependencies;
-- DROP TABLE IF EXISTS public_action_tokens;
-- DROP TABLE IF EXISTS booking_abandonments;
-- DROP TABLE IF EXISTS booking_rules;
-- DROP TABLE IF EXISTS booking_payment_links;
-- DROP TABLE IF EXISTS online_booking_otps;
-- DROP TABLE IF EXISTS booking_wizard_state;
-- DROP TABLE IF EXISTS booking_funnel_events;
-- DROP TABLE IF EXISTS online_booking_sessions;
-- DROP TABLE IF EXISTS audit_log;
-- DROP TABLE IF EXISTS job_queue;
-- DROP TABLE IF EXISTS idempotency_keys;
-- DROP TABLE IF EXISTS slot_reservations;
