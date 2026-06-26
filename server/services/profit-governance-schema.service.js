import { db } from "../db.js";

let ensured = false;

export function ensureProfitGovernanceSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS profit_governance_rules (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      ruleType TEXT NOT NULL,
      title TEXT NOT NULL,
      description TEXT NOT NULL DEFAULT '',
      enabled INTEGER NOT NULL DEFAULT 1,
      minMarginBps INTEGER NOT NULL DEFAULT 0,
      maxDiscountBps INTEGER NOT NULL DEFAULT 0,
      maxImpactPaise INTEGER NOT NULL DEFAULT 0,
      approvalRequired INTEGER NOT NULL DEFAULT 1,
      autoExecuteAllowed INTEGER NOT NULL DEFAULT 0,
      auditRequired INTEGER NOT NULL DEFAULT 1,
      severity TEXT NOT NULL DEFAULT 'medium',
      payloadJson TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS profit_governance_audit (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      ruleId TEXT NOT NULL DEFAULT '',
      sourceType TEXT NOT NULL DEFAULT '',
      sourceId TEXT NOT NULL DEFAULT '',
      decision TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged',
      marginBps INTEGER NOT NULL DEFAULT 0,
      discountBps INTEGER NOT NULL DEFAULT 0,
      impactPaise INTEGER NOT NULL DEFAULT 0,
      message TEXT NOT NULL DEFAULT '',
      payloadJson TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE UNIQUE INDEX IF NOT EXISTS idx_profit_governance_default_rule
      ON profit_governance_rules(tenantId, branchId, ruleType);
    CREATE INDEX IF NOT EXISTS idx_profit_governance_rules_scope
      ON profit_governance_rules(tenantId, branchId, enabled, severity);
    CREATE INDEX IF NOT EXISTS idx_profit_governance_audit_scope
      ON profit_governance_audit(tenantId, branchId, decision, createdAt);
  `);
  ensured = true;
}
