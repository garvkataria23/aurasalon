import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let ensured = false;

const INDEX_COLUMNS = {
  security_trusted_devices: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    userId: "TEXT DEFAULT ''",
    deviceId: "TEXT DEFAULT ''",
    status: "TEXT DEFAULT 'observed'",
    lastSeenAt: "TEXT DEFAULT ''"
  },
  security_field_audit_logs: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    entityType: "TEXT DEFAULT ''",
    createdAt: "TEXT DEFAULT ''"
  },
  security_policies: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    policyKey: "TEXT DEFAULT ''"
  },
  security_risk_events: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    riskLevel: "TEXT DEFAULT 'low'",
    createdAt: "TEXT DEFAULT ''"
  },
  security_approval_requests: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    status: "TEXT DEFAULT 'pending'",
    createdAt: "TEXT DEFAULT ''"
  },
  security_access_rules: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    ruleType: "TEXT DEFAULT 'ip'",
    status: "TEXT DEFAULT 'active'"
  },
  security_data_masks: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    entityType: "TEXT DEFAULT ''",
    status: "TEXT DEFAULT 'active'"
  },
  security_review_playbooks: {
    tenantId: "TEXT DEFAULT ''",
    branchId: "TEXT DEFAULT ''",
    severity: "TEXT DEFAULT 'warning'",
    status: "TEXT DEFAULT 'active'"
  },
  security_sso_settings: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", status: "TEXT DEFAULT 'draft'" },
  security_privileged_sessions: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", status: "TEXT DEFAULT 'active'", expiresAt: "TEXT DEFAULT ''" },
  security_api_clients: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", status: "TEXT DEFAULT 'active'" },
  security_payment_guard_events: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", severity: "TEXT DEFAULT 'info'", createdAt: "TEXT DEFAULT ''" },
  security_privacy_requests: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", status: "TEXT DEFAULT 'open'", createdAt: "TEXT DEFAULT ''" },
  security_session_revocations: { tenantId: "TEXT DEFAULT ''", userId: "TEXT DEFAULT ''", deviceId: "TEXT DEFAULT ''", scope: "TEXT DEFAULT 'device'", createdAt: "TEXT DEFAULT ''" },
  security_account_sharing_events: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", severity: "TEXT DEFAULT 'warning'", createdAt: "TEXT DEFAULT ''" },
  security_subscription_guard_events: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", status: "TEXT DEFAULT 'open'", createdAt: "TEXT DEFAULT ''" },
  security_fraud_warnings: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", status: "TEXT DEFAULT 'active'", createdAt: "TEXT DEFAULT ''" },
  security_disclosure_reports: { tenantId: "TEXT DEFAULT ''", branchId: "TEXT DEFAULT ''", status: "TEXT DEFAULT 'new'", createdAt: "TEXT DEFAULT ''" }
};

function hasColumn(table, column) {
  return db.prepare(`PRAGMA table_info(${table})`).all().some((item) => item.name === column);
}

function ensureIndexColumns() {
  for (const [table, columns] of Object.entries(INDEX_COLUMNS)) {
    for (const [column, definition] of Object.entries(columns)) {
      if (!hasColumn(table, column)) {
        db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
      }
    }
  }
}

export function ensureSecurityAdvancedSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_trusted_devices (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      deviceId TEXT NOT NULL,
      deviceName TEXT DEFAULT '',
      ipAddress TEXT DEFAULT '',
      userAgent TEXT DEFAULT '',
      trustLevel TEXT DEFAULT 'observed',
      firstSeenAt TEXT NOT NULL,
      lastSeenAt TEXT NOT NULL,
      status TEXT DEFAULT 'observed',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_field_audit_logs (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      entityType TEXT NOT NULL,
      entityId TEXT DEFAULT '',
      fieldName TEXT NOT NULL,
      oldValue TEXT DEFAULT '',
      newValue TEXT DEFAULT '',
      action TEXT DEFAULT 'field_changed',
      ipAddress TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_policies (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      policyKey TEXT NOT NULL,
      policyValue TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(tenantId, branchId, policyKey)
    );

    CREATE TABLE IF NOT EXISTS security_risk_events (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      riskScore INTEGER DEFAULT 0,
      riskLevel TEXT DEFAULT 'low',
      ipAddress TEXT DEFAULT '',
      userAgent TEXT DEFAULT '',
      reasons TEXT DEFAULT '[]',
      status TEXT DEFAULT 'open',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_approval_requests (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      requestedBy TEXT DEFAULT '',
      approvedBy TEXT DEFAULT '',
      actionType TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      status TEXT DEFAULT 'pending',
      decidedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_access_rules (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      ruleType TEXT DEFAULT 'ip',
      matchValue TEXT NOT NULL,
      effect TEXT DEFAULT 'watch',
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_data_masks (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      entityType TEXT NOT NULL,
      fieldName TEXT NOT NULL,
      maskType TEXT DEFAULT 'partial',
      rolesAllowed TEXT DEFAULT 'owner,admin,superAdmin',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(tenantId, branchId, entityType, fieldName)
    );

    CREATE TABLE IF NOT EXISTS security_review_playbooks (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      playbookKey TEXT NOT NULL,
      title TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      checklist TEXT DEFAULT '[]',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(tenantId, branchId, playbookKey)
    );

    CREATE TABLE IF NOT EXISTS security_sso_settings (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      provider TEXT DEFAULT 'saml',
      domainHint TEXT DEFAULT '',
      enforceForRoles TEXT DEFAULT 'owner,admin,superAdmin',
      status TEXT DEFAULT 'draft',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_privileged_sessions (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      purpose TEXT NOT NULL,
      riskLevel TEXT DEFAULT 'warning',
      expiresAt TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_api_clients (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      clientName TEXT NOT NULL,
      tokenHash TEXT NOT NULL,
      scopes TEXT DEFAULT '',
      lastUsedAt TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_payment_guard_events (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      eventType TEXT NOT NULL,
      summary TEXT NOT NULL,
      paymentRef TEXT DEFAULT '',
      severity TEXT DEFAULT 'info',
      status TEXT DEFAULT 'open',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_privacy_requests (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      requesterId TEXT DEFAULT '',
      subjectType TEXT DEFAULT 'client',
      subjectId TEXT DEFAULT '',
      requestType TEXT NOT NULL,
      summary TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      resolvedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_session_revocations (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      deviceId TEXT DEFAULT '',
      scope TEXT DEFAULT 'device',
      reason TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_account_sharing_events (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      signalType TEXT NOT NULL,
      summary TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      severity TEXT DEFAULT 'warning',
      status TEXT DEFAULT 'open',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_subscription_guard_events (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      subscriptionStatus TEXT DEFAULT '',
      path TEXT DEFAULT '',
      action TEXT DEFAULT 'module_guard',
      summary TEXT NOT NULL,
      status TEXT DEFAULT 'open',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_fraud_warnings (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      severity TEXT DEFAULT 'info',
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS security_disclosure_reports (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      reporterName TEXT DEFAULT '',
      reporterContact TEXT DEFAULT '',
      summary TEXT NOT NULL,
      details TEXT DEFAULT '',
      severity TEXT DEFAULT 'warning',
      status TEXT DEFAULT 'new',
      resolvedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);

  ensureIndexColumns();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_devices_tenant_user ON security_trusted_devices(tenantId, userId, status, lastSeenAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_devices_device ON security_trusted_devices(tenantId, deviceId, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_field_audit_tenant ON security_field_audit_logs(tenantId, branchId, entityType, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_policies_tenant ON security_policies(tenantId, branchId, policyKey)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_risk_events_tenant ON security_risk_events(tenantId, branchId, riskLevel, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_approvals_tenant ON security_approval_requests(tenantId, branchId, status, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_access_rules_tenant ON security_access_rules(tenantId, branchId, ruleType, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_data_masks_tenant ON security_data_masks(tenantId, branchId, entityType, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_playbooks_tenant ON security_review_playbooks(tenantId, branchId, severity, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_sso_tenant ON security_sso_settings(tenantId, branchId, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_privileged_sessions_tenant ON security_privileged_sessions(tenantId, branchId, status, expiresAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_api_clients_tenant ON security_api_clients(tenantId, branchId, status)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_payment_guard_tenant ON security_payment_guard_events(tenantId, branchId, severity, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_privacy_requests_tenant ON security_privacy_requests(tenantId, branchId, status, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_session_revocations_tenant ON security_session_revocations(tenantId, userId, deviceId, scope, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_account_sharing_tenant ON security_account_sharing_events(tenantId, branchId, severity, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_subscription_guard_tenant ON security_subscription_guard_events(tenantId, branchId, status, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_fraud_warnings_tenant ON security_fraud_warnings(tenantId, branchId, status, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_disclosure_reports_tenant ON security_disclosure_reports(tenantId, branchId, status, createdAt)").run();

  ensured = true;
  logger.info("security_advanced_schema_ensured", {
    tables: ["security_trusted_devices", "security_field_audit_logs", "security_policies", "security_risk_events", "security_approval_requests", "security_access_rules", "security_data_masks", "security_review_playbooks", "security_sso_settings", "security_privileged_sessions", "security_api_clients", "security_payment_guard_events", "security_privacy_requests", "security_session_revocations", "security_account_sharing_events", "security_subscription_guard_events", "security_fraud_warnings", "security_disclosure_reports"]
  });
}
