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
  ensured = true;
  logger.info("engagement_schema_ensured", { migration: "20260529_engagement_command_center_foundation.sql" });
}
