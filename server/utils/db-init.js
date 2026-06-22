import { db } from "../db.js";
import { logger } from "./logger.js";

let initialized = false;

export function initializeDatabaseRuntime() {
  if (initialized) return;
  const pragmas = [
    "journal_mode = WAL",
    "busy_timeout = 5000",
    "synchronous = NORMAL",
    "foreign_keys = ON",
    "cache_size = -64000"
  ];
  for (const pragma of pragmas) {
    try {
      const key = pragma.split("=")[0].trim();
      db.pragma(pragma);
      logger.info("db_pragma_applied", { pragma: key, value: db.pragma(key, { simple: true }) });
    } catch (error) {
      logger.warn("db_pragma_failed", { pragma, error: error.message });
    }
  }
  const journalMode = String(db.pragma("journal_mode", { simple: true })).toLowerCase();
  if (journalMode !== "wal") {
    throw new Error(`SQLite WAL mode was not applied; journal_mode=${journalMode}`);
  }
  initialized = true;
}
