import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";

let ensured = false;

export function ensureTransactionsSchema() {
  if (ensured) return;
  const __dirname = path.dirname(fileURLToPath(import.meta.url));
  const migrationPath = path.join(__dirname, "../db/migrations/20260526_transactions.sql");
  const sql = fs.readFileSync(migrationPath, "utf8");
  db.exec(sql);
  ensureOutgoingFundColumn("expense_branch_id", "TEXT");
  ensureOutgoingFundColumn("expense_branch_name", "TEXT");
  ensureOutgoingFundColumn("cheque_date", "TEXT");
  ensureOutgoingFundColumn("transaction_type", "TEXT");
  ensureOutgoingFundColumn("salary_month_year", "TEXT");
  ensureOutgoingFundColumn("line_items_json", "TEXT");
  ensured = true;
}

function ensureOutgoingFundColumn(columnName, definition) {
  const columns = db.prepare("PRAGMA table_info(outgoing_fund_entries)").all();
  if (columns.some((column) => column.name === columnName)) return;
  db.exec(`ALTER TABLE outgoing_fund_entries ADD COLUMN ${columnName} ${definition}`);
}
