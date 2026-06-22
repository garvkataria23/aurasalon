import { db } from "../db.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";
import {
  assertBranch,
  branchIdFrom,
  camel,
  emitStaffEvent,
  makeId,
  now,
  requireManager,
  requireTenant,
  scopedBranchWhere,
  staffAudit,
  staffById,
  toJson
} from "./staff-os-advanced-utils.js";

const sensitiveTypes = new Set(["payroll_generated", "payroll_paid", "burnout_alert"]);

function containsSalaryAmount(message = "") {
  return /(?:salary|ctc|net pay|in-hand|payroll|₹|rs\.?\s?\d|\binr\b)/i.test(message);
}

function quietHourDeferred(preference = {}, scheduledAt = now()) {
  const date = new Date(scheduledAt);
  const minutes = date.getHours() * 60 + date.getMinutes();
  const [startHour, startMinute] = String(preference.quiet_hours_start || "21:00").split(":").map(Number);
  const [endHour, endMinute] = String(preference.quiet_hours_end || "08:00").split(":").map(Number);
  const start = startHour * 60 + startMinute;
  const end = endHour * 60 + endMinute;
  return start > end ? minutes >= start || minutes < end : minutes >= start && minutes < end;
}

export class StaffWhatsappNotificationService {
  listTemplates(query = {}, access) {
    access = requireTenant(access);
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      notification_type: query.type || query.notificationType || "",
      limit: Math.min(Number(query.limit || 100), 500)
    };
    const filters = ["tenant_id = @tenant_id"];
    if (params.branch_id) filters.push("(branch_id = @branch_id OR branch_id IS NULL OR branch_id = '')");
    if (params.notification_type) filters.push("notification_type = @notification_type");
    return db.prepare(`SELECT * FROM staff_notification_templates WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params).map(camel);
  }

  createTemplate(payload = {}, access) {
    access = requireTenant(access);
    requireManager(access);
    const branchId = branchIdFrom(payload, access);
    if (branchId) assertBranch(access, branchId);
    const row = {
      id: makeId("sntpl"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      notification_type: payload.notificationType || payload.notification_type || payload.type || "",
      language: payload.language || "en-IN",
      title: payload.title || "",
      body_template: payload.bodyTemplate || payload.body_template || "",
      sensitive: payload.sensitive ? 1 : 0,
      status: payload.status || "active"
    };
    if (!row.notification_type || !row.title || !row.body_template) throw badRequest("notificationType, title and bodyTemplate are required");
    db.prepare(`INSERT INTO staff_notification_templates
      (id, tenant_id, branch_id, notification_type, language, title, body_template, sensitive, status)
      VALUES (@id, @tenant_id, @branch_id, @notification_type, @language, @title, @body_template, @sensitive, @status)`).run(row);
    return camel(db.prepare("SELECT * FROM staff_notification_templates WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  queue(payload = {}, access) {
    access = requireTenant(access);
    const staff = staffById(payload.staffId || payload.staff_id, access);
    const branchId = branchIdFrom(payload, access) || staff.branch_id;
    assertBranch(access, branchId);
    const type = payload.notificationType || payload.notification_type || payload.type || "";
    if (!type) throw badRequest("notificationType is required");
    const preference = this.preference(staff.id, access);
    if (preference && Number(preference.whatsapp_opt_in) !== 1) throw forbidden("Staff member has opted out of WhatsApp notifications");
    const template = payload.templateId || payload.template_id
      ? db.prepare("SELECT * FROM staff_notification_templates WHERE id = ? AND tenant_id = ?").get(payload.templateId || payload.template_id, access.tenantId)
      : db.prepare(`SELECT * FROM staff_notification_templates
          WHERE tenant_id = ? AND notification_type = ? AND language = ? AND status = 'active'
          ORDER BY branch_id = ? DESC, created_at DESC LIMIT 1`).get(access.tenantId, type, payload.language || preference?.language || "en-IN", branchId);
    const message = payload.message || payload.messagePreview || this.renderTemplate(template?.body_template || "", { staff, ...(payload.variables || {}) });
    const sensitive = sensitiveTypes.has(type) || Number(template?.sensitive || 0) === 1 || Boolean(payload.sensitive);
    if (containsSalaryAmount(message) && !payload.allowSalaryAmount && Number(preference?.allow_payroll_amounts || 0) !== 1) {
      throw forbidden("Salary amounts are blocked in WhatsApp unless policy explicitly allows them");
    }
    const requiresApproval = sensitive || type.startsWith("payroll_") ? 1 : 0;
    const scheduledAt = payload.scheduledAt || payload.scheduled_at || now();
    const row = {
      id: makeId("snotif"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      staff_id: staff.id,
      notification_type: type,
      template_id: template?.id || "",
      language: payload.language || preference?.language || "en-IN",
      message_preview: message,
      sensitive: sensitive ? 1 : 0,
      requires_approval: requiresApproval,
      status: requiresApproval ? "approval_required" : "queued",
      quiet_hours_deferred: quietHourDeferred(preference || {}, scheduledAt) ? 1 : 0,
      scheduled_at: scheduledAt,
      metadata_json: toJson(payload.metadata || {}),
      created_by: access.userId || ""
    };
    db.transaction(() => {
      db.prepare(`INSERT INTO staff_notification_queue
        (id, tenant_id, branch_id, staff_id, notification_type, template_id, language, message_preview, sensitive, requires_approval, status, quiet_hours_deferred, scheduled_at, metadata_json, created_by)
        VALUES (@id, @tenant_id, @branch_id, @staff_id, @notification_type, @template_id, @language, @message_preview, @sensitive, @requires_approval, @status, @quiet_hours_deferred, @scheduled_at, @metadata_json, @created_by)`).run(row);
      staffAudit("staff.notification_queued", "staff_notification_queue", row.id, access, { after: row, branchId });
    })();
    emitStaffEvent("staff:notification_queued", access, branchId, row.id);
    return camel(db.prepare("SELECT * FROM staff_notification_queue WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  approve(id, access) {
    access = requireTenant(access);
    requireManager(access);
    const row = this.queueRow(id, access);
    db.transaction(() => {
      db.prepare("UPDATE staff_notification_queue SET status = 'approved', approved_by = ?, approved_at = ?, version = version + 1, updated_at = ? WHERE id = ? AND tenant_id = ?")
        .run(access.userId || "", now(), now(), id, access.tenantId);
      staffAudit("staff.notification_approved", "staff_notification_queue", id, access, { before: row, branchId: row.branch_id });
    })();
    emitStaffEvent("staff:notification_approved", access, row.branch_id, id);
    return this.queueRow(id, access, true);
  }

  markSent(id, payload = {}, access) {
    access = requireTenant(access);
    requireManager(access);
    const row = this.queueRow(id, access);
    const status = payload.status || "sent";
    db.transaction(() => {
      db.prepare("UPDATE staff_notification_queue SET status = ?, provider_message_id = ?, version = version + 1, updated_at = ? WHERE id = ? AND tenant_id = ?")
        .run(status, payload.providerMessageId || payload.provider_message_id || "", now(), id, access.tenantId);
      db.prepare(`INSERT INTO staff_notification_delivery_logs
        (id, tenant_id, branch_id, queue_id, provider, provider_message_id, status, error_message, payload_json)
        VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`).run(
        makeId("sndlog"), access.tenantId, row.branch_id, id, payload.provider || "manual",
        payload.providerMessageId || payload.provider_message_id || "", status, payload.errorMessage || "", toJson(payload)
      );
      staffAudit(`staff.notification_${status}`, "staff_notification_queue", id, access, { before: row, after: payload, branchId: row.branch_id });
    })();
    emitStaffEvent(status === "sent" ? "staff:notification_sent" : "staff:notification_failed", access, row.branch_id, id);
    return this.queueRow(id, access, true);
  }

  logs(query = {}, access) {
    access = requireTenant(access);
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      limit: Math.min(Number(query.limit || 100), 500)
    };
    const filters = [scopedBranchWhere(access, params)];
    return db.prepare(`SELECT * FROM staff_notification_delivery_logs WHERE ${filters.join(" AND ")} ORDER BY created_at DESC LIMIT @limit`).all(params).map(camel);
  }

  preference(staffId, access) {
    return db.prepare("SELECT * FROM staff_notification_preferences WHERE tenant_id = ? AND staff_id = ?").get(access.tenantId, staffId) || {
      whatsapp_opt_in: 1,
      language: "en-IN",
      quiet_hours_start: "21:00",
      quiet_hours_end: "08:00",
      allow_payroll_amounts: 0
    };
  }

  queueRow(id, access, asCamel = false) {
    const row = db.prepare("SELECT * FROM staff_notification_queue WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Notification not found");
    assertBranch(access, row.branch_id);
    return asCamel ? camel(row) : row;
  }

  renderTemplate(template, variables = {}) {
    return String(template || "").replace(/\{\{\s*([a-zA-Z0-9_.]+)\s*\}\}/g, (_match, key) => {
      if (key === "staff.full_name") return variables.staff?.full_name || "";
      if (key === "staff.first_name") return variables.staff?.first_name || "";
      return variables[key] ?? "";
    });
  }
}

export const staffWhatsappNotificationService = new StaffWhatsappNotificationService();
