import { createHash } from "node:crypto";
import { db, tableHasColumn } from "../db.js";

/**
 * Tamper-evident audit log via hash chaining (ADD-ONLY).
 *
 * Each sealed audit row stores entryHash = sha256(prevHash + canonical(row)).
 * Editing or deleting any sealed row breaks the chain, which verify() detects.
 * Columns are added lazily with ALTER TABLE (db.js is never modified). Sealing
 * is append-only and idempotent; run it on a schedule or before verifying.
 */

const GENESIS = "0".repeat(64);

function ensureColumns() {
  if (!tableHasColumn("security_audit_logs", "entryHash")) {
    db.prepare("ALTER TABLE security_audit_logs ADD COLUMN entryHash TEXT").run();
  }
  if (!tableHasColumn("security_audit_logs", "prevHash")) {
    db.prepare("ALTER TABLE security_audit_logs ADD COLUMN prevHash TEXT").run();
  }
}

function canonical(row) {
  return JSON.stringify([
    row.id, row.tenantId || "", row.actorUserId || "", row.actorRole || "",
    row.action || "", row.targetType || "", row.targetId || "", row.severity || "",
    row.ipAddress || "", row.details || "", row.createdAt || ""
  ]);
}

function entryHash(prevHash, row) {
  return createHash("sha256").update(prevHash + canonical(row)).digest("hex");
}

export class AuditChainService {
  constructor() {
    try { ensureColumns(); } catch { /* columns may already exist */ }
  }

  /** Seal all not-yet-sealed rows for a tenant in chronological order. */
  seal(tenantId) {
    ensureColumns();
    const last = db.prepare(
      "SELECT entryHash FROM security_audit_logs WHERE tenantId = @tenantId AND entryHash IS NOT NULL ORDER BY createdAt DESC, id DESC LIMIT 1"
    ).get({ tenantId });
    let prev = last?.entryHash || GENESIS;
    const pending = db.prepare(
      "SELECT * FROM security_audit_logs WHERE tenantId = @tenantId AND (entryHash IS NULL OR entryHash = '') ORDER BY createdAt ASC, id ASC"
    ).all({ tenantId });
    const update = db.prepare("UPDATE security_audit_logs SET entryHash = @entryHash, prevHash = @prevHash WHERE id = @id");
    const tx = db.transaction((rows) => {
      for (const row of rows) {
        const h = entryHash(prev, row);
        update.run({ entryHash: h, prevHash: prev, id: row.id });
        prev = h;
      }
    });
    tx(pending);
    return { sealed: pending.length, headHash: prev };
  }

  /** Recompute the chain and report the first tampered row, if any. */
  verify(tenantId) {
    ensureColumns();
    const rows = db.prepare(
      "SELECT * FROM security_audit_logs WHERE tenantId = @tenantId AND entryHash IS NOT NULL AND entryHash != '' ORDER BY createdAt ASC, id ASC"
    ).all({ tenantId });
    let prev = GENESIS;
    for (let i = 0; i < rows.length; i++) {
      const row = rows[i];
      const expected = entryHash(prev, row);
      if (row.prevHash !== prev || row.entryHash !== expected) {
        return { valid: false, sealedRows: rows.length, brokenAtIndex: i, brokenId: row.id, action: row.action };
      }
      prev = row.entryHash;
    }
    return { valid: true, sealedRows: rows.length, headHash: prev };
  }

  sealAndVerify(tenantId) {
    const sealed = this.seal(tenantId);
    return { ...this.verify(tenantId), justSealed: sealed.sealed };
  }
}

export const auditChainService = new AuditChainService();
