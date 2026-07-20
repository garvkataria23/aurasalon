import { randomUUID } from "node:crypto";
import { columnsFor, db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import { terminalService } from "./terminal.service.js";

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

export class DeviceSessionService {
  start(terminalId, payload = {}, access = {}, req = {}) {
    requireTable("terminal_sessions");
    const terminal = terminalService.assertActive(terminalId, access);
    const active = db
      .prepare("SELECT * FROM terminal_sessions WHERE tenant_id = ? AND user_id = ? AND session_status = 'active'")
      .get(access.tenantId, access.userId || "");
    if (active && !payload.allow_multiple) throw conflict("Cashier already has an active terminal session", { activeSessionId: active.id });
    const id = makeId("tses");
    db.prepare(
      `INSERT INTO terminal_sessions
        (id, tenant_id, branch_id, terminal_id, user_id, session_status, opened_at, opening_cash_drawer_id, ip_address, user_agent)
       VALUES
        (?, ?, ?, ?, ?, 'active', CURRENT_TIMESTAMP, ?, ?, ?)`
    ).run(
      id,
      access.tenantId,
      terminal.branch_id,
      terminalId,
      access.userId || "",
      payload.opening_cash_drawer_id || payload.openingCashDrawerId || "",
      req.ip || "",
      req.get?.("user-agent") || ""
    );
    terminalService.recordEvent(access.tenantId, terminalId, "terminal.session_started", { sessionId: id });
    return this.get(id, access);
  }

  end(terminalId, payload = {}, access = {}) {
    requireTable("terminal_sessions");
    const row = db
      .prepare("SELECT * FROM terminal_sessions WHERE tenant_id = ? AND terminal_id = ? AND session_status = 'active' ORDER BY opened_at DESC LIMIT 1")
      .get(access.tenantId, terminalId);
    if (!row) throw notFound("Active terminal session not found");
    db.prepare(
      `UPDATE terminal_sessions
          SET session_status = 'closed', closed_at = CURRENT_TIMESTAMP, closing_cash_drawer_id = ?
        WHERE tenant_id = ? AND id = ?`
    ).run(payload.closing_cash_drawer_id || payload.closingCashDrawerId || "", access.tenantId, row.id);
    terminalService.recordEvent(access.tenantId, terminalId, "terminal.session_closed", { sessionId: row.id });
    return this.get(row.id, access);
  }

  get(id, access = {}) {
    const row = db.prepare("SELECT * FROM terminal_sessions WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Terminal session not found");
    return row;
  }
}

export const deviceSessionService = new DeviceSessionService();
