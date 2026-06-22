-- AuraShine Staff Enterprise OS - Safe Additive Foundation
-- Phase 1: migration only. Existing staff tables and data are not overwritten.
-- Conventions in this foundation intentionally use tenantId/branchId/staffId
-- because the Phase 1 contract requires those logical keys.

CREATE TABLE IF NOT EXISTS staff_ai_command_center (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT,
  commandType TEXT NOT NULL,
  title TEXT NOT NULL,
  insightSummary TEXT,
  recommendationJson TEXT DEFAULT '{}',
  metricSnapshotJson TEXT DEFAULT '{}',
  riskLevel TEXT DEFAULT 'low',
  priorityScore REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  generatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewedBy TEXT,
  reviewedAt TEXT,
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_ai_command_center_scope
  ON staff_ai_command_center(tenantId, branchId, status, generatedAt);

CREATE INDEX IF NOT EXISTS idx_staff_ai_command_center_staff
  ON staff_ai_command_center(tenantId, staffId, status);

CREATE TABLE IF NOT EXISTS staff_digital_twins (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT NOT NULL,
  profileJson TEXT DEFAULT '{}',
  skillJson TEXT DEFAULT '{}',
  clientPreferenceJson TEXT DEFAULT '{}',
  revenueJson TEXT DEFAULT '{}',
  upsellJson TEXT DEFAULT '{}',
  fatigueJson TEXT DEFAULT '{}',
  complaintRiskJson TEXT DEFAULT '{}',
  cancellationImpactJson TEXT DEFAULT '{}',
  lastComputedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  confidenceScore REAL DEFAULT 0,
  status TEXT NOT NULL DEFAULT 'active',
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenantId, staffId)
);

CREATE INDEX IF NOT EXISTS idx_staff_digital_twins_scope
  ON staff_digital_twins(tenantId, branchId, status);

CREATE TABLE IF NOT EXISTS staff_skill_licenses (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT NOT NULL,
  serviceId TEXT,
  skillName TEXT NOT NULL,
  licenseType TEXT DEFAULT 'internal',
  certificationStatus TEXT NOT NULL DEFAULT 'pending',
  certifiedBy TEXT,
  certifiedAt TEXT,
  expiresAt TEXT,
  evidenceJson TEXT DEFAULT '{}',
  restrictionLevel TEXT DEFAULT 'advisory',
  status TEXT NOT NULL DEFAULT 'active',
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenantId, staffId, serviceId, skillName)
);

CREATE INDEX IF NOT EXISTS idx_staff_skill_licenses_scope
  ON staff_skill_licenses(tenantId, branchId, status, certificationStatus);

CREATE INDEX IF NOT EXISTS idx_staff_skill_licenses_staff
  ON staff_skill_licenses(tenantId, staffId, status);

CREATE TABLE IF NOT EXISTS staff_risk_signals (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT NOT NULL,
  signalType TEXT NOT NULL,
  riskLevel TEXT NOT NULL DEFAULT 'low',
  riskScore REAL DEFAULT 0,
  reason TEXT NOT NULL,
  evidenceJson TEXT DEFAULT '{}',
  suggestedAction TEXT,
  detectedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  reviewedBy TEXT,
  reviewedAt TEXT,
  resolutionNotes TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_risk_signals_scope
  ON staff_risk_signals(tenantId, branchId, status, riskLevel, detectedAt);

CREATE INDEX IF NOT EXISTS idx_staff_risk_signals_staff
  ON staff_risk_signals(tenantId, staffId, status, detectedAt);

CREATE TABLE IF NOT EXISTS staff_training_assignments (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT NOT NULL,
  trainingType TEXT NOT NULL,
  trainingTitle TEXT NOT NULL,
  triggerSignalId TEXT,
  assignedBy TEXT,
  assignedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  dueAt TEXT,
  completedAt TEXT,
  score REAL DEFAULT 0,
  resultJson TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'assigned',
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_scope
  ON staff_training_assignments(tenantId, branchId, status, dueAt);

CREATE INDEX IF NOT EXISTS idx_staff_training_assignments_staff
  ON staff_training_assignments(tenantId, staffId, status);

CREATE TABLE IF NOT EXISTS staff_approval_requests (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT,
  requestType TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  actionRequested TEXT NOT NULL,
  beforeJson TEXT DEFAULT '{}',
  afterJson TEXT DEFAULT '{}',
  reason TEXT,
  sensitivityLevel TEXT DEFAULT 'standard',
  requestedBy TEXT,
  requestedByRole TEXT,
  requestedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  approvedBy TEXT,
  approvedAt TEXT,
  rejectedBy TEXT,
  rejectedAt TEXT,
  rejectionReason TEXT,
  expiresAt TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_approval_requests_scope
  ON staff_approval_requests(tenantId, branchId, status, requestedAt);

CREATE INDEX IF NOT EXISTS idx_staff_approval_requests_staff
  ON staff_approval_requests(tenantId, staffId, status);

CREATE TABLE IF NOT EXISTS staff_zero_trust_audit (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT,
  actorId TEXT NOT NULL,
  actorRole TEXT,
  actionType TEXT NOT NULL,
  entityType TEXT NOT NULL,
  entityId TEXT,
  beforeJson TEXT DEFAULT '{}',
  afterJson TEXT DEFAULT '{}',
  metadataJson TEXT DEFAULT '{}',
  ipAddress TEXT,
  userAgent TEXT,
  status TEXT NOT NULL DEFAULT 'recorded',
  eventHash TEXT,
  previousEventHash TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_zero_trust_audit_scope
  ON staff_zero_trust_audit(tenantId, branchId, createdAt);

CREATE INDEX IF NOT EXISTS idx_staff_zero_trust_audit_staff
  ON staff_zero_trust_audit(tenantId, staffId, createdAt);

CREATE INDEX IF NOT EXISTS idx_staff_zero_trust_audit_actor
  ON staff_zero_trust_audit(tenantId, actorId, createdAt);

CREATE TABLE IF NOT EXISTS staff_floor_control_events (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT,
  eventType TEXT NOT NULL,
  floorZone TEXT,
  resourceId TEXT,
  appointmentId TEXT,
  clientId TEXT,
  queueId TEXT,
  eventPayloadJson TEXT DEFAULT '{}',
  severity TEXT DEFAULT 'info',
  eventAt TEXT DEFAULT CURRENT_TIMESTAMP,
  resolvedBy TEXT,
  resolvedAt TEXT,
  status TEXT NOT NULL DEFAULT 'open',
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_staff_floor_control_events_scope
  ON staff_floor_control_events(tenantId, branchId, status, eventAt);

CREATE INDEX IF NOT EXISTS idx_staff_floor_control_events_staff
  ON staff_floor_control_events(tenantId, staffId, status, eventAt);

CREATE TABLE IF NOT EXISTS staff_payroll_intelligence (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT,
  staffId TEXT NOT NULL,
  periodStart TEXT NOT NULL,
  periodEnd TEXT NOT NULL,
  grossPay REAL DEFAULT 0,
  commissionAmount REAL DEFAULT 0,
  incentiveAmount REAL DEFAULT 0,
  deductionAmount REAL DEFAULT 0,
  statutoryJson TEXT DEFAULT '{}',
  anomalyJson TEXT DEFAULT '{}',
  complianceRiskLevel TEXT DEFAULT 'low',
  payoutRecommendationJson TEXT DEFAULT '{}',
  status TEXT NOT NULL DEFAULT 'draft',
  archivedAt TEXT,
  version INTEGER DEFAULT 1,
  createdBy TEXT,
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(tenantId, staffId, periodStart, periodEnd)
);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_intelligence_scope
  ON staff_payroll_intelligence(tenantId, branchId, status, periodStart, periodEnd);

CREATE INDEX IF NOT EXISTS idx_staff_payroll_intelligence_staff
  ON staff_payroll_intelligence(tenantId, staffId, periodStart, periodEnd);

CREATE TRIGGER IF NOT EXISTS trg_staff_zero_trust_audit_no_update
BEFORE UPDATE ON staff_zero_trust_audit
BEGIN
  SELECT RAISE(ABORT, 'staff_zero_trust_audit is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_zero_trust_audit_no_delete
BEFORE DELETE ON staff_zero_trust_audit
BEGIN
  SELECT RAISE(ABORT, 'staff_zero_trust_audit is immutable');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_ai_command_center_no_delete
BEFORE DELETE ON staff_ai_command_center
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_ai_command_center');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_digital_twins_no_delete
BEFORE DELETE ON staff_digital_twins
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_digital_twins');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_skill_licenses_no_delete
BEFORE DELETE ON staff_skill_licenses
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_skill_licenses');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_risk_signals_no_delete
BEFORE DELETE ON staff_risk_signals
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_risk_signals');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_training_assignments_no_delete
BEFORE DELETE ON staff_training_assignments
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_training_assignments');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_approval_requests_no_delete
BEFORE DELETE ON staff_approval_requests
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_approval_requests');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_floor_control_events_no_delete
BEFORE DELETE ON staff_floor_control_events
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_floor_control_events');
END;

CREATE TRIGGER IF NOT EXISTS trg_staff_payroll_intelligence_no_delete
BEFORE DELETE ON staff_payroll_intelligence
BEGIN
  SELECT RAISE(ABORT, 'hard delete forbidden for staff_payroll_intelligence');
END;
