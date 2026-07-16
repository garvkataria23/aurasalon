import { db } from "../db.js";

let ready = false;

export function ensureOwnerOperationsSchema() {
  if (ready) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS ownerNotificationReceipts (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      ownerUserId TEXT NOT NULL,
      notificationId TEXT NOT NULL,
      readAt TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL,
      UNIQUE (tenantId, branchId, ownerUserId, notificationId)
    );
    CREATE INDEX IF NOT EXISTS idx_owner_notification_receipts_lookup
      ON ownerNotificationReceipts (tenantId, ownerUserId, notificationId, branchId);
  `);
  ready = true;
}
