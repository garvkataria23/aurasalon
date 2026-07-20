import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260528_appointment_activity_center.sql");
let ensured = false;

export function ensureAppointmentActivitySchema() {
  if (ensured) return;
  db.exec(readFileSync(migrationPath, "utf8"));
  ensured = true;
  logger.info("appointment_activity_schema_ensured", {
    migration: migrationPath.split(/[\\/]/).pop()
  });
}
