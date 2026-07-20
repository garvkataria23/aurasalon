import { randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";

const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

function safeColumns(table) {
  try {
    return columnsFor(table);
  } catch {
    return [];
  }
}

function requireTable(table) {
  if (!safeColumns(table).length) throw badRequest(`${table} migration is not applied`);
}

export class TerminalService {
  register(payload = {}, access = {}) {
    requireTable("pos_terminals");
    const branchId = payload.branch_id || payload.branchId || access.branchId;
    if (!branchId) throw badRequest("branch_id is required");
    const terminalCode = payload.terminal_code || payload.terminalCode;
    if (!terminalCode) throw badRequest("terminal_code is required");
    const existing = db.prepare("SELECT * FROM pos_terminals WHERE tenant_id = ? AND branch_id = ? AND terminal_code = ?").get(access.tenantId, branchId, terminalCode);
    if (existing) return existing;
    const id = makeId("term");
    db.prepare(
      `INSERT INTO pos_terminals
        (id, tenant_id, branch_id, terminal_code, terminal_name, device_fingerprint, assigned_counter, status, created_by, created_at, updated_at)
       VALUES
        (@id, @tenantId, @branchId, @terminalCode, @terminalName, @deviceFingerprint, @assignedCounter, 'active', @createdBy, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
    ).run({
      id,
      tenantId: access.tenantId,
      branchId,
      terminalCode,
      terminalName: payload.terminal_name || payload.terminalName || terminalCode,
      deviceFingerprint: payload.device_fingerprint || payload.deviceFingerprint || "",
      assignedCounter: payload.assigned_counter || payload.assignedCounter || "",
      createdBy: access.userId || ""
    });
    this.recordEvent(access.tenantId, id, "terminal.registered", payload);
    return this.get(id, access);
  }

  list(query = {}, access = {}) {
    requireTable("pos_terminals");
    const params = [access.tenantId];
    let where = "tenant_id = ?";
    if (query.branchId || query.branch_id || access.branchId) {
      where += " AND branch_id = ?";
      params.push(query.branchId || query.branch_id || access.branchId);
    }
    return db.prepare(`SELECT * FROM pos_terminals WHERE ${where} ORDER BY created_at DESC`).all(...params);
  }

  get(id, access = {}) {
    const row = db.prepare("SELECT * FROM pos_terminals WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Terminal not found");
    return row;
  }

  assertActive(id, access = {}) {
    const terminal = this.get(id, access);
    if (terminal.status !== "active") throw forbidden("Suspended terminal cannot create invoices");
    return terminal;
  }

  heartbeat(id, payload = {}, access = {}) {
    const terminal = this.assertActive(id, access);
    db.prepare("UPDATE pos_terminals SET last_seen_at = CURRENT_TIMESTAMP, device_fingerprint = COALESCE(NULLIF(?, ''), device_fingerprint), updated_at = CURRENT_TIMESTAMP WHERE tenant_id = ? AND id = ?")
      .run(payload.device_fingerprint || payload.deviceFingerprint || "", access.tenantId, id);
    this.recordEvent(access.tenantId, id, "terminal.heartbeat", { ip: payload.ip || "" });
    return { ...terminal, last_seen_at: new Date().toISOString(), online: true };
  }

  sales(id, query = {}, access = {}) {
    this.get(id, access);
    const from = query.from || "1970-01-01";
    const to = query.to || "2999-12-31";
    const rows = db.prepare(
      `SELECT ip.payment_mode, COUNT(DISTINCT ip.invoice_id) AS invoice_count, SUM(ip.amount) AS amount
         FROM invoice_payments ip
        WHERE ip.tenant_id = ? AND ip.terminal_id = ? AND date(COALESCE(ip.paid_at, ip.created_at)) BETWEEN date(?) AND date(?)
        GROUP BY ip.payment_mode`
    ).all(access.tenantId, id, from, to);
    return {
      terminalId: id,
      from,
      to,
      rows,
      total: rows.reduce((sum, row) => sum + Number(row.amount || 0), 0)
    };
  }

  recordEvent(tenantId, terminalId, eventType, payload = {}) {
    if (!safeColumns("terminal_device_events").length) return null;
    const id = makeId("tdev");
    db.prepare(
      `INSERT INTO terminal_device_events (id, tenant_id, terminal_id, event_type, event_payload_json, created_at)
       VALUES (?, ?, ?, ?, ?, CURRENT_TIMESTAMP)`
    ).run(id, tenantId, terminalId, eventType, JSON.stringify(payload || {}));
    return id;
  }
}

export const terminalService = new TerminalService();
