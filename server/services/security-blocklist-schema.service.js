import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let ensured = false;

export function ensureSecurityBlocklistSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_blocklist (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      ipAddress TEXT DEFAULT '',
      userId TEXT DEFAULT '',
      reason TEXT NOT NULL,
      severity TEXT DEFAULT 'warning',
      blockedUntil TEXT NOT NULL,
      status TEXT DEFAULT 'active',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `);
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_blocklist_tenant_ip ON security_blocklist(tenantId, ipAddress, status, blockedUntil)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_security_blocklist_user ON security_blocklist(tenantId, userId, status, blockedUntil)").run();
  ensured = true;
  logger.info("security_blocklist_schema_ensured", { table: "security_blocklist" });
}
