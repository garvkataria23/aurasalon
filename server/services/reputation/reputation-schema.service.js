import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../db.js";

let ensured = false;

export function ensureReputationSchema() {
  if (ensured) return;
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..", "..");
  const migration = readFileSync(join(root, "server", "db", "migrations", "20260524_reputation_advanced.sql"), "utf8");
  db.exec(migration);
  ensured = true;
}
