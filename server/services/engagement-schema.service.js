import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260529_engagement_command_center_foundation.sql");

let ensured = false;

export function ensureEngagementSchema() {
  if (ensured) return;
  db.exec(readFileSync(migrationPath, "utf8"));
  db.exec(`
    CREATE TABLE IF NOT EXISTS engagementLeadActions (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      leadId TEXT NOT NULL,
      threadId TEXT DEFAULT '',
      whatsappThreadId TEXT DEFAULT '',
      clientId TEXT DEFAULT '',
      invoiceId TEXT DEFAULT '',
      actionType TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'logged',
      assignedTo TEXT DEFAULT '',
      note TEXT DEFAULT '',
      metadataJson TEXT NOT NULL DEFAULT '{}',
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_engagementLeadActions_scope
      ON engagementLeadActions (tenantId, branchId, leadId, createdAt);
    CREATE INDEX IF NOT EXISTS idx_engagementLeadActions_status
      ON engagementLeadActions (tenantId, branchId, actionType, status, createdAt);
  `);
  ensured = true;
  logger.info("engagement_schema_ensured", { migration: "20260529_engagement_command_center_foundation.sql" });
}
