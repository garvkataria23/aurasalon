import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let ensured = false;

export function ensureSecurityRateLimitSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS security_rate_limit_windows (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      scope TEXT NOT NULL,
      bucketKey TEXT NOT NULL,
      count INTEGER DEFAULT 0,
      resetAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE(tenantId, branchId, scope, bucketKey)
    );
    CREATE INDEX IF NOT EXISTS idx_security_rate_limit_scope
      ON security_rate_limit_windows(tenantId, branchId, scope, resetAt);
  `);
  ensured = true;
  logger.info("security_rate_limit_schema_ensured", { table: "security_rate_limit_windows" });
}
