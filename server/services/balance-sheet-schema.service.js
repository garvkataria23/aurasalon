import { db } from "../db.js";

let ensured = false;

export function ensureBalanceSheetSchema() {
  if (ensured) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS chartOfAccounts (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      code TEXT NOT NULL,
      name TEXT NOT NULL,
      accountType TEXT NOT NULL CHECK(accountType IN ('asset', 'liability', 'equity', 'income', 'expense')),
      accountSubType TEXT NOT NULL DEFAULT '',
      normalBalance TEXT NOT NULL CHECK(normalBalance IN ('debit', 'credit')),
      systemAccount INTEGER NOT NULL DEFAULT 0,
      active INTEGER NOT NULL DEFAULT 1,
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, branchId, code)
    );

    CREATE TABLE IF NOT EXISTS journalEntries (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      entryDate TEXT NOT NULL,
      businessDate TEXT NOT NULL,
      sourceType TEXT NOT NULL DEFAULT 'manual',
      sourceId TEXT NOT NULL DEFAULT '',
      memo TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'posted' CHECK(status IN ('draft', 'posted', 'reversed')),
      locked INTEGER NOT NULL DEFAULT 0,
      reversalOf TEXT NOT NULL DEFAULT '',
      idempotencyKey TEXT NOT NULL DEFAULT '',
      createdBy TEXT NOT NULL DEFAULT 'system',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, idempotencyKey)
    );

    CREATE TABLE IF NOT EXISTS journalEntryLines (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      journalEntryId TEXT NOT NULL,
      accountId TEXT NOT NULL,
      debitPaise INTEGER NOT NULL DEFAULT 0,
      creditPaise INTEGER NOT NULL DEFAULT 0,
      lineMemo TEXT NOT NULL DEFAULT '',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS fixedAssets (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      assetName TEXT NOT NULL,
      purchaseDate TEXT NOT NULL,
      purchaseCostPaise INTEGER NOT NULL DEFAULT 0,
      salvageValuePaise INTEGER NOT NULL DEFAULT 0,
      usefulLifeMonths INTEGER NOT NULL DEFAULT 60,
      depreciationMethod TEXT NOT NULL DEFAULT 'slm' CHECK(depreciationMethod IN ('slm', 'wdv')),
      wdvRatePercent REAL NOT NULL DEFAULT 0,
      accumulatedDepreciationPaise INTEGER NOT NULL DEFAULT 0,
      status TEXT NOT NULL DEFAULT 'active',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE TABLE IF NOT EXISTS depreciationSchedules (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      assetId TEXT NOT NULL,
      period TEXT NOT NULL,
      depreciationPaise INTEGER NOT NULL DEFAULT 0,
      postedJournalEntryId TEXT NOT NULL DEFAULT '',
      status TEXT NOT NULL DEFAULT 'pending',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, assetId, period)
    );

    CREATE TABLE IF NOT EXISTS balanceSheetSnapshots (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      asOfDate TEXT NOT NULL,
      totalAssetsPaise INTEGER NOT NULL DEFAULT 0,
      totalLiabilitiesPaise INTEGER NOT NULL DEFAULT 0,
      totalEquityPaise INTEGER NOT NULL DEFAULT 0,
      payloadJson TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      UNIQUE(tenantId, branchId, asOfDate)
    );

    CREATE TABLE IF NOT EXISTS periodLocks (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      period TEXT NOT NULL,
      lockedAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP,
      lockedBy TEXT NOT NULL DEFAULT 'system',
      reason TEXT NOT NULL DEFAULT '',
      UNIQUE(tenantId, branchId, period)
    );

    CREATE TABLE IF NOT EXISTS balanceSheetAlerts (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      alertDate TEXT NOT NULL,
      severity TEXT NOT NULL DEFAULT 'info',
      title TEXT NOT NULL,
      message TEXT NOT NULL,
      status TEXT NOT NULL DEFAULT 'open',
      payloadJson TEXT NOT NULL DEFAULT '{}',
      createdAt TEXT NOT NULL DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_journal_entries_scope ON journalEntries(tenantId, branchId, businessDate);
    CREATE INDEX IF NOT EXISTS idx_journal_lines_entry ON journalEntryLines(tenantId, journalEntryId);
    CREATE INDEX IF NOT EXISTS idx_journal_lines_account ON journalEntryLines(tenantId, accountId);
  `);
  seedChartOfAccounts("tenant_aura", "");
  ensured = true;
}

export function seedChartOfAccounts(tenantId, branchId = "") {
  const accounts = [
    ["1000", "Cash", "asset", "cash", "debit"],
    ["1010", "Bank", "asset", "bank", "debit"],
    ["1100", "Accounts Receivable", "asset", "receivables", "debit"],
    ["1200", "Inventory", "asset", "inventory", "debit"],
    ["1500", "Fixed Assets", "asset", "fixed_assets", "debit"],
    ["1590", "Accumulated Depreciation", "asset", "contra_asset", "credit"],
    ["2000", "Accounts Payable", "liability", "payables", "credit"],
    ["2100", "GST Payable", "liability", "tax", "credit"],
    ["2200", "Loans Payable", "liability", "loan", "credit"],
    ["3000", "Owner Capital", "equity", "capital", "credit"],
    ["3100", "Owner Drawings", "equity", "drawings", "debit"],
    ["3200", "Retained Earnings", "equity", "retained_earnings", "credit"],
    ["4000", "Service Revenue", "income", "sales", "credit"],
    ["4100", "Product Revenue", "income", "sales", "credit"],
    ["5000", "Cost of Goods Sold", "expense", "cogs", "debit"],
    ["5100", "Salary Expense", "expense", "salary", "debit"],
    ["5200", "Rent Expense", "expense", "rent", "debit"],
    ["5300", "Marketing Expense", "expense", "marketing", "debit"],
    ["5400", "Depreciation Expense", "expense", "depreciation", "debit"]
  ];
  const stmt = db.prepare(`
    INSERT OR IGNORE INTO chartOfAccounts
      (id, tenantId, branchId, code, name, accountType, accountSubType, normalBalance, systemAccount)
    VALUES
      (@id, @tenantId, @branchId, @code, @name, @accountType, @accountSubType, @normalBalance, 1)
  `);
  for (const [code, name, accountType, accountSubType, normalBalance] of accounts) {
    stmt.run({
      id: `coa_${tenantId}_${branchId || "tenant"}_${code}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      tenantId,
      branchId,
      code,
      name,
      accountType,
      accountSubType,
      normalBalance
    });
  }
}
