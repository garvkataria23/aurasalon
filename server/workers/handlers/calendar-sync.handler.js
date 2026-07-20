import { randomUUID } from "node:crypto";
import { db } from "../../db.js";

function id(prefix) {
  return `${prefix}_${randomUUID().slice(0, 10)}`;
}

export async function run(job) {
  const payload = job.payload || {};
  if (!job.tenantId) return { success: false, error: "tenantId is required" };
  const branchId = payload.branchId || "";
  const connection = db.prepare(
    `SELECT * FROM marketplace_connections
     WHERE tenantId = ?
       AND (? = '' OR branchId = ?)
       AND lower(provider) LIKE '%calendar%'
       AND status = 'connected'
     ORDER BY updatedAt DESC
     LIMIT 1`
  ).get(job.tenantId, branchId, branchId);
  if (!connection) {
    return { success: true, skipped: true, reason: "calendar_connection_not_configured" };
  }

  const appointmentId = payload.appointmentId || "";
  const appointment = appointmentId
    ? db.prepare("SELECT id, branchId, startAt, endAt, status FROM appointments WHERE tenantId = ? AND id = ?").get(job.tenantId, appointmentId)
    : null;
  const syncedAt = new Date().toISOString();
  db.prepare(
    `UPDATE marketplace_connections
     SET lastSyncAt = @syncedAt,
         health = @health,
         updatedAt = @syncedAt
     WHERE id = @id AND tenantId = @tenantId`
  ).run({
    id: connection.id,
    tenantId: job.tenantId,
    syncedAt,
    health: JSON.stringify({
      status: "healthy",
      lastJobId: job.id,
      lastAppointmentId: appointmentId,
      lastSyncedAt: syncedAt
    })
  });
  db.prepare(
    `INSERT INTO audit_logs (id, tenantId, branchId, actorUserId, action, entityType, entityId, severity, details, createdAt, updatedAt)
     VALUES (@id, @tenantId, @branchId, 'job-worker', 'calendar.synced', @entityType, @entityId, 'info', @details, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)`
  ).run({
    id: id("audit"),
    tenantId: job.tenantId,
    branchId: appointment?.branchId || branchId || connection.branchId || "",
    entityType: appointmentId ? "appointment" : "calendar_connection",
    entityId: appointmentId || connection.id,
    details: JSON.stringify({ connectionId: connection.id, provider: connection.provider, syncedAt, appointment })
  });
  return { success: true, connectionId: connection.id, appointmentId, syncedAt };
}
