import { db } from "../db.js";

/**
 * SIEM export (ADD-ONLY). Streams security events as newline-delimited JSON
 * (NDJSON) for ingestion by external monitoring (Datadog/Splunk/Elastic).
 * Tenant-scoped, time-filterable. Read-only.
 */
export class SiemService {
  *events(tenantId, { since = "", limit = 5000 } = {}) {
    const audit = db.prepare(
      `SELECT 'audit' AS source, id, action AS event, severity, actorUserId AS userId, actorRole AS role,
              targetType, targetId, ipAddress, userAgent, details, createdAt
       FROM security_audit_logs WHERE tenantId = @tenantId AND (@since = '' OR createdAt > @since)
       ORDER BY createdAt ASC LIMIT @limit`
    ).all({ tenantId, since, limit });
    for (const row of audit) {
      yield { ...row, details: safeParse(row.details), "@timestamp": row.createdAt };
    }
    const activity = db.prepare(
      `SELECT 'activity' AS source, id, method, path, statusCode, durationMs, userId, role, ipAddress, userAgent, createdAt
       FROM security_activity_events WHERE tenantId = @tenantId AND (@since = '' OR createdAt > @since)
       ORDER BY createdAt ASC LIMIT @limit`
    ).all({ tenantId, since, limit });
    for (const row of activity) {
      yield { ...row, "@timestamp": row.createdAt };
    }
  }

  writeNdjson(res, tenantId, opts) {
    res.setHeader("Content-Type", "application/x-ndjson");
    let count = 0;
    for (const ev of this.events(tenantId, opts)) {
      res.write(JSON.stringify(ev) + "\n");
      count += 1;
    }
    res.end();
    return count;
  }
}

function safeParse(v) {
  try { return v ? JSON.parse(v) : {}; } catch { return {}; }
}

export const siemService = new SiemService();
