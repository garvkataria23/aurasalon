import { db } from "../db.js";

export function ensureDueRecoveryFollowupSchema() {
  db.prepare(`
    CREATE TABLE IF NOT EXISTS due_recovery_followups (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      invoiceId TEXT NOT NULL,
      clientId TEXT DEFAULT '',
      managerId TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      note TEXT DEFAULT '',
      actionType TEXT NOT NULL,
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    )
  `).run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_due_recovery_followups_invoice ON due_recovery_followups(tenantId, branchId, invoiceId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_due_recovery_followups_manager ON due_recovery_followups(tenantId, branchId, managerId, status)").run();
}
