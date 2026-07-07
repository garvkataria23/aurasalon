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
import { ensurePettyCashSchema } from "./petty-cash-schema.service.js";

export const pettyCashService = {
  entries(query = {}, access) {
    requireTenant(access);
    ensurePettyCashSchema();
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = {
      tenantId: access.tenantId,
      branchId: branchId || "",
      dateFrom: dateOnly(query.dateFrom || query.fromDate),
      dateTo: dateOnly(query.dateTo || query.toDate),
      type: normalizeType(query.type, ""),
      category: clean(query.category),
      search: `%${clean(query.search).toLowerCase()}%`,
      limit: Math.max(1, Math.min(number(query.limit, 1000), 5000))
    };
    const filters = ["tenantId = @tenantId", "status != 'deleted'"];
    if (branchId) filters.push("branchId = @branchId");
    if (params.dateFrom) filters.push("docDate >= @dateFrom");
    if (params.dateTo) filters.push("docDate <= @dateTo");
    if (params.type) filters.push("type = @type");
    if (params.category) filters.push("category = @category");
    if (query.search) {
      filters.push(`(
        LOWER(docNo) LIKE @search OR LOWER(prefix) LIKE @search OR LOWER(billNumber) LIKE @search OR
        LOWER(particular) LIKE @search OR LOWER(paymode) LIKE @search OR LOWER(chequeNo) LIKE @search OR
        LOWER(remarks) LIKE @search
      )`);
    }
    const rows = db.prepare(`
      SELECT * FROM pettyCashEntries
      WHERE ${filters.join(" AND ")}
      ORDER BY docDate ASC, createdAt ASC
      LIMIT @limit
    `).all(params);
    return mapEntriesWithBalance(rows);
  },

  entry(id, access) {
    return mapEntry(this.findEntry(id, access));
  },

  createEntry(payload = {}, access) {
    requireManager(access);
    ensurePettyCashSchema();
    const normalized = normalizeEntry(payload, access);
    const row = {
      id: makeId("pc"),
      tenantId: access.tenantId,
      createdBy: access.userId || "",
      updatedBy: access.userId || "",
      createdAt: now(),
      updatedAt: now(),
      version: 1,
      ...normalized
    };
    row.ledgerEventKey = row.ledgerEventKey || `petty-cash:${access.tenantId}:${row.id}`;
    db.prepare(`
      INSERT INTO pettyCashEntries (${Object.keys(row).join(", ")})
      VALUES (${Object.keys(row).map((key) => `@${key}`).join(", ")})
    `).run(row);
    const created = this.entry(row.id, access);
    writeHistory("created", row.id, access, null, created);
    auditDecision("petty_cash.created", "pettyCashEntries", created.id, access, { branchId: created.branchId, details: created });
    emitEvent("transaction:petty_cash_created", access, created.branchId, created.id, { type: created.type, debitPaise: created.debitPaise, creditPaise: created.creditPaise });
    return created;
  },

  updateEntry(id, payload = {}, access) {
    requireManager(access);
    ensurePettyCashSchema();
    const existing = this.findEntry(id, access);
    const normalized = normalizeEntry(payload, access, existing);
    const row = {
      ...normalized,
      updatedBy: access.userId || "",
      updatedAt: now(),
      version: number(existing.version, 1) + 1
    };
    db.prepare(`
      UPDATE pettyCashEntries
      SET ${Object.keys(row).map((key) => `${key} = @${key}`).join(", ")}
      WHERE id = @id AND tenantId = @tenantId
    `).run({ ...row, id, tenantId: access.tenantId });
    const updated = this.entry(id, access);
    writeHistory("updated", id, access, mapEntry(existing), updated);
    auditDecision("petty_cash.updated", "pettyCashEntries", id, access, { branchId: updated.branchId, details: { before: mapEntry(existing), after: payload } });
    emitEvent("transaction:petty_cash_updated", access, updated.branchId, id, { type: updated.type, debitPaise: updated.debitPaise, creditPaise: updated.creditPaise });
    return updated;
  },

  deleteEntry(id, access) {
    requireManager(access);
    const existing = this.findEntry(id, access);
    db.prepare(`
      UPDATE pettyCashEntries
      SET status = 'deleted', updatedBy = @updatedBy, updatedAt = @updatedAt, version = COALESCE(version, 1) + 1
      WHERE id = @id AND tenantId = @tenantId
    `).run({ id, tenantId: access.tenantId, updatedBy: access.userId || "", updatedAt: now() });
    writeHistory("deleted", id, access, mapEntry(existing), { id, deleted: true });
    auditDecision("petty_cash.deleted", "pettyCashEntries", id, access, { branchId: existing.branchId, details: { docNo: existing.docNo } });
    emitEvent("transaction:petty_cash_deleted", access, existing.branchId || "", id, { docNo: existing.docNo });
    return { id, deleted: true };
  },

  findEntry(id, access) {
    requireTenant(access);
    ensurePettyCashSchema();
    const row = db.prepare("SELECT * FROM pettyCashEntries WHERE id = @id AND tenantId = @tenantId").get({ id, tenantId: access.tenantId });
    if (!row) throw notFound("Petty cash entry not found");
    if (row.branchId) assertBranch(access, row.branchId);
    return row;
  }
};

function normalizeEntry(payload = {}, access, existing = {}) {
  const branchId = clean(payload.branchId ?? existing.branchId ?? branchFrom(payload, access));
  if (!branchId) throw badRequest("Branch is required");
  assertBranch(access, branchId);
  const type = normalizeType(payload.type ?? existing.type);
  if (!type) throw badRequest("Type IN, OUT or OPENING is required");
  const amountPaise = moneyPaise(payload.amount ?? payload.amountRupees ?? payload.debit ?? payload.credit ?? existingAmount(existing));
  if (amountPaise <= 0) throw badRequest("Amount must be greater than zero");
  const docDate = dateOnly(payload.docDate ?? existing.docDate);
  if (!docDate) throw badRequest("Doc date is required");
  const particular = clean(payload.particular ?? existing.particular);
  if (!particular) throw badRequest("Particular is required");
  return {
    branchId,
    branchName: clean(payload.branchName ?? existing.branchName),
    docDate,
    type,
    prefix: clean(payload.prefix ?? existing.prefix ?? prefixFor(type)),
    docNo: clean(payload.docNo ?? existing.docNo) || makeDocNo(type, access.tenantId, branchId),
    billNumber: clean(payload.billNumber ?? existing.billNumber),
    billDate: dateOnly(payload.billDate ?? existing.billDate),
    particular,
    category: normalizeCategory(payload.category ?? existing.category, type),
    sourceAccount: clean(payload.sourceAccount ?? existing.sourceAccount),
    staffId: clean(payload.staffId ?? existing.staffId),
    staffName: clean(payload.staffName ?? existing.staffName),
    debitPaise: type === "IN" || type === "OPENING" ? amountPaise : 0,
    creditPaise: type === "OUT" ? amountPaise : 0,
    paymode: clean(payload.paymode ?? existing.paymode) || "Cash",
    chequeNo: clean(payload.chequeNo ?? existing.chequeNo),
    remarks: clean(payload.remarks ?? existing.remarks),
    approvalStatus: normalizeApprovalStatus(payload.approvalStatus ?? existing.approvalStatus, type, amountPaise),
    approvedBy: clean(payload.approvedBy ?? existing.approvedBy),
    approvedAt: clean(payload.approvedAt ?? existing.approvedAt),
    ledgerStatus: clean(payload.ledgerStatus ?? existing.ledgerStatus) || "queued",
    ledgerEventKey: clean(payload.ledgerEventKey ?? existing.ledgerEventKey),
    status: "active"
  };
}

function mapEntry(row = {}) {
  const debitPaise = number(row.debitPaise);
  const creditPaise = number(row.creditPaise);
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId || "",
    branchName: row.branchName || "",
    docDate: row.docDate || "",
    type: row.type || "",
    prefix: row.prefix || "",
    docNo: row.docNo || "",
    billNumber: row.billNumber || "",
    billDate: row.billDate || "",
    particular: row.particular || "",
    category: row.category || "",
    sourceAccount: row.sourceAccount || "",
    staffId: row.staffId || "",
    staffName: row.staffName || "",
    debitPaise,
    creditPaise,
    balancePaise: number(row.balancePaise),
    balance: paiseToRupees(number(row.balancePaise)),
    debit: paiseToRupees(debitPaise),
    credit: paiseToRupees(creditPaise),
    amount: paiseToRupees(debitPaise || creditPaise),
    paymode: row.paymode || "",
    chequeNo: row.chequeNo || "",
    remarks: row.remarks || "",
    approvalStatus: row.approvalStatus || "not_required",
    approvedBy: row.approvedBy || "",
    approvedAt: row.approvedAt || "",
    ledgerStatus: row.ledgerStatus || "queued",
    ledgerEventKey: row.ledgerEventKey || "",
    status: row.status || "active",
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || "",
    version: number(row.version, 1)
  };
}

function normalizeType(value, fallback = "OUT") {
  const text = clean(value || fallback).toUpperCase();
  if (["OPENING", "OP", "OPENING BALANCE"].includes(text)) return "OPENING";
  if (["IN", "OR", "RECEIPT", "DEBIT"].includes(text)) return "IN";
  if (["OUT", "OG", "PAYMENT", "CREDIT"].includes(text)) return "OUT";
  return "";
}

function mapEntriesWithBalance(rows = []) {
  let balancePaise = 0;
  return rows.map((row) => {
    balancePaise += number(row.debitPaise) - number(row.creditPaise);
    return mapEntry({ ...row, balancePaise });
  });
}

function existingAmount(row = {}) {
  return paiseToRupees(number(row.debitPaise) || number(row.creditPaise));
}

function moneyPaise(value) {
  const parsed = Number(value ?? 0);
  if (!Number.isFinite(parsed)) return 0;
  return Math.max(0, Math.round(parsed * 100));
}

function paiseToRupees(value) {
  return Math.round(number(value) || 0) / 100;
}

function dateOnly(value) {
  const text = clean(value);
  if (/^\d{4}-\d{2}-\d{2}$/.test(text)) return text;
  const parsed = new Date(text);
  if (Number.isNaN(parsed.getTime())) return "";
  return parsed.toISOString().slice(0, 10);
}

function makeDocNo(type, tenantId, branchId) {
  const prefix = prefixFor(type);
  const rows = db.prepare(`
    SELECT docNo FROM pettyCashEntries
    WHERE tenantId = @tenantId AND branchId = @branchId AND prefix = @prefix AND docNo LIKE @like AND status != 'deleted'
  `).all({ tenantId, branchId, prefix, like: `${prefix}-%` });
  const maxNo = rows.reduce((max, row) => {
    const match = String(row.docNo || "").match(/-(\d+)$/);
    return Math.max(max, match ? number(match[1]) : 0);
  }, 0);
  return `${prefix}-${String(maxNo + 1).padStart(4, "0")}`;
}

function prefixFor(type) {
  if (type === "OPENING") return "OP";
  return type === "IN" ? "OR" : "OG";
}

function normalizeCategory(value, type) {
  const category = clean(value).toLowerCase().replace(/\s+/g, "_");
  if (category) return category;
  if (type === "OPENING") return "opening_balance";
  if (type === "IN") return "bank_withdrawal";
  return "other_expense";
}

function normalizeApprovalStatus(value, type, amountPaise) {
  const text = clean(value).toLowerCase();
  if (["pending", "approved", "rejected", "not_required"].includes(text)) return text;
  if (type === "OUT" && amountPaise >= 500000) return "pending";
  return "not_required";
}

function writeHistory(action, entryId, access, before, after) {
  db.prepare(`
    INSERT INTO pettyCashEntryHistory
      (id, tenantId, branchId, entryId, action, beforeJson, afterJson, changedBy, changedAt)
    VALUES
      (@id, @tenantId, @branchId, @entryId, @action, @beforeJson, @afterJson, @changedBy, @changedAt)
  `).run({
    id: makeId("pch"),
    tenantId: access.tenantId,
    branchId: after?.branchId || before?.branchId || "",
    entryId,
    action,
    beforeJson: before ? JSON.stringify(before) : "",
    afterJson: after ? JSON.stringify(after) : "",
    changedBy: access.userId || "",
    changedAt: now()
  });
}

function clean(value) {
  return String(value ?? "").trim();
}
