import { db } from "../../db.js";
import { badRequest, forbidden } from "../../utils/app-error.js";
import { emitCompliance, fiscalYear, logCompliance, makeId, now } from "./compliance-utils.js";

export class FyClosureService {
  status(fy = fiscalYear(), access = {}) {
    return db.prepare("SELECT * FROM compliance_fy_locks WHERE tenant_id = ? AND fy = ?").get(access.tenantId, fy) || {
      tenant_id: access.tenantId,
      fy,
      status: "open"
    };
  }

  close(fy = fiscalYear(), payload = {}, access = {}) {
    const form16Open = db.prepare("SELECT COUNT(*) AS count FROM tds_deductions WHERE tenant_id = ? AND fy = ?").get(access.tenantId, fy)?.count || 0;
    if (payload.requireForm16 && form16Open > 0) {
      const issued = db.prepare("SELECT COUNT(*) AS count FROM form_16 WHERE tenant_id = ? AND fy = ?").get(access.tenantId, fy)?.count || 0;
      if (!issued) throw badRequest("Issue Form 16 before FY close");
    }
    const archive = {
      pf: db.prepare("SELECT COUNT(*) AS count FROM pf_contributions WHERE tenant_id = ? AND fy = ?").get(access.tenantId, fy)?.count || 0,
      esi: db.prepare("SELECT COUNT(*) AS count FROM esi_contributions WHERE tenant_id = ? AND fy = ?").get(access.tenantId, fy)?.count || 0,
      tds: form16Open,
      closedAt: now()
    };
    const row = {
      id: makeId("fy_lock"),
      tenant_id: access.tenantId,
      fy,
      status: "closed",
      closed_by: access.userId || "",
      closed_at: now(),
      reopened_by: "",
      reopened_at: "",
      reopen_reason: "",
      archive_json: JSON.stringify(archive),
      created_at: now()
    };
    db.prepare(`
      INSERT INTO compliance_fy_locks
        (id, tenant_id, fy, status, closed_by, closed_at, reopened_by, reopened_at, reopen_reason, archive_json, created_at)
      VALUES
        (@id, @tenant_id, @fy, @status, @closed_by, @closed_at, @reopened_by, @reopened_at, @reopen_reason, @archive_json, @created_at)
      ON CONFLICT(tenant_id, fy) DO UPDATE SET
        status = 'closed', closed_by = excluded.closed_by, closed_at = excluded.closed_at,
        archive_json = excluded.archive_json
    `).run(row);
    logCompliance({ tenantId: access.tenantId, module: "fy", action: "closed", entityId: fy, newValue: row, access, severity: "warning" });
    emitCompliance("compliance:fy_closed", { fy }, access);
    return this.status(fy, access);
  }

  reopen(fy = fiscalYear(), payload = {}, access = {}) {
    if (!["owner", "admin", "superAdmin"].includes(access.role)) throw forbidden("Only admin or owner can reopen a statutory FY");
    if (!payload.reason) throw badRequest("reason is required");
    const result = db.prepare(`
      UPDATE compliance_fy_locks
      SET status = 'open', reopened_by = ?, reopened_at = ?, reopen_reason = ?
      WHERE tenant_id = ? AND fy = ?
    `).run(access.userId || "", now(), payload.reason, access.tenantId, fy);
    if (!result.changes) {
      db.prepare(`
        INSERT INTO compliance_fy_locks
          (id, tenant_id, fy, status, reopened_by, reopened_at, reopen_reason, created_at)
        VALUES (?, ?, ?, 'open', ?, ?, ?, ?)
      `).run(makeId("fy_lock"), access.tenantId, fy, access.userId || "", now(), payload.reason, now());
    }
    logCompliance({ tenantId: access.tenantId, module: "fy", action: "reopened", entityId: fy, newValue: payload, access, severity: "warning" });
    return this.status(fy, access);
  }
}

export const fyClosureService = new FyClosureService();
