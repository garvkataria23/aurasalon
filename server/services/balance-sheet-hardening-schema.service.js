import { db } from "../db.js";

let ensured = false;

export function ensureHardeningSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS schedulerRuns (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      jobType TEXT NOT NULL,
      runKey TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'running',
      startedAt INTEGER NOT NULL,
      finishedAt INTEGER,
      detail TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, jobType, runKey)
    );

    CREATE TABLE IF NOT EXISTS glOutbox (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      eventType TEXT NOT NULL,
      eventKey TEXT NOT NULL,
      businessDate TEXT NOT NULL,
      payloadJson TEXT NOT NULL DEFAULT '{}',
      status TEXT NOT NULL DEFAULT 'pending',
      attempts INTEGER NOT NULL DEFAULT 0,
      maxAttempts INTEGER NOT NULL DEFAULT 5,
      availableAt INTEGER NOT NULL DEFAULT 0,
      lastError TEXT NOT NULL DEFAULT '',
      journalEntryId TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      processedAt TEXT NOT NULL DEFAULT '',
      UNIQUE(tenantId, eventKey)
    );

    CREATE TABLE IF NOT EXISTS inventoryItems (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      sku TEXT NOT NULL,
      name TEXT NOT NULL DEFAULT '',
      qtyOnHand REAL NOT NULL DEFAULT 0,
      wmaCostPaise INTEGER NOT NULL DEFAULT 0,
      totalValuePaise INTEGER NOT NULL DEFAULT 0,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, branchId, sku)
    );

    CREATE TABLE IF NOT EXISTS inventoryMovements (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      sku TEXT NOT NULL,
      movementType TEXT NOT NULL CHECK(movementType IN ('in','out')),
      qty REAL NOT NULL DEFAULT 0,
      unitCostPaise INTEGER NOT NULL DEFAULT 0,
      totalCostPaise INTEGER NOT NULL DEFAULT 0,
      wmaCostAfterPaise INTEGER NOT NULL DEFAULT 0,
      qtyAfter REAL NOT NULL DEFAULT 0,
      valueAfterPaise INTEGER NOT NULL DEFAULT 0,
      sourceType TEXT NOT NULL DEFAULT '',
      sourceId TEXT NOT NULL DEFAULT '',
      businessDate TEXT NOT NULL,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS reconciliationRuns (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      asOfDate TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'ok',
      checksJson TEXT NOT NULL DEFAULT '[]',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_gl_outbox_status ON glOutbox(tenantId, status, availableAt);
    CREATE INDEX IF NOT EXISTS idx_inventory_items_scope ON inventoryItems(tenantId, branchId, sku);
    CREATE INDEX IF NOT EXISTS idx_inventory_movements_scope ON inventoryMovements(tenantId, branchId, sku, businessDate);
    CREATE INDEX IF NOT EXISTS idx_reconciliation_scope ON reconciliationRuns(tenantId, branchId, asOfDate);
  `);
  ensured = true;
}
