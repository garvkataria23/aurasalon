import { db } from "../db.js";

let ensured = false;

export function ensureWaitlistSchema() {
  if (ensured) return;
  db.prepare(`
    CREATE TABLE IF NOT EXISTS waitlist_entries (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT,
      clientId TEXT NOT NULL,
      serviceId TEXT,
      staffId TEXT,
      preferredDate TEXT,
      windowStart TEXT,
      windowEnd TEXT,
      priority INTEGER DEFAULT 0,
      status TEXT DEFAULT 'waiting',
      offeredAt TEXT,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    )
  `).run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_waitlist_entries_slot ON waitlist_entries(tenantId, branchId, status, serviceId, staffId, windowStart, windowEnd)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_waitlist_entries_client ON waitlist_entries(tenantId, clientId, status)").run();
  ensured = true;
}
