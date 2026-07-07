import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let ensured = false;

export function ensureLeadManagementSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS leadStages (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      name TEXT NOT NULL,
      stageKey TEXT NOT NULL,
      sortOrder INTEGER DEFAULT 0,
      color TEXT DEFAULT '',
      isWon INTEGER DEFAULT 0,
      isLost INTEGER DEFAULT 0,
      active INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leadTypes (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT DEFAULT '',
      name TEXT NOT NULL,
      typeKey TEXT NOT NULL,
      active INTEGER DEFAULT 1,
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leadRecords (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      title TEXT NOT NULL,
      quotedAmountPaise INTEGER DEFAULT 0,
      convertedAmountPaise INTEGER DEFAULT 0,
      currency TEXT DEFAULT 'INR',
      customerName TEXT NOT NULL,
      phone TEXT NOT NULL,
      email TEXT DEFAULT '',
      clientId TEXT DEFAULT '',
      typeId TEXT DEFAULT '',
      typeName TEXT DEFAULT '',
      stageId TEXT DEFAULT '',
      stageName TEXT DEFAULT '',
      assignedTo TEXT DEFAULT '',
      assignedName TEXT DEFAULT '',
      source TEXT DEFAULT '',
      followUpAt TEXT DEFAULT '',
      notes TEXT DEFAULT '',
      leadScore INTEGER DEFAULT 0,
      leadTemperature TEXT DEFAULT 'cold',
      slaStatus TEXT DEFAULT 'collecting',
      status TEXT DEFAULT 'open',
      wonAt TEXT DEFAULT '',
      lostAt TEXT DEFAULT '',
      lostReason TEXT DEFAULT '',
      invoiceId TEXT DEFAULT '',
      appointmentId TEXT DEFAULT '',
      createdBy TEXT DEFAULT '',
      updatedBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leadFollowUps (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      leadId TEXT NOT NULL,
      dueAt TEXT NOT NULL,
      note TEXT DEFAULT '',
      status TEXT DEFAULT 'pending',
      completedAt TEXT DEFAULT '',
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL,
      updatedAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leadNotes (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      leadId TEXT NOT NULL,
      note TEXT NOT NULL,
      noteType TEXT DEFAULT 'note',
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leadEvents (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      leadId TEXT DEFAULT '',
      actorUserId TEXT DEFAULT '',
      action TEXT NOT NULL,
      fromStageId TEXT DEFAULT '',
      toStageId TEXT DEFAULT '',
      beforePayload TEXT DEFAULT '{}',
      afterPayload TEXT DEFAULT '{}',
      status TEXT DEFAULT 'recorded',
      createdAt TEXT NOT NULL
    );

    CREATE TABLE IF NOT EXISTS leadImports (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL,
      fileName TEXT DEFAULT '',
      rowCount INTEGER DEFAULT 0,
      importedCount INTEGER DEFAULT 0,
      skippedCount INTEGER DEFAULT 0,
      duplicateCount INTEGER DEFAULT 0,
      errorCount INTEGER DEFAULT 0,
      resultJson TEXT DEFAULT '{}',
      createdBy TEXT DEFAULT '',
      createdAt TEXT NOT NULL
    );
  `);

  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_leadStages_scope_key ON leadStages(tenantId, branchId, stageKey)").run();
  db.prepare("CREATE UNIQUE INDEX IF NOT EXISTS idx_leadTypes_scope_key ON leadTypes(tenantId, branchId, typeKey)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_leadRecords_scope_stage ON leadRecords(tenantId, branchId, status, stageId, updatedAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_leadRecords_phone ON leadRecords(tenantId, branchId, phone)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_leadFollowUps_scope_due ON leadFollowUps(tenantId, branchId, status, dueAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_leadNotes_lead ON leadNotes(tenantId, branchId, leadId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_leadEvents_lead ON leadEvents(tenantId, branchId, leadId, createdAt)").run();
  db.prepare("CREATE INDEX IF NOT EXISTS idx_leadImports_scope ON leadImports(tenantId, branchId, createdAt)").run();

  ensured = true;
  logger.info("lead_management_schema_ensured", {
    tables: ["leadStages", "leadTypes", "leadRecords", "leadFollowUps", "leadNotes", "leadEvents", "leadImports"]
  });
}
