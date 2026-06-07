import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260524_invoice_notifications.sql");

let ensured = false;

export function ensureInvoiceNotificationSchema() {
  if (ensured) return;
  db.exec(readFileSync(migrationPath, "utf8"));
  ensured = true;
  logger.info("invoice_notification_schema_ensured", { migration: "20260524_invoice_notifications.sql" });
}
