import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260524_invoice_notifications.sql");

let ensured = false;

function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!exists) db.prepare(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`).run();
}

export function ensureInvoiceNotificationSchema() {
  if (ensured) return;
  db.exec(readFileSync(migrationPath, "utf8"));
  ensureColumn("business_notification_profiles", "report_email_enabled", "INTEGER DEFAULT 0");
  ensureColumn("business_notification_profiles", "report_email_time", "TEXT DEFAULT '21:00'");
  ensureColumn("business_notification_profiles", "report_email_timezone", "TEXT DEFAULT 'Asia/Kolkata'");
  ensureColumn("business_notification_profiles", "report_last_sent_date", "TEXT DEFAULT ''");
  db.exec(`
    CREATE TABLE IF NOT EXISTS businessNotificationContactVerifications (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      contactRole TEXT NOT NULL,
      contactType TEXT NOT NULL,
      contactValue TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'pending',
      otpHash TEXT NOT NULL DEFAULT '',
      requestedChannel TEXT NOT NULL DEFAULT '',
      deliveryChannel TEXT NOT NULL DEFAULT '',
      attemptCount INTEGER NOT NULL DEFAULT 0,
      maxAttempts INTEGER NOT NULL DEFAULT 5,
      requestedAt TEXT NOT NULL,
      expiresAt TEXT NOT NULL,
      verifiedAt TEXT,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, branchId, contactRole, contactType, contactValue)
    );
    CREATE INDEX IF NOT EXISTS idx_businessNotificationContactVerifications_lookup
      ON businessNotificationContactVerifications(tenantId, branchId, contactRole, contactType, contactValue);
    CREATE INDEX IF NOT EXISTS idx_businessNotificationContactVerifications_expiry
      ON businessNotificationContactVerifications(expiresAt);
  `);
  ensured = true;
  logger.info("invoice_notification_schema_ensured", { migration: "20260524_invoice_notifications.sql" });
}
