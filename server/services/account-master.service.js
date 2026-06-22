import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import {
  assertBranch,
  auditDecision,
  branchFrom,
  emitEvent,
  makeId,
  now,
  number,
  requireManager,
  requireTenant
} from "./enterprise-command-utils.js";
import { seedDefaultAccountGroups } from "./account-master-schema.service.js";

const ACCOUNT_COLUMNS = {
  branchId: "branch_id",
  accountCode: "account_code",
  accountName: "account_name",
  shortName: "short_name",
  groupId: "group_id",
  groupName: "group_name",
  openingBalance: "opening_balance",
  openingBalanceType: "opening_balance_type",
  isHidden: "is_hidden",
  igstPct: "igst_pct",
  gstPct: "gst_pct",
  utgstPct: "utgst_pct",
  hsnSacCode: "hsn_sac_code",
  hsnSacDescription: "hsn_sac_description",
  description: "description",
  contactPerson: "contact_person",
  mobile: "mobile",
  phone: "phone",
  fax: "fax",
  addressLine1: "address_line1",
  addressLine2: "address_line2",
  addressLine3: "address_line3",
  landmark: "landmark",
  city: "city",
  pin: "pin",
  state: "state",
  country: "country",
  area: "area",
  email: "email",
  web: "web",
  gstin: "gstin",
  panNo: "pan_no",
  vatNo: "vat_no",
  cstNo: "cst_no",
  tinNo: "tin_no",
  status: "status",
  notes: "notes"
};

export const accountMasterService = {
  overview(query = {}, access) {
    const accounts = this.accounts(query, access);
    const groups = this.groups(query, access);
    return {
      metrics: {
        totalAccounts: accounts.length,
        visibleAccounts: accounts.filter((account) => !account.isHidden && account.status !== "deleted").length,
        hiddenAccounts: accounts.filter((account) => account.isHidden).length,
        groups: groups.length,
        gstReady: accounts.filter((account) => account.gstin || account.panNo).length
      },
      groups,
      accounts
    };
  },

  groups(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    seedDefaultAccountGroups(access.tenantId, branchId || "");
    const filters = ["tenant_id = @tenant_id", "branch_id = @branch_id"];
    if (query.includeHidden !== "true" && query.includeHidden !== true) filters.push("is_active = 1");
    return db.prepare(`
      SELECT * FROM account_master_groups
      WHERE ${filters.join(" AND ")}
      ORDER BY sort_order, group_name
    `).all({ tenant_id: access.tenantId, branch_id: branchId || "" }).map(mapGroup);
  },

  createGroup(payload = {}, access) {
    requireManager(access);
    const group = normalizeGroupPayload(payload, access);
    assertUniqueGroupName(access.tenantId, group.branch_id, group.group_name);
    const row = {
      id: makeId("acctgrp"),
      tenant_id: access.tenantId,
      created_at: now(),
      updated_at: now(),
      version: 1,
      ...group
    };
    db.prepare(`
      INSERT INTO account_master_groups
        (${Object.keys(row).join(", ")})
      VALUES
        (${Object.keys(row).map((key) => `@${key}`).join(", ")})
    `).run(row);
    const created = this.group(row.id, access);
    auditDecision("account_group.created", "account_master_groups", created.id, access, { branchId: created.branchId, details: { groupName: created.groupName } });
    emitEvent("account_group:created", access, created.branchId, created.id, { groupName: created.groupName });
    return created;
  },

  updateGroup(id, payload = {}, access) {
    requireManager(access);
    const existing = this.findGroup(id, access);
    const group = normalizeGroupPayload(payload, access, existing);
    if (group.group_name && group.group_name !== existing.group_name) {
      assertUniqueGroupName(access.tenantId, group.branch_id || existing.branch_id || "", group.group_name, id);
    }
    const row = {
      ...group,
      updated_at: now(),
      version: number(existing.version, 1) + 1
    };
    db.prepare(`
      UPDATE account_master_groups
      SET ${Object.keys(row).map((key) => `${key} = @${key}`).join(", ")}
      WHERE id = @id AND tenant_id = @tenant_id
    `).run({ ...row, id, tenant_id: access.tenantId });
    if (row.group_name) {
      db.prepare(`
        UPDATE account_masters
        SET group_name = @group_name, updated_at = @updated_at, version = COALESCE(version, 1) + 1
        WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND group_id = @group_id
      `).run({
        tenant_id: access.tenantId,
        branch_id: row.branch_id || existing.branch_id || "",
        group_id: id,
        group_name: row.group_name,
        updated_at: row.updated_at
      });
    }
    const updated = this.group(id, access);
    auditDecision("account_group.updated", "account_master_groups", id, access, { branchId: updated.branchId, details: { before: mapGroup(existing), after: payload } });
    emitEvent("account_group:updated", access, updated.branchId, id, { groupName: updated.groupName });
    return updated;
  },

  deleteGroup(id, access) {
    requireManager(access);
    const existing = this.findGroup(id, access);
    db.prepare(`
      UPDATE account_master_groups
      SET is_active = 0, updated_at = @updated_at, version = COALESCE(version, 1) + 1
      WHERE id = @id AND tenant_id = @tenant_id
    `).run({ id, tenant_id: access.tenantId, updated_at: now() });
    auditDecision("account_group.deleted", "account_master_groups", id, access, { branchId: existing.branch_id || "", details: { groupName: existing.group_name } });
    emitEvent("account_group:deleted", access, existing.branch_id || "", id, { groupName: existing.group_name });
    return { id, deleted: true };
  },

  restoreDefaultGroups(query = {}, access) {
    requireManager(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    seedDefaultAccountGroups(access.tenantId, branchId || "");
    db.prepare(`
      UPDATE account_master_groups
      SET is_active = 1, updated_at = @updated_at, version = COALESCE(version, 1) + 1
      WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND system_group = 1
    `).run({ tenant_id: access.tenantId, branch_id: branchId || "", updated_at: now() });
    const groups = this.groups({ branchId: branchId || "", includeHidden: true }, access);
    auditDecision("account_group.restored_defaults", "account_master_groups", "defaults", access, { branchId: branchId || "", details: { count: groups.length } });
    emitEvent("account_group:restored_defaults", access, branchId || "", "defaults", { count: groups.length });
    return groups;
  },

  group(id, access) {
    return mapGroup(this.findGroup(id, access));
  },

  accounts(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = {
      tenant_id: access.tenantId,
      branch_id: branchId || "",
      search: `%${String(query.search || "").trim().toLowerCase()}%`,
      limit: Math.max(1, Math.min(number(query.limit, 500), 1000))
    };
    const filters = ["tenant_id = @tenant_id", "branch_id = @branch_id"];
    if (query.includeHidden !== "true" && query.includeHidden !== true) filters.push("status != 'deleted'");
    if (query.search) {
      filters.push(`(
        LOWER(account_name) LIKE @search OR LOWER(group_name) LIKE @search OR LOWER(short_name) LIKE @search OR
        LOWER(contact_person) LIKE @search OR LOWER(mobile) LIKE @search OR LOWER(gstin) LIKE @search OR LOWER(pan_no) LIKE @search
      )`);
    }
    return db.prepare(`
      SELECT * FROM account_masters
      WHERE ${filters.join(" AND ")}
      ORDER BY account_name
      LIMIT @limit
    `).all(params).map(mapAccount);
  },

  account(id, access) {
    const row = this.find(id, access);
    return mapAccount(row);
  },

  createAccount(payload = {}, access) {
    requireManager(access);
    const normalized = normalizePayload(payload, access);
    const row = {
      id: makeId("acct"),
      tenant_id: access.tenantId,
      created_by: access.userId || "",
      updated_by: access.userId || "",
      created_at: now(),
      updated_at: now(),
      version: 1,
      ...normalized
    };
    assertUniqueName(row.tenant_id, row.branch_id, row.account_name);
    db.prepare(`
      INSERT INTO account_masters
        (${Object.keys(row).join(", ")})
      VALUES
        (${Object.keys(row).map((key) => `@${key}`).join(", ")})
    `).run(row);
    const created = this.account(row.id, access);
    auditDecision("account_master.created", "account_masters", created.id, access, { branchId: created.branchId, details: { accountName: created.accountName, groupName: created.groupName } });
    emitEvent("account_master:created", access, created.branchId, created.id, { accountName: created.accountName });
    return created;
  },

  updateAccount(id, payload = {}, access) {
    requireManager(access);
    const existing = this.find(id, access);
    const normalized = normalizePayload(payload, access, existing);
    if (normalized.account_name && normalized.account_name !== existing.account_name) {
      assertUniqueName(access.tenantId, normalized.branch_id || existing.branch_id || "", normalized.account_name, id);
    }
    const row = {
      ...normalized,
      updated_by: access.userId || "",
      updated_at: now(),
      version: number(existing.version, 1) + 1
    };
    const keys = Object.keys(row);
    if (!keys.length) return mapAccount(existing);
    db.prepare(`
      UPDATE account_masters
      SET ${keys.map((key) => `${key} = @${key}`).join(", ")}
      WHERE id = @id AND tenant_id = @tenant_id
    `).run({ ...row, id, tenant_id: access.tenantId });
    const updated = this.account(id, access);
    auditDecision("account_master.updated", "account_masters", id, access, { branchId: updated.branchId, details: { before: mapAccount(existing), after: payload } });
    emitEvent("account_master:updated", access, updated.branchId, id, { accountName: updated.accountName });
    return updated;
  },

  deleteAccount(id, access) {
    requireManager(access);
    const existing = this.find(id, access);
    db.prepare(`
      UPDATE account_masters
      SET status = 'deleted', is_hidden = 1, updated_by = @updated_by, updated_at = @updated_at, version = COALESCE(version, 1) + 1
      WHERE id = @id AND tenant_id = @tenant_id
    `).run({ id, tenant_id: access.tenantId, updated_by: access.userId || "", updated_at: now() });
    auditDecision("account_master.deleted", "account_masters", id, access, { branchId: existing.branch_id || "", details: { accountName: existing.account_name } });
    emitEvent("account_master:deleted", access, existing.branch_id || "", id, { accountName: existing.account_name });
    return { id, deleted: true };
  },

  ledger(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const accounts = this.accounts({ branchId: branchId || "", limit: 1000 }, access);
    const requestedAccountId = clean(query.accountId || query.account_id || accounts[0]?.id || "");
    const accountRow = requestedAccountId ? this.find(requestedAccountId, access) : null;
    const fromDate = dateOnly(query.from || query.fromDate || fiscalYearStart());
    const toDate = dateOnly(query.to || query.toDate || now().slice(0, 10));
    const ledgerBranchId = accountRow ? accountRow.branch_id || branchId || "" : branchId || "";
    const storedRows = accountRow
      ? db.prepare(`
          SELECT * FROM account_ledger_entries
          WHERE tenant_id = @tenant_id
            AND branch_id = @branch_id
            AND account_id = @account_id
            AND date(doc_date) >= date(@from_date)
            AND date(doc_date) <= date(@to_date)
          ORDER BY doc_date, created_at, id
        `).all({
          tenant_id: access.tenantId,
          branch_id: ledgerBranchId,
          account_id: accountRow.id,
          from_date: fromDate,
          to_date: toDate
        })
      : [];
    const rows = accountRow
      ? [...storedRows, ...outgoingFundLedgerRows(accountRow, { access, branchId: ledgerBranchId, fromDate, toDate, storedRows })].sort(compareLedgerRows)
      : [];
    const openingAmount = accountRow ? money(accountRow.opening_balance) : 0;
    const openingType = accountRow?.opening_balance_type === "Cr" ? "Cr" : "Dr";
    let runningBalance = openingType === "Cr" ? -openingAmount : openingAmount;
    const entries = rows.map((row) => {
      runningBalance += money(row.debit) - money(row.credit);
      return mapLedgerEntry(row, runningBalance);
    });
    const totalDebit = entries.reduce((sum, entry) => sum + number(entry.debit), 0);
    const totalCredit = entries.reduce((sum, entry) => sum + number(entry.credit), 0);
    return {
      dateRange: { from: fromDate, to: toDate },
      accounts,
      selectedAccount: accountRow ? mapAccount(accountRow) : null,
      openingBalance: {
        amount: openingAmount,
        type: openingType,
        signedAmount: openingType === "Cr" ? -openingAmount : openingAmount,
        display: `${openingAmount.toFixed(2)} ${openingType}.`
      },
      entries,
      totals: {
        debit: totalDebit,
        credit: totalCredit,
        balance: runningBalance
      }
    };
  },

  find(id, access) {
    requireTenant(access);
    const row = db.prepare("SELECT * FROM account_masters WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Account master record not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return row;
  },

  findGroup(id, access) {
    requireTenant(access);
    const row = db.prepare("SELECT * FROM account_master_groups WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Account group not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return row;
  }
};

function normalizeGroupPayload(payload = {}, access, existing = {}) {
  const branchId = payload.branchId ?? payload.branch_id ?? existing.branch_id ?? branchFrom(payload, access) ?? "";
  if (branchId) assertBranch(access, branchId);
  const groupName = clean(payload.groupName ?? payload.group_name ?? existing.group_name);
  if (!groupName) throw badRequest("Account group name is required");
  const accountType = clean(payload.accountType ?? payload.account_type ?? existing.account_type) || "asset";
  const normalBalance = ["Cr", "cr", "credit"].includes(String(payload.normalBalance ?? payload.normal_balance ?? existing.normal_balance)) ? "Cr" : "Dr";
  const isHidden = truthy(payload.isHidden ?? payload.is_hidden) || payload.isActive === false || payload.is_active === 0 || payload.is_active === "0";
  return {
    branch_id: branchId || "",
    group_code: slug(payload.groupCode ?? payload.group_code ?? existing.group_code ?? groupName),
    group_name: groupName,
    parent_group_id: clean(payload.parentGroupId ?? payload.parent_group_id ?? existing.parent_group_id),
    account_type: accountType,
    normal_balance: normalBalance,
    system_group: truthy(existing.system_group) ? 1 : truthy(payload.systemGroup ?? payload.system_group) ? 1 : 0,
    is_active: isHidden ? 0 : 1,
    sort_order: number(payload.sortOrder ?? payload.sort_order ?? existing.sort_order, 500)
  };
}

function normalizePayload(payload = {}, access, existing = {}) {
  const branchId = payload.branchId ?? payload.branch_id ?? existing.branch_id ?? branchFrom(payload, access) ?? "";
  if (branchId) assertBranch(access, branchId);
  const next = { branch_id: branchId || "" };
  for (const [inputKey, column] of Object.entries(ACCOUNT_COLUMNS)) {
    if (!(inputKey in payload)) continue;
    next[column] = payload[inputKey];
  }
  if (!String(next.account_name || existing.account_name || "").trim()) throw badRequest("Account name is required");
  next.account_name = clean(next.account_name ?? existing.account_name);
  next.short_name = clean(next.short_name ?? existing.short_name);
  next.group_id = clean(next.group_id ?? existing.group_id);
  next.group_name = resolveGroupName(next.group_id, clean(next.group_name ?? existing.group_name), access.tenantId, next.branch_id);
  next.account_code = clean(next.account_code ?? existing.account_code);
  next.opening_balance = money(next.opening_balance ?? existing.opening_balance);
  next.opening_balance_type = ["Cr", "cr", "credit"].includes(String(next.opening_balance_type ?? existing.opening_balance_type)) ? "Cr" : "Dr";
  next.is_hidden = truthy(next.is_hidden ?? existing.is_hidden) ? 1 : 0;
  next.igst_pct = money(next.igst_pct ?? existing.igst_pct);
  next.gst_pct = money(next.gst_pct ?? existing.gst_pct);
  next.utgst_pct = money(next.utgst_pct ?? existing.utgst_pct);
  next.country = clean(next.country ?? existing.country) || "India";
  next.status = clean(next.status ?? existing.status) || "active";
  return Object.fromEntries(Object.entries(next).filter(([, value]) => value !== undefined));
}

function resolveGroupName(groupId, fallback, tenantId, branchId) {
  if (!groupId) return fallback || "";
  const row = db.prepare("SELECT group_name FROM account_master_groups WHERE id = ? AND tenant_id = ? AND branch_id = ?").get(groupId, tenantId, branchId || "");
  return row?.group_name || fallback || "";
}

function assertUniqueName(tenantId, branchId, accountName, ignoreId = "") {
  const row = db.prepare(`
    SELECT id FROM account_masters
    WHERE tenant_id = ? AND branch_id = ? AND LOWER(account_name) = LOWER(?) AND id != ? AND status != 'deleted'
    LIMIT 1
  `).get(tenantId, branchId || "", accountName, ignoreId || "");
  if (row) throw badRequest("Account name already exists in this branch scope");
}

function assertUniqueGroupName(tenantId, branchId, groupName, ignoreId = "") {
  const row = db.prepare(`
    SELECT id FROM account_master_groups
    WHERE tenant_id = ? AND branch_id = ? AND LOWER(group_name) = LOWER(?) AND id != ?
    LIMIT 1
  `).get(tenantId, branchId || "", groupName, ignoreId || "");
  if (row) throw badRequest("Account group already exists in this branch scope");
}

function mapLedgerEntry(row = {}, balance = 0) {
  return {
    id: row.id,
    branch: row.branch_id || "HO",
    docDate: row.doc_date || "",
    type: row.entry_type || "",
    prefix: row.prefix || "",
    docNo: row.doc_no || "",
    sno: row.sno || "",
    billNumber: row.bill_number || "",
    billDate: row.bill_date || "",
    particular: row.particular || row.account_name || "",
    debit: number(row.debit),
    credit: number(row.credit),
    balance,
    paymode: row.paymode || "",
    chqNo: row.cheque_no || "",
    remarks: row.remarks || "",
    sourceModule: row.source_module || "",
    sourceId: row.source_id || ""
  };
}

function outgoingFundLedgerRows(accountRow = {}, { access = {}, branchId = "", fromDate = "", toDate = "", storedRows = [] } = {}) {
  const reportBranchId = branchId || accountRow.branch_id || "";
  const postedSourceIds = new Set(
    storedRows
      .filter((row) => row.source_module === "outgoing_fund_entries" && row.source_id)
      .map((row) => row.source_id)
  );
  const rows = db.prepare(`
    SELECT * FROM outgoing_fund_entries
    WHERE tenant_id = @tenant_id
      AND branch_id = @branch_id
      AND date(entry_date) >= date(@from_date)
      AND date(entry_date) <= date(@to_date)
      AND status NOT IN ('deleted', 'cancelled')
    ORDER BY entry_date, created_at, id
  `).all({
    tenant_id: access.tenantId,
    branch_id: reportBranchId,
    from_date: fromDate,
    to_date: toDate
  });
  return rows.flatMap((row) => {
    if (postedSourceIds.has(row.id)) return [];
    return outgoingFundRowsForAccount(row, accountRow);
  });
}

function outgoingFundRowsForAccount(row = {}, accountRow = {}) {
  const rows = [];
  if (matchesAccount(row.paid_from_account_id, row.paid_from_account_name, accountRow)) {
    rows.push(outgoingFundLedgerRow(row, {
      idSuffix: "from",
      sno: "1",
      particular: row.paid_to_account_name || row.payee_name || row.transaction_type || "Outgoing fund",
      debit: 0,
      credit: money(row.amount)
    }));
  }
  const items = parseJson(row.line_items_json, []);
  const lines = items.length ? items : [{
    sno: 1,
    type: row.transaction_type,
    accountId: row.paid_to_account_id,
    accountName: row.paid_to_account_name || row.payee_name,
    amount: row.amount,
    remarks: row.remarks
  }];
  for (const [index, line] of lines.entries()) {
    if (!matchesAccount(line.accountId ?? line.account_id, line.accountName ?? line.account_name, accountRow)) continue;
    rows.push(outgoingFundLedgerRow(row, {
      idSuffix: `line-${line.sno || index + 1}`,
      sno: String(line.sno || index + 1),
      entryType: line.type || row.transaction_type || "Outgoing",
      particular: line.accountName || line.account_name || row.paid_to_account_name || row.payee_name || "Outgoing fund",
      debit: money(line.amount),
      credit: 0,
      remarks: line.remarks || row.remarks || ""
    }));
  }
  return rows;
}

function outgoingFundLedgerRow(row = {}, patch = {}) {
  return {
    id: `outgoing:${row.id}:${patch.idSuffix || "row"}`,
    tenant_id: row.tenant_id,
    branch_id: row.branch_id || "",
    account_id: "",
    account_name: patch.particular || "",
    doc_date: dateOnly(row.entry_date),
    entry_type: patch.entryType || row.transaction_type || "Outgoing",
    prefix: "OG",
    doc_no: row.entry_no || row.id || "",
    sno: patch.sno || "",
    bill_number: row.reference_no || "",
    bill_date: row.cheque_date || row.entry_date || "",
    particular: patch.particular || row.paid_to_account_name || row.payee_name || "Outgoing fund",
    debit: money(patch.debit),
    credit: money(patch.credit),
    paymode: row.payment_mode || "",
    cheque_no: row.cheque_no || row.reference_no || "",
    remarks: patch.remarks || row.remarks || "",
    source_module: "outgoing_fund_entries",
    source_id: row.id || "",
    created_at: row.created_at || row.entry_date || ""
  };
}

function matchesAccount(accountId, accountName, accountRow = {}) {
  const targetId = clean(accountRow.id);
  const targetName = clean(accountRow.account_name).toLowerCase();
  const incomingId = clean(accountId);
  const incomingName = clean(accountName).toLowerCase();
  return (!!targetId && incomingId === targetId) || (!!targetName && incomingName === targetName);
}

function compareLedgerRows(left = {}, right = {}) {
  return String(left.doc_date || "").localeCompare(String(right.doc_date || ""))
    || String(left.created_at || "").localeCompare(String(right.created_at || ""))
    || String(left.id || "").localeCompare(String(right.id || ""));
}

function fiscalYearStart() {
  const today = new Date();
  const year = today.getMonth() >= 3 ? today.getFullYear() : today.getFullYear() - 1;
  return `${year}-04-01`;
}

function dateOnly(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return now().slice(0, 10);
  return parsed.toISOString().slice(0, 10);
}

function parseJson(value, fallback = []) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function mapGroup(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    groupCode: row.group_code,
    groupName: row.group_name,
    parentGroupId: row.parent_group_id || "",
    accountType: row.account_type || "",
    normalBalance: row.normal_balance || "Dr",
    systemGroup: Boolean(row.system_group),
    isActive: Boolean(row.is_active),
    isHidden: !Boolean(row.is_active),
    sortOrder: number(row.sort_order),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    version: number(row.version, 1)
  };
}

function mapAccount(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    accountCode: row.account_code || "",
    accountName: row.account_name || "",
    shortName: row.short_name || "",
    groupId: row.group_id || "",
    groupName: row.group_name || "",
    openingBalance: number(row.opening_balance),
    openingBalanceType: row.opening_balance_type || "Dr",
    isHidden: Boolean(row.is_hidden),
    igstPct: number(row.igst_pct),
    gstPct: number(row.gst_pct),
    utgstPct: number(row.utgst_pct),
    hsnSacCode: row.hsn_sac_code || "",
    hsnSacDescription: row.hsn_sac_description || "",
    description: row.description || "",
    contactPerson: row.contact_person || "",
    mobile: row.mobile || "",
    phone: row.phone || "",
    fax: row.fax || "",
    addressLine1: row.address_line1 || "",
    addressLine2: row.address_line2 || "",
    addressLine3: row.address_line3 || "",
    landmark: row.landmark || "",
    city: row.city || "",
    pin: row.pin || "",
    state: row.state || "",
    country: row.country || "India",
    area: row.area || "",
    email: row.email || "",
    web: row.web || "",
    gstin: row.gstin || "",
    panNo: row.pan_no || "",
    vatNo: row.vat_no || "",
    cstNo: row.cst_no || "",
    tinNo: row.tin_no || "",
    status: row.status || "active",
    notes: row.notes || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    version: number(row.version, 1)
  };
}

function clean(value) {
  return String(value ?? "").trim();
}

function slug(value) {
  return clean(value).toLowerCase().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "") || "group";
}

function money(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function truthy(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}
