import { db } from "../db.js";

// Add-only schema for Stages 22-24 (dimensions, deferred revenue, fixed assets).
// Does not alter base balance-sheet tables or db.js. Lazily ensured.

let ensured = false;

export function ensureAdvancedSchema() {
  if (ensured) return;
  db.exec(`
    -- Stage 22: cost centers / dimensions
    CREATE TABLE IF NOT EXISTS costCenters (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      type TEXT NOT NULL DEFAULT 'custom' CHECK(type IN ('chair','stylist','category','department','custom')),
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, branchId, code)
    );

    -- Side table that tags posted journal lines with a cost center (add-only,
    -- does not modify journalEntryLines).
    CREATE TABLE IF NOT EXISTS journalLineDimensions (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      journalEntryId TEXT NOT NULL,
      lineId TEXT NOT NULL,
      costCenterId TEXT NOT NULL,
      amountPaise INTEGER NOT NULL DEFAULT 0,
      side TEXT NOT NULL CHECK(side IN ('debit','credit')),
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    -- Stage 23: deferred revenue (packages / memberships / gift cards)
    CREATE TABLE IF NOT EXISTS deferredSchedules (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      sourceType TEXT NOT NULL DEFAULT 'package' CHECK(sourceType IN ('package','membership','giftcard','prepaid')),
      sourceId TEXT NOT NULL DEFAULT '',
      customerId TEXT NOT NULL DEFAULT '',
      totalPaise INTEGER NOT NULL DEFAULT 0,
      recognizedPaise INTEGER NOT NULL DEFAULT 0,
      method TEXT NOT NULL DEFAULT 'straight_line' CHECK(method IN ('straight_line','on_usage')),
      startDate TEXT NOT NULL,
      periods INTEGER NOT NULL DEFAULT 1,
      paymentMode TEXT NOT NULL DEFAULT 'bank',
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','completed','cancelled')),
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, sourceType, sourceId)
    );

    CREATE TABLE IF NOT EXISTS deferredRecognitions (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      scheduleId TEXT NOT NULL,
      periodIndex INTEGER NOT NULL DEFAULT 0,
      recognizeDate TEXT NOT NULL,
      amountPaise INTEGER NOT NULL DEFAULT 0,
      journalEntryId TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, scheduleId, periodIndex)
    );

    -- Stage 24: fixed asset register + depreciation
    CREATE TABLE IF NOT EXISTS fixedAssets (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      category TEXT NOT NULL DEFAULT 'equipment',
      acquisitionDate TEXT NOT NULL,
      costPaise INTEGER NOT NULL DEFAULT 0,
      salvagePaise INTEGER NOT NULL DEFAULT 0,
      usefulLifeMonths INTEGER NOT NULL DEFAULT 60,
      method TEXT NOT NULL DEFAULT 'SLM' CHECK(method IN ('SLM','WDV')),
      wdvRatePct REAL NOT NULL DEFAULT 0,
      accumulatedDepreciationPaise INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active' CHECK(status IN ('active','disposed')),
      disposedDate TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, branchId, code)
    );

    CREATE TABLE IF NOT EXISTS depreciationEntries (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      assetId TEXT NOT NULL,
      period TEXT NOT NULL,
      amountPaise INTEGER NOT NULL DEFAULT 0,
      journalEntryId TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, assetId, period)
    );

    CREATE INDEX IF NOT EXISTS idx_jld_scope ON journalLineDimensions(tenantId, costCenterId, journalEntryId);
    CREATE INDEX IF NOT EXISTS idx_deferred_active ON deferredSchedules(tenantId, status, startDate);
    CREATE INDEX IF NOT EXISTS idx_assets_active ON fixedAssets(tenantId, branchId, status);
  `);
  ensureColumn("fixedAssets", "code", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("fixedAssets", "name", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("fixedAssets", "category", "TEXT NOT NULL DEFAULT 'equipment'");
  ensureColumn("fixedAssets", "acquisitionDate", "TEXT NOT NULL DEFAULT ''");
  ensureColumn("fixedAssets", "costPaise", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("fixedAssets", "salvagePaise", "INTEGER NOT NULL DEFAULT 0");
  ensureColumn("fixedAssets", "method", "TEXT NOT NULL DEFAULT 'SLM'");
  ensureColumn("fixedAssets", "wdvRatePct", "REAL NOT NULL DEFAULT 0");
  ensureColumn("fixedAssets", "disposedDate", "TEXT NOT NULL DEFAULT ''");
  ensured = true;
}

function ensureColumn(table, column, definition) {
  const exists = db.prepare(`PRAGMA table_info(${table})`).all().some((row) => row.name === column);
  if (!exists) db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} ${definition}`);
}

// Idempotently ensure the extra ledger accounts these engines post to.
const ADVANCED_ACCOUNTS = [
  ["2300", "Deferred Revenue", "liability", "deferred_revenue", "credit"],
  ["4200", "Gain on Asset Disposal", "income", "other_income", "credit"],
  ["5500", "Loss on Asset Disposal", "expense", "other_expense", "debit"]
];

export function ensureAdvancedAccounts(tenantId, branchId = "") {
  ensureAdvancedSchema();
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO chartOfAccounts
      (id, tenantId, branchId, code, name, accountType, accountSubType, normalBalance, systemAccount, active)
    VALUES (@id, @tenantId, @branchId, @code, @name, @accountType, @accountSubType, @normalBalance, 1, 1)
  `);
  for (const [code, name, accountType, accountSubType, normalBalance] of ADVANCED_ACCOUNTS) {
    stmt.run({
      id: `coa_${tenantId}_${branchId || "tenant"}_${code}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      tenantId, branchId, code, name, accountType, accountSubType, normalBalance
    });
  }
}
