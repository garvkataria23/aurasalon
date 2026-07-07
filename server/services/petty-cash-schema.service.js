import { db } from "../db.js";

let pettyCashSchemaReady = false;

export function ensurePettyCashSchema() {
  if (pettyCashSchemaReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS pettyCashEntries (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      branchName TEXT DEFAULT '',
      docDate TEXT NOT NULL,
      type TEXT NOT NULL,
      prefix TEXT DEFAULT '',
      docNo TEXT NOT NULL,
      billNumber TEXT DEFAULT '',
      billDate TEXT DEFAULT '',
      particular TEXT NOT NULL,
      category TEXT DEFAULT '',
      sourceAccount TEXT DEFAULT '',
      staffId TEXT DEFAULT '',
      staffName TEXT DEFAULT '',
      debitPaise INTEGER DEFAULT 0,
      creditPaise INTEGER DEFAULT 0,
      paymode TEXT DEFAULT 'Cash',
      chequeNo TEXT DEFAULT '',
      remarks TEXT DEFAULT '',
      approvalStatus TEXT DEFAULT 'not_required',
      approvedBy TEXT DEFAULT '',
      approvedAt TEXT DEFAULT '',
      ledgerStatus TEXT DEFAULT 'queued',
      ledgerEventKey TEXT DEFAULT '',
      status TEXT DEFAULT 'active',
      createdBy TEXT DEFAULT '',
      updatedBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      version INTEGER DEFAULT 1
    );
    CREATE INDEX IF NOT EXISTS idx_pettyCashEntries_tenant_branch_date
      ON pettyCashEntries (tenantId, branchId, docDate, createdAt);
    CREATE INDEX IF NOT EXISTS idx_pettyCashEntries_tenant_doc
      ON pettyCashEntries (tenantId, docNo);
    CREATE TABLE IF NOT EXISTS pettyCashEntryHistory (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      entryId TEXT NOT NULL,
      action TEXT NOT NULL,
      beforeJson TEXT DEFAULT '',
      afterJson TEXT DEFAULT '',
      changedBy TEXT DEFAULT '',
      changedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idx_pettyCashEntryHistory_entry
      ON pettyCashEntryHistory (tenantId, entryId, changedAt);
  `);
  ensureColumn("category", "TEXT DEFAULT ''");
  ensureColumn("sourceAccount", "TEXT DEFAULT ''");
  ensureColumn("staffId", "TEXT DEFAULT ''");
  ensureColumn("staffName", "TEXT DEFAULT ''");
  ensureColumn("approvalStatus", "TEXT DEFAULT 'not_required'");
  ensureColumn("approvedBy", "TEXT DEFAULT ''");
  ensureColumn("approvedAt", "TEXT DEFAULT ''");
  ensureColumn("ledgerStatus", "TEXT DEFAULT 'queued'");
  ensureColumn("ledgerEventKey", "TEXT DEFAULT ''");
  pettyCashSchemaReady = true;
}

function ensureColumn(columnName, definition) {
  const columns = db.prepare("PRAGMA table_info(pettyCashEntries)").all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE pettyCashEntries ADD COLUMN ${columnName} ${definition}`);
}
