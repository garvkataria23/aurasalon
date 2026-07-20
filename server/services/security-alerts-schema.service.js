import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let ensured = false;

export function ensureSecurityAlertsSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_alerts (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      alertType TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      ipAddress TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      summary TEXT NOT NULL,
      details TEXT DEFAULT '{}',
      status TEXT DEFAULT 'open',
      notifiedAt TEXT DEFAULT '',
      resolvedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_alerts_tenant_status ON security_alerts(tenantId, status, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_alerts_ip ON security_alerts(tenantId, ipAddress, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_alerts_type ON security_alerts(tenantId, alertType, createdAt)").run();
  ensured = true;
  logger.info("security_alerts_schema_ensured", { table: "security_alerts" });
}
