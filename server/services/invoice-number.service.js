import { randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest } from "../utils/app-error.js";

const DEFAULT_PREFIX = "INV";

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function makeId(prefix) {
  return `${prefix}_${randomUUID().slice(0, 12)}`;
}

function cleanBranchCode(value) {
  const cleaned = String(value || "")
    .trim()
    .toUpperCase()
    .replace(/[^A-Z0-9]/g, "")
    .slice(0, 6);
  return cleaned || "BR";
}

function financialYearFor(input = new Date()) {
  const date = input instanceof Date ? input : new Date(input);
  if (Number.isNaN(date.getTime())) throw badRequest("Invalid invoice date");
  const year = date.getFullYear();
  const month = date.getMonth();
  return String(month >= 3 ? year : year - 1);
}

function assertSequenceSchema() {
  const columns = safeColumns("invoice_number_sequences");
  const missing = ["tenant_id", "branch_id", "financial_year", "prefix", "last_number"].filter((column) => !columns.includes(column));
  if (missing.length) {
    throw badRequest("Enterprise billing migration is not applied", {
      table: "invoice_number_sequences",
      missing
    });
  }
}

function branchCodeFromRow(row, fallback) {
  return cleanBranchCode(
    row?.branch_code ||
      row?.branchCode ||
      row?.code ||
      row?.slug ||
      row?.shortName ||
      row?.name ||
      fallback
  );
}

export class InvoiceNumberService {
  financialYearFor(input = new Date()) {
    return financialYearFor(input);
  }

  resolveBranchCode({ tenantId, branchId, branchCode }) {
    if (branchCode) return cleanBranchCode(branchCode);
    if (!branchId) return "BR";

    const columns = safeColumns("branches");
    if (!columns.length || !columns.includes("id")) return cleanBranchCode(branchId);

    const tenantColumn = columns.includes("tenant_id") ? "tenant_id" : columns.includes("tenantId") ? "tenantId" : "";
    const where = tenantColumn ? `id = @branchId AND ${tenantColumn} = @tenantId` : "id = @branchId";
    const row = db.prepare(`SELECT * FROM branches WHERE ${where}`).get({ tenantId, branchId });
    return branchCodeFromRow(row, branchId);
  }

  nextInvoiceNumberInTransaction({ tenantId, branchId, branchCode, prefix = DEFAULT_PREFIX, date = new Date() }) {
    if (!tenantId) throw badRequest("tenant_id is required for invoice number generation");
    if (!branchId) throw badRequest("branch_id is required for invoice number generation");

    assertSequenceSchema();

    const financialYear = financialYearFor(date);
    const safePrefix = cleanBranchCode(prefix || DEFAULT_PREFIX);
    const safeBranchCode = this.resolveBranchCode({ tenantId, branchId, branchCode });

    const existing = db
      .prepare(
        `SELECT id, last_number
           FROM invoice_number_sequences
          WHERE tenant_id = @tenantId
            AND branch_id = @branchId
            AND financial_year = @financialYear
            AND prefix = @prefix`
      )
      .get({ tenantId, branchId, financialYear, prefix: safePrefix });

    const nextNumber = Number(existing?.last_number || 0) + 1;
    const now = new Date().toISOString();

    if (existing) {
      db.prepare(
        `UPDATE invoice_number_sequences
            SET last_number = @nextNumber,
                updated_at = @now
          WHERE tenant_id = @tenantId
            AND branch_id = @branchId
            AND financial_year = @financialYear
            AND prefix = @prefix`
      ).run({ nextNumber, now, tenantId, branchId, financialYear, prefix: safePrefix });
    } else {
      db.prepare(
        `INSERT INTO invoice_number_sequences
          (id, tenant_id, branch_id, financial_year, prefix, last_number, reset_policy, updated_at)
         VALUES
          (@id, @tenantId, @branchId, @financialYear, @prefix, @nextNumber, 'financial_year', @now)`
      ).run({
        id: makeId("seq"),
        tenantId,
        branchId,
        financialYear,
        prefix: safePrefix,
        nextNumber,
        now
      });
    }

    return {
      invoiceNo: `${safePrefix}-${safeBranchCode}-${financialYear}-${String(nextNumber).padStart(6, "0")}`,
      branchCode: safeBranchCode,
      financialYear,
      sequence: nextNumber,
      prefix: safePrefix
    };
  }

  nextInvoiceNumber(input) {
    const txn = db.transaction((payload) => this.nextInvoiceNumberInTransaction(payload));
    return txn(input);
  }
}

export const invoiceNumberService = new InvoiceNumberService();
