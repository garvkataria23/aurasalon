import { randomBytes } from "node:crypto";
import { db } from "../db.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

function makeId(prefix) {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function icsDate(value) {
  return new Date(value).toISOString().replace(/[-:]/g, "").replace(/\.\d{3}Z$/, "Z");
}

function esc(value = "") {
  return String(value).replace(/\\/g, "\\\\").replace(/,/g, "\\,").replace(/;/g, "\\;").replace(/\n/g, "\\n");
}

export const calendarExportService = {
  generateToken(access, { scope, scopeId, privacyMode = "busy" } = {}) {
    if (!["staff", "branch"].includes(scope)) throw badRequest("scope must be staff or branch");
    if (!scopeId) throw badRequest("scopeId is required");
    if (scope === "branch") tenantService.assertBranchAccess(access, scopeId);
    const row = {
      id: makeId("ical"),
      tenantId: access.tenantId,
      scope,
      scopeId,
      privacyMode,
      token: randomBytes(24).toString("hex")
    };
    db.prepare(
      `INSERT INTO calendar_export_tokens (id, tenantId, scope, scopeId, token, privacyMode)
       VALUES (@id, @tenantId, @scope, @scopeId, @token, @privacyMode)`
    ).run(row);
    return row;
  },

  revokeToken(access, id) {
    const result = db.prepare("UPDATE calendar_export_tokens SET active = 0 WHERE id = ? AND tenantId = ?").run(id, access.tenantId);
    return { revoked: result.changes > 0 };
  },

  getICalFeed({ scope, scopeId, token }) {
    const row = db.prepare(
      "SELECT * FROM calendar_export_tokens WHERE scope = ? AND scopeId = ? AND token = ? AND active = 1"
    ).get(scope, scopeId, token);
    if (!row) throw notFound("Calendar token not found");
    db.prepare("UPDATE calendar_export_tokens SET lastAccessedAt = CURRENT_TIMESTAMP WHERE id = ?").run(row.id);
    const appointments = scope === "staff"
      ? db.prepare("SELECT * FROM appointments WHERE tenantId = ? AND staffId = ? AND status NOT IN ('cancelled','no-show') ORDER BY startAt ASC LIMIT 1000").all(row.tenantId, scopeId)
      : db.prepare("SELECT * FROM appointments WHERE tenantId = ? AND branchId = ? AND status NOT IN ('cancelled','no-show') ORDER BY startAt ASC LIMIT 1000").all(row.tenantId, scopeId);
    const events = appointments.map((appt) => {
      const title = scope === "staff" && row.privacyMode === "busy" ? "BUSY" : `Aura booking ${appt.clientId || ""}`.trim();
      return [
        "BEGIN:VEVENT",
        `UID:${appt.id}@aura-salon`,
        `DTSTAMP:${icsDate(new Date().toISOString())}`,
        `DTSTART:${icsDate(appt.startAt)}`,
        `DTEND:${icsDate(appt.endAt || appt.startAt)}`,
        `SUMMARY:${esc(title)}`,
        `DESCRIPTION:${esc(row.privacyMode === "busy" ? "Aura Salon appointment block" : appt.notes || "")}`,
        "END:VEVENT"
      ].join("\r\n");
    });
    return [
      "BEGIN:VCALENDAR",
      "VERSION:2.0",
      "PRODID:-//Aura Salon CRM POS//Appointments//EN",
      "CALSCALE:GREGORIAN",
      "METHOD:PUBLISH",
      ...events,
      "END:VCALENDAR"
    ].join("\r\n");
  }
};

