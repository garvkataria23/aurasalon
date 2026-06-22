import { db, tableHasColumn } from "../db.js";

let ensured = false;

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function ensureColumn(table, definition) {
  if (!tableExists(table)) return;
  const column = definition.trim().split(/\s+/)[0];
  if (!tableHasColumn(table, column)) {
    db.prepare(`ALTER TABLE ${table} ADD COLUMN ${definition}`).run();
  }
}

export function ensureEnterpriseSchedulerSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS appointment_staff_blocks (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      staffId TEXT NOT NULL,
      blockDate TEXT NOT NULL,
      startAt TEXT NOT NULL,
      endAt TEXT NOT NULL,
      reason TEXT DEFAULT '',
      status TEXT DEFAULT 'blocked',
      createdBy TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );
    CREATE INDEX IF NOT EXISTS idx_appointment_staff_blocks_lookup
      ON appointment_staff_blocks(tenantId, branchId, staffId, blockDate, status);
    CREATE INDEX IF NOT EXISTS idx_appointment_staff_blocks_time
      ON appointment_staff_blocks(tenantId, branchId, startAt, endAt);
  `);
  ensureColumn("appointments", "bookingGroupId TEXT DEFAULT ''");
  ensureColumn("appointments", "groupMemberRole TEXT DEFAULT ''");
  ensured = true;
}

ensureEnterpriseSchedulerSchema();
