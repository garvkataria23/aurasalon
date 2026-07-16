import { db } from "../db.js";

let ensured = false;

export function ensureOwnerPosHandoffSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ownerPosHandoffs (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      secretHash TEXT NOT NULL UNIQUE,
      ownerUserId TEXT NOT NULL,
      appointmentId TEXT NOT NULL,
      clientId TEXT DEFAULT '',
      serviceIdsJson TEXT DEFAULT '[]',
      contextJson TEXT DEFAULT '{}',
      targetOrigin TEXT DEFAULT '',
      createdOrigin TEXT DEFAULT '',
      consumedOrigin TEXT DEFAULT '',
      expiresAt TEXT NOT NULL,
      consumedAt TEXT DEFAULT '',
      consumedByUserId TEXT DEFAULT '',
      revokedAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );
    CREATE INDEX IF NOT EXISTS idxOwnerPosHandoffsLookup
      ON ownerPosHandoffs(secretHash, expiresAt, consumedAt, revokedAt);
    CREATE INDEX IF NOT EXISTS idxOwnerPosHandoffsOwner
      ON ownerPosHandoffs(tenantId, branchId, ownerUserId, createdAt);
  `);
  const columns = new Set(db.prepare("PRAGMA table_info(ownerPosHandoffs)").all().map((column) => column.name));
  if (!columns.has("targetOrigin")) {
    db.prepare("ALTER TABLE ownerPosHandoffs ADD COLUMN targetOrigin TEXT DEFAULT ''").run();
  }
  ensured = true;
}
