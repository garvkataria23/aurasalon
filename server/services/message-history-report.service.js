import { db } from "../db.js";

const SOURCE_LABELS = {
  message_logs: "Message Log",
  whatsapp_messages: "WhatsApp Automation",
  engagement_messages: "Engagement",
  invoice_notification_queue: "Invoice Notification",
  staff_notification_queue: "Staff Notification",
  notifications: "Notification Center"
};

function safeJson(value, fallback = {}) {
  if (!value) return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(String(value));
  } catch {
    return fallback;
  }
}

function tableExists(table) {
  return !!db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = @table").get({ table });
}

function dateMs(value = "") {
  const time = new Date(String(value || "")).getTime();
  return Number.isFinite(time) ? time : 0;
}

function dateKey(value = "") {
  const time = dateMs(value);
  return time ? new Date(time).toISOString().slice(0, 10) : "";
}

function timeLabel(value = "") {
  const time = dateMs(value);
  return time
    ? new Date(time).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit", hour12: true, timeZone: "Asia/Kolkata" })
    : "";
}

function normalizeStatus(value = "") {
  const status = String(value || "queued").toLowerCase();
  if (status.includes("deliver")) return "delivered";
  if (status.includes("fail") || status.includes("error")) return "failed";
  if (status.includes("sent")) return "sent";
  if (status.includes("read")) return "read";
  if (status.includes("block")) return "blocked";
  if (status.includes("queue") || status.includes("pending")) return "queued";
  return status || "queued";
}

function direction(row = {}) {
  return String(row.direction || row.direction_type || "outbound").toLowerCase();
}

function contains(row, query) {
  if (!query) return true;
  const text = [
    row.template,
    row.message,
    row.contact,
    row.clientName,
    row.channel,
    row.provider,
    row.status,
    row.deliveryStatus,
    row.source,
    row.referenceLabel
  ].join(" ").toLowerCase();
  return text.includes(query.toLowerCase());
}

function inDateRange(row, from, to) {
  const key = row.date || dateKey(row.sentAt || row.createdAt);
  if (from && key < from) return false;
  if (to && key > to) return false;
  return true;
}

function filtersMatch(row, query = {}) {
  const channel = String(query.channel || "all").toLowerCase();
  const status = String(query.status || "all").toLowerCase();
  const source = String(query.source || "all").toLowerCase();
  const directionFilter = String(query.direction || "outbound").toLowerCase();
  const template = String(query.template || "").toLowerCase();
  const branchId = String(query.branchId || query.branch_id || "").trim();
  if (channel !== "all" && String(row.channel || "").toLowerCase() !== channel) return false;
  if (status !== "all" && String(row.status || "").toLowerCase() !== status) return false;
  if (source !== "all" && String(row.sourceKey || "").toLowerCase() !== source) return false;
  if (directionFilter !== "all" && String(row.direction || "").toLowerCase() !== directionFilter) return false;
  if (template && !String(row.template || "").toLowerCase().includes(template)) return false;
  if (branchId && String(row.branchId || "") !== branchId) return false;
  if (!inDateRange(row, query.from || "", query.to || "")) return false;
  return contains(row, String(query.q || query.search || "").trim());
}

function baseRow(sourceKey, row, overrides = {}) {
  const createdAt = overrides.createdAt || row.createdAt || row.created_at || "";
  const sentAt = overrides.sentAt || row.sentAt || row.sent_at || createdAt;
  const payload = overrides.payload || {};
  const providerPayload = safeJson(row.provider_payload_json || row.providerResponse || row.provider_response_json || row.metadata_json || row.metadata, {});
  const provider = overrides.provider || row.provider || row.provider_mode || providerPayload.provider || payload.provider || "";
  const contact = overrides.contact || row.recipient || row.recipient_address || row.phone || row.to || "";
  const status = normalizeStatus(overrides.status || row.status || row.delivery_status);
  return {
    id: `${sourceKey}:${row.id}`,
    sourceId: row.id,
    sourceKey,
    source: SOURCE_LABELS[sourceKey] || sourceKey,
    channel: String(overrides.channel || row.channel || "whatsapp").toLowerCase(),
    direction: direction(row),
    template: overrides.template || row.templateKey || row.template_key || row.template_id || row.notification_type || payload.template || "",
    message: overrides.message || row.message || row.body || row.message_body || row.message_preview || "",
    contact,
    clientId: overrides.clientId || row.clientId || row.client_id || "",
    clientName: overrides.clientName || row.recipient_name || row.clientName || row.client_name || "",
    status,
    deliveryStatus: normalizeStatus(overrides.deliveryStatus || row.delivery_status || status),
    provider,
    providerMessageId: overrides.providerMessageId || row.providerMessageId || row.provider_message_id || "",
    referenceType: overrides.referenceType || "",
    referenceId: overrides.referenceId || row.invoice_id || row.appointment_id || "",
    referenceLabel: overrides.referenceLabel || row.invoice_no || "",
    branchId: overrides.branchId || row.branchId || row.branch_id || "",
    createdAt,
    sentAt,
    date: dateKey(sentAt || createdAt),
    time: timeLabel(sentAt || createdAt)
  };
}

function rowsFromMessageLogs(access) {
  if (!tableExists("message_logs")) return [];
  return db.prepare(`
    SELECT * FROM message_logs
    WHERE tenantId = @tenantId
    ORDER BY createdAt DESC
    LIMIT @limit
  `).all({ tenantId: access.tenantId, limit: 5000 }).map((row) => {
    const payload = safeJson(row.payload, {});
    return baseRow("message_logs", row, {
      payload,
      template: payload.template || payload.templateKey || payload.messageType || "",
      referenceType: payload.referenceType || payload.entityType || "",
      referenceId: payload.referenceId || payload.invoiceId || payload.appointmentId || "",
      referenceLabel: payload.invoiceNo || payload.referenceLabel || ""
    });
  });
}

function rowsFromWhatsappMessages(access) {
  if (!tableExists("whatsapp_messages")) return [];
  return db.prepare(`
    SELECT * FROM whatsapp_messages
    WHERE tenantId = @tenantId
    ORDER BY createdAt DESC
    LIMIT @limit
  `).all({ tenantId: access.tenantId, limit: 5000 }).map((row) => {
    const metadata = safeJson(row.metadata, {});
    return baseRow("whatsapp_messages", row, {
      contact: metadata.phone || metadata.contact || metadata.recipient || "",
      clientName: metadata.clientName || metadata.name || "",
      template: row.templateKey || metadata.template || metadata.messageType || row.eventType || "",
      referenceType: metadata.invoiceId ? "invoice" : metadata.appointmentId ? "appointment" : "",
      referenceId: metadata.invoiceId || metadata.appointmentId || "",
      referenceLabel: metadata.invoiceNo || metadata.appointmentNo || ""
    });
  });
}

function rowsFromEngagementMessages(access) {
  if (!tableExists("engagement_messages")) return [];
  return db.prepare(`
    SELECT * FROM engagement_messages
    WHERE tenant_id = @tenantId
    ORDER BY created_at DESC
    LIMIT @limit
  `).all({ tenantId: access.tenantId, limit: 5000 }).map((row) => {
    return baseRow("engagement_messages", row, {
      channel: row.channel,
      template: row.template_id || row.event_type || row.message_type || "",
      message: row.body || row.body_preview || "",
      contact: row.recipient_address || "",
      clientId: row.client_id || "",
      clientName: row.recipient_name || "",
      deliveryStatus: row.delivery_status || row.status,
      providerMessageId: row.provider_message_id || "",
      referenceType: row.invoice_id ? "invoice" : row.appointment_id ? "appointment" : "",
      referenceId: row.invoice_id || row.appointment_id || "",
      createdAt: row.created_at,
      sentAt: row.sent_at || row.created_at,
      branchId: row.branch_id
    });
  });
}

function rowsFromInvoiceNotifications(access) {
  if (!tableExists("invoice_notification_queue")) return [];
  return db.prepare(`
    SELECT * FROM invoice_notification_queue
    WHERE tenant_id = @tenantId
    ORDER BY created_at DESC
    LIMIT @limit
  `).all({ tenantId: access.tenantId, limit: 5000 }).map((row) => {
    return baseRow("invoice_notification_queue", row, {
      channel: row.channel,
      template: row.recipient_type || "invoice_notification",
      message: row.message_body || row.message_subject || "",
      contact: row.recipient_address || "",
      clientId: row.client_id || "",
      clientName: row.recipient_name || "",
      provider: row.provider_mode || "",
      referenceType: "invoice",
      referenceId: row.invoice_id || "",
      referenceLabel: row.invoice_no || "",
      createdAt: row.created_at || row.queued_at || "",
      sentAt: row.sent_at || row.queued_at || row.created_at || "",
      branchId: row.branch_id || ""
    });
  });
}

function rowsFromStaffNotifications(access) {
  if (!tableExists("staff_notification_queue")) return [];
  return db.prepare(`
    SELECT * FROM staff_notification_queue
    WHERE tenant_id = @tenantId
    ORDER BY created_at DESC
    LIMIT @limit
  `).all({ tenantId: access.tenantId, limit: 5000 }).map((row) => {
    return baseRow("staff_notification_queue", row, {
      channel: row.channel || "whatsapp",
      template: row.notification_type || row.template_id || "",
      message: row.message_preview || "",
      contact: row.staff_id || "",
      providerMessageId: row.provider_message_id || "",
      referenceType: "staff",
      referenceId: row.staff_id || "",
      createdAt: row.created_at || row.scheduled_at || "",
      sentAt: row.updated_at || row.created_at || row.scheduled_at || "",
      branchId: row.branch_id || ""
    });
  });
}

function rowsFromNotifications(access) {
  if (!tableExists("notifications")) return [];
  return db.prepare(`
    SELECT * FROM notifications
    WHERE tenantId = @tenantId
    ORDER BY createdAt DESC
    LIMIT @limit
  `).all({ tenantId: access.tenantId, limit: 5000 }).map((row) => {
    return baseRow("notifications", row, {
      template: row.type || "",
      clientId: row.clientId || "",
      createdAt: row.createdAt || "",
      sentAt: row.createdAt || ""
    });
  });
}

function buildSummary(rows) {
  const bySource = {};
  const byStatus = {};
  const byChannel = {};
  for (const row of rows) {
    bySource[row.sourceKey] = (bySource[row.sourceKey] || 0) + 1;
    byStatus[row.status] = (byStatus[row.status] || 0) + 1;
    byChannel[row.channel] = (byChannel[row.channel] || 0) + 1;
  }
  return {
    total: rows.length,
    outbound: rows.filter((row) => row.direction === "outbound").length,
    queued: byStatus.queued || 0,
    sent: byStatus.sent || 0,
    delivered: byStatus.delivered || 0,
    failed: byStatus.failed || 0,
    whatsapp: byChannel.whatsapp || 0,
    sms: byChannel.sms || 0,
    email: byChannel.email || 0,
    bySource,
    byStatus,
    byChannel
  };
}

export const messageHistoryReportService = {
  report(query = {}, access = {}) {
    const tenantId = access.tenantId || "tenant_aura";
    const rows = [
      ...rowsFromMessageLogs({ ...access, tenantId }),
      ...rowsFromWhatsappMessages({ ...access, tenantId }),
      ...rowsFromEngagementMessages({ ...access, tenantId }),
      ...rowsFromInvoiceNotifications({ ...access, tenantId }),
      ...rowsFromStaffNotifications({ ...access, tenantId }),
      ...rowsFromNotifications({ ...access, tenantId })
    ]
      .filter((row) => filtersMatch(row, query))
      .sort((a, b) => dateMs(b.sentAt || b.createdAt) - dateMs(a.sentAt || a.createdAt));
    const limit = Math.min(Math.max(Number(query.limit || 500), 1), 2000);
    return {
      summary: buildSummary(rows),
      rows: rows.slice(0, limit),
      sources: Object.entries(SOURCE_LABELS).map(([key, label]) => ({ key, label }))
    };
  }
};
