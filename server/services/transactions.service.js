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
import { balanceSheetHardeningService } from "./balance-sheet-hardening.service.js";
import { ensureHardeningSchema } from "./balance-sheet-hardening-schema.service.js";
import { classifySalonOutgoing } from "./salon-outgoing-category.service.js";

const OUTGOING_COLUMNS = {
  branchId: "branch_id",
  entryNo: "entry_no",
  entryDate: "entry_date",
  expenseBranchId: "expense_branch_id",
  expenseBranchName: "expense_branch_name",
  paidFromAccountId: "paid_from_account_id",
  paidFromAccountName: "paid_from_account_name",
  paidToAccountId: "paid_to_account_id",
  paidToAccountName: "paid_to_account_name",
  payeeName: "payee_name",
  amount: "amount",
  paymentMode: "payment_mode",
  chequeDate: "cheque_date",
  referenceNo: "reference_no",
  chequeNo: "cheque_no",
  transactionType: "transaction_type",
  salaryMonthYear: "salary_month_year",
  lineItemsJson: "line_items_json",
  gstAmount: "gst_amount",
  billUrl: "bill_url",
  impactType: "impact_type",
  linkedPartyType: "linked_party_type",
  linkedPartyId: "linked_party_id",
  linkedPartyName: "linked_party_name",
  approvalStatus: "approval_status",
  approvedBy: "approved_by",
  approvedAt: "approved_at",
  remarks: "remarks",
  status: "status",
  postedToLedger: "posted_to_ledger"
};

const OUTGOING_SCHEMA_COLUMNS = {
  gst_amount: "REAL DEFAULT 0",
  bill_url: "TEXT DEFAULT ''",
  impact_type: "TEXT DEFAULT ''",
  linked_party_type: "TEXT DEFAULT 'none'",
  linked_party_id: "TEXT DEFAULT ''",
  linked_party_name: "TEXT DEFAULT ''",
  approval_status: "TEXT DEFAULT 'pending'",
  approved_by: "TEXT DEFAULT ''",
  approved_at: "TEXT DEFAULT ''"
};

let outgoingFundSchemaReady = false;

export const transactionsService = {
  outgoingFunds(query = {}, access) {
    requireTenant(access);
    ensureOutgoingFundSchema();
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = {
      tenant_id: access.tenantId,
      branch_id: branchId || "",
      search: `%${String(query.search || "").trim().toLowerCase()}%`,
      limit: Math.max(1, Math.min(number(query.limit, 250), 500))
    };
    const filters = ["tenant_id = @tenant_id", "branch_id = @branch_id", "status != 'deleted'"];
    if (query.status) filters.push("status = @status");
    if (query.search) {
      filters.push(`(
        LOWER(entry_no) LIKE @search OR LOWER(paid_from_account_name) LIKE @search OR LOWER(paid_to_account_name) LIKE @search OR
        LOWER(payee_name) LIKE @search OR LOWER(payment_mode) LIKE @search OR LOWER(transaction_type) LIKE @search OR
        LOWER(reference_no) LIKE @search OR LOWER(cheque_no) LIKE @search OR LOWER(remarks) LIKE @search
      )`);
    }
    return db.prepare(`
      SELECT * FROM outgoing_fund_entries
      WHERE ${filters.join(" AND ")}
      ORDER BY entry_date DESC, created_at DESC
      LIMIT @limit
    `).all({ ...params, status: clean(query.status) }).map((row) => mapOutgoingFund(row, access));
  },

  outgoingFund(id, access) {
    return mapOutgoingFund(this.findOutgoingFund(id, access), access);
  },

  createOutgoingFund(payload = {}, access) {
    requireManager(access);
    ensureOutgoingFundSchema();
    const normalized = normalizeOutgoingFund(payload, access);
    const row = {
      id: makeId("ofe"),
      tenant_id: access.tenantId,
      entry_no: clean(payload.entryNo || payload.entry_no) || makeEntryNo(),
      created_by: access.userId || "",
      updated_by: access.userId || "",
      created_at: now(),
      updated_at: now(),
      version: 1,
      ...normalized
    };
    db.prepare(`
      INSERT INTO outgoing_fund_entries
        (${Object.keys(row).join(", ")})
      VALUES
        (${Object.keys(row).map((key) => `@${key}`).join(", ")})
    `).run(row);
    const created = this.outgoingFund(row.id, access);
    const balanceSheetLink = queueOutgoingFundToBalanceSheet(created, access);
    auditDecision("outgoing_fund.created", "outgoing_fund_entries", created.id, access, { branchId: created.branchId, details: created });
    emitEvent("transaction:outgoing_fund_created", access, created.branchId, created.id, { amount: created.amount, paymentMode: created.paymentMode, balanceSheetStatus: balanceSheetLink.status });
    return { ...created, balanceSheetLink };
  },

  updateOutgoingFund(id, payload = {}, access) {
    requireManager(access);
    ensureOutgoingFundSchema();
    const existing = this.findOutgoingFund(id, access);
    const normalized = normalizeOutgoingFund(payload, access, existing);
    const row = {
      ...normalized,
      updated_by: access.userId || "",
      updated_at: now(),
      version: number(existing.version, 1) + 1
    };
    db.prepare(`
      UPDATE outgoing_fund_entries
      SET ${Object.keys(row).map((key) => `${key} = @${key}`).join(", ")}
      WHERE id = @id AND tenant_id = @tenant_id
    `).run({ ...row, id, tenant_id: access.tenantId });
    const updated = this.outgoingFund(id, access);
    const balanceSheetLink = queueOutgoingFundToBalanceSheet(updated, access);
    auditDecision("outgoing_fund.updated", "outgoing_fund_entries", id, access, { branchId: updated.branchId, details: { before: mapOutgoingFund(existing, access), after: payload } });
    emitEvent("transaction:outgoing_fund_updated", access, updated.branchId, id, { amount: updated.amount, status: updated.status, balanceSheetStatus: balanceSheetLink.status });
    return { ...updated, balanceSheetLink };
  },

  deleteOutgoingFund(id, access) {
    requireManager(access);
    const existing = this.findOutgoingFund(id, access);
    db.prepare(`
      UPDATE outgoing_fund_entries
      SET status = 'deleted', updated_by = @updated_by, updated_at = @updated_at, version = COALESCE(version, 1) + 1
      WHERE id = @id AND tenant_id = @tenant_id
    `).run({ id, tenant_id: access.tenantId, updated_by: access.userId || "", updated_at: now() });
    auditDecision("outgoing_fund.deleted", "outgoing_fund_entries", id, access, { branchId: existing.branch_id || "", details: { entryNo: existing.entry_no } });
    emitEvent("transaction:outgoing_fund_deleted", access, existing.branch_id || "", id, { entryNo: existing.entry_no });
    return { id, deleted: true };
  },

  findOutgoingFund(id, access) {
    requireTenant(access);
    ensureOutgoingFundSchema();
    const row = db.prepare("SELECT * FROM outgoing_fund_entries WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Outgoing fund entry not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return row;
  }
};

function normalizeOutgoingFund(payload = {}, access, existing = {}) {
  const branchId = payload.branchId ?? payload.branch_id ?? existing.branch_id ?? branchFrom(payload, access) ?? "";
  if (branchId) assertBranch(access, branchId);
  const next = { branch_id: branchId || "" };
  for (const [inputKey, column] of Object.entries(OUTGOING_COLUMNS)) {
    if (!(inputKey in payload)) continue;
    next[column] = payload[inputKey];
  }
  if (!dateOnly(next.entry_date ?? existing.entry_date)) throw badRequest("Entry date is required");
  next.entry_date = dateOnly(next.entry_date ?? existing.entry_date);
  const lineItems = normalizeLineItems(payload.lineItems ?? payload.line_items ?? parseJson(existing.line_items_json, []));
  if (lineItems.length) {
    next.amount = lineItems.reduce((sum, item) => sum + money(item.amount), 0);
    next.line_items_json = JSON.stringify(lineItems);
    next.transaction_type = clean(next.transaction_type ?? lineItems[0]?.type ?? existing.transaction_type) || "Daily Exp.";
    next.paid_to_account_id = clean(next.paid_to_account_id ?? lineItems[0]?.accountId ?? existing.paid_to_account_id);
    next.paid_to_account_name = clean(next.paid_to_account_name ?? lineItems[0]?.accountName ?? existing.paid_to_account_name);
    next.salary_month_year = clean(next.salary_month_year ?? lineItems[0]?.salaryMonthYear ?? existing.salary_month_year);
  } else {
    next.amount = money(next.amount ?? existing.amount);
    next.line_items_json = clean(next.line_items_json ?? existing.line_items_json);
  }
  if (next.amount <= 0) throw badRequest("Amount must be greater than zero");
  next.entry_no = clean(next.entry_no ?? existing.entry_no) || makeEntryNo();
  next.expense_branch_id = clean(next.expense_branch_id ?? existing.expense_branch_id ?? next.branch_id);
  next.expense_branch_name = clean(next.expense_branch_name ?? existing.expense_branch_name);
  next.paid_from_account_id = clean(next.paid_from_account_id ?? existing.paid_from_account_id);
  next.paid_from_account_name = clean(next.paid_from_account_name ?? existing.paid_from_account_name);
  next.paid_to_account_id = clean(next.paid_to_account_id ?? existing.paid_to_account_id);
  next.paid_to_account_name = clean(next.paid_to_account_name ?? existing.paid_to_account_name);
  next.payee_name = clean(next.payee_name ?? existing.payee_name);
  next.payment_mode = clean(next.payment_mode ?? existing.payment_mode) || "Cash";
  next.cheque_date = dateOnly(next.cheque_date ?? existing.cheque_date);
  next.reference_no = clean(next.reference_no ?? existing.reference_no);
  next.cheque_no = clean(next.cheque_no ?? existing.cheque_no);
  next.transaction_type = clean(next.transaction_type ?? existing.transaction_type) || "Daily Exp.";
  next.salary_month_year = clean(next.salary_month_year ?? existing.salary_month_year);
  next.remarks = clean(next.remarks ?? existing.remarks);
  const category = classifySalonOutgoing(next.transaction_type, next.paid_to_account_name, next.remarks);
  next.gst_amount = Math.min(next.amount, Math.max(0, money(next.gst_amount ?? existing.gst_amount)));
  next.bill_url = clean(next.bill_url ?? existing.bill_url);
  next.impact_type = normalizeImpactType(next.impact_type ?? existing.impact_type, category);
  next.linked_party_type = normalizeLinkedPartyType(next.linked_party_type ?? existing.linked_party_type);
  next.linked_party_id = clean(next.linked_party_id ?? existing.linked_party_id);
  next.linked_party_name = clean(next.linked_party_name ?? existing.linked_party_name);
  next.approval_status = normalizeApprovalStatus(next.approval_status ?? existing.approval_status);
  next.approved_by = clean(next.approved_by ?? existing.approved_by);
  next.approved_at = clean(next.approved_at ?? existing.approved_at);
  if (next.approval_status === "approved" && !next.approved_at) next.approved_at = now();
  if (next.approval_status !== "approved") {
    next.approved_by = "";
    next.approved_at = "";
  }
  next.status = ["draft", "posted", "cancelled", "deleted"].includes(clean(next.status ?? existing.status)) ? clean(next.status ?? existing.status) : "draft";
  next.posted_to_ledger = truthy(next.posted_to_ledger ?? existing.posted_to_ledger) ? 1 : 0;
  return next;
}

function mapOutgoingFund(row = {}, access = {}) {
  const balanceSheetLink = outgoingFundBalanceSheetLink(row, access);
  const approvalStatus = row.approval_status || "pending";
  const hasPartyLink = Boolean(row.linked_party_name || (row.linked_party_type && row.linked_party_type !== "none"));
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    entryNo: row.entry_no || "",
    entryDate: row.entry_date || "",
    expenseBranchId: row.expense_branch_id || "",
    expenseBranchName: row.expense_branch_name || "",
    paidFromAccountId: row.paid_from_account_id || "",
    paidFromAccountName: row.paid_from_account_name || "",
    paidToAccountId: row.paid_to_account_id || "",
    paidToAccountName: row.paid_to_account_name || "",
    payeeName: row.payee_name || "",
    amount: number(row.amount),
    gstAmount: number(row.gst_amount),
    netAmount: Math.max(0, number(row.amount) - number(row.gst_amount)),
    paymentMode: row.payment_mode || "",
    chequeDate: row.cheque_date || "",
    referenceNo: row.reference_no || "",
    chequeNo: row.cheque_no || "",
    transactionType: row.transaction_type || "",
    salaryMonthYear: row.salary_month_year || "",
    lineItems: parseJson(row.line_items_json, []).map(enrichOutgoingLineItem),
    billUrl: row.bill_url || "",
    impactType: row.impact_type || "",
    linkedPartyType: row.linked_party_type || "none",
    linkedPartyId: row.linked_party_id || "",
    linkedPartyName: row.linked_party_name || "",
    approvalStatus,
    approvedBy: row.approved_by || "",
    approvedAt: row.approved_at || "",
    remarks: row.remarks || "",
    status: row.status || "draft",
    postedToLedger: Boolean(row.posted_to_ledger),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || "",
    version: number(row.version, 1),
    balanceSheetLink,
    connectionStatus: {
      hasGst: number(row.gst_amount) > 0,
      hasBill: Boolean(row.bill_url),
      hasPartyLink,
      approved: ["approved", "not_required"].includes(approvalStatus),
      glStatus: balanceSheetLink.status || "not-linked"
    }
  };
}

function outgoingFundBalanceSheetLink(row = {}, access = {}) {
  if (!row.id || !access.tenantId) return { status: "not-linked" };
  ensureHardeningSchema();
  const eventKey = `outgoing-fund:${access.tenantId}:${row.id}`;
  const event = db.prepare(
    "SELECT eventKey, status, journalEntryId, lastError FROM glOutbox WHERE tenantId = ? AND eventKey = ?"
  ).get(access.tenantId, eventKey);
  if (!event) return { status: "not-linked", eventKey };
  return {
    status: event.status || "pending",
    eventKey: event.eventKey,
    journalEntryId: event.journalEntryId || "",
    lastError: event.lastError || ""
  };
}

function queueOutgoingFundToBalanceSheet(entry = {}, access = {}) {
  const amountPaise = Math.round(number(entry.amount) * 100);
  if (!entry.id || amountPaise <= 0 || entry.status === "cancelled" || entry.status === "deleted") {
    return { status: "skipped", reason: "not-postable" };
  }
  if (entry.approvalStatus === "rejected") {
    return { status: "skipped", reason: "approval-rejected" };
  }
  const category = categoryFromOutgoingType(entry.transactionType, entry.paidToAccountName);
  const mode = modeFromPayment(entry.paymentMode, entry.paidFromAccountName);
  const lineItems = outgoingGlLines(entry);
  const inputGstPaise = Math.min(amountPaise, Math.max(0, Math.round(number(entry.gstAmount) * 100)));
  const result = balanceSheetHardeningService.enqueue({
    branchId: entry.branchId || "",
    eventType: "expense.recorded",
    eventKey: `outgoing-fund:${access.tenantId}:${entry.id}`,
    businessDate: entry.entryDate,
    data: {
      amountPaise,
      inputGstPaise,
      category,
      mode,
      lineItems,
      settled: entry.status !== "draft",
      memo: `Outgoing fund ${entry.entryNo || entry.id}: ${entry.paidToAccountName || entry.transactionType || "expense"}`,
      source: "outgoing_fund_entries",
      sourceId: entry.id,
      entryNo: entry.entryNo,
      billUrl: entry.billUrl,
      impactType: entry.impactType,
      linkedPartyType: entry.linkedPartyType,
      linkedPartyId: entry.linkedPartyId,
      linkedPartyName: entry.linkedPartyName,
      approvalStatus: entry.approvalStatus,
      paymentMode: entry.paymentMode,
      paidFromAccountName: entry.paidFromAccountName,
      paidToAccountName: entry.paidToAccountName,
      remarks: entry.remarks
    }
  }, access);
  return {
    status: result.event?.status || (result.enqueued ? "pending" : "queued"),
    eventKey: result.event?.eventKey || "",
    journalEntryId: result.event?.journalEntryId || "",
    duplicate: result.duplicate
  };
}

function outgoingGlLines(entry = {}) {
  const items = Array.isArray(entry.lineItems) ? entry.lineItems : [];
  return items
    .map((item) => {
      const amountPaise = Math.round(number(item.amount) * 100);
      const category = classifySalonOutgoing(item.type, item.accountName, item.remarks);
      return {
        amountPaise,
        category: category.key,
        bucket: category.bucket,
        impact: category.impact,
        operating: category.operating,
        memo: clean(item.remarks || item.accountName || item.type)
      };
    })
    .filter((item) => item.amountPaise > 0);
}

function categoryFromOutgoingType(type = "", accountName = "", remarks = "") {
  return classifySalonOutgoing(type, accountName, remarks).key;
}

function modeFromPayment(paymentMode = "", accountName = "") {
  const text = `${paymentMode} ${accountName}`.toLowerCase();
  return text.includes("cash") ? "cash" : "bank";
}

function ensureOutgoingFundSchema() {
  if (outgoingFundSchemaReady) return;
  const existing = new Set(db.prepare("PRAGMA table_info(outgoing_fund_entries)").all().map((row) => row.name));
  for (const [column, definition] of Object.entries(OUTGOING_SCHEMA_COLUMNS)) {
    if (!existing.has(column)) {
      db.prepare(`ALTER TABLE outgoing_fund_entries ADD COLUMN ${column} ${definition}`).run();
    }
  }
  outgoingFundSchemaReady = true;
}

function makeEntryNo() {
  return `OF-${now().slice(0, 10).replace(/-/g, "")}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

function dateOnly(value) {
  const text = String(value || "").trim();
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function clean(value) {
  return String(value ?? "").trim();
}

function normalizeLineItems(items = []) {
  if (!Array.isArray(items)) return [];
  return items
    .map((item, index) => enrichOutgoingLineItem({
      sno: number(item.sno, index + 1),
      type: clean(item.type) || "Daily Exp.",
      accountId: clean(item.accountId ?? item.account_id),
      accountName: clean(item.accountName ?? item.account_name ?? item.particular),
      amount: money(item.amount),
      salaryMonthYear: clean(item.salaryMonthYear ?? item.salary_month_year),
      remarks: clean(item.remarks)
    }))
    .filter((item) => item.amount > 0 || item.accountName || item.remarks)
    .map((item, index) => ({ ...item, sno: index + 1 }));
}

function enrichOutgoingLineItem(item = {}) {
  const category = classifySalonOutgoing(item.type, item.accountName, item.remarks);
  return {
    ...item,
    category: category.key,
    categoryLabel: category.label,
    categoryBucket: category.bucket,
    balanceSheetImpact: category.impact,
    glCategory: category.glCategory,
    operating: category.operating
  };
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function money(value) {
  const parsed = Number(value ?? 0);
  return Number.isFinite(parsed) ? Math.round(parsed * 100) / 100 : 0;
}

function truthy(value) {
  return value === true || value === 1 || value === "1" || value === "true";
}

function normalizeImpactType(value, category = {}) {
  const cleanValue = clean(value).toLowerCase();
  const allowed = new Set(["expense", "inventory", "fixed_asset", "tax", "advance", "loan", "owner", "transfer", "other"]);
  if (allowed.has(cleanValue)) return cleanValue;
  if (category.operating) return "expense";
  if (["inventory_purchase", "product_consumable", "wastage_damage"].includes(category.key)) return "inventory";
  if (category.key === "fixed_asset_purchase") return "fixed_asset";
  if (["gst_payment", "statutory_payment"].includes(category.key)) return "tax";
  if (["advance", "security_deposit", "prepaid_expense"].includes(category.key)) return "advance";
  if (["loan", "interest"].includes(category.key)) return "loan";
  if (category.key === "owner_drawing") return "owner";
  if (category.key === "bank_deposit") return "transfer";
  return "other";
}

function normalizeLinkedPartyType(value) {
  const cleanValue = clean(value).toLowerCase();
  return ["none", "staff", "vendor", "customer", "asset", "loan", "owner", "other"].includes(cleanValue) ? cleanValue : "none";
}

function normalizeApprovalStatus(value) {
  const cleanValue = clean(value).toLowerCase();
  return ["pending", "approved", "rejected", "not_required"].includes(cleanValue) ? cleanValue : "pending";
}
