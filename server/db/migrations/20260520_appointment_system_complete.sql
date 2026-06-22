-- UP
-- Aura project stores existing operational columns in camelCase.
-- This migration keeps that convention while matching the appointment blueprint.

ALTER TABLE appointments ADD COLUMN version INTEGER DEFAULT 1;
ALTER TABLE appointments ADD COLUMN sourceChannel TEXT;
ALTER TABLE appointments ADD COLUMN sourceCampaign TEXT;
ALTER TABLE appointments ADD COLUMN sourceMedium TEXT;
ALTER TABLE appointments ADD COLUMN utmSource TEXT;
ALTER TABLE appointments ADD COLUMN utmMedium TEXT;
ALTER TABLE appointments ADD COLUMN utmCampaign TEXT;
ALTER TABLE appointments ADD COLUMN referrerCustomerId TEXT;
ALTER TABLE appointments ADD COLUMN isTouchup INTEGER DEFAULT 0;
ALTER TABLE appointments ADD COLUMN touchupOfAppointmentId TEXT;
ALTER TABLE appointments ADD COLUMN warrantyUntil TEXT;
ALTER TABLE appointments ADD COLUMN bookingGroupId TEXT;
ALTER TABLE appointments ADD COLUMN groupMemberRole TEXT;
ALTER TABLE appointments ADD COLUMN idempotencyKey TEXT;
ALTER TABLE appointments ADD COLUMN reservedFromSlotId TEXT;
ALTER TABLE appointments ADD COLUMN timezone TEXT;
CREATE INDEX IF NOT EXISTS idx_apt_source ON appointments(sourceChannel, sourceCampaign);
CREATE INDEX IF NOT EXISTS idx_apt_group ON appointments(bookingGroupId);
CREATE INDEX IF NOT EXISTS idx_apt_touchup ON appointments(touchupOfAppointmentId);

ALTER TABLE clients ADD COLUMN preferredLanguage TEXT DEFAULT 'en';
ALTER TABLE clients ADD COLUMN preferredChannel TEXT DEFAULT 'whatsapp';
ALTER TABLE clients ADD COLUMN primaryAccountId TEXT;
ALTER TABLE clients ADD COLUMN relationship TEXT;
ALTER TABLE clients ADD COLUMN consolidateCommunications INTEGER DEFAULT 0;

ALTER TABLE services ADD COLUMN warrantyDays INTEGER DEFAULT 0;
ALTER TABLE services ADD COLUMN warrantyPolicy TEXT;
ALTER TABLE services ADD COLUMN hsnCode TEXT;
ALTER TABLE services ADD COLUMN genderPreference TEXT;
ALTER TABLE services ADD COLUMN minAge INTEGER;
ALTER TABLE services ADD COLUMN maxAge INTEGER;

ALTER TABLE branches ADD COLUMN tierAdvanceBookingDays TEXT;
ALTER TABLE branches ADD COLUMN peakSlotsReservedPct INTEGER DEFAULT 0;
ALTER TABLE branches ADD COLUMN peakHoursDefinition TEXT;

CREATE TABLE IF NOT EXISTS slot_reservations (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT NOT NULL,
  staffId TEXT DEFAULT '',
  chairId TEXT DEFAULT '',
  roomId TEXT DEFAULT '',
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
  status TEXT DEFAULT 'planning',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_booking_groups_tenant_status ON booking_groups(tenantId, status);

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

CREATE TABLE IF NOT EXISTS job_queue (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  jobType TEXT NOT NULL,
  payload TEXT NOT NULL,
  status TEXT DEFAULT 'pending',
  attempts INTEGER DEFAULT 0,
  maxAttempts INTEGER DEFAULT 3,
  scheduledAt TEXT DEFAULT CURRENT_TIMESTAMP,
  lastError TEXT,
  completedAt TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS idx_jobs_status_sched ON job_queue(status, scheduledAt);
CREATE INDEX IF NOT EXISTS idx_jobs_tenant_type ON job_queue(tenantId, jobType);

-- DOWN (manual rollback reference)
-- SQLite cannot drop columns safely without table rebuilds.
-- DROP TABLE IF EXISTS job_queue;
-- DROP TABLE IF EXISTS booking_wizard_state;
-- DROP TABLE IF EXISTS blackout_dates;
-- DROP TABLE IF EXISTS calendar_export_tokens;
-- DROP TABLE IF EXISTS booking_groups;
-- DROP TABLE IF EXISTS service_restrictions;
-- DROP TABLE IF EXISTS service_dependencies;
-- DROP TABLE IF EXISTS idempotency_keys;
-- DROP TABLE IF EXISTS slot_reservations;

