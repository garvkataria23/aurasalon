import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../db.js";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const migrationPath = path.join(__dirname, "../../db/migrations/20260527_ai_workforce_os.sql");

const existingColumnAdds = {
  ai_agents: {
    risk_level: "TEXT DEFAULT 'low'",
    approval_status: "TEXT DEFAULT 'approval_required'",
    provider_key: "TEXT DEFAULT 'not_configured'",
    autonomy_level: "TEXT DEFAULT 'approval_required'"
  },
  ai_agent_runs: {
    run_type: "TEXT DEFAULT 'manual'",
    provider_key: "TEXT DEFAULT 'not_configured'",
    model_key: "TEXT DEFAULT ''",
    prompt_version: "INTEGER DEFAULT 1",
    risk_level: "TEXT DEFAULT 'low'",
    approval_status: "TEXT DEFAULT 'not_required'",
    safety_score: "REAL DEFAULT 0",
    prompt_tokens: "INTEGER DEFAULT 0",
    completion_tokens: "INTEGER DEFAULT 0",
    total_tokens: "INTEGER DEFAULT 0",
    estimated_cost: "REAL DEFAULT 0",
    duration_ms: "REAL DEFAULT 0",
    error_text: "TEXT DEFAULT ''",
    updated_at: "TEXT"
  },
  ai_agent_decisions: {
    safety_score: "REAL DEFAULT 0",
    approval_status: "TEXT DEFAULT 'not_required'",
    approval_queue_id: "TEXT"
  },
  ai_agent_tasks: {
    schedule_id: "TEXT",
    playbook_id: "TEXT",
    task_name: "TEXT",
    description: "TEXT",
    output_json: "TEXT DEFAULT '{}'",
    priority: "TEXT DEFAULT 'normal'",
    assigned_to: "TEXT",
    due_at: "TEXT",
    completed_at: "TEXT",
    approval_status: "TEXT DEFAULT 'not_required'",
    created_by: "TEXT"
  }
};

export function ensureAiWorkforceOsSchema() {
  for (const [table, columns] of Object.entries(existingColumnAdds)) {
    ensureColumns(table, columns);
  }

  if (!existsSync(migrationPath)) return;
  db.exec(readFileSync(migrationPath, "utf8"));

  for (const [table, columns] of Object.entries(existingColumnAdds)) {
    ensureColumns(table, columns);
  }
}

function ensureColumns(table, columns) {
  if (!tableExists(table)) return;
  const existing = new Set(db.prepare(`PRAGMA table_info(${table})`).all().map((column) => column.name));
  for (const [column, definition] of Object.entries(columns)) {
    if (!existing.has(column)) {
      db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
    }
  }
}

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}
