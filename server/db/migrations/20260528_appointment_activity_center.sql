CREATE TABLE IF NOT EXISTS appointment_activity_log (
  id TEXT PRIMARY KEY,
  tenantId TEXT NOT NULL,
  branchId TEXT DEFAULT '',
  appointmentId TEXT NOT NULL,
  clientId TEXT DEFAULT '',
  staffId TEXT DEFAULT '',
  action TEXT NOT NULL,
  actionGroup TEXT DEFAULT '',
  statusBefore TEXT DEFAULT '',
  statusAfter TEXT DEFAULT '',
  changedBy TEXT DEFAULT '',
  changedByRole TEXT DEFAULT '',
  source TEXT DEFAULT 'system',
  reason TEXT DEFAULT '',
  oldData TEXT DEFAULT '{}',
  newData TEXT DEFAULT '{}',
  changes TEXT DEFAULT '[]',
  riskLevel TEXT DEFAULT 'low',
  riskScore INTEGER DEFAULT 0,
  riskReasons TEXT DEFAULT '[]',
  suggestedAction TEXT DEFAULT '',
  createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
  version INTEGER DEFAULT 1
);

CREATE INDEX IF NOT EXISTS idx_appointment_activity_tenant_time
  ON appointment_activity_log(tenantId, createdAt);

CREATE INDEX IF NOT EXISTS idx_appointment_activity_client
  ON appointment_activity_log(tenantId, clientId, createdAt);

CREATE INDEX IF NOT EXISTS idx_appointment_activity_appointment
  ON appointment_activity_log(tenantId, appointmentId, createdAt);

CREATE INDEX IF NOT EXISTS idx_appointment_activity_branch_action
  ON appointment_activity_log(tenantId, branchId, action, createdAt);

CREATE INDEX IF NOT EXISTS idx_appointment_activity_staff
  ON appointment_activity_log(tenantId, staffId, createdAt);
