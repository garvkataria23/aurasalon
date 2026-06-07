import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const MIGRATION_PATH = path.resolve(__dirname, "../db/migrations/20260526_account_ledger.sql");

export function ensureAccountLedgerSchema() {
  const sql = fs.readFileSync(MIGRATION_PATH, "utf8");
  db.exec(sql);
}
