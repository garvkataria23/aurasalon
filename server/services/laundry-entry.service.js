import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { assertBranch, branchFrom, makeId, now, number, requireManager, requireTenant } from "./enterprise-command-utils.js";

let schemaReady = false;

function ensureLaundrySchema() {
  if (schemaReady) return;
  db.exec(`
    CREATE TABLE IF NOT EXISTS laundryEntries (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      docNo TEXT NOT NULL,
      docDate TEXT NOT NULL,
      laundryAccountId TEXT NOT NULL,
      laundryAccountName TEXT NOT NULL,
      remarks TEXT DEFAULT '',
      regularTotalIn REAL DEFAULT 0,
      regularTotalOut REAL DEFAULT 0,
      rewashTotalIn REAL DEFAULT 0,
      rewashTotalOut REAL DEFAULT 0,
      totalAmountPaise INTEGER DEFAULT 0,
      createdBy TEXT DEFAULT '',
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP,
      version INTEGER DEFAULT 1,
      UNIQUE (tenantId, branchId, docNo)
    );

    CREATE TABLE IF NOT EXISTS laundryEntryLines (
      id TEXT PRIMARY KEY,
      tenantId TEXT NOT NULL,
      branchId TEXT NOT NULL DEFAULT '',
      entryId TEXT NOT NULL,
      productId TEXT DEFAULT '',
      productName TEXT NOT NULL,
      srNo INTEGER DEFAULT 0,
      regularOpening REAL DEFAULT 0,
      regularInQty REAL DEFAULT 0,
      regularOutQty REAL DEFAULT 0,
      ratePaise INTEGER DEFAULT 0,
      amountPaise INTEGER DEFAULT 0,
      rewashOpening REAL DEFAULT 0,
      rewashInQty REAL DEFAULT 0,
      rewashOutQty REAL DEFAULT 0,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    );

    CREATE INDEX IF NOT EXISTS idx_laundry_entries_scope
      ON laundryEntries (tenantId, branchId, docDate);

    CREATE INDEX IF NOT EXISTS idx_laundry_lines_entry
      ON laundryEntryLines (tenantId, branchId, entryId);
  `);
  schemaReady = true;
}

export const laundryEntryService = {
  context(query = {}, access = {}) {
    ensureLaundrySchema();
    requireTenant(access);
    const branchId = scopedBranch(query, access);
    return {
      nextDocNo: nextDocNo(access.tenantId, branchId),
      laundryAccounts: laundryAccounts(access.tenantId, branchId),
      products: products(access.tenantId, branchId),
      recentEntries: this.list({ branchId, limit: 10 }, access)
    };
  },

  list(query = {}, access = {}) {
    ensureLaundrySchema();
    requireTenant(access);
    const branchId = scopedBranch(query, access);
    const limit = Math.max(1, Math.min(number(query.limit, 50), 200));
    const rows = db.prepare(`
      SELECT * FROM laundryEntries
      WHERE tenantId = @tenantId AND branchId = @branchId
      ORDER BY date(docDate) DESC, docNo DESC
      LIMIT @limit
    `).all({ tenantId: access.tenantId, branchId, limit });
    return rows.map(mapEntry);
  },

  detail(id, access = {}) {
    ensureLaundrySchema();
    requireTenant(access);
    const entry = db.prepare(`
      SELECT * FROM laundryEntries
      WHERE tenantId = @tenantId AND id = @id
      LIMIT 1
    `).get({ tenantId: access.tenantId, id: clean(id) });
    if (!entry) throw badRequest("Laundry entry not found");
    if (entry.branchId) assertBranch(access, entry.branchId);
    const lines = db.prepare(`
      SELECT * FROM laundryEntryLines
      WHERE tenantId = @tenantId AND branchId = @branchId AND entryId = @entryId
      ORDER BY srNo, productName
    `).all({ tenantId: access.tenantId, branchId: entry.branchId || "", entryId: entry.id });
    return { entry: mapEntry(entry), lines: lines.map(mapLine) };
  },

  create(payload = {}, access = {}) {
    ensureLaundrySchema();
    requireManager(access);
    const branchId = scopedBranch(payload, access);
    const docDate = dateOnly(payload.docDate || payload.doc_date || now().slice(0, 10));
    const account = laundryAccount(access.tenantId, branchId, payload.laundryAccountId || payload.laundry_account_id);
    if (!account) throw badRequest("Laundry account is required");
    const rawLines = Array.isArray(payload.lines) ? payload.lines : [];
    if (!rawLines.length) throw badRequest("At least one laundry product row is required");

    const entryId = makeId("laundry");
    const docNo = clean(payload.docNo || payload.doc_no) || nextDocNo(access.tenantId, branchId);
    const lines = rawLines.map((line, index) => normalizeLine(line, index + 1, { tenantId: access.tenantId, branchId, entryId }));
    const totals = lineTotals(lines);
    const stamp = now();
    const entry = {
      id: entryId,
      tenantId: access.tenantId,
      branchId,
      docNo,
      docDate,
      laundryAccountId: account.id,
      laundryAccountName: account.account_name,
      remarks: clean(payload.remarks),
      regularTotalIn: totals.regularTotalIn,
      regularTotalOut: totals.regularTotalOut,
      rewashTotalIn: totals.rewashTotalIn,
      rewashTotalOut: totals.rewashTotalOut,
      totalAmountPaise: totals.totalAmountPaise,
      createdBy: access.userId || "",
      createdAt: stamp,
      updatedAt: stamp,
      version: 1
    };
    db.prepare(`
      INSERT INTO laundryEntries
        (id, tenantId, branchId, docNo, docDate, laundryAccountId, laundryAccountName, remarks,
         regularTotalIn, regularTotalOut, rewashTotalIn, rewashTotalOut, totalAmountPaise, createdBy, createdAt, updatedAt, version)
      VALUES
        (@id, @tenantId, @branchId, @docNo, @docDate, @laundryAccountId, @laundryAccountName, @remarks,
         @regularTotalIn, @regularTotalOut, @rewashTotalIn, @rewashTotalOut, @totalAmountPaise, @createdBy, @createdAt, @updatedAt, @version)
    `).run(entry);

    const lineStmt = db.prepare(`
      INSERT INTO laundryEntryLines
        (id, tenantId, branchId, entryId, productId, productName, srNo, regularOpening, regularInQty, regularOutQty,
         ratePaise, amountPaise, rewashOpening, rewashInQty, rewashOutQty, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @entryId, @productId, @productName, @srNo, @regularOpening, @regularInQty, @regularOutQty,
         @ratePaise, @amountPaise, @rewashOpening, @rewashInQty, @rewashOutQty, @createdAt, @updatedAt)
    `);
    for (const line of lines) lineStmt.run({ ...line, createdAt: stamp, updatedAt: stamp });
    return { entry: mapEntry(entry), lines: lines.map(mapLine), nextDocNo: nextDocNo(access.tenantId, branchId) };
  }
};

function scopedBranch(source = {}, access = {}) {
  const branchId = branchFrom(source, access) || "";
  if (branchId) assertBranch(access, branchId);
  return branchId;
}

function laundryAccounts(tenantId, branchId) {
  return db.prepare(`
    SELECT id, account_name, group_name, short_name
    FROM account_masters
    WHERE tenant_id = @tenantId
      AND branch_id = @branchId
      AND COALESCE(is_laundry, 0) = 1
      AND status != 'deleted'
    ORDER BY account_name
  `).all({ tenantId, branchId }).map((row) => ({
    id: row.id,
    accountName: row.account_name,
    groupName: row.group_name || "",
    shortName: row.short_name || ""
  }));
}

function laundryAccount(tenantId, branchId, accountId) {
  const id = clean(accountId);
  if (!id) return null;
  return db.prepare(`
    SELECT id, account_name
    FROM account_masters
    WHERE tenant_id = @tenantId
      AND branch_id = @branchId
      AND id = @id
      AND COALESCE(is_laundry, 0) = 1
      AND status != 'deleted'
    LIMIT 1
  `).get({ tenantId, branchId, id });
}

function products(tenantId, branchId) {
  return db.prepare(`
    SELECT *
    FROM products
    WHERE tenantId = @tenantId
      AND (@branchId = '' OR branchId = @branchId OR branchId = '')
    ORDER BY name
    LIMIT 300
  `).all({ tenantId, branchId }).map((row, index) => ({
    id: row.id,
    name: row.name || row.productName || row.sku || `Product ${index + 1}`,
    sku: row.sku || "",
    stock: number(row.stock, 0),
    rate: number(row.laundryRate ?? row.unitCost ?? row.costPrice ?? row.price ?? row.sellingPrice, 0)
  }));
}

function nextDocNo(tenantId, branchId) {
  const row = db.prepare(`
    SELECT MAX(CAST(docNo AS INTEGER)) AS lastNo
    FROM laundryEntries
    WHERE tenantId = @tenantId AND branchId = @branchId
  `).get({ tenantId, branchId });
  return String(number(row?.lastNo, 0) + 1).padStart(8, "0");
}

function normalizeLine(line = {}, srNo, scope) {
  return {
    id: makeId("laundryline"),
    ...scope,
    productId: clean(line.productId),
    productName: clean(line.productName) || "Laundry item",
    srNo: number(line.srNo, srNo),
    regularOpening: qty(line.regularOpening),
    regularInQty: qty(line.regularInQty),
    regularOutQty: qty(line.regularOutQty),
    ratePaise: paise(line.rate),
    amountPaise: paise(line.amount),
    rewashOpening: qty(line.rewashOpening),
    rewashInQty: qty(line.rewashInQty),
    rewashOutQty: qty(line.rewashOutQty)
  };
}

function lineTotals(lines) {
  return lines.reduce((total, line) => ({
    regularTotalIn: total.regularTotalIn + line.regularInQty,
    regularTotalOut: total.regularTotalOut + line.regularOutQty,
    rewashTotalIn: total.rewashTotalIn + line.rewashInQty,
    rewashTotalOut: total.rewashTotalOut + line.rewashOutQty,
    totalAmountPaise: total.totalAmountPaise + line.amountPaise
  }), { regularTotalIn: 0, regularTotalOut: 0, rewashTotalIn: 0, rewashTotalOut: 0, totalAmountPaise: 0 });
}

function mapEntry(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId || "",
    docNo: row.docNo,
    docDate: row.docDate,
    laundryAccountId: row.laundryAccountId,
    laundryAccountName: row.laundryAccountName,
    remarks: row.remarks || "",
    regularTotalIn: number(row.regularTotalIn, 0),
    regularTotalOut: number(row.regularTotalOut, 0),
    rewashTotalIn: number(row.rewashTotalIn, 0),
    rewashTotalOut: number(row.rewashTotalOut, 0),
    totalAmount: number(row.totalAmountPaise, 0) / 100,
    createdAt: row.createdAt || ""
  };
}

function mapLine(row = {}) {
  return {
    id: row.id,
    productId: row.productId || "",
    productName: row.productName || "",
    srNo: number(row.srNo, 0),
    regularOpening: number(row.regularOpening, 0),
    regularInQty: number(row.regularInQty, 0),
    regularOutQty: number(row.regularOutQty, 0),
    rate: number(row.ratePaise, 0) / 100,
    amount: number(row.amountPaise, 0) / 100,
    rewashOpening: number(row.rewashOpening, 0),
    rewashInQty: number(row.rewashInQty, 0),
    rewashOutQty: number(row.rewashOutQty, 0)
  };
}

function dateOnly(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return now().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function qty(value) {
  return Math.max(0, number(value, 0));
}

function paise(value) {
  return Math.max(0, Math.round(number(value, 0) * 100));
}

function clean(value) {
  return String(value ?? "").trim();
}
