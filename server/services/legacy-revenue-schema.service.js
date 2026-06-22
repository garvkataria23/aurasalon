import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
const migrationPath = join(__dirname, "..", "db", "migrations", "20260605_legacy_inward_revenue.sql");
let ensured = false;

export function ensureLegacyRevenueSchema() {
  if (ensured) return;
  db.exec(readFileSync(migrationPath, "utf8"));
  ensured = true;
  logger.info("legacy_revenue_schema_ensured", {
    migration: migrationPath.split(/[\\/]/).pop()
  });
}
