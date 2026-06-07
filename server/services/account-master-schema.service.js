import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../db.js";

let ensured = false;

export function ensureAccountMasterSchema() {
  if (ensured) return;
  const root = join(dirname(fileURLToPath(import.meta.url)), "..", "..");
  const migration = readFileSync(join(root, "server", "db", "migrations", "20260526_account_master.sql"), "utf8");
  db.exec(migration);
  seedDefaultAccountGroups("tenant_aura", "");
  ensured = true;
}

export function seedDefaultAccountGroups(tenantId, branchId = "") {
  const rows = [
    ["academy", "ACADEMY", "income", "Cr", 10],
    ["vendors_suppliers", "VENDORS (SUPP)", "liability", "Cr", 20],
    ["bank", "BANK", "asset", "Dr", 30],
    ["cash_account", "CASH ACCOUNT", "asset", "Dr", 40],
    ["expense", "EXPENSE", "expense", "Dr", 50],
    ["income", "INCOME", "income", "Cr", 60],
    ["customers", "CUSTOMERS", "asset", "Dr", 70],
    ["duties_taxes", "DUTIES & TAXES", "liability", "Cr", 80],
    ["capital", "CAPITAL ACCOUNT", "equity", "Cr", 90],
    ["loans", "LOANS", "liability", "Cr", 100],
    ["fixed_assets", "FIXED ASSETS", "asset", "Dr", 110],
    ["current_assets", "CURRENT ASSETS", "asset", "Dr", 120],
    ["current_liabilities", "CURRENT LIABILITIES", "liability", "Cr", 130]
  ];

  const stmt = db.prepare(`
    INSERT OR IGNORE INTO account_master_groups
      (id, tenant_id, branch_id, group_code, group_name, account_type, normal_balance, system_group, sort_order, updated_at)
    VALUES
      (@id, @tenant_id, @branch_id, @group_code, @group_name, @account_type, @normal_balance, 1, @sort_order, CURRENT_TIMESTAMP)
  `);

  for (const [group_code, group_name, account_type, normal_balance, sort_order] of rows) {
    stmt.run({
      id: `acctgrp_${tenantId}_${branchId || "tenant"}_${group_code}`.replace(/[^a-zA-Z0-9_]/g, "_"),
      tenant_id: tenantId,
      branch_id: branchId || "",
      group_code,
      group_name,
      account_type,
      normal_balance,
      sort_order
    });
  }
}
