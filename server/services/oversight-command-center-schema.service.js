import { db } from "../db.js";

export function ensureOversightCommandCenterSchema() {
  db.exec(`
    CREATE TABLE IF NOT EXISTS oversight_audit_verify_runs (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      runDate TEXT NOT NULL,
      status TEXT NOT NULL,
      verifiedInvoices INTEGER NOT NULL DEFAULT 0,
      warningCount INTEGER NOT NULL DEFAULT 0,
      tamperCount INTEGER NOT NULL DEFAULT 0,
      detailsJson TEXT NOT NULL DEFAULT '{}',
      createdBy TEXT,
      createdAt TEXT NOT NULL
    );

    CREATE INDEX IF NOT EXISTS idx_oversight_audit_verify_scope
      ON oversight_audit_verify_runs (tenantId, branchId, runDate, createdAt);
  `);
}
