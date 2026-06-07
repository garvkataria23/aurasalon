import { randomUUID } from "node:crypto";
import { db } from "../../db.js";

export async function run(job) {
  const payload = job.payload || {};
  if (!job.tenantId || !payload.action || !payload.entityType) {
    return { success: false, error: "tenantId, action and entityType are required" };
  }
  db.prepare(
    `INSERT INTO audit_log
      (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, ip_address, user_agent)
     VALUES
      (@id, @tenantId, @userId, @action, @entityType, @entityId, @oldValue, @newValue, @ipAddress, @userAgent)`
  ).run({
    id: payload.id || `audit_${randomUUID().slice(0, 10)}`,
    tenantId: job.tenantId,
    userId: payload.userId || "",
    action: payload.action,
    entityType: payload.entityType,
    entityId: payload.entityId || "",
    oldValue: JSON.stringify(payload.oldValue || null),
    newValue: JSON.stringify(payload.newValue || null),
    ipAddress: payload.ipAddress || "",
    userAgent: payload.userAgent || ""
  });
  return { success: true };
}
