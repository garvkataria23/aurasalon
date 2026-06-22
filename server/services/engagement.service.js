import { randomUUID } from "node:crypto";
import { db } from "../db.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";
import { resourceService } from "./resource.service.js";
import { smartBookingService } from "./smart-booking.service.js";
import { tenantService } from "./tenant.service.js";
import { aiAssistantLlmService } from "./ai-assistant-llm.service.js";
import { reputationService } from "./reputation/reputation.service.js";

const THREAD_TYPES = new Set(["whatsapp", "sms", "email", "call", "review", "appointment", "system_alert"]);
const THREAD_STATUSES = new Set(["open", "pending", "waiting_for_client", "resolved", "escalated", "archived"]);
const MESSAGE_CHANNELS = THREAD_TYPES;
const MESSAGE_APPROVAL_STATUSES = new Set(["not_required", "pending", "approved", "rejected"]);
const TEMPLATE_APPROVAL_STATUSES = new Set(["pending", "approved", "rejected"]);
const TEMPLATE_STATUSES = new Set(["draft", "active", "paused", "archived"]);
const REVIEW_RESPONSE_TONES = new Set(["warm", "professional", "apology", "retention"]);
const RECOVERY_OPPORTUNITY_TYPES = new Set([
  "abandoned_appointment",
  "missed_call",
  "no_show",
  "cancelled_appointment",
  "package_expiry",
  "membership_expiry",
  "payment_due",
  "inactive_client",
  "negative_review",
  "high_value_client_inactive",
  "wallet_balance_unused",
  "service_due_reminder"
]);
const RECOVERY_STATUSES = new Set(["open", "assigned", "draft_created", "done", "lost", "archived"]);
const RECOVERY_PRIORITIES = new Set(["low", "normal", "high", "urgent"]);
const RISK_SIGNAL_TYPES = new Set([
  "angry_client",
  "repeated_cancellation",
  "unpaid_due",
  "package_expiry",
  "membership_expiry",
  "negative_review",
  "no_show_risk",
  "high_value_client_inactive",
  "repeated_staff_complaint",
  "appointment_delay_risk",
  "whatsapp_opt_out",
  "failed_payment_link",
  "abandoned_booking"
]);
const RISK_LEVELS = new Set(["low", "medium", "high", "critical"]);
const RISK_REVIEW_STATUSES = new Set(["unreviewed", "reviewing", "acknowledged", "resolved", "dismissed", "false_positive"]);
const THREAD_CLOSE_STATUSES = new Set(["resolved", "archived"]);
const SLA_CLOSE_ROLES = new Set(["owner", "super_admin", "superadmin", "admin", "manager"]);
const ENGAGEMENT_APPROVAL_ROLES = new Set(["owner", "super_admin", "superadmin", "manager"]);
const ENGAGEMENT_BROADCAST_APPROVAL_ROLES = new Set(["owner", "super_admin", "superadmin", "manager"]);
const ENGAGEMENT_SEND_ROLES = new Set(["owner", "super_admin", "superadmin", "manager", "front_desk", "frontdesk", "cashier"]);
const SENSITIVE_MESSAGE_TYPES = new Set([
  "payment_due",
  "discount_offer",
  "refund_cancellation",
  "complaint_response",
  "negative_review_response"
]);
const SENSITIVE_MESSAGE_PATTERNS = [
  { type: "payment_due", pattern: /\b(payment due|due amount|pending balance|outstanding|pay now|payment link|balance due)\b/i },
  { type: "discount_offer", pattern: /\b(discount|offer|coupon|promo|% off|flat off|special price)\b/i },
  { type: "refund_cancellation", pattern: /\b(refund|cancellation|cancel membership|cancel appointment|credit note|return amount)\b/i },
  { type: "complaint_response", pattern: /\b(complaint|escalation|sorry for|apologize|resolve this|bad experience)\b/i },
  { type: "negative_review_response", pattern: /\b(negative review|poor review|bad review|one star|1 star|low rating)\b/i }
];
const SLA_POLICY_MINUTES = {
  urgent: 30,
  high: 60,
  normal: 240,
  low: 480
};
const TEMPLATE_VARIABLES = new Set([
  "client_name",
  "appointment_date",
  "appointment_time",
  "service_name",
  "staff_name",
  "branch_name",
  "due_amount",
  "membership_name",
  "membership_expiry",
  "package_name",
  "package_credits",
  "payment_link",
  "booking_link"
]);
const DEFAULT_TEMPLATE_CATALOG = [
  {
    key: "appointment_confirmation",
    name: "Appointment confirmation",
    category: "appointment",
    body: "Hi {{client_name}}, your appointment for {{service_name}} is confirmed on {{appointment_date}} at {{appointment_time}} with {{staff_name}} at {{branch_name}}."
  },
  {
    key: "appointment_reminder",
    name: "Appointment reminder",
    category: "appointment",
    body: "Hi {{client_name}}, reminder for your {{service_name}} appointment on {{appointment_date}} at {{appointment_time}}. See you at {{branch_name}}."
  },
  {
    key: "reschedule_follow_up",
    name: "Reschedule follow-up",
    category: "appointment",
    body: "Hi {{client_name}}, we noticed your appointment was rescheduled. Your new slot is {{appointment_date}} at {{appointment_time}} for {{service_name}}."
  },
  {
    key: "cancellation_recovery",
    name: "Cancellation recovery",
    category: "recovery",
    body: "Hi {{client_name}}, sorry we missed you after the cancellation. You can book your next {{service_name}} slot here: {{booking_link}}."
  },
  {
    key: "no_show_recovery",
    name: "No-show recovery",
    category: "recovery",
    body: "Hi {{client_name}}, we missed you for {{service_name}}. Reply here or use {{booking_link}} to choose a new time."
  },
  {
    key: "birthday_greeting",
    name: "Birthday greeting",
    category: "occasion",
    body: "Happy birthday {{client_name}}. AuraShine wishes you a beautiful day. Book your celebration service here: {{booking_link}}."
  },
  {
    key: "anniversary_greeting",
    name: "Anniversary greeting",
    category: "occasion",
    body: "Happy anniversary {{client_name}}. Celebrate with your favorite service at {{branch_name}}. Book here: {{booking_link}}."
  },
  {
    key: "membership_expiry",
    name: "Membership expiry",
    category: "membership",
    body: "Hi {{client_name}}, your {{membership_name}} membership expires on {{membership_expiry}}. Renew early to keep benefits active."
  },
  {
    key: "package_expiry",
    name: "Package expiry",
    category: "package",
    body: "Hi {{client_name}}, your {{package_name}} package has {{package_credits}} credits left. Please use it before expiry."
  },
  {
    key: "payment_due",
    name: "Payment due",
    category: "payment",
    body: "Hi {{client_name}}, your pending balance is {{due_amount}}. Please complete payment here: {{payment_link}}."
  },
  {
    key: "review_thank_you",
    name: "Review thank-you",
    category: "review",
    body: "Thank you {{client_name}} for your review. We are happy you visited {{branch_name}}."
  },
  {
    key: "negative_review_recovery",
    name: "Negative review recovery",
    category: "review",
    body: "Hi {{client_name}}, we are sorry your experience was not ideal. Our manager will help resolve this personally."
  },
  {
    key: "inactive_client_win_back",
    name: "Inactive client win-back",
    category: "recovery",
    body: "Hi {{client_name}}, we would love to welcome you back to {{branch_name}}. Book your next visit here: {{booking_link}}."
  },
  {
    key: "service_upsell",
    name: "Service upsell",
    category: "upsell",
    body: "Hi {{client_name}}, based on your visits, {{service_name}} would be a great next service with {{staff_name}}."
  },
  {
    key: "feedback_request",
    name: "Feedback request",
    category: "feedback",
    body: "Hi {{client_name}}, thank you for visiting {{branch_name}} for {{service_name}}. Please share your feedback with us."
  }
];

const PROVIDER_ADAPTERS = [
  {
    providerName: "whatsapp_cloud",
    label: "WhatsApp Cloud API",
    channel: "whatsapp",
    providerType: "whatsapp",
    senderLabel: "Business phone / WABA sender",
    supportsTemplates: true,
    supportsWebhook: true,
    directSendImplemented: false,
    requiredFields: ["senderId", "templateNamespace", "webhookUrl"]
  },
  {
    providerName: "gupshup",
    label: "Gupshup",
    channel: "whatsapp",
    providerType: "whatsapp",
    senderLabel: "Gupshup app / sender",
    supportsTemplates: true,
    supportsWebhook: true,
    directSendImplemented: false,
    requiredFields: ["senderId", "templateNamespace", "webhookUrl"]
  },
  {
    providerName: "interakt",
    label: "Interakt",
    channel: "whatsapp",
    providerType: "whatsapp",
    senderLabel: "Interakt phone / sender",
    supportsTemplates: true,
    supportsWebhook: true,
    directSendImplemented: false,
    requiredFields: ["senderId", "templateNamespace", "webhookUrl"]
  },
  {
    providerName: "twilio",
    label: "Twilio",
    channel: "sms",
    providerType: "sms",
    senderLabel: "Twilio number / sender",
    supportsTemplates: false,
    supportsWebhook: true,
    directSendImplemented: false,
    requiredFields: ["senderId", "webhookUrl"]
  },
  {
    providerName: "email_smtp",
    label: "Email SMTP",
    channel: "email",
    providerType: "email",
    senderLabel: "From email / sender id",
    supportsTemplates: false,
    supportsWebhook: false,
    directSendImplemented: false,
    requiredFields: ["senderId"]
  },
  {
    providerName: "sms_placeholder",
    label: "SMS provider placeholder",
    channel: "sms",
    providerType: "sms",
    senderLabel: "SMS sender id",
    supportsTemplates: false,
    supportsWebhook: true,
    directSendImplemented: false,
    requiredFields: ["senderId"]
  },
  {
    providerName: "call_placeholder",
    label: "Call provider placeholder",
    channel: "call",
    providerType: "call",
    senderLabel: "Caller id / desk line",
    supportsTemplates: false,
    supportsWebhook: true,
    directSendImplemented: false,
    requiredFields: ["senderId"]
  }
];
const PROVIDER_NAMES = new Set(PROVIDER_ADAPTERS.map((adapter) => adapter.providerName));
const PROVIDER_ACCOUNT_STATUSES = new Set(["inactive", "active", "paused", "archived"]);

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 12)}`;

function text(value) {
  return String(value ?? "").trim();
}

function limit(value, fallback = 50) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), 200);
}

function parseJson(value, fallback) {
  if (value === undefined || value === null || value === "") return fallback;
  if (typeof value !== "string") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function stringify(value, fallback) {
  return JSON.stringify(value ?? fallback);
}

function normalizeThreadType(value) {
  const type = text(value || "whatsapp").toLowerCase();
  if (!THREAD_TYPES.has(type)) {
    throw badRequest("Unsupported engagement thread type", { allowed: [...THREAD_TYPES] });
  }
  return type;
}

function normalizeThreadStatus(value) {
  const status = text(value || "open").toLowerCase();
  if (!THREAD_STATUSES.has(status)) {
    throw badRequest("Unsupported engagement thread status", { allowed: [...THREAD_STATUSES] });
  }
  return status;
}

function normalizeChannel(value) {
  const channel = text(value || "whatsapp").toLowerCase();
  if (!MESSAGE_CHANNELS.has(channel)) {
    throw badRequest("Unsupported engagement message channel", { allowed: [...MESSAGE_CHANNELS] });
  }
  return channel;
}

function normalizeProviderName(value) {
  const providerName = text(value || "whatsapp_cloud").toLowerCase();
  if (!PROVIDER_NAMES.has(providerName)) {
    throw badRequest("Unsupported engagement provider", { allowed: [...PROVIDER_NAMES] });
  }
  return providerName;
}

function normalizeProviderAccountStatus(value) {
  const status = text(value || "inactive").toLowerCase();
  if (!PROVIDER_ACCOUNT_STATUSES.has(status)) {
    throw badRequest("Unsupported provider status", { allowed: [...PROVIDER_ACCOUNT_STATUSES] });
  }
  return status;
}

function normalizeTemplateStatus(value) {
  const status = text(value || "draft").toLowerCase();
  if (!TEMPLATE_STATUSES.has(status)) {
    throw badRequest("Unsupported engagement template status", { allowed: [...TEMPLATE_STATUSES] });
  }
  return status;
}

function normalizeTemplateApprovalStatus(value, channel = "whatsapp") {
  const fallback = channel === "whatsapp" ? "pending" : "approved";
  const status = text(value || fallback).toLowerCase();
  if (!TEMPLATE_APPROVAL_STATUSES.has(status)) {
    throw badRequest("Unsupported engagement template approval status", { allowed: [...TEMPLATE_APPROVAL_STATUSES] });
  }
  return status;
}

function slugify(value) {
  return text(value)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}

function extractTemplateVariables(body) {
  const found = new Set();
  const pattern = /\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g;
  let match = pattern.exec(body || "");
  while (match) {
    found.add(match[1]);
    match = pattern.exec(body || "");
  }
  return [...found];
}

function validateTemplateVariables(variables = []) {
  const list = [...new Set((Array.isArray(variables) ? variables : arrayValue(variables)).map((item) => text(item)).filter(Boolean))];
  const unsupported = list.filter((item) => !TEMPLATE_VARIABLES.has(item));
  if (unsupported.length) {
    throw badRequest("Unsupported engagement template variables", { unsupportedVariables: unsupported, allowedVariables: [...TEMPLATE_VARIABLES] });
  }
  return list;
}

function branchScope(access = {}, requestedBranchId = "") {
  const scoped = tenantService.accessScope(access);
  const branchId = text(requestedBranchId || scoped.branchId || "");
  if (branchId) tenantService.assertBranchAccess(access, branchId);
  return branchId;
}

function actor(access = {}) {
  return {
    userId: access.userId || "system-user",
    role: access.role || "owner"
  };
}

function canApproveEngagement(access = {}) {
  return ENGAGEMENT_APPROVAL_ROLES.has(roleKey(access.role));
}

function canApproveBroadcast(access = {}) {
  return ENGAGEMENT_BROADCAST_APPROVAL_ROLES.has(roleKey(access.role));
}

function canSendEngagement(access = {}) {
  return ENGAGEMENT_SEND_ROLES.has(roleKey(access.role));
}

function plainObject(value) {
  return value && typeof value === "object" && !Array.isArray(value) ? value : {};
}

function truthyFlag(value) {
  if (typeof value === "boolean") return value;
  if (typeof value === "number") return value !== 0;
  return ["1", "true", "yes", "y", "on"].includes(text(value).toLowerCase());
}

function metadataFlag(metadata = {}, names = []) {
  const source = plainObject(metadata);
  return names.some((name) => truthyFlag(source[name]));
}

function firstColumn(columns, names = []) {
  for (const name of names) {
    if (columns.has(name)) return name;
  }
  return "";
}

function detectSensitiveMessage({ body = "", payload = {}, metadata = {} } = {}) {
  const found = new Set();
  const explicit = [
    payload.sensitiveType,
    payload.messageType,
    payload.detectedIntent,
    payload.intent,
    payload.category,
    metadata.sensitiveType,
    metadata.messageType,
    metadata.detectedIntent,
    metadata.intent,
    metadata.category
  ].map((item) => text(item).toLowerCase()).filter(Boolean);
  for (const item of explicit) {
    if (SENSITIVE_MESSAGE_TYPES.has(item)) found.add(item);
  }
  const content = text(body);
  for (const rule of SENSITIVE_MESSAGE_PATTERNS) {
    if (rule.pattern.test(content)) found.add(rule.type);
  }
  const types = [...found];
  return {
    sensitive: types.length > 0,
    types,
    reasons: types.map((type) => `${type.replace(/_/g, " ")} messages require manager approval`),
    riskLevel: types.includes("refund_cancellation") || types.includes("negative_review_response") ? "high" : types.length ? "medium" : "low"
  };
}

function messageMetadata(message = {}) {
  return plainObject(message.metadata || parseJson(message.metadata_json, {}));
}

function enterpriseControlsFromMessage(message = {}) {
  const metadata = messageMetadata(message);
  return plainObject(metadata.enterpriseControls);
}

function isBroadcastMessage({ payload = {}, thread = {}, metadata = {} } = {}) {
  return Boolean(
    payload.broadcast ||
    payload.isBroadcast ||
    metadata.broadcast ||
    metadata.isBroadcast ||
    metadata.campaignId ||
    metadata.broadcastId ||
    /broadcast|campaign|bulk/i.test(text(thread.source || thread.subject || ""))
  );
}

function quietHoursActive(policy = {}, referenceDate = new Date()) {
  const config = plainObject(policy);
  if (!truthyFlag(config.enabled)) return false;
  const startHour = Number.isFinite(Number(config.startHour)) ? Math.floor(Number(config.startHour)) : 21;
  const endHour = Number.isFinite(Number(config.endHour)) ? Math.floor(Number(config.endHour)) : 8;
  const hour = Number.isFinite(Number(config.currentHour)) ? Math.floor(Number(config.currentHour)) : referenceDate.getHours();
  if (startHour === endHour) return true;
  if (startHour < endHour) return hour >= startHour && hour < endHour;
  return hour >= startHour || hour < endHour;
}

function commonEntity(payload = {}, fallback = {}) {
  return {
    branchId: text(payload.branchId ?? fallback.branchId ?? ""),
    clientId: text(payload.clientId ?? fallback.clientId ?? ""),
    appointmentId: text(payload.appointmentId ?? fallback.appointmentId ?? ""),
    invoiceId: text(payload.invoiceId ?? fallback.invoiceId ?? ""),
    membershipId: text(payload.membershipId ?? fallback.membershipId ?? ""),
    packageId: text(payload.packageId ?? fallback.packageId ?? ""),
    staffId: text(payload.staffId ?? fallback.staffId ?? ""),
    assignedTo: text(payload.assignedTo ?? fallback.assignedTo ?? "")
  };
}

function rowToThread(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    clientId: row.client_id || "",
    appointmentId: row.appointment_id || "",
    invoiceId: row.invoice_id || "",
    membershipId: row.membership_id || "",
    packageId: row.package_id || "",
    staffId: row.staff_id || "",
    assignedTo: row.assigned_to || "",
    type: row.primary_channel,
    primaryChannel: row.primary_channel,
    source: row.source || "",
    subject: row.subject || "",
    displayName: row.display_name || "",
    phone: row.phone || "",
    email: row.email || "",
    status: row.status,
    priority: row.priority,
    riskLevel: row.risk_level,
    slaStatus: row.sla_status,
    lastMessageAt: row.last_message_at || "",
    lastMessagePreview: row.last_message_preview || "",
    unreadCount: Number(row.unread_count || 0),
    tags: parseJson(row.tags_json, []),
    metadata: parseJson(row.metadata_json, {}),
    archivedAt: row.archived_at || "",
    archivedBy: row.archived_by || "",
    archiveReason: row.archive_reason || "",
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToMessage(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    threadId: row.thread_id || "",
    clientId: row.client_id || "",
    appointmentId: row.appointment_id || "",
    invoiceId: row.invoice_id || "",
    membershipId: row.membership_id || "",
    packageId: row.package_id || "",
    staffId: row.staff_id || "",
    assignedTo: row.assigned_to || "",
    providerAccountId: row.provider_account_id || "",
    channel: row.channel,
    direction: row.direction,
    messageType: row.message_type,
    eventType: row.event_type || "",
    providerMessageId: row.provider_message_id || "",
    externalConversationId: row.external_conversation_id || "",
    senderUserId: row.sender_user_id || "",
    senderRole: row.sender_role || "",
    recipientName: row.recipient_name || "",
    recipientAddress: row.recipient_address || "",
    body: row.body || "",
    bodyPreview: row.body_preview || "",
    templateId: row.template_id || "",
    status: row.status,
    deliveryStatus: row.delivery_status,
    approvalStatus: row.approval_status,
    riskLevel: row.risk_level,
    consentStatus: row.consent_status,
    optOutChecked: Boolean(Number(row.opt_out_checked || 0)),
    providerPayload: parseJson(row.provider_payload_json, {}),
    metadata: parseJson(row.metadata_json, {}),
    createdBy: row.created_by || "",
    sentAt: row.sent_at || "",
    deliveredAt: row.delivered_at || "",
    readAt: row.read_at || "",
    failedAt: row.failed_at || "",
    failureReason: row.failure_reason || "",
    archivedAt: row.archived_at || "",
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToDraft(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    threadId: row.thread_id || "",
    messageId: row.message_id || "",
    clientId: row.client_id || "",
    channel: row.channel,
    draftType: row.draft_type,
    source: row.source,
    suggestedBody: row.suggested_body || "",
    editedBody: row.edited_body || "",
    detectedIntent: row.detected_intent || "",
    confidence: Number(row.confidence || 0),
    approvalRequired: Boolean(Number(row.approval_required || 0)),
    approvalStatus: row.approval_status,
    status: row.status,
    riskLevel: row.risk_level,
    riskReasons: parseJson(row.risk_reasons_json, []),
    metadata: parseJson(row.metadata_json, {}),
    createdBy: row.created_by || "",
    approvedBy: row.approved_by || "",
    approvedAt: row.approved_at || "",
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToTemplate(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    templateKey: row.template_key,
    key: row.template_key,
    name: row.name,
    channel: row.channel,
    category: row.category,
    language: row.language,
    purpose: row.purpose || "",
    body: row.body || "",
    variables: parseJson(row.variables_json, []),
    providerTemplateId: row.provider_template_id || "",
    providerStatus: row.provider_status,
    approvalStatus: row.approval_status,
    status: row.status,
    quietHours: parseJson(row.quiet_hours_json, {}),
    consentRequired: Boolean(Number(row.consent_required || 0)),
    optOutRequired: Boolean(Number(row.opt_out_required || 0)),
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    archivedAt: row.archived_at || "",
    archivedBy: row.archived_by || "",
    archiveReason: row.archive_reason || "",
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToProviderAccount(row) {
  if (!row) return null;
  const config = parseJson(row.config_json, {});
  const rateLimit = parseJson(row.rate_limit_json, {});
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    providerType: row.provider_type || "",
    providerName: row.provider_name || "",
    channel: row.channel || "",
    accountLabel: row.account_label || "",
    businessPhone: row.business_phone || "",
    senderId: row.sender_id || "",
    fromEmail: row.from_email || "",
    providerStatus: row.provider_status || "not_configured",
    directSendEnabled: Boolean(Number(row.direct_send_enabled || 0)),
    approvalRequired: Boolean(Number(row.approval_required ?? 1)),
    templateNamespace: config.templateNamespace || config.template_namespace || "",
    webhookUrl: config.webhookUrl || config.webhook_url || "",
    config,
    rateLimit,
    lastHealthStatus: row.last_health_status || "",
    lastCheckedAt: row.last_checked_at || "",
    lastVerifiedAt: row.last_checked_at || "",
    status: row.status || "inactive",
    createdBy: row.created_by || "",
    updatedBy: row.updated_by || "",
    archivedAt: row.archived_at || "",
    archivedBy: row.archived_by || "",
    archiveReason: row.archive_reason || "",
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToAudit(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    threadId: row.thread_id || "",
    messageId: row.message_id || "",
    clientId: row.client_id || "",
    appointmentId: row.appointment_id || "",
    invoiceId: row.invoice_id || "",
    membershipId: row.membership_id || "",
    packageId: row.package_id || "",
    staffId: row.staff_id || "",
    assignedTo: row.assigned_to || "",
    actorUserId: row.actor_user_id || "",
    actorRole: row.actor_role || "",
    action: row.action,
    entityType: row.entity_type,
    entityId: row.entity_id || "",
    before: parseJson(row.before_json, {}),
    after: parseJson(row.after_json, {}),
    details: parseJson(row.details_json, {}),
    severity: row.severity || "info",
    createdAt: row.created_at
  };
}

function rowToAiSummary(row) {
  if (!row) return null;
  const metadata = parseJson(row.metadata_json, {});
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    threadId: row.thread_id || "",
    clientId: row.client_id || "",
    appointmentId: row.appointment_id || "",
    invoiceId: row.invoice_id || "",
    membershipId: row.membership_id || "",
    packageId: row.package_id || "",
    staffId: row.staff_id || "",
    assignedTo: row.assigned_to || "",
    summaryScope: row.summary_scope,
    summaryText: row.summary_text || "",
    insights: parseJson(row.highlights_json, []),
    highlights: parseJson(row.highlights_json, []),
    suggestions: metadata.suggestions || [],
    alerts: metadata.alerts || [],
    risks: parseJson(row.risks_json, []),
    nextBestActions: parseJson(row.next_best_actions_json, []),
    dataSources: parseJson(row.data_sources_json, []),
    modelProvider: row.model_provider || "",
    modelName: row.model_name || "",
    confidence: Number(row.confidence || 0),
    status: row.status,
    generatedBy: row.generated_by || "",
    generatedAt: row.created_at,
    generated_at: row.created_at,
    expiresAt: row.expires_at || "",
    metadata,
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToClientAlert(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    threadId: row.thread_id || "",
    clientId: row.client_id || "",
    appointmentId: row.appointment_id || "",
    invoiceId: row.invoice_id || "",
    membershipId: row.membership_id || "",
    packageId: row.package_id || "",
    staffId: row.staff_id || "",
    assignedTo: row.assigned_to || "",
    alertType: row.alert_type,
    alert_type: row.alert_type,
    alertSource: row.alert_source,
    alert_source: row.alert_source,
    title: row.title || "",
    summary: row.summary || "",
    reason: row.summary || row.title || "",
    riskLevel: row.risk_level,
    risk_level: row.risk_level,
    riskScore: Number(row.risk_score || 0),
    risk_score: Number(row.risk_score || 0),
    priority: row.priority,
    status: row.status,
    reviewStatus: row.review_status,
    review_status: row.review_status,
    suggestedAction: row.suggested_action || "",
    suggested_action: row.suggested_action || "",
    evidence: parseJson(row.evidence_json, []),
    dueAt: row.due_at || "",
    createdBy: row.created_by || "",
    reviewedBy: row.reviewed_by || "",
    reviewedAt: row.reviewed_at || "",
    resolvedAt: row.resolved_at || "",
    resolutionNote: row.resolution_note || "",
    metadata: parseJson(row.metadata_json, {}),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function rowToRecoveryOpportunity(row) {
  if (!row) return null;
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    threadId: row.thread_id || "",
    clientId: row.client_id || "",
    appointmentId: row.appointment_id || "",
    invoiceId: row.invoice_id || "",
    membershipId: row.membership_id || "",
    packageId: row.package_id || "",
    staffId: row.staff_id || "",
    assignedTo: row.assigned_to || "",
    opportunityType: row.opportunity_type,
    type: row.opportunity_type,
    sourceEventId: row.source_event_id || "",
    sourceChannel: row.source_channel || "",
    title: row.title || "",
    reason: row.reason || "",
    suggestedAction: row.suggested_action || "",
    expectedValue: Number(row.expected_value || 0),
    revenueValue: Number(row.expected_value || 0),
    confidence: Number(row.confidence || 0),
    status: row.status,
    priority: row.priority,
    conversionId: row.conversion_id || "",
    dueAt: row.due_at || "",
    recoveredAt: row.recovered_at || "",
    lostAt: row.lost_at || "",
    outcome: row.outcome || "",
    evidence: parseJson(row.evidence_json, []),
    metadata: parseJson(row.metadata_json, {}),
    archivedAt: row.archived_at || "",
    archivedBy: row.archived_by || "",
    archiveReason: row.archive_reason || "",
    version: Number(row.version || 1),
    createdAt: row.created_at,
    updatedAt: row.updated_at
  };
}

function numberValue(value, fallback = 0) {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function normalizeReviewTone(value) {
  const tone = text(value || "warm").toLowerCase();
  if (!REVIEW_RESPONSE_TONES.has(tone)) {
    throw badRequest("Unsupported review response tone", { allowed: [...REVIEW_RESPONSE_TONES] });
  }
  return tone;
}

function reviewRisk(review = {}) {
  const rating = numberValue(review.rating, 0);
  const sentiment = text(review.sentiment).toLowerCase();
  if (rating <= 1.5 || sentiment.includes("very_negative")) return { riskLevel: "critical", riskScore: 95, priority: "urgent" };
  if (rating <= 2.5 || sentiment.includes("negative")) return { riskLevel: "high", riskScore: 82, priority: "high" };
  if (rating <= 3.5) return { riskLevel: "medium", riskScore: 55, priority: "normal" };
  return { riskLevel: "low", riskScore: 15, priority: "normal" };
}

function isNegativeReview(review = {}) {
  return reviewRisk(review).riskScore >= 55;
}

function normalizeRecoveryType(value) {
  const type = text(value).toLowerCase();
  if (!RECOVERY_OPPORTUNITY_TYPES.has(type)) {
    throw badRequest("Unsupported recovery opportunity type", { allowed: [...RECOVERY_OPPORTUNITY_TYPES] });
  }
  return type;
}

function normalizeRecoveryStatus(value, fallback = "open") {
  const status = text(value || fallback).toLowerCase();
  if (!RECOVERY_STATUSES.has(status)) {
    throw badRequest("Unsupported recovery opportunity status", { allowed: [...RECOVERY_STATUSES] });
  }
  return status;
}

function normalizeRecoveryPriority(value, fallback = "normal") {
  const priority = text(value || fallback).toLowerCase();
  if (!RECOVERY_PRIORITIES.has(priority)) {
    throw badRequest("Unsupported recovery priority", { allowed: [...RECOVERY_PRIORITIES] });
  }
  return priority;
}

function normalizeRiskSignalType(value) {
  const type = text(value).toLowerCase();
  if (!RISK_SIGNAL_TYPES.has(type)) {
    throw badRequest("Unsupported engagement risk signal type", { allowed: [...RISK_SIGNAL_TYPES] });
  }
  return type;
}

function riskLevelFromScore(score) {
  const value = Math.max(0, Math.min(100, numberValue(score)));
  if (value >= 90) return "critical";
  if (value >= 70) return "high";
  if (value >= 40) return "medium";
  return "low";
}

function normalizeRiskLevel(value, score = 0) {
  const level = text(value || "").toLowerCase();
  if (RISK_LEVELS.has(level)) return level;
  return riskLevelFromScore(score);
}

function normalizeRiskReviewStatus(value, fallback = "reviewing") {
  const status = text(value || fallback).toLowerCase();
  if (!RISK_REVIEW_STATUSES.has(status)) {
    throw badRequest("Unsupported engagement risk review status", { allowed: [...RISK_REVIEW_STATUSES] });
  }
  return status;
}

function riskPriority(level, score = 0) {
  const resolvedLevel = normalizeRiskLevel(level, score);
  if (resolvedLevel === "critical") return "urgent";
  if (resolvedLevel === "high") return "high";
  if (resolvedLevel === "medium") return "normal";
  return "low";
}

function riskStatusFromReview(reviewStatus, fallback = "open") {
  if (reviewStatus === "resolved") return "resolved";
  if (["dismissed", "false_positive"].includes(reviewStatus)) return "dismissed";
  return fallback || "open";
}

function booleanValue(value) {
  return value === true || value === 1 || ["1", "true", "yes", "on"].includes(String(value || "").toLowerCase());
}

function positiveInt(value, fallback = 1, max = 20) {
  const parsed = Math.floor(Number(value || fallback));
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(parsed, 1), max);
}

function normalizeServiceIds(payload = {}) {
  const ids = arrayValue(payload.serviceIds || payload.service_ids || [payload.serviceId || payload.service_id].filter(Boolean)).map(String);
  const unique = [...new Set(ids.map(text).filter(Boolean))];
  if (!unique.length) throw badRequest("service is required for engagement booking");
  return unique;
}

function addMinutesIso(value, minutes) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) throw badRequest("valid slot startAt is required");
  return new Date(date.getTime() + Math.max(1, Number(minutes || 45)) * 60000).toISOString();
}

function addMinutesSafeIso(value, minutes) {
  const parsed = dateMs(value) || Date.now();
  return new Date(parsed + Math.max(1, Number(minutes || 45)) * 60000).toISOString();
}

function dateMs(value) {
  const raw = text(value);
  if (!raw) return 0;
  const parsed = new Date(raw).getTime();
  return Number.isFinite(parsed) ? parsed : 0;
}

function secondsBetween(start, end) {
  const from = dateMs(start);
  const to = dateMs(end);
  if (!from || !to || to < from) return 0;
  return Math.round((to - from) / 1000);
}

function minutesBetween(start, end) {
  return Math.round(secondsBetween(start, end) / 60);
}

function roleKey(value) {
  const normalized = text(value || "staff")
    .replace(/([a-z0-9])([A-Z])/g, "$1_$2")
    .replace(/[\s-]+/g, "_")
    .toLowerCase();
  return normalized === "superadmin" ? "super_admin" : normalized;
}

function canCloseEscalatedThread(access = {}) {
  return SLA_CLOSE_ROLES.has(roleKey(actor(access).role));
}

function normalizeSlaPriority(value, fallback = "normal") {
  const priority = text(value || fallback).toLowerCase();
  return RECOVERY_PRIORITIES.has(priority) ? priority : fallback;
}

function slaPolicyMinutes(priority) {
  return SLA_POLICY_MINUTES[normalizeSlaPriority(priority)] || SLA_POLICY_MINUTES.normal;
}

function isOpenThreadStatus(status) {
  return !THREAD_CLOSE_STATUSES.has(text(status || "open").toLowerCase());
}

function average(values = []) {
  const clean = values.map(Number).filter((value) => Number.isFinite(value) && value >= 0);
  if (!clean.length) return 0;
  return Math.round(clean.reduce((sum, value) => sum + value, 0) / clean.length);
}

function percentValue(part, total) {
  const numerator = Number(part || 0);
  const denominator = Number(total || 0);
  if (!Number.isFinite(numerator) || !Number.isFinite(denominator) || denominator <= 0) return 0;
  return Math.round((numerator / denominator) * 1000) / 10;
}

function safeLimit(value, fallback = 1000, max = 5000) {
  const parsed = Number(value || fallback);
  if (!Number.isFinite(parsed)) return fallback;
  return Math.min(Math.max(Math.floor(parsed), 1), max);
}

function firstText(row = {}, keys = [], fallback = "") {
  for (const key of keys) {
    const value = row?.[key];
    if (value !== undefined && value !== null && value !== "") return text(value);
  }
  return fallback;
}

function dateOnlyIso(value) {
  const parsed = dateMs(value);
  if (!parsed) return "";
  return new Date(parsed).toISOString().slice(0, 10);
}

function reportDateBounds(query = {}) {
  const fromDate = text(query.fromDate || query.startDate || query.from || "");
  const toDate = text(query.toDate || query.endDate || query.to || "");
  const fromMs = fromDate ? new Date(`${fromDate}T00:00:00.000Z`).getTime() : 0;
  const toMs = toDate ? new Date(`${toDate}T23:59:59.999Z`).getTime() : 0;
  return {
    fromDate,
    toDate,
    fromMs: Number.isFinite(fromMs) ? fromMs : 0,
    toMs: Number.isFinite(toMs) ? toMs : 0
  };
}

function inReportDateRange(value, filters = {}) {
  if (!filters.fromMs && !filters.toMs) return true;
  const parsed = dateMs(value);
  if (!parsed) return false;
  if (filters.fromMs && parsed < filters.fromMs) return false;
  if (filters.toMs && parsed > filters.toMs) return false;
  return true;
}

function mapCounts(rows = [], keyFn, fallback = "unknown") {
  const counts = new Map();
  for (const row of rows) {
    const key = text(keyFn(row) || fallback) || fallback;
    counts.set(key, (counts.get(key) || 0) + 1);
  }
  return [...counts.entries()]
    .map(([key, count]) => ({ key, label: key.replace(/_/g, " "), count }))
    .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
}

function sumValue(rows = [], keyOrFn) {
  return rows.reduce((sum, row) => {
    const value = typeof keyOrFn === "function" ? keyOrFn(row) : row?.[keyOrFn];
    return sum + numberValue(value);
  }, 0);
}

function scopedReportRows(tableName, access, branchId = "", { orderBy = "updated_at", max = 1000 } = {}) {
  if (!tableExists(tableName)) return [];
  const columns = tableColumns(tableName);
  const tenantColumn = columns.has("tenant_id") ? "tenant_id" : columns.has("tenantId") ? "tenantId" : "";
  if (!tenantColumn) return [];
  const clauses = [`${tenantColumn} = ?`];
  const params = [access.tenantId];
  const branchColumn = columns.has("branch_id") ? "branch_id" : columns.has("branchId") ? "branchId" : "";
  if (branchId && branchColumn) {
    clauses.push(`${branchColumn} = ?`);
    params.push(branchId);
  }
  if (columns.has("archived_at")) clauses.push("(archived_at IS NULL OR archived_at = '')");
  if (columns.has("deletedAt")) clauses.push("(deletedAt IS NULL OR deletedAt = '')");
  const orderColumn = columns.has(orderBy) ? orderBy : columns.has("updated_at") ? "updated_at" : columns.has("updatedAt") ? "updatedAt" : columns.has("created_at") ? "created_at" : columns.has("createdAt") ? "createdAt" : "";
  const orderSql = orderColumn ? ` ORDER BY ${orderColumn} DESC` : "";
  params.push(safeLimit(max));
  return db.prepare(`SELECT * FROM ${tableName} WHERE ${clauses.join(" AND ")}${orderSql} LIMIT ?`).all(...params);
}

function reportRowMatches(row = {}, filters = {}, options = {}) {
  const dateKeys = options.dateKeys || ["created_at", "createdAt", "updated_at", "updatedAt"];
  const dateValue = firstText(row, dateKeys);
  if (!inReportDateRange(dateValue, filters)) return false;

  if (filters.staffId) {
    const staffKeys = options.staffKeys || ["staff_id", "staffId", "assigned_to", "assignedTo", "sender_user_id", "created_by", "approved_by", "assigned_by"];
    const staffValues = staffKeys.map((key) => text(row[key])).filter(Boolean);
    if (!staffValues.includes(filters.staffId)) return false;
  }

  if (filters.channel) {
    const channelKeys = options.channelKeys || ["primary_channel", "channel", "source_channel"];
    const channelValues = channelKeys.map((key) => text(row[key]).toLowerCase()).filter(Boolean);
    if (!channelValues.includes(filters.channel)) return false;
  }

  if (filters.status) {
    const statusKeys = options.statusKeys || ["status", "approval_status", "delivery_status"];
    const statusValues = statusKeys.map((key) => text(row[key]).toLowerCase()).filter(Boolean);
    if (!statusValues.includes(filters.status)) return false;
  }

  if (filters.riskLevel) {
    const riskKeys = options.riskKeys || ["risk_level"];
    const riskValues = riskKeys.map((key) => text(row[key]).toLowerCase()).filter(Boolean);
    if (!riskValues.includes(filters.riskLevel)) return false;
  }

  if (filters.recoveryType) {
    const recoveryType = text(row.opportunity_type || row.conversion_type || "").toLowerCase();
    if (recoveryType !== filters.recoveryType) return false;
  }

  if (filters.clientSegment) {
    const clientId = firstText(row, options.clientIdKeys || ["client_id", "clientId", "customer_id"]);
    if (!clientId || !options.clientSegmentMatches?.(clientId)) return false;
  }

  return true;
}

function minutesLabel(minutes) {
  const value = Number(minutes || 0);
  if (!Number.isFinite(value) || value <= 0) return "0m";
  if (value < 60) return `${Math.round(value)}m`;
  return `${Math.floor(value / 60)}h ${Math.round(value % 60)}m`;
}

function daysUntil(value) {
  const parsed = dateMs(value);
  if (!parsed) return null;
  return Math.ceil((parsed - Date.now()) / 86400000);
}

function ageDays(value) {
  const parsed = dateMs(value);
  if (!parsed) return null;
  return Math.floor((Date.now() - parsed) / 86400000);
}

function addDaysIso(days) {
  return new Date(Date.now() + Number(days || 0) * 86400000).toISOString();
}

function annualDateWithin(value, windowDays = 30) {
  const raw = text(value);
  if (!raw) return false;
  const date = new Date(raw);
  if (Number.isNaN(date.getTime())) return false;
  const today = new Date();
  const candidate = new Date(today.getFullYear(), date.getMonth(), date.getDate());
  if (candidate.getTime() < new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()) {
    candidate.setFullYear(today.getFullYear() + 1);
  }
  return Math.ceil((candidate.getTime() - today.getTime()) / 86400000) <= windowDays;
}

const COLUMN_CACHE = new Map();

function tableExists(name) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(name));
}

function tableColumns(name) {
  if (!COLUMN_CACHE.has(name)) {
    COLUMN_CACHE.set(name, new Set(db.prepare(`PRAGMA table_info(${name})`).all().map((row) => row.name)));
  }
  return COLUMN_CACHE.get(name);
}

function scopedRows(tableName, access, branchId = "", { orderBy = "updated_at", max = 250 } = {}) {
  if (!tableExists(tableName)) return [];
  const columns = tableColumns(tableName);
  const tenantColumn = columns.has("tenant_id") ? "tenant_id" : columns.has("tenantId") ? "tenantId" : "";
  if (!tenantColumn) return [];
  const clauses = [`${tenantColumn} = ?`];
  const params = [access.tenantId];
  const branchColumn = columns.has("branch_id") ? "branch_id" : columns.has("branchId") ? "branchId" : "";
  if (branchId && branchColumn) {
    clauses.push(`${branchColumn} = ?`);
    params.push(branchId);
  }
  const orderColumn = columns.has(orderBy) ? orderBy : columns.has("updated_at") ? "updated_at" : columns.has("updatedAt") ? "updatedAt" : columns.has("created_at") ? "created_at" : columns.has("createdAt") ? "createdAt" : "";
  const orderSql = orderColumn ? ` ORDER BY ${orderColumn} DESC` : "";
  params.push(limit(max, max));
  return db.prepare(`SELECT * FROM ${tableName} WHERE ${clauses.join(" AND ")}${orderSql} LIMIT ?`).all(...params);
}

function arrayValue(value) {
  const parsed = parseJson(value, value);
  if (Array.isArray(parsed)) return parsed;
  if (parsed && typeof parsed === "object") return Object.values(parsed).filter((item) => item !== undefined && item !== null && item !== "");
  return text(parsed).split(",").map((item) => item.trim()).filter(Boolean);
}

function objectValue(value) {
  const parsed = parseJson(value, {});
  return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : {};
}

function compactClient(row, branch) {
  if (!row) return null;
  return {
    id: row.id,
    name: row.name || "",
    phone: row.phone || "",
    email: row.email || "",
    branchId: row.branchId || "",
    branchName: branch?.name || row.branchId || "",
    gender: row.gender || "",
    birthday: row.birthday || "",
    anniversary: row.anniversary || "",
    tags: arrayValue(row.tags),
    notes: row.notes || "",
    walletBalance: numberValue(row.walletBalance),
    loyaltyPoints: numberValue(row.loyaltyPoints),
    totalSpend: numberValue(row.totalSpend),
    visitCount: numberValue(row.visitCount),
    lastVisitAt: row.lastVisitAt || "",
    preferences: objectValue(row.preferences),
    allergies: arrayValue(row.allergies),
    safetyFlags: objectValue(row.safetyFlags),
    communicationPreferences: objectValue(row.communicationPreferences),
    preferredLanguage: row.preferredLanguage || "",
    preferredChannel: row.preferredChannel || "",
    noShowCount: numberValue(row.noShowCount),
    cancellationCount: numberValue(row.cancellationCount),
    tier: row.tier || "",
    status: row.deletedAt ? "archived" : "active"
  };
}

function compactAppointment(row, staffNames = new Map(), serviceNames = new Map()) {
  const serviceIds = arrayValue(row.serviceIds).map(String);
  const serviceLabels = serviceIds.map((id) => serviceNames.get(id) || id).filter(Boolean);
  return {
    id: row.id,
    clientId: row.clientId,
    staffId: row.staffId || "",
    staffName: staffNames.get(row.staffId) || row.staffId || "",
    branchId: row.branchId || "",
    serviceIds,
    serviceNames: serviceLabels,
    serviceName: serviceLabels[0] || "Appointment",
    startAt: row.startAt || "",
    endAt: row.endAt || "",
    status: row.status || "",
    notes: row.notes || "",
    noShowRiskScore: numberValue(row.noShowRiskScore)
  };
}

function compactInvoice(row) {
  const total = numberValue(row.total ?? row.grand_total ?? row.subtotal);
  const paid = numberValue(row.paid ?? row.paid_amount);
  const due = numberValue(row.balance ?? row.due_amount);
  return {
    id: row.id,
    invoiceNumber: row.invoiceNumber || row.invoice_no || row.id,
    clientId: row.clientId || row.customer_id || "",
    branchId: row.branchId || row.branch_id || "",
    staffId: row.staffId || row.staff_id || "",
    status: row.status || row.payment_status || "",
    total,
    paid,
    due,
    discount: numberValue(row.discount ?? row.discount_total),
    createdAt: row.createdAt || row.created_at || "",
    dueDate: row.dueDate || "",
    lineItems: parseJson(row.lineItems, parseJson(row.line_items, []))
  };
}

function extractPackageItems(rows = []) {
  return rows.flatMap((row) => {
    const items = arrayValue(row.items || row.lineItems);
    return items
      .filter((item) => {
        const haystack = `${item.type || ""} ${item.itemType || ""} ${item.category || ""} ${item.name || ""}`.toLowerCase();
        return haystack.includes("package");
      })
      .map((item) => ({
        id: item.id || item.packageId || item.serviceId || item.name || "",
        name: item.name || item.packageName || "Package",
        source: row.invoiceNumber || row.invoice_no || row.id,
        purchasedAt: row.createdAt || row.created_at || "",
        expiresOn: item.expiresOn || item.expiryDate || item.expires_at || "",
        credits: numberValue(item.credits ?? item.quantity),
        remainingCredits: numberValue(item.remainingCredits ?? item.balanceCredits ?? item.credits)
      }));
  });
}

function countBy(rows, key) {
  const counts = new Map();
  for (const row of rows) {
    const value = text(row[key]);
    if (!value) continue;
    counts.set(value, (counts.get(value) || 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]).map(([id, count]) => ({ id, count }));
}

function pushTag(tags, key, label, tone, reason) {
  if (tags.some((tag) => tag.key === key || tag.label === label)) return;
  tags.push({ key, label, tone, reason });
}

function emptyClient360(clientId) {
  return {
    clientId,
    client: null,
    branch: null,
    tags: [],
    membership: { activeMembership: null, activeMemberships: [], ledger: [], empty: true, summaryText: "No active membership" },
    package: { activePackage: null, recentPackages: [], expiringSoon: false, empty: true, summaryText: "No active package" },
    wallet: { balance: 0, source: "client.walletBalance" },
    loyalty: { points: 0, source: "client.loyaltyPoints" },
    balance: { dueAmount: 0, unpaidInvoices: 0 },
    appointments: { last: null, upcoming: [], past: [], allCount: 0 },
    invoices: { past: [], totalSpend: 0, dueAmount: 0, unpaidCount: 0 },
    notes: { text: "", preferences: {}, allergies: [] },
    files: { available: false, count: 0, placeholder: "Files placeholder ready for consultation forms, photos and signed documents." },
    preferences: {
      preferredStaff: [],
      preferredServices: [],
      allergies: [],
      communicationPreferences: {},
      rawPreferences: {}
    },
    alerts: [],
    aiSummary: "No linked client data found yet."
  };
}

function money(value) {
  return `Rs ${Math.round(numberValue(value)).toLocaleString("en-IN")}`;
}

function appointmentStatusCount(rows = [], statuses = []) {
  const wanted = statuses.map((item) => String(item).toLowerCase());
  return rows.filter((item) => {
    const status = String(item.status || "").toLowerCase();
    return wanted.some((needle) => status.includes(needle));
  }).length;
}

function daysLabel(days) {
  if (days === null || days === undefined) return "date not captured";
  if (days < 0) return `${Math.abs(days)} days overdue`;
  if (days === 0) return "today";
  return `${days} days`;
}

function addSummaryItem(list, title, summary, extras = {}) {
  list.push({ title, summary, ...extras });
}

function buildLocalAiGuestSummary(profile, payload = {}) {
  const client = profile.client || {};
  const membership = profile.membership?.activeMembership || null;
  const activePackage = profile.package?.activePackage || null;
  const appointments = profile.appointments || {};
  const past = Array.isArray(appointments.past) ? appointments.past : [];
  const upcoming = Array.isArray(appointments.upcoming) ? appointments.upcoming : [];
  const invoices = profile.invoices || {};
  const preferences = profile.preferences || {};
  const alerts = [...(profile.alerts || [])];
  const insights = [];
  const suggestions = [];
  const risks = [];
  const nextBestActions = [];
  const dueAmount = numberValue(profile.balance?.dueAmount || client.dueAmount);
  const totalSpend = numberValue(invoices.totalSpend || client.totalSpend);
  const cancellationCount = numberValue(client.cancellationCount) + appointmentStatusCount(past, ["cancel"]);
  const noShowCount = numberValue(client.noShowCount) + appointmentStatusCount(past, ["no_show", "no-show"]);
  const membershipDays = daysUntil(membership?.expiresOn);
  const packageDays = daysUntil(activePackage?.expiresOn);
  const preferredStaff = (preferences.preferredStaff || [])[0];
  const preferredService = (preferences.preferredServices || [])[0];
  const hasBirthday = (profile.tags || []).some((tag) => tag.key === "birthday" || tag.label === "Birthday");
  const hasAnniversary = (profile.tags || []).some((tag) => tag.key === "anniversary" || tag.label === "Anniversary");

  addSummaryItem(insights, "Recent visits", `${client.name || "Client"} has ${past.length} past visit${past.length === 1 ? "" : "s"} and ${upcoming.length} upcoming appointment${upcoming.length === 1 ? "" : "s"}.`, {
    severity: upcoming.length ? "positive" : "neutral",
    evidence: { pastVisits: past.length, upcomingAppointments: upcoming.length, lastVisit: appointments.last?.startAt || "" }
  });

  if (totalSpend >= 25000) {
    addSummaryItem(insights, "High spend client", `Lifetime spend is ${money(totalSpend)}, so this client should receive premium retention attention.`, {
      severity: "positive",
      evidence: { totalSpend }
    });
  } else {
    addSummaryItem(insights, "Spend profile", `Known spend is ${money(totalSpend)} from available invoice/client records.`, {
      severity: "neutral",
      evidence: { totalSpend }
    });
  }

  if (preferredStaff?.name || preferredStaff?.id) {
    addSummaryItem(insights, "Staff preference", `Most frequent staff match is ${preferredStaff.name || preferredStaff.id}.`, {
      severity: "positive",
      evidence: preferredStaff
    });
  }

  if (hasBirthday || hasAnniversary) {
    addSummaryItem(insights, "Personal date window", `${hasBirthday ? "Birthday" : "Anniversary"} is within the current engagement window.`, {
      severity: "positive",
      evidence: { birthday: client.birthday || "", anniversary: client.anniversary || "" }
    });
  }

  if (dueAmount > 0) {
    addSummaryItem(alerts, "Due balance", `${money(dueAmount)} is outstanding before the next engagement.`, { status: "danger" });
    addSummaryItem(risks, "Payment follow-up risk", `Outstanding balance ${money(dueAmount)} may block booking or renewal conversion.`, {
      riskLevel: dueAmount >= 5000 ? "high" : "medium",
      riskScore: dueAmount >= 5000 ? 82 : 62,
      evidence: { dueAmount },
      suggestedAction: "Confirm due payment before offering new discounts."
    });
  }

  if (membership) {
    addSummaryItem(insights, "Membership status", `${membership.planName || "Membership"} is active and expires in ${daysLabel(membershipDays)}.`, {
      severity: membershipDays !== null && membershipDays <= 30 ? "warning" : "positive",
      evidence: membership
    });
    if (membershipDays !== null && membershipDays <= 30) {
      addSummaryItem(alerts, "Membership expiry", `${membership.planName || "Membership"} expires in ${daysLabel(membershipDays)}.`, { status: "warning" });
      addSummaryItem(suggestions, "Renew membership", "Offer renewal with benefits before expiry.", {
        priority: "high",
        reason: "Active membership is close to expiry."
      });
    }
  } else {
    addSummaryItem(suggestions, "Membership upsell", "Client has no active membership; check eligibility for a relevant membership plan.", {
      priority: totalSpend >= 10000 ? "high" : "medium",
      reason: "No active membership found."
    });
  }

  if (activePackage) {
    addSummaryItem(insights, "Package status", `${activePackage.name || "Package"} has ${activePackage.remainingCredits ?? activePackage.credits ?? 0} credits and expires in ${daysLabel(packageDays)}.`, {
      severity: packageDays !== null && packageDays <= 30 ? "warning" : "positive",
      evidence: activePackage
    });
    if (packageDays !== null && packageDays <= 30) {
      addSummaryItem(alerts, "Package expiring", `${activePackage.name || "Package"} expires in ${daysLabel(packageDays)}.`, { status: "warning" });
    }
  }

  if (cancellationCount || noShowCount) {
    addSummaryItem(risks, "Booking reliability risk", `${cancellationCount} cancellation${cancellationCount === 1 ? "" : "s"} and ${noShowCount} no-show${noShowCount === 1 ? "" : "s"} found in profile/history.`, {
      riskLevel: cancellationCount + noShowCount >= 3 ? "high" : "medium",
      riskScore: Math.min(90, 45 + ((cancellationCount + noShowCount) * 15)),
      evidence: { cancellationCount, noShowCount },
      suggestedAction: "Use confirmation call or advance payment for high-demand slots."
    });
  }

  if (!upcoming.length && past.length) {
    addSummaryItem(risks, "Churn watch", "Client has previous visits but no upcoming booking in the current view.", {
      riskLevel: "medium",
      riskScore: 58,
      evidence: { lastVisit: appointments.last?.startAt || "", upcomingAppointments: upcoming.length },
      suggestedAction: "Send a recovery message with preferred service and staff context."
    });
  }

  addSummaryItem(insights, "Review signal", "No negative review source is configured in the local engagement data yet.", {
    severity: "neutral",
    evidence: { reviewsSource: "not_configured" }
  });

  const likelyUpsell = preferredService?.name
    ? `${preferredService.name} add-on or package`
    : membership
      ? "membership renewal or service package"
      : "introductory membership";
  addSummaryItem(suggestions, "Likely upsell", `Best offer candidate: ${likelyUpsell}.`, {
    priority: totalSpend >= 25000 ? "high" : "medium",
    reason: preferredService?.name ? "Based on service preference." : "Based on membership/package context."
  });

  addSummaryItem(nextBestActions, dueAmount > 0 ? "Collect due and recover booking" : "Send personalized recovery message", dueAmount > 0
    ? `Ask for ${money(dueAmount)} due clearance, then offer ${likelyUpsell}.`
    : `Message with ${preferredStaff?.name ? `${preferredStaff.name} availability and ` : ""}${likelyUpsell}.`, {
    actionType: dueAmount > 0 ? "payment_follow_up" : "engagement_message",
    priority: dueAmount > 0 || membershipDays !== null && membershipDays <= 30 ? "high" : "medium",
    confidence: 0.78
  });

  if (hasBirthday || hasAnniversary) {
    addSummaryItem(nextBestActions, "Personal occasion campaign", "Use birthday/anniversary context in the next WhatsApp draft.", {
      actionType: "campaign_prompt",
      priority: "medium",
      confidence: 0.72
    });
  }

  const riskPenalty = risks.reduce((score, risk) => score + Math.min(0.16, numberValue(risk.riskScore) / 1000), 0);
  const confidence = Math.max(0.52, Math.min(0.94, 0.86 - riskPenalty + (totalSpend > 0 ? 0.04 : 0)));
  const summaryParts = [
    `${client.name || "Client"}: ${past.length} visits, ${upcoming.length} upcoming`,
    `${membership ? membership.planName || "active membership" : "no active membership"}`,
    `${activePackage ? activePackage.name || "active package" : "no active package"}`,
    `${money(dueAmount)} due`,
    `${risks.length} risk signal${risks.length === 1 ? "" : "s"}`
  ];

  return {
    summaryText: summaryParts.join("; ") + ".",
    insights,
    suggestions,
    alerts,
    risks,
    nextBestActions,
    dataSources: [
      "clients",
      "appointments",
      "invoices",
      "client_membership_ledger",
      "membership_plans",
      "branches",
      "staff",
      "services"
    ],
    confidence: Number(confidence.toFixed(2)),
    metadata: {
      providerConfigured: false,
      fallbackReason: text(payload.providerFallbackReason || "AI provider not configured; deterministic local summary used."),
      suggestions,
      alerts,
      localEngine: "aura-engagement-local-v1"
    }
  };
}

function formatDateValue(value) {
  const ms = dateMs(value);
  if (!ms) return "";
  return new Date(ms).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" });
}

function formatTimeValue(value) {
  const ms = dateMs(value);
  if (!ms) return "";
  return new Date(ms).toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" });
}

function renderTemplateBody(body, variables) {
  return text(body).replace(/\{\{\s*([a-zA-Z0-9_]+)\s*\}\}/g, (_, key) => text(variables[key]));
}

function templateContextFromClient360(profile) {
  if (!profile?.client) return {};
  const appointment = profile.appointments?.upcoming?.[0] || profile.appointments?.last || {};
  const membership = profile.membership?.activeMembership || {};
  const activePackage = profile.package?.activePackage || {};
  const preferredStaff = profile.preferences?.preferredStaff?.[0] || {};
  const preferredService = profile.preferences?.preferredServices?.[0] || {};
  return {
    client_name: profile.client.name || "",
    appointment_date: formatDateValue(appointment.startAt || appointment.appointmentDate || appointment.date),
    appointment_time: formatTimeValue(appointment.startAt || appointment.appointmentTime || appointment.time),
    service_name: appointment.serviceName || preferredService.name || "",
    staff_name: appointment.staffName || preferredStaff.name || "",
    branch_name: profile.branch?.name || profile.client.branchName || profile.client.branchId || "",
    due_amount: profile.balance?.dueAmount ? money(profile.balance.dueAmount) : "",
    membership_name: membership.planName || "",
    membership_expiry: formatDateValue(membership.expiresOn),
    package_name: activePackage.name || "",
    package_credits: activePackage.remainingCredits ?? activePackage.credits ?? "",
    payment_link: "",
    booking_link: ""
  };
}

export class EngagementService {
  ensureDefaultTemplates(access) {
    const stamp = now();
    const existingRows = db.prepare(
      `SELECT template_key FROM engagement_templates
       WHERE tenant_id = ?
         AND branch_id = ''
         AND template_key IN (${DEFAULT_TEMPLATE_CATALOG.map(() => "?").join(",")})`
    ).all(access.tenantId, ...DEFAULT_TEMPLATE_CATALOG.map((item) => item.key));
    const existing = new Set(existingRows.map((row) => row.template_key));
    const actorInfo = actor(access);
    const insert = db.prepare(
      `INSERT OR IGNORE INTO engagement_templates
      (id, tenant_id, branch_id, template_key, name, channel, category, language, purpose, body, variables_json,
       provider_template_id, provider_status, approval_status, status, quiet_hours_json, consent_required, opt_out_required,
       created_by, updated_by, created_at, updated_at)
       VALUES (?, ?, '', ?, ?, 'whatsapp', ?, 'en', ?, ?, ?, '', 'pending_provider', 'pending', 'active', '{}', 1, 1, ?, ?, ?, ?)`
    );
    for (const item of DEFAULT_TEMPLATE_CATALOG) {
      if (existing.has(item.key)) continue;
      insert.run(
        makeId("eng_tpl"),
        access.tenantId,
        item.key,
        item.name,
        item.category,
        item.purpose || item.name,
        item.body,
        stringify(validateTemplateVariables(extractTemplateVariables(item.body)), []),
        actorInfo.userId,
        actorInfo.userId,
        stamp,
        stamp
      );
    }
  }

  providerAdapterCatalog() {
    return PROVIDER_ADAPTERS.map((adapter) => ({
      ...adapter,
      directSendSupported: Boolean(adapter.directSendImplemented),
      sendMode: adapter.directSendImplemented ? "direct_send_ready" : "pending_send_only",
      defaultStatus: "inactive"
    }));
  }

  listProviderReadiness(query = {}, access) {
    const branchId = branchScope(access, query.branchId || "");
    const providers = db.prepare(
      `SELECT * FROM engagement_provider_accounts
       WHERE tenant_id = ?
         AND archived_at = ''
         AND (? = '' OR branch_id = ? OR branch_id = '')
       ORDER BY channel ASC, provider_name ASC, updated_at DESC`
    ).all(access.tenantId, branchId, branchId).map(rowToProviderAccount);
    const byProvider = new Map();
    for (const provider of providers) {
      const key = `${provider.providerName}:${provider.branchId || ""}`;
      if (!byProvider.has(key)) byProvider.set(key, provider);
      if (!byProvider.has(`${provider.providerName}:`)) byProvider.set(`${provider.providerName}:`, provider);
    }
    const rows = this.providerAdapterCatalog()
      .filter((adapter) => !query.channel || adapter.channel === normalizeChannel(query.channel))
      .map((adapter) => this.providerReadinessView(adapter, byProvider.get(`${adapter.providerName}:${branchId}`) || byProvider.get(`${adapter.providerName}:`) || null));
    const summary = {
      providers: rows.length,
      activeConfigs: rows.filter((row) => row.status === "active").length,
      configuredPublicDetails: rows.filter((row) => row.configComplete).length,
      directSendReady: rows.filter((row) => row.providerConfigured).length,
      pendingSendOnly: rows.filter((row) => row.sendMode === "pending_send_only").length,
      disabledByDefault: rows.every((row) => !row.providerConfigured)
    };
    return { summary, providers: rows, generatedAt: now() };
  }

  providerReadinessView(adapter, account = null) {
    const config = account?.config || {};
    const publicConfig = {
      providerName: adapter.providerName,
      status: account?.status || "inactive",
      senderId: account?.senderId || "",
      templateNamespace: account?.templateNamespace || config.templateNamespace || "",
      webhookUrl: account?.webhookUrl || config.webhookUrl || "",
      lastVerifiedAt: account?.lastVerifiedAt || ""
    };
    const missingFields = adapter.requiredFields.filter((field) => !text(publicConfig[field]));
    const configComplete = missingFields.length === 0 && publicConfig.status === "active";
    const providerConfigured = configComplete && Boolean(account?.directSendEnabled) && adapter.directSendImplemented;
    const readinessStatus = providerConfigured
      ? "direct_send_ready"
      : configComplete
        ? "configured_pending_adapter"
        : publicConfig.status === "active"
          ? "needs_config"
          : "disabled";
    return {
      ...adapter,
      accountId: account?.id || "",
      branchId: account?.branchId || "",
      accountLabel: account?.accountLabel || adapter.label,
      status: publicConfig.status,
      providerStatus: account?.providerStatus || (publicConfig.status === "active" ? "not_configured" : "disabled"),
      senderId: publicConfig.senderId,
      templateNamespace: publicConfig.templateNamespace,
      webhookUrl: publicConfig.webhookUrl,
      lastVerifiedAt: publicConfig.lastVerifiedAt,
      lastHealthStatus: account?.lastHealthStatus || "",
      directSendEnabled: Boolean(account?.directSendEnabled) && adapter.directSendImplemented,
      directSendSupported: Boolean(adapter.directSendImplemented),
      providerConfigured,
      configComplete,
      missingFields,
      readinessStatus,
      sendMode: providerConfigured ? "direct_send_ready" : "pending_send_only",
      safeConfig: publicConfig,
      note: providerConfigured
        ? `${adapter.label} is ready for direct sending.`
        : configComplete
          ? `${adapter.label} public config is ready, but direct send adapter is disabled until provider credentials/webhooks are implemented.`
          : `${adapter.label} is disabled or missing ${missingFields.join(", ") || "required config"}. Send attempts remain pending only.`
    };
  }

  saveProviderConfig(payload = {}, access, requestMeta = {}) {
    const providerName = normalizeProviderName(payload.providerName || payload.provider_name);
    const adapter = PROVIDER_ADAPTERS.find((item) => item.providerName === providerName);
    const branchId = branchScope(access, payload.branchId || "");
    const status = normalizeProviderAccountStatus(payload.status || "inactive");
    const senderId = text(payload.senderId || payload.sender_id || "");
    const templateNamespace = text(payload.templateNamespace || payload.template_namespace || "");
    const webhookUrl = text(payload.webhookUrl || payload.webhook_url || "");
    const accountLabel = text(payload.accountLabel || payload.account_label || adapter.label);
    const config = {
      templateNamespace,
      webhookUrl,
      providerReadinessOnly: true,
      secretsStored: false
    };
    const missingFields = adapter.requiredFields.filter((field) => !text({ senderId, templateNamespace, webhookUrl }[field]));
    const providerStatus = status === "active" && !missingFields.length ? "configured" : status === "active" ? "not_configured" : "disabled";
    const existing = db.prepare(
      `SELECT * FROM engagement_provider_accounts
       WHERE tenant_id = ?
         AND provider_name = ?
         AND branch_id = ?
         AND archived_at = ''
       ORDER BY updated_at DESC
       LIMIT 1`
    ).get(access.tenantId, providerName, branchId);
    const stamp = now();
    const id = existing?.id || makeId("eng_provider");
    db.transaction(() => {
      if (existing) {
        db.prepare(
          `UPDATE engagement_provider_accounts
           SET provider_type = ?,
               channel = ?,
               account_label = ?,
               business_phone = ?,
               sender_id = ?,
               from_email = ?,
               provider_status = ?,
               direct_send_enabled = 0,
               approval_required = 1,
               config_json = ?,
               last_health_status = ?,
               status = ?,
               updated_by = ?,
               updated_at = ?,
               version = version + 1
           WHERE tenant_id = ? AND id = ?`
        ).run(
          adapter.providerType,
          adapter.channel,
          accountLabel,
          adapter.channel === "whatsapp" ? senderId : "",
          senderId,
          adapter.channel === "email" ? senderId : "",
          providerStatus,
          stringify(config, {}),
          missingFields.length ? `missing: ${missingFields.join(", ")}` : "public_config_ready",
          status,
          actor(access).userId,
          stamp,
          access.tenantId,
          existing.id
        );
      } else {
        db.prepare(
          `INSERT INTO engagement_provider_accounts
          (id, tenant_id, branch_id, provider_type, provider_name, channel, account_label, business_phone, sender_id, from_email,
           provider_status, direct_send_enabled, approval_required, config_json, rate_limit_json, last_health_status, last_checked_at,
           status, created_by, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, 1, ?, '{}', ?, '', ?, ?, ?, ?, ?)`
        ).run(
          id,
          access.tenantId,
          branchId,
          adapter.providerType,
          providerName,
          adapter.channel,
          accountLabel,
          adapter.channel === "whatsapp" ? senderId : "",
          senderId,
          adapter.channel === "email" ? senderId : "",
          providerStatus,
          stringify(config, {}),
          missingFields.length ? `missing: ${missingFields.join(", ")}` : "public_config_ready",
          status,
          actor(access).userId,
          actor(access).userId,
          stamp,
          stamp
        );
      }
      this.audit({
        action: existing ? "engagement.provider.updated" : "engagement.provider.configured",
        entityType: "engagement_provider_account",
        entityId: id,
        branchId,
        before: existing ? rowToProviderAccount(existing) : {},
        after: { providerName, channel: adapter.channel, status, providerStatus, senderId, templateNamespace, webhookUrl, directSendEnabled: false },
        details: { missingFields, directSendImplemented: adapter.directSendImplemented, secretsStored: false },
        access,
        requestMeta,
        severity: status === "active" && missingFields.length ? "warn" : "info"
      });
    })();
    const account = rowToProviderAccount(db.prepare("SELECT * FROM engagement_provider_accounts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
    return this.providerReadinessView(adapter, account);
  }

  verifyProviderConfig(id, payload = {}, access, requestMeta = {}) {
    const row = db.prepare("SELECT * FROM engagement_provider_accounts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Engagement provider config not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    const account = rowToProviderAccount(row);
    const adapter = PROVIDER_ADAPTERS.find((item) => item.providerName === account.providerName);
    if (!adapter) throw badRequest("Unsupported engagement provider config");
    const readiness = this.providerReadinessView(adapter, account);
    const stamp = now();
    const healthStatus = readiness.configComplete ? "readiness_verified_no_external_send" : `missing: ${readiness.missingFields.join(", ")}`;
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_provider_accounts
         SET last_health_status = ?,
             last_checked_at = ?,
             provider_status = ?,
             direct_send_enabled = 0,
             updated_by = ?,
             updated_at = ?,
             version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(
        healthStatus,
        stamp,
        readiness.configComplete ? "configured" : "not_configured",
        actor(access).userId,
        stamp,
        access.tenantId,
        id
      );
      this.audit({
        action: "engagement.provider.readiness_verified",
        entityType: "engagement_provider_account",
        entityId: id,
        branchId: account.branchId,
        before: { providerStatus: account.providerStatus, lastHealthStatus: account.lastHealthStatus, lastVerifiedAt: account.lastVerifiedAt },
        after: { providerStatus: readiness.configComplete ? "configured" : "not_configured", lastVerifiedAt: stamp, healthStatus, providerConfigured: false },
        details: { note: text(payload.note || ""), missingFields: readiness.missingFields, externalSendTested: false },
        access,
        requestMeta,
        severity: readiness.configComplete ? "info" : "warn"
      });
    })();
    return this.providerReadinessView(adapter, rowToProviderAccount(db.prepare("SELECT * FROM engagement_provider_accounts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id)));
  }

  listTemplates(query = {}, access) {
    this.ensureDefaultTemplates(access);
    const branchId = branchScope(access, query.branchId);
    const params = [access.tenantId];
    const clauses = ["tenant_id = ?"];
    if (branchId) {
      clauses.push("(branch_id = ? OR branch_id = '')");
      params.push(branchId);
    }
    if (query.channel) {
      clauses.push("channel = ?");
      params.push(normalizeChannel(query.channel));
    }
    if (query.category) {
      clauses.push("category = ?");
      params.push(text(query.category));
    }
    if (query.status) {
      clauses.push("status = ?");
      params.push(normalizeTemplateStatus(query.status));
    } else if (!["1", "true"].includes(String(query.includeArchived || "").toLowerCase())) {
      clauses.push("archived_at = ''");
    }
    if (query.search) {
      clauses.push("lower(template_key || ' ' || name || ' ' || purpose || ' ' || body) LIKE ?");
      params.push(`%${text(query.search).toLowerCase()}%`);
    }
    params.push(limit(query.limit, 100));
    return db.prepare(
      `SELECT * FROM engagement_templates
       WHERE ${clauses.join(" AND ")}
       ORDER BY CASE WHEN branch_id = '' THEN 1 ELSE 0 END, category ASC, name ASC
       LIMIT ?`
    ).all(...params).map(rowToTemplate);
  }

  createTemplate(payload = {}, access, requestMeta = {}) {
    const body = text(payload.body);
    const name = text(payload.name);
    if (!name) throw badRequest("template name is required");
    if (!body) throw badRequest("template body is required");
    const branchId = branchScope(access, payload.branchId);
    const channel = normalizeChannel(payload.channel || "whatsapp");
    const templateKey = slugify(payload.templateKey || payload.key || name);
    if (!templateKey) throw badRequest("template key is required");
    const variables = validateTemplateVariables(payload.variables?.length ? payload.variables : extractTemplateVariables(body));
    const approvalStatus = normalizeTemplateApprovalStatus(payload.approvalStatus, channel);
    const status = normalizeTemplateStatus(payload.status || "draft");
    const stamp = now();
    const id = makeId("eng_tpl");
    try {
      db.transaction(() => {
        db.prepare(
          `INSERT INTO engagement_templates
          (id, tenant_id, branch_id, template_key, name, channel, category, language, purpose, body, variables_json,
           provider_template_id, provider_status, approval_status, status, quiet_hours_json, consent_required, opt_out_required,
           created_by, updated_by, created_at, updated_at)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
        ).run(
          id,
          access.tenantId,
          branchId,
          templateKey,
          name,
          channel,
          text(payload.category || "service"),
          text(payload.language || "en"),
          text(payload.purpose || ""),
          body,
          stringify(variables, []),
          text(payload.providerTemplateId || ""),
          text(payload.providerStatus || (channel === "whatsapp" ? "pending_provider" : "not_required")),
          approvalStatus,
          status,
          stringify(payload.quietHours, {}),
          payload.consentRequired === false ? 0 : 1,
          payload.optOutRequired === false ? 0 : 1,
          actor(access).userId,
          actor(access).userId,
          stamp,
          stamp
        );
        this.audit({
          action: "engagement.template.created",
          entityType: "engagement_template",
          entityId: id,
          branchId,
          after: { templateKey, name, channel, approvalStatus, status, variables },
          access,
          requestMeta
        });
      })();
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE")) {
        throw badRequest("Template key already exists for this branch");
      }
      throw error;
    }
    return rowToTemplate(db.prepare("SELECT * FROM engagement_templates WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  updateTemplate(id, payload = {}, access, requestMeta = {}) {
    const existing = this.mustGetTemplate(id, access);
    const nextBody = payload.body === undefined ? existing.body : text(payload.body);
    if (!nextBody) throw badRequest("template body is required");
    const nextChannel = payload.channel === undefined ? existing.channel : normalizeChannel(payload.channel);
    const variables = validateTemplateVariables(payload.variables?.length ? payload.variables : extractTemplateVariables(nextBody));
    const next = {
      branchId: payload.branchId === undefined ? existing.branchId : branchScope(access, payload.branchId),
      templateKey: payload.templateKey === undefined && payload.key === undefined ? existing.templateKey : slugify(payload.templateKey || payload.key),
      name: payload.name === undefined ? existing.name : text(payload.name),
      channel: nextChannel,
      category: payload.category === undefined ? existing.category : text(payload.category || "service"),
      language: payload.language === undefined ? existing.language : text(payload.language || "en"),
      purpose: payload.purpose === undefined ? existing.purpose : text(payload.purpose || ""),
      body: nextBody,
      variables,
      providerTemplateId: payload.providerTemplateId === undefined ? existing.providerTemplateId : text(payload.providerTemplateId || ""),
      providerStatus: payload.providerStatus === undefined ? existing.providerStatus : text(payload.providerStatus || ""),
      approvalStatus: payload.approvalStatus === undefined ? existing.approvalStatus : normalizeTemplateApprovalStatus(payload.approvalStatus, nextChannel),
      status: payload.status === undefined ? existing.status : normalizeTemplateStatus(payload.status),
      quietHours: payload.quietHours === undefined ? existing.quietHours : payload.quietHours,
      consentRequired: payload.consentRequired === undefined ? existing.consentRequired : payload.consentRequired !== false,
      optOutRequired: payload.optOutRequired === undefined ? existing.optOutRequired : payload.optOutRequired !== false
    };
    if (!next.templateKey) throw badRequest("template key is required");
    if (!next.name) throw badRequest("template name is required");
    const stamp = now();
    try {
      db.transaction(() => {
        db.prepare(
          `UPDATE engagement_templates
           SET branch_id = ?, template_key = ?, name = ?, channel = ?, category = ?, language = ?, purpose = ?,
               body = ?, variables_json = ?, provider_template_id = ?, provider_status = ?, approval_status = ?,
               status = ?, quiet_hours_json = ?, consent_required = ?, opt_out_required = ?, updated_by = ?,
               archived_at = CASE WHEN ? = 'archived' AND archived_at = '' THEN ? ELSE archived_at END,
               archived_by = CASE WHEN ? = 'archived' AND archived_by = '' THEN ? ELSE archived_by END,
               archive_reason = CASE WHEN ? = 'archived' AND archive_reason = '' THEN ? ELSE archive_reason END,
               updated_at = ?, version = version + 1
           WHERE tenant_id = ? AND id = ?`
        ).run(
          next.branchId,
          next.templateKey,
          next.name,
          next.channel,
          next.category,
          next.language,
          next.purpose,
          next.body,
          stringify(next.variables, []),
          next.providerTemplateId,
          next.providerStatus,
          next.approvalStatus,
          next.status,
          stringify(next.quietHours, {}),
          next.consentRequired ? 1 : 0,
          next.optOutRequired ? 1 : 0,
          actor(access).userId,
          next.status,
          stamp,
          next.status,
          actor(access).userId,
          next.status,
          text(payload.archiveReason || "Archived from engagement template editor"),
          stamp,
          access.tenantId,
          id
        );
        this.audit({
          action: "engagement.template.updated",
          entityType: "engagement_template",
          entityId: id,
          branchId: next.branchId,
          before: existing,
          after: next,
          access,
          requestMeta
        });
      })();
    } catch (error) {
      if (String(error?.message || "").includes("UNIQUE")) {
        throw badRequest("Template key already exists for this branch");
      }
      throw error;
    }
    return rowToTemplate(db.prepare("SELECT * FROM engagement_templates WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  renderTemplate(id, payload = {}, access, requestMeta = {}) {
    const template = this.mustGetTemplate(id, access);
    let thread = null;
    if (payload.threadId) thread = this.mustGetThread(payload.threadId, access);
    const clientId = text(payload.clientId || thread?.clientId || "");
    let profile = null;
    if (clientId) {
      profile = this.client360(clientId, access);
      if (!profile.client) throw notFound("Client not found for template rendering");
    }
    const variables = {
      ...(profile ? templateContextFromClient360(profile) : {}),
      ...objectValue(payload.variables)
    };
    const requiredVariables = validateTemplateVariables(template.variables?.length ? template.variables : extractTemplateVariables(template.body));
    const missingVariables = requiredVariables.filter((key) => text(variables[key]) === "");
    if (missingVariables.length) {
      throw badRequest("Template render variables are missing", { missingVariables, requiredVariables, allowedVariables: [...TEMPLATE_VARIABLES] });
    }
    const renderedBody = renderTemplateBody(template.body, variables);
    this.audit({
      action: "engagement.template.rendered",
      entityType: "engagement_template",
      entityId: id,
      threadId: text(thread?.id || payload.threadId || ""),
      branchId: template.branchId || text(profile?.client?.branchId || ""),
      clientId,
      after: { templateKey: template.templateKey, variables: requiredVariables, channel: template.channel },
      access,
      requestMeta
    });
    return {
      template,
      renderedBody,
      variables,
      requiredVariables,
      missingVariables: [],
      approvalStatus: template.approvalStatus,
      providerStatus: template.providerStatus
    };
  }

  listReviews(query = {}, access) {
    const reviews = reputationService.reviews({ ...query, limit: query.limit || 100 }, access);
    return reviews.map((review) => this.enrichReviewForEngagement(review, access));
  }

  async aiReviewResponse(id, payload = {}, access, requestMeta = {}) {
    const review = reputationService.review(id, access);
    const tone = normalizeReviewTone(payload.tone);
    const enriched = this.enrichReviewForEngagement(review, access);
    const aiResult = await aiAssistantLlmService.run("review-reply", {
      branchId: review.branchId || "",
      clientId: review.customerId || "",
      rating: review.rating,
      reviewText: review.reviewText || review.title || "",
      tone,
      clientName: enriched.client?.name || review.reviewerName || review.reviewer || "",
      serviceName: enriched.services?.map((service) => service.name).filter(Boolean).join(", "),
      staffName: enriched.staff?.name || ""
    }, access);
    const responseText = text(payload.responseText || aiResult.output?.reply || aiResult.output?.result || "");
    if (!responseText) throw badRequest("AI response text could not be generated");
    const reply = reputationService.createReply(id, {
      replyText: responseText,
      replyLanguage: payload.replyLanguage || review.reviewLanguage || "en",
      aiGenerated: true,
      aiModelUsed: aiResult.output?.model || "",
      aiPromptVersion: aiResult.output?.ai?.taskKey || "review.reply",
      approvalStatus: "pending"
    }, access);
    const alert = this.ensureNegativeReviewAlert(review, access, requestMeta, {
      tone,
      source: "ai_response",
      replyId: reply.id
    });
    this.audit({
      action: "engagement.review_response.ai_generated",
      entityType: "review_response",
      entityId: reply.id,
      branchId: review.branchId || "",
      clientId: review.customerId || "",
      after: {
        reviewId: id,
        replyId: reply.id,
        tone,
        confidence: aiResult.output?.confidence || 0,
        riskLevel: enriched.riskLevel
      },
      details: {
        model: aiResult.output?.model || "",
        provider: aiResult.output?.ai?.provider || "local",
        negativeAlertId: alert?.id || ""
      },
      access,
      requestMeta
    });
    return {
      review: this.enrichReviewForEngagement(reputationService.review(id, access), access),
      reply,
      aiResponse: responseText,
      tone,
      confidence: aiResult.output?.confidence || 0,
      providerStatus: aiResult.output?.ai?.provider || "local",
      negativeAlert: alert
    };
  }

  approveReviewResponse(id, payload = {}, access, requestMeta = {}) {
    const review = reputationService.review(id, access);
    let reply = payload.replyId ? reputationService.reply(payload.replyId, access) : this.latestReviewReply(id, access);
    const responseText = text(payload.responseText || payload.replyText || "");
    if (!reply && !responseText) throw badRequest("responseText is required when no review response draft exists");
    if (!reply) {
      reply = reputationService.createReply(id, {
        replyText: responseText,
        replyLanguage: payload.replyLanguage || review.reviewLanguage || "en",
        aiGenerated: Boolean(payload.aiGenerated),
        approvalStatus: "pending"
      }, access);
    } else if (responseText && responseText !== reply.replyText) {
      const stamp = now();
      db.prepare(
        `UPDATE review_replies
         SET reply_text = ?, updated_at = ?
         WHERE tenant_id = ? AND id = ?`
      ).run(responseText, stamp, access.tenantId, reply.id);
      if (tableExists("reviews_v2")) {
        db.prepare(
          `UPDATE reviews_v2
           SET has_reply = 1, reply_text = ?, updated_at = ?
           WHERE tenant_id = ? AND id = ?`
        ).run(responseText, stamp, access.tenantId, id);
      }
      reply = reputationService.reply(reply.id, access);
    }
    const approved = reputationService.approveReply(reply.id, {
      note: payload.note || "Approved from Engagement Review Response Center"
    }, access);
    const alert = this.ensureNegativeReviewAlert(review, access, requestMeta, {
      source: "approve_response",
      replyId: approved.id
    });
    this.audit({
      action: "engagement.review_response.approved",
      entityType: "review_response",
      entityId: approved.id,
      branchId: review.branchId || approved.branchId || "",
      clientId: review.customerId || "",
      before: { approvalStatus: reply.approvalStatus, replyText: reply.replyText },
      after: { approvalStatus: approved.approvalStatus, replyText: approved.replyText, reviewId: id },
      details: { negativeAlertId: alert?.id || "" },
      access,
      requestMeta
    });
    return {
      review: this.enrichReviewForEngagement(reputationService.review(id, access), access),
      reply: approved,
      negativeAlert: alert
    };
  }

  sendReviewResponse(id, payload = {}, access, requestMeta = {}) {
    const review = reputationService.review(id, access);
    const reply = payload.replyId ? reputationService.reply(payload.replyId, access) : this.latestReviewReply(id, access, "approved");
    if (!reply) throw badRequest("approved response is required before send/post");
    if (reply.approvalStatus !== "approved") throw badRequest("Review response must be approved before send/post");
    const result = reputationService.postReply(reply.id, payload, access);
    this.audit({
      action: "engagement.review_response.send_attempted",
      entityType: "review_response",
      entityId: reply.id,
      branchId: review.branchId || reply.branchId || "",
      clientId: review.customerId || "",
      before: { postedToPlatform: reply.postedToPlatform, approvalStatus: reply.approvalStatus },
      after: {
        reviewId: id,
        status: result.status,
        postedToPlatform: Boolean(result.postedToPlatform),
        message: result.message || ""
      },
      access,
      requestMeta,
      severity: result.postedToPlatform ? "info" : "warn"
    });
    return {
      ...result,
      review: this.enrichReviewForEngagement(reputationService.review(id, access), access),
      providerConfigured: Boolean(result.postedToPlatform)
    };
  }

  bookingSlotPreview(payload = {}, access, requestMeta = {}) {
    const thread = payload.threadId ? this.mustGetThread(payload.threadId, access) : null;
    const clientId = text(payload.clientId || thread?.clientId || "");
    if (!clientId) throw badRequest("clientId is required for engagement booking preview");
    if (thread?.clientId && thread.clientId !== clientId) throw badRequest("Thread is linked to a different client");
    const branchId = branchScope(access, payload.branchId || thread?.branchId || "");
    if (!branchId) throw badRequest("branchId is required for engagement booking preview");
    const serviceIds = normalizeServiceIds(payload);
    const preview = smartBookingService.recommendSlots({
      branchId,
      clientId,
      serviceIds,
      serviceId: serviceIds[0],
      staffId: text(payload.staffId || ""),
      chair: text(payload.roomResource || payload.resource || payload.chair || payload.room || ""),
      date: text(payload.date || ""),
      durationMinutes: Number(payload.durationMinutes || 0) || undefined,
      days: Number(payload.days || 1),
      limit: Number(payload.limit || 8),
      source: "engagement"
    }, access);
    const insights = this.bookingClientInsights(clientId, branchId, access);
    this.audit({
      action: "engagement.booking.slot_preview",
      entityType: "engagement_booking",
      entityId: preview.record?.id || "",
      threadId: text(thread?.id || payload.threadId || ""),
      branchId,
      clientId,
      after: {
        recommendationId: preview.record?.id || "",
        suggestedSlots: preview.recommendations.length,
        serviceIds,
        dueAmount: insights.dueAmount,
        openAppointmentsCount: insights.openAppointmentsCount
      },
      access,
      requestMeta
    });
    return {
      recommendationId: preview.record?.id || "",
      branchId,
      clientId,
      serviceIds,
      suggestedSlots: preview.recommendations,
      dueAmount: insights.dueAmount,
      dueAmountWarning: insights.dueAmount > 0 ? `Client has pending due ${money(insights.dueAmount)}.` : "",
      openAppointmentsCount: insights.openAppointmentsCount,
      openAppointmentsWarning: insights.openAppointmentsCount > 0 ? `${insights.openAppointmentsCount} open appointment${insights.openAppointmentsCount === 1 ? "" : "s"} already exist.` : "",
      warnings: [
        ...(insights.dueAmount > 0 ? [{ type: "due_amount", level: "warning", message: `Pending due ${money(insights.dueAmount)}` }] : []),
        ...(insights.openAppointmentsCount > 0 ? [{ type: "open_appointments", level: "info", message: `${insights.openAppointmentsCount} open appointment(s)` }] : [])
      ]
    };
  }

  createBookingFromEngagement(payload = {}, access, requestMeta = {}) {
    const threadId = text(payload.threadId);
    const thread = threadId ? this.mustGetThread(threadId, access) : null;
    const clientId = text(payload.clientId || thread?.clientId || "");
    if (!clientId) throw badRequest("clientId is required for engagement booking");
    if (thread?.clientId && thread.clientId !== clientId) throw badRequest("Thread is linked to a different client");
    const branchId = branchScope(access, payload.branchId || thread?.branchId || "");
    if (!branchId) throw badRequest("branchId is required for engagement booking");
    const serviceIds = normalizeServiceIds(payload);
    const slot = objectValue(payload.slot || payload.selectedSlot || {});
    const startAt = text(payload.startAt || slot.startAt || slot.startTime);
    if (!startAt) throw badRequest("slot startAt is required for engagement booking");
    const durationMinutes = Number(payload.durationMinutes || 0) || 45;
    const endAt = text(payload.endAt || slot.endAt || slot.endTime || addMinutesIso(startAt, durationMinutes));
    const resource = text(payload.roomResource || payload.resource || payload.chair || payload.room || slot.chair || slot.room || "");
    const familyBooking = booleanValue(payload.familyBooking);
    const numberOfGuests = positiveInt(payload.numberOfGuests, familyBooking ? 2 : 1, 25);
    const bookingGroupId = familyBooking ? text(payload.bookingGroupId || makeId("eng_group")) : "";
    const appointmentCategory = text(payload.appointmentCategory || payload.category || "");
    const notes = [
      text(payload.notes || ""),
      `Engagement booking${thread ? ` from thread ${thread.id}` : ""}`,
      appointmentCategory ? `Category: ${appointmentCategory}` : "",
      familyBooking ? `Family booking: ${numberOfGuests} guest(s)` : "",
      booleanValue(payload.surpriseVisit) ? "Surprise visit" : "",
      booleanValue(payload.advancedMode) ? "Advanced mode used" : ""
    ].filter(Boolean).join(" | ");
    const appointment = resourceService.create("appointments", {
      clientId,
      branchId,
      staffId: text(payload.staffId || slot.staffId || ""),
      serviceIds,
      startAt,
      endAt,
      chair: resource,
      room: resource,
      status: text(payload.status || "booked"),
      notes,
      source: "engagement",
      sourceChannel: "engagement",
      onlineStatus: "confirmed",
      bookingGroupId,
      groupMemberRole: familyBooking ? "primary" : ""
    }, access, {
      activityAction: "BOOKED",
      req: requestMeta.req
    });
    const event = thread ? this.recordBookingEvent(thread, appointment, {
      ...payload,
      familyBooking,
      numberOfGuests,
      appointmentCategory,
      roomResource: resource
    }, access, requestMeta) : null;
    if (thread) {
      const stamp = now();
      db.prepare(
        `UPDATE engagement_threads
         SET appointment_id = ?,
             staff_id = COALESCE(NULLIF(?, ''), staff_id),
             last_message_at = ?,
             last_message_preview = ?,
             updated_at = ?,
             version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(
        appointment.id,
        appointment.staffId || "",
        stamp,
        `Appointment booked for ${new Date(appointment.startAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}`,
        stamp,
        access.tenantId,
        thread.id
      );
    }
    this.audit({
      action: "engagement.booking.created",
      entityType: "appointment",
      entityId: appointment.id,
      threadId: text(thread?.id || ""),
      messageId: text(event?.id || ""),
      branchId,
      clientId,
      before: {},
      after: {
        appointmentId: appointment.id,
        startAt: appointment.startAt,
        endAt: appointment.endAt,
        staffId: appointment.staffId,
        serviceIds,
        familyBooking,
        numberOfGuests,
        bookingGroupId
      },
      access,
      requestMeta
    });
    return {
      appointment,
      event,
      thread: thread ? this.mustGetThread(thread.id, access) : null,
      warnings: this.bookingClientInsights(clientId, branchId, access)
    };
  }

  listThreads(query = {}, access) {
    const branchId = branchScope(access, query.branchId);
    const params = [access.tenantId];
    const clauses = ["tenant_id = ?"];
    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    if (query.status) {
      clauses.push("status = ?");
      params.push(normalizeThreadStatus(query.status));
    } else if (!["1", "true"].includes(String(query.includeArchived || "").toLowerCase())) {
      clauses.push("archived_at = ''");
    }
    const type = query.type || query.channel || query.primaryChannel;
    if (type) {
      clauses.push("primary_channel = ?");
      params.push(normalizeThreadType(type));
    }
    for (const [queryKey, column] of [
      ["clientId", "client_id"],
      ["appointmentId", "appointment_id"],
      ["invoiceId", "invoice_id"],
      ["membershipId", "membership_id"],
      ["packageId", "package_id"],
      ["assignedTo", "assigned_to"]
    ]) {
      if (query[queryKey]) {
        clauses.push(`${column} = ?`);
        params.push(text(query[queryKey]));
      }
    }
    if (query.search) {
      clauses.push(`lower(subject || ' ' || display_name || ' ' || phone || ' ' || email || ' ' || last_message_preview) LIKE ?`);
      params.push(`%${text(query.search).toLowerCase()}%`);
    }
    params.push(limit(query.limit));
    const rows = db.prepare(
      `SELECT * FROM engagement_threads
       WHERE ${clauses.join(" AND ")}
       ORDER BY COALESCE(NULLIF(last_message_at, ''), updated_at) DESC
       LIMIT ?`
    ).all(...params);
    return rows.map(rowToThread);
  }

  listAuditLogs(query = {}, access) {
    const branchId = branchScope(access, query.branchId);
    const params = [access.tenantId];
    const clauses = ["tenant_id = ?"];
    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    for (const [queryKey, column] of [
      ["threadId", "thread_id"],
      ["messageId", "message_id"],
      ["clientId", "client_id"],
      ["actorUserId", "actor_user_id"],
      ["actorRole", "actor_role"],
      ["action", "action"],
      ["entityType", "entity_type"],
      ["entityId", "entity_id"]
    ]) {
      if (query[queryKey]) {
        clauses.push(`${column} = ?`);
        params.push(text(query[queryKey]));
      }
    }
    if (query.fromDate || query.from) {
      clauses.push("created_at >= ?");
      params.push(text(query.fromDate || query.from));
    }
    if (query.toDate || query.to) {
      clauses.push("created_at <= ?");
      params.push(text(query.toDate || query.to));
    }
    if (query.search) {
      clauses.push(`lower(action || ' ' || entity_type || ' ' || entity_id || ' ' || actor_user_id || ' ' || actor_role) LIKE ?`);
      params.push(`%${text(query.search).toLowerCase()}%`);
    }
    params.push(limit(query.limit, 100));
    return db.prepare(
      `SELECT * FROM engagement_audit_logs
       WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(...params).map(rowToAudit);
  }

  listRiskSignals(query = {}, access, requestMeta = {}) {
    const branchId = branchScope(access, query.branchId);
    this.detectRiskSignals(access, branchId, requestMeta);

    const params = [access.tenantId];
    const clauses = ["tenant_id = ?", "alert_source = 'ai_risk_engine'", "archived_at = ''"];
    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    if (query.riskLevel || query.risk_level) {
      clauses.push("risk_level = ?");
      params.push(normalizeRiskLevel(query.riskLevel || query.risk_level));
    }
    if (query.reviewStatus || query.review_status) {
      clauses.push("review_status = ?");
      params.push(normalizeRiskReviewStatus(query.reviewStatus || query.review_status, "unreviewed"));
    }
    if (query.status) {
      clauses.push("status = ?");
      params.push(text(query.status).toLowerCase());
    }
    if (query.type || query.alertType || query.alert_type) {
      clauses.push("alert_type = ?");
      params.push(normalizeRiskSignalType(query.type || query.alertType || query.alert_type));
    }
    for (const [queryKey, column] of [
      ["clientId", "client_id"],
      ["appointmentId", "appointment_id"],
      ["invoiceId", "invoice_id"],
      ["membershipId", "membership_id"],
      ["packageId", "package_id"],
      ["staffId", "staff_id"],
      ["assignedTo", "assigned_to"]
    ]) {
      if (query[queryKey]) {
        clauses.push(`${column} = ?`);
        params.push(text(query[queryKey]));
      }
    }
    if (query.search) {
      clauses.push(`lower(alert_type || ' ' || title || ' ' || summary || ' ' || suggested_action || ' ' || review_status) LIKE ?`);
      params.push(`%${text(query.search).toLowerCase()}%`);
    }
    params.push(limit(query.limit, 100));
    return db.prepare(
      `SELECT * FROM engagement_client_alerts
       WHERE ${clauses.join(" AND ")}
       ORDER BY risk_score DESC, created_at DESC
       LIMIT ?`
    ).all(...params).map((row) => this.riskSignalView(row, access));
  }

  reviewRiskSignal(id, payload = {}, access, requestMeta = {}) {
    const existingRow = db.prepare(
      `SELECT * FROM engagement_client_alerts
       WHERE tenant_id = ? AND id = ? AND alert_source = 'ai_risk_engine' AND archived_at = ''
       LIMIT 1`
    ).get(access.tenantId, id);
    if (!existingRow) throw notFound("Engagement risk signal not found");
    if (existingRow.branch_id) tenantService.assertBranchAccess(access, existingRow.branch_id);

    const before = rowToClientAlert(existingRow);
    const reviewStatus = normalizeRiskReviewStatus(payload.reviewStatus || payload.review_status, "reviewing");
    const status = riskStatusFromReview(reviewStatus, text(payload.status || before.status || "open").toLowerCase());
    const resolutionNote = text(payload.resolutionNote || payload.note || before.resolutionNote || "");
    const assignedTo = text(payload.assignedTo ?? before.assignedTo ?? "");
    const stamp = now();
    db.prepare(
      `UPDATE engagement_client_alerts
       SET review_status = ?,
           status = ?,
           assigned_to = ?,
           reviewed_by = ?,
           reviewed_at = ?,
           resolved_at = ?,
           resolution_note = ?,
           updated_at = ?,
           version = version + 1
       WHERE tenant_id = ? AND id = ?`
    ).run(
      reviewStatus,
      status,
      assignedTo,
      actor(access).userId,
      stamp,
      status === "resolved" || status === "dismissed" ? stamp : before.resolvedAt || "",
      resolutionNote,
      stamp,
      access.tenantId,
      id
    );
    const updatedRow = db.prepare("SELECT * FROM engagement_client_alerts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    const updated = rowToClientAlert(updatedRow);
    this.audit({
      action: "engagement.risk.reviewed",
      entityType: "engagement_client_alert",
      entityId: id,
      threadId: updated.threadId,
      branchId: updated.branchId,
      clientId: updated.clientId,
      appointmentId: updated.appointmentId,
      invoiceId: updated.invoiceId,
      membershipId: updated.membershipId,
      packageId: updated.packageId,
      staffId: updated.staffId,
      assignedTo: updated.assignedTo,
      before: {
        status: before.status,
        reviewStatus: before.reviewStatus,
        assignedTo: before.assignedTo,
        resolutionNote: before.resolutionNote
      },
      after: {
        status: updated.status,
        reviewStatus: updated.reviewStatus,
        assignedTo: updated.assignedTo,
        resolutionNote: updated.resolutionNote
      },
      details: { source: "ai_risk_next_best_action" },
      access,
      requestMeta,
      severity: ["critical", "high"].includes(updated.riskLevel) ? "warn" : "info"
    });
    return this.riskSignalView(updatedRow, access);
  }

  getThread(id, access) {
    const thread = this.mustGetThread(id, access);
    const messages = db.prepare(
      `SELECT * FROM engagement_messages
       WHERE tenant_id = ? AND thread_id = ?
       ORDER BY created_at ASC`
    ).all(access.tenantId, id).map(rowToMessage);
    const drafts = db.prepare(
      `SELECT * FROM engagement_drafts
       WHERE tenant_id = ? AND thread_id = ?
       ORDER BY created_at DESC`
    ).all(access.tenantId, id).map(rowToDraft);
    const assignments = db.prepare(
      `SELECT * FROM engagement_assignments
       WHERE tenant_id = ? AND thread_id = ?
       ORDER BY created_at DESC`
    ).all(access.tenantId, id);
    const slaEvents = db.prepare(
      `SELECT * FROM engagement_sla_events
       WHERE tenant_id = ? AND thread_id = ?
       ORDER BY created_at DESC`
    ).all(access.tenantId, id);
    const auditTrail = db.prepare(
      `SELECT * FROM engagement_audit_logs
       WHERE tenant_id = ? AND thread_id = ?
       ORDER BY created_at DESC
       LIMIT 100`
    ).all(access.tenantId, id).map(rowToAudit);
    return { thread, messages, drafts, assignments, slaEvents, auditTrail };
  }

  createThread(payload = {}, access, requestMeta = {}) {
    const channel = normalizeThreadType(payload.type || payload.threadType || payload.primaryChannel || payload.channel);
    const status = normalizeThreadStatus(payload.status || "open");
    const entity = commonEntity(payload, { branchId: access.requestedBranchId || access.branchId || "" });
    if (entity.branchId) tenantService.assertBranchAccess(access, entity.branchId);
    const stamp = now();
    const id = payload.id || makeId("eng_thread");
    const row = {
      id,
      tenant_id: access.tenantId,
      branch_id: entity.branchId,
      client_id: entity.clientId,
      appointment_id: entity.appointmentId,
      invoice_id: entity.invoiceId,
      membership_id: entity.membershipId,
      package_id: entity.packageId,
      staff_id: entity.staffId,
      assigned_to: entity.assignedTo,
      primary_channel: channel,
      source: text(payload.source || "manual"),
      subject: text(payload.subject || payload.title || `${channel.replace("_", " ")} conversation`),
      display_name: text(payload.displayName || payload.clientName || ""),
      phone: text(payload.phone || payload.mobile || ""),
      email: text(payload.email || ""),
      status,
      priority: text(payload.priority || "normal"),
      risk_level: text(payload.riskLevel || "low"),
      sla_status: text(payload.slaStatus || "on_track"),
      last_message_at: text(payload.lastMessageAt || ""),
      last_message_preview: text(payload.lastMessagePreview || ""),
      unread_count: Number(payload.unreadCount || 0),
      tags_json: stringify(payload.tags, []),
      metadata_json: stringify(payload.metadata, {}),
      created_at: stamp,
      updated_at: stamp
    };
    db.transaction(() => {
      db.prepare(
        `INSERT INTO engagement_threads
        (id, tenant_id, branch_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id, assigned_to,
         primary_channel, source, subject, display_name, phone, email, status, priority, risk_level, sla_status,
         last_message_at, last_message_preview, unread_count, tags_json, metadata_json, created_at, updated_at)
         VALUES (@id, @tenant_id, @branch_id, @client_id, @appointment_id, @invoice_id, @membership_id, @package_id, @staff_id, @assigned_to,
         @primary_channel, @source, @subject, @display_name, @phone, @email, @status, @priority, @risk_level, @sla_status,
         @last_message_at, @last_message_preview, @unread_count, @tags_json, @metadata_json, @created_at, @updated_at)`
      ).run(row);
      this.audit({
        action: "engagement.thread.created",
        entityType: "engagement_thread",
        entityId: id,
        threadId: id,
        branchId: row.branch_id,
        clientId: row.client_id,
        after: row,
        access,
        requestMeta
      });
    })();
    return rowToThread(db.prepare("SELECT * FROM engagement_threads WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  updateThreadStatus(id, payload = {}, access, requestMeta = {}) {
    const existing = this.mustGetThread(id, access);
    const status = normalizeThreadStatus(payload.status);
    if (existing.status === "escalated" && THREAD_CLOSE_STATUSES.has(status) && !canCloseEscalatedThread(access)) {
      throw forbidden("Escalated engagement threads can only be closed by a manager, owner or super admin");
    }
    const stamp = now();
    const actorInfo = actor(access);
    const snapshot = this.threadSlaSnapshot(existing, access);
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_threads
         SET status = ?,
             sla_status = CASE WHEN ? IN ('resolved', 'archived') THEN 'resolved' ELSE sla_status END,
             archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END,
             archived_by = CASE WHEN ? = 'archived' THEN ? ELSE archived_by END,
             archive_reason = CASE WHEN ? = 'archived' THEN ? ELSE archive_reason END,
             updated_at = ?,
             version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(status, status, status, stamp, status, actorInfo.userId, status, text(payload.reason || ""), stamp, access.tenantId, id);
      if (THREAD_CLOSE_STATUSES.has(status)) {
        this.recordSlaEvent({
          thread: existing,
          eventType: "resolved",
          dueAt: snapshot.dueAt,
          status: "closed",
          severity: "normal",
          responseTimeSeconds: snapshot.firstResponseSeconds || 0,
          resolutionTimeSeconds: secondsBetween(existing.createdAt, stamp),
          evidence: { reason: text(payload.reason || ""), previousStatus: existing.status },
          metadata: { closedBy: actorInfo.userId, closeRole: actorInfo.role },
          access
        });
      }
      this.audit({
        action: "engagement.thread.status_updated",
        entityType: "engagement_thread",
        entityId: id,
        threadId: id,
        branchId: existing.branchId,
        clientId: existing.clientId,
        before: existing,
        after: { status, reason: text(payload.reason || "") },
        access,
        requestMeta
      });
    })();
    return rowToThread(db.prepare("SELECT * FROM engagement_threads WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  assignThread(id, payload = {}, access, requestMeta = {}) {
    const existing = this.mustGetThread(id, access);
    const assignedTo = text(payload.assignedTo || payload.userId || payload.staffId);
    if (!assignedTo) throw badRequest("assignedTo is required");
    const stamp = now();
    const assignmentId = makeId("eng_assign");
    const priority = normalizeSlaPriority(payload.priority || existing.priority || "normal");
    const slaDueAt = text(payload.slaDueAt || addMinutesSafeIso(existing.lastMessageAt || existing.createdAt || stamp, slaPolicyMinutes(priority)));
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_threads
         SET assigned_to = ?, staff_id = ?, priority = ?, sla_status = CASE WHEN sla_status = 'resolved' THEN sla_status ELSE 'on_track' END, updated_at = ?, version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(assignedTo, text(payload.staffId || existing.staffId), priority, stamp, access.tenantId, id);
      db.prepare(
        `INSERT INTO engagement_assignments
        (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id,
         assigned_to, assigned_role, assigned_by, assignment_reason, queue_name, priority, sla_due_at, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?)`
      ).run(
        assignmentId,
        access.tenantId,
        existing.branchId,
        id,
        existing.clientId,
        existing.appointmentId,
        existing.invoiceId,
        existing.membershipId,
        existing.packageId,
        text(payload.staffId || existing.staffId),
        assignedTo,
        text(payload.assignedRole || ""),
        actor(access).userId,
        text(payload.reason || "Manual assignment"),
        text(payload.queueName || "front_desk"),
        priority,
        slaDueAt,
        stamp,
        stamp
      );
      this.recordSlaEvent({
        thread: { ...existing, assignedTo, priority },
        eventType: "assigned",
        dueAt: slaDueAt,
        status: "open",
        severity: priority,
        evidence: { assignmentId, reason: text(payload.reason || "Manual assignment") },
        metadata: { queueName: text(payload.queueName || "front_desk"), assignedRole: text(payload.assignedRole || "") },
        access
      });
      this.audit({
        action: "engagement.thread.assigned",
        entityType: "engagement_thread",
        entityId: id,
        threadId: id,
        branchId: existing.branchId,
        clientId: existing.clientId,
        before: { assignedTo: existing.assignedTo, staffId: existing.staffId },
        after: { assignedTo, staffId: text(payload.staffId || existing.staffId), assignmentId },
        access,
        requestMeta
      });
    })();
    return rowToThread(db.prepare("SELECT * FROM engagement_threads WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  listSlaOverdue(query = {}, access, requestMeta = {}) {
    const branchId = branchScope(access, query.branchId);
    const params = [access.tenantId];
    const clauses = ["tenant_id = ?", "archived_at = ''", "status NOT IN ('resolved', 'archived')"];
    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    if (query.assignedTo) {
      clauses.push("assigned_to = ?");
      params.push(text(query.assignedTo));
    }
    params.push(limit(query.limit, 100));
    const rows = db.prepare(
      `SELECT * FROM engagement_threads
       WHERE ${clauses.join(" AND ")}
       ORDER BY
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         COALESCE(NULLIF(last_message_at, ''), updated_at) ASC
       LIMIT ?`
    ).all(...params);
    const snapshots = rows.map(rowToThread).map((thread) => this.threadSlaSnapshot(thread, access));
    const overdue = snapshots.filter((snapshot) => snapshot.overdue || ["overdue", "breached"].includes(snapshot.slaStatus));
    overdue.forEach((snapshot) => this.ensureSlaBreach(snapshot, access, requestMeta));
    return overdue
      .sort((a, b) => dateMs(a.dueAt) - dateMs(b.dueAt))
      .map((snapshot) => ({
        ...snapshot,
        thread: { ...snapshot.thread, slaStatus: snapshot.overdue ? "overdue" : snapshot.thread.slaStatus },
        slaStatus: snapshot.overdue ? "overdue" : snapshot.slaStatus
      }));
  }

  managerView(query = {}, access, requestMeta = {}) {
    const branchId = branchScope(access, query.branchId);
    const overdueQueue = this.listSlaOverdue({ ...query, branchId, limit: query.limit || 100 }, access, requestMeta);
    const unresolvedConversations = this.listThreads({ branchId, includeArchived: false, limit: 200 }, access)
      .filter((thread) => isOpenThreadStatus(thread.status))
      .map((thread) => this.threadSlaSnapshot(thread, access))
      .sort((a, b) => dateMs(a.dueAt) - dateMs(b.dueAt))
      .slice(0, 100);
    const escalatedThreads = unresolvedConversations.filter((item) => item.thread.status === "escalated");
    const staffPerformance = this.staffAccountabilityReport({ ...query, branchId }, access);
    const actionQueue = this.engagementActionQueue({ ...query, branchId }, access);
    return {
      generatedAt: now(),
      branchId,
      overdueQueue,
      unresolvedConversations,
      escalatedThreads,
      staffPerformance,
      actionQueue
    };
  }

  engagementActionQueue(query = {}, access) {
    const branchId = branchScope(access, query.branchId);
    const messages = scopedRows("engagement_messages", access, branchId, { orderBy: "updated_at", max: 1000 }).map(rowToMessage).filter(Boolean);
    const drafts = scopedRows("engagement_drafts", access, branchId, { orderBy: "updated_at", max: 1000 }).map(rowToDraft).filter(Boolean);
    const templates = scopedRows("engagement_templates", access, branchId, { orderBy: "updated_at", max: 500 }).map(rowToTemplate).filter(Boolean);
    const recovery = scopedRows("engagement_recovery_opportunities", access, branchId, { orderBy: "updated_at", max: 1000 }).map(rowToRecoveryOpportunity).filter(Boolean);
    const readiness = this.listProviderReadiness({ branchId, channel: "whatsapp" }, access);
    const whatsappProviders = readiness.providers || [];

    const pendingApproval = [
      ...messages.filter((message) => message.approvalStatus === "pending"),
      ...drafts.filter((draft) => draft.approvalStatus === "pending" || (draft.approvalRequired && draft.status !== "approved"))
    ];
    const quietHoursBlocked = messages.filter((message) => {
      const reason = `${message.failureReason || ""} ${message.metadata?.blockedReason || ""}`.toLowerCase();
      return message.status === "send_blocked" && reason.includes("quiet");
    });
    const deliveryAttention = messages.filter((message) => {
      if (message.direction !== "outbound") return false;
      const status = text(message.status).toLowerCase();
      const deliveryStatus = text(message.deliveryStatus).toLowerCase();
      return ["failed", "send_blocked", "pending_send"].includes(status) || ["failed", "blocked", "pending", "queued"].includes(deliveryStatus);
    });
    const conversionTracking = recovery.filter((item) => {
      if (["done", "lost", "archived"].includes(item.status)) return false;
      return numberValue(item.expectedValue) > 0 || ["abandoned_appointment", "payment_due", "inactive_client", "package_expiry", "membership_expiry"].includes(item.opportunityType);
    });
    const campaignApproval = templates.filter((template) => {
      return template.channel === "whatsapp" && (template.approvalStatus === "pending" || template.status === "draft" || template.providerStatus === "pending");
    });
    const providerReadiness = whatsappProviders.filter((provider) => !provider.providerConfigured || provider.sendMode !== "direct_send_ready");

    const items = [];
    const push = (type, title, count, priority, description, actionLabel, actionTarget, sample = []) => {
      if (!count) return;
      items.push({ type, title, count, priority, description, actionLabel, actionTarget, sample: sample.slice(0, 5) });
    };

    push(
      "pending_approval",
      "Approval queue",
      pendingApproval.length,
      "urgent",
      "Drafts and sensitive WhatsApp messages waiting for manager approval before send.",
      "Open conversation approvals",
      "inbox",
      pendingApproval
    );
    push(
      "quiet_hours",
      "Quiet-hours blocked",
      quietHoursBlocked.length,
      "high",
      "Messages are held because the client communication policy blocks after-hours sends.",
      "Review send policy",
      "providers",
      quietHoursBlocked
    );
    push(
      "delivery_attention",
      "Delivery attention",
      deliveryAttention.length,
      "high",
      "Outbound WhatsApp messages need provider status review, retry, or manual follow-up.",
      "Open reports",
      "reports",
      deliveryAttention
    );
    push(
      "conversion_tracking",
      "Conversion tracking",
      conversionTracking.length,
      "normal",
      "Open recovery and campaign opportunities need follow-up to close revenue attribution.",
      "Open recovery board",
      "recovery",
      conversionTracking
    );
    push(
      "campaign_approval",
      "Campaign approval",
      campaignApproval.length,
      "normal",
      "WhatsApp templates and campaign drafts need approval before live use.",
      "Open reports",
      "reports",
      campaignApproval
    );
    push(
      "provider_readiness",
      "Provider readiness",
      providerReadiness.length,
      "high",
      "WhatsApp provider setup is incomplete or still pending direct-send adapter readiness.",
      "Open providers",
      "providers",
      providerReadiness
    );

    return {
      generatedAt: now(),
      branchId,
      summary: {
        pendingApproval: pendingApproval.length,
        quietHoursBlocked: quietHoursBlocked.length,
        deliveryAttention: deliveryAttention.length,
        conversionTracking: conversionTracking.length,
        campaignApproval: campaignApproval.length,
        providerReadiness: providerReadiness.length,
        totalActions: items.reduce((sum, item) => sum + item.count, 0)
      },
      items: items.sort((a, b) => {
        const rank = { urgent: 0, high: 1, normal: 2, low: 3 };
        return (rank[a.priority] ?? 9) - (rank[b.priority] ?? 9) || b.count - a.count || a.title.localeCompare(b.title);
      })
    };
  }

  staffAccountabilityReport(query = {}, access) {
    const branchId = branchScope(access, query.branchId);
    const params = [access.tenantId];
    const clauses = ["tenant_id = ?", "archived_at = ''"];
    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    const threads = db.prepare(`SELECT * FROM engagement_threads WHERE ${clauses.join(" AND ")}`).all(...params).map(rowToThread);
    const groups = new Map();
    const ensureGroup = (staffKey) => {
      const key = staffKey || "unassigned";
      if (!groups.has(key)) {
        const staff = key === "unassigned" ? null : this.recoveryStaff(key, access);
        groups.set(key, {
          staffId: staff?.id || (key === "unassigned" ? "" : key),
          staffName: staff?.name || (key === "unassigned" ? "Unassigned" : key),
          role: staff?.role || "",
          assignedThreads: 0,
          unresolvedConversations: 0,
          overdueFollowUps: 0,
          escalatedThreads: 0,
          conversions: 0,
          conversionRevenue: 0,
          abandonedRecovery: 0,
          recoveredOpportunities: 0,
          firstResponseSamples: [],
          resolutionSamples: []
        });
      }
      return groups.get(key);
    };

    for (const thread of threads) {
      const staffKey = thread.assignedTo || thread.staffId || "unassigned";
      const group = ensureGroup(staffKey);
      const snapshot = this.threadSlaSnapshot(thread, access);
      group.assignedThreads += 1;
      if (isOpenThreadStatus(thread.status)) group.unresolvedConversations += 1;
      if (snapshot.overdue || ["overdue", "breached"].includes(snapshot.slaStatus)) group.overdueFollowUps += 1;
      if (thread.status === "escalated") group.escalatedThreads += 1;
      if (snapshot.firstResponseMinutes !== null && snapshot.firstResponseMinutes !== undefined) group.firstResponseSamples.push(snapshot.firstResponseMinutes);
      if (snapshot.resolutionMinutes !== null && snapshot.resolutionMinutes !== undefined) group.resolutionSamples.push(snapshot.resolutionMinutes);
    }

    const conversionClauses = ["tenant_id = ?", "archived_at = ''"];
    const conversionParams = [access.tenantId];
    if (branchId) {
      conversionClauses.push("branch_id = ?");
      conversionParams.push(branchId);
    }
    const conversions = tableExists("engagement_conversions")
      ? db.prepare(`SELECT * FROM engagement_conversions WHERE ${conversionClauses.join(" AND ")}`).all(...conversionParams)
      : [];
    for (const conversion of conversions) {
      if (!conversion.converted_at && !["converted", "won", "completed"].includes(String(conversion.status || "").toLowerCase())) continue;
      const group = ensureGroup(conversion.assigned_to || conversion.staff_id || "unassigned");
      group.conversions += 1;
      group.conversionRevenue += numberValue(conversion.amount);
    }

    const recoveryClauses = ["tenant_id = ?", "archived_at = ''"];
    const recoveryParams = [access.tenantId];
    if (branchId) {
      recoveryClauses.push("branch_id = ?");
      recoveryParams.push(branchId);
    }
    const recoveryRows = db.prepare(`SELECT * FROM engagement_recovery_opportunities WHERE ${recoveryClauses.join(" AND ")}`).all(...recoveryParams);
    for (const row of recoveryRows) {
      const group = ensureGroup(row.assigned_to || row.staff_id || "unassigned");
      if (row.opportunity_type === "abandoned_appointment") group.abandonedRecovery += 1;
      if (row.status === "done" || row.recovered_at) group.recoveredOpportunities += 1;
    }

    const rows = [...groups.values()].map((group) => {
      const avgFirstResponseMinutes = average(group.firstResponseSamples);
      const avgResolutionMinutes = average(group.resolutionSamples);
      const { firstResponseSamples, resolutionSamples, ...safeGroup } = group;
      return {
        ...safeGroup,
        avgFirstResponseMinutes,
        avgFirstResponseLabel: minutesLabel(avgFirstResponseMinutes),
        avgResolutionMinutes,
        avgResolutionLabel: minutesLabel(avgResolutionMinutes)
      };
    }).sort((a, b) => b.overdueFollowUps - a.overdueFollowUps || b.unresolvedConversations - a.unresolvedConversations || a.staffName.localeCompare(b.staffName));

    return {
      generatedAt: now(),
      branchId,
      summary: {
        staffCount: rows.length,
        unresolvedConversations: rows.reduce((sum, row) => sum + row.unresolvedConversations, 0),
        overdueFollowUps: rows.reduce((sum, row) => sum + row.overdueFollowUps, 0),
        conversions: rows.reduce((sum, row) => sum + row.conversions, 0),
        abandonedRecovery: rows.reduce((sum, row) => sum + row.abandonedRecovery, 0),
        avgFirstResponseMinutes: average(rows.map((row) => row.avgFirstResponseMinutes).filter(Boolean)),
        avgResolutionMinutes: average(rows.map((row) => row.avgResolutionMinutes).filter(Boolean))
      },
      rows
    };
  }

  engagementReports(query = {}, access) {
    const filters = this.engagementReportFilters(query, access);
    const branchId = filters.branchId;
    const clientRows = scopedReportRows("clients", access, branchId, { orderBy: "updatedAt", max: 5000 });
    const clientById = new Map(clientRows.map((row) => [row.id, row]));
    const membershipRows = scopedReportRows("client_membership_ledger", access, branchId, { orderBy: "created_at", max: 5000 });
    const activeMembershipClientIds = new Set(membershipRows
      .filter((row) => !["cancel", "cancelled", "expired"].includes(text(row.action || row.status).toLowerCase()))
      .map((row) => row.client_id || row.clientId)
      .filter(Boolean));
    const invoiceRows = scopedReportRows("invoices", access, branchId, { orderBy: "createdAt", max: 5000 }).map(compactInvoice);
    const dueClientIds = new Set(invoiceRows.filter((invoice) => numberValue(invoice.due) > 0).map((invoice) => invoice.clientId).filter(Boolean));
    const riskAlertRows = scopedReportRows("engagement_client_alerts", access, branchId, { orderBy: "created_at", max: 5000 });
    const riskClientIds = new Set(riskAlertRows
      .filter((row) => ["high", "critical"].includes(text(row.risk_level).toLowerCase()))
      .map((row) => row.client_id)
      .filter(Boolean));
    const clientSegmentMatches = (clientId) => this.engagementClientSegmentMatches(clientId, filters, {
      clientById,
      activeMembershipClientIds,
      dueClientIds,
      riskClientIds
    });

    const common = { clientSegmentMatches };
    const threads = scopedReportRows("engagement_threads", access, branchId, { orderBy: "updated_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        ...common,
        dateKeys: ["created_at", "updated_at", "last_message_at"],
        channelKeys: ["primary_channel"],
        statusKeys: ["status", "sla_status"],
        staffKeys: ["staff_id", "assigned_to"]
      }));
    const messages = scopedReportRows("engagement_messages", access, branchId, { orderBy: "created_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        ...common,
        dateKeys: ["created_at", "sent_at", "delivered_at", "failed_at", "updated_at"],
        channelKeys: ["channel"],
        statusKeys: ["status", "delivery_status", "approval_status"],
        staffKeys: ["staff_id", "assigned_to", "sender_user_id", "created_by"]
      }));
    const slaEvents = scopedReportRows("engagement_sla_events", access, branchId, { orderBy: "created_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        ...common,
        dateKeys: ["created_at", "breached_at", "due_at", "updated_at"],
        statusKeys: ["status", "event_type"],
        staffKeys: ["staff_id", "assigned_to"]
      }));
    const recovery = scopedReportRows("engagement_recovery_opportunities", access, branchId, { orderBy: "created_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        ...common,
        dateKeys: ["created_at", "recovered_at", "due_at", "updated_at"],
        channelKeys: ["source_channel"],
        statusKeys: ["status", "priority"],
        riskKeys: ["priority"],
        staffKeys: ["staff_id", "assigned_to"]
      }));
    const conversions = scopedReportRows("engagement_conversions", access, branchId, { orderBy: "created_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        ...common,
        dateKeys: ["converted_at", "created_at", "updated_at"],
        channelKeys: ["source_channel"],
        statusKeys: ["status"],
        staffKeys: ["staff_id", "assigned_to", "created_by"]
      }));
    const drafts = scopedReportRows("engagement_drafts", access, branchId, { orderBy: "created_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        ...common,
        dateKeys: ["created_at", "approved_at", "updated_at"],
        channelKeys: ["channel"],
        statusKeys: ["status", "approval_status"],
        riskKeys: ["risk_level"],
        staffKeys: ["staff_id", "assigned_to", "created_by", "approved_by"]
      }));
    const templates = scopedReportRows("engagement_templates", access, branchId, { orderBy: "updated_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        dateKeys: ["created_at", "updated_at"],
        channelKeys: ["channel"],
        statusKeys: ["status", "approval_status", "provider_status"]
      }));
    const reviews = scopedReportRows("reviews_v2", access, branchId, { orderBy: "reviewed_at", max: 5000 })
      .filter((row) => reportRowMatches(row, { ...filters, riskLevel: "" }, {
        ...common,
        dateKeys: ["reviewed_at", "imported_at", "updated_at"],
        statusKeys: ["status", "sentiment", "reply_approval_status"],
        staffKeys: ["primary_staff_id", "assigned_to", "reply_by"],
        clientIdKeys: ["customer_id"]
      }))
      .filter((row) => !filters.riskLevel || reviewRisk(row).riskLevel === filters.riskLevel);
    const reviewReplies = scopedReportRows("review_replies", access, branchId, { orderBy: "created_at", max: 5000 })
      .filter((row) => reportRowMatches(row, { ...filters, clientSegment: "", riskLevel: "" }, {
        dateKeys: ["created_at", "approved_at", "posted_at", "updated_at"],
        statusKeys: ["approval_status"],
        staffKeys: ["created_by", "approved_by"]
      }));
    const auditRows = scopedReportRows("engagement_audit_logs", access, branchId, { orderBy: "created_at", max: 5000 })
      .filter((row) => reportRowMatches(row, filters, {
        ...common,
        dateKeys: ["created_at"],
        statusKeys: ["severity", "action"],
        staffKeys: ["staff_id", "assigned_to", "actor_user_id"]
      }));

    const responseRows = this.engagementResponseTimeRows(threads, messages, clientById, access);
    const breachedSlaEvents = slaEvents.filter((row) => {
      const status = text(row.status).toLowerCase();
      const eventType = text(row.event_type).toLowerCase();
      return Boolean(row.breached_at) || status === "breached" || eventType === "sla_breached";
    });
    const channelWiseMessages = this.engagementChannelWiseMessages(messages);
    const staffWiseEngagement = this.engagementStaffWiseReport({ threads, messages, recovery, conversions, responseRows, access });
    const recoveryRevenue = this.engagementRecoveryRevenue(recovery, conversions);
    const abandonedAppointmentConversion = this.engagementAbandonedConversion(recovery, conversions);
    const reviewResponsePerformance = this.engagementReviewPerformance(reviews, reviewReplies);
    const membershipPackageExpiryRecovery = this.engagementExpiryRecovery(recovery, conversions);
    const paymentDueRecovery = this.engagementPaymentDueRecovery(recovery, conversions);
    const aiSuggestionAcceptance = this.engagementAiSuggestionAcceptance(drafts, auditRows);
    const templatePerformance = this.engagementTemplatePerformance(templates, messages, drafts, auditRows);
    const whatsappDeliveryStatus = this.engagementWhatsappDeliveryStatus(messages, scopedReportRows("engagement_provider_accounts", access, branchId, { orderBy: "updated_at", max: 200 }));
    const exportRows = this.engagementReportExportRows({
      filters,
      threads,
      messages,
      breachedSlaEvents,
      responseRows,
      channelWiseMessages,
      staffWiseEngagement,
      recoveryRevenue,
      abandonedAppointmentConversion,
      reviewResponsePerformance,
      membershipPackageExpiryRecovery,
      paymentDueRecovery,
      aiSuggestionAcceptance,
      templatePerformance,
      whatsappDeliveryStatus
    });

    return {
      generatedAt: now(),
      filters,
      summary: {
        conversationVolume: threads.length,
        totalMessages: messages.length,
        inboundMessages: messages.filter((row) => row.direction === "inbound").length,
        outboundMessages: messages.filter((row) => row.direction === "outbound").length,
        avgFirstResponseMinutes: average(responseRows.map((row) => row.responseMinutes)),
        slaBreaches: breachedSlaEvents.length,
        staffEngaged: staffWiseEngagement.length,
        recoveryRevenue: recoveryRevenue.totalRevenue,
        abandonedAppointmentConversions: abandonedAppointmentConversion.converted,
        reviewResponsesApproved: reviewResponsePerformance.approvedResponses,
        membershipPackageExpiryRecoveries: membershipPackageExpiryRecovery.total,
        paymentDueRecoveries: paymentDueRecovery.total,
        aiSuggestionAcceptanceRate: aiSuggestionAcceptance.acceptanceRate,
        templateRenderCount: templatePerformance.rendered,
        whatsappDeliveryPlaceholder: whatsappDeliveryStatus.placeholder
      },
      conversationVolume: {
        total: threads.length,
        byStatus: mapCounts(threads, (row) => row.status),
        byChannel: mapCounts(threads, (row) => row.primary_channel),
        daily: mapCounts(threads, (row) => dateOnlyIso(row.created_at), "undated").filter((row) => row.key !== "undated")
      },
      channelWiseMessages,
      responseTime: {
        avgFirstResponseMinutes: average(responseRows.map((row) => row.responseMinutes)),
        avgFirstResponseLabel: minutesLabel(average(responseRows.map((row) => row.responseMinutes))),
        rows: responseRows.slice(0, 200)
      },
      slaBreach: {
        total: breachedSlaEvents.length,
        open: breachedSlaEvents.filter((row) => row.status !== "resolved").length,
        resolved: breachedSlaEvents.filter((row) => row.status === "resolved").length,
        rows: breachedSlaEvents.slice(0, 200).map((row) => ({
          id: row.id,
          threadId: row.thread_id,
          clientId: row.client_id,
          staffId: row.staff_id || row.assigned_to,
          eventType: row.event_type,
          status: row.status,
          severity: row.severity,
          dueAt: row.due_at,
          breachedAt: row.breached_at,
          createdAt: row.created_at
        }))
      },
      staffWiseEngagement,
      recoveryRevenue,
      abandonedAppointmentConversion,
      reviewResponsePerformance,
      membershipPackageExpiryRecovery,
      paymentDueRecovery,
      aiSuggestionAcceptance,
      templatePerformance,
      whatsappDeliveryStatus,
      exportRows
    };
  }

  engagementReportsCsv(query = {}, access) {
    const report = this.engagementReports(query, access);
    const rows = report.exportRows || [];
    const headers = rows.length ? Object.keys(rows[0]) : ["section", "metric", "value", "date", "note"];
    const bodyRows = rows.length ? rows : [{ section: "engagement_reports", metric: "empty", value: 0, date: report.generatedAt, note: "No rows for selected filters" }];
    return [
      headers.join(","),
      ...bodyRows.map((row) => headers.map((header) => this.csvCell(row[header])).join(","))
    ].join("\n");
  }

  engagementReportsPdf(query = {}, access) {
    const report = this.engagementReports(query, access);
    const summary = report.summary || {};
    const lines = [
      "AuraShine Engagement Command Center Reports",
      `Generated: ${report.generatedAt}`,
      `Conversation volume: ${summary.conversationVolume || 0}`,
      `Channel messages: ${summary.totalMessages || 0}`,
      `Avg response: ${report.responseTime?.avgFirstResponseLabel || "0m"}`,
      `SLA breaches: ${summary.slaBreaches || 0}`,
      `Staff engaged: ${summary.staffEngaged || 0}`,
      `Recovery revenue: Rs ${Math.round(summary.recoveryRevenue || 0).toLocaleString("en-IN")}`,
      `Abandoned appointment conversions: ${summary.abandonedAppointmentConversions || 0}`,
      `Review approvals: ${summary.reviewResponsesApproved || 0}`,
      `Membership/package expiry recoveries: ${summary.membershipPackageExpiryRecoveries || 0}`,
      `Payment due recoveries: ${summary.paymentDueRecoveries || 0}`,
      `AI suggestion acceptance: ${summary.aiSuggestionAcceptanceRate || 0}%`,
      `Template renders: ${summary.templateRenderCount || 0}`,
      `WhatsApp delivery placeholder: ${summary.whatsappDeliveryPlaceholder ? "yes" : "no"}`,
      ...report.exportRows.slice(0, 55).map((row) => `${row.section}: ${row.metric} ${row.value} ${row.note || ""}`)
    ];
    return this.simplePdf(lines);
  }

  engagementReportFilters(query = {}, access) {
    const dates = reportDateBounds(query);
    return {
      ...dates,
      branchId: branchScope(access, query.branchId),
      staffId: text(query.staffId || query.staff || ""),
      channel: text(query.channel || "").toLowerCase(),
      status: text(query.status || "").toLowerCase(),
      riskLevel: text(query.riskLevel || "").toLowerCase(),
      clientSegment: text(query.clientSegment || "").toLowerCase(),
      recoveryType: text(query.recoveryType || "").toLowerCase()
    };
  }

  engagementClientSegmentMatches(clientId, filters, context = {}) {
    const segment = filters.clientSegment;
    if (!segment) return true;
    const client = context.clientById?.get(clientId) || {};
    if (segment === "member") return context.activeMembershipClientIds?.has(clientId);
    if (segment === "due") return context.dueClientIds?.has(clientId);
    if (segment === "risk" || segment === "at_risk") return context.riskClientIds?.has(clientId);
    if (segment === "high_value") return numberValue(client.totalSpend || client.total_spend) >= 25000;
    if (segment === "inactive") {
      const lastVisit = client.lastVisitAt || client.last_visit_at || "";
      return !lastVisit || (ageDays(lastVisit) ?? 0) >= 60;
    }
    if (segment === "new") return numberValue(client.visitCount || client.visit_count) <= 1;
    return true;
  }

  engagementResponseTimeRows(threads = [], messages = [], clientById = new Map(), access) {
    const messagesByThread = new Map();
    for (const message of messages) {
      if (!message.thread_id) continue;
      if (!messagesByThread.has(message.thread_id)) messagesByThread.set(message.thread_id, []);
      messagesByThread.get(message.thread_id).push(message);
    }
    return threads.map((thread) => {
      const rows = (messagesByThread.get(thread.id) || []).sort((a, b) => dateMs(a.created_at) - dateMs(b.created_at));
      const firstInbound = rows.find((row) => row.direction === "inbound");
      const firstOutbound = rows.find((row) => row.direction === "outbound" && (!firstInbound || dateMs(row.created_at) >= dateMs(firstInbound.created_at)));
      if (!firstInbound || !firstOutbound) return null;
      const staff = this.recoveryStaff(firstOutbound.sender_user_id || firstOutbound.staff_id || firstOutbound.assigned_to || thread.assigned_to, access);
      const responseMinutes = minutesBetween(firstInbound.created_at, firstOutbound.created_at);
      const client = clientById.get(thread.client_id) || {};
      return {
        threadId: thread.id,
        clientId: thread.client_id || "",
        clientName: client.name || thread.display_name || thread.client_id || "",
        channel: thread.primary_channel,
        staffId: staff?.id || firstOutbound.sender_user_id || firstOutbound.staff_id || firstOutbound.assigned_to || "",
        staffName: staff?.name || firstOutbound.sender_user_id || firstOutbound.staff_id || firstOutbound.assigned_to || "Unassigned",
        firstInboundAt: firstInbound.created_at,
        firstOutboundAt: firstOutbound.created_at,
        responseMinutes,
        responseLabel: minutesLabel(responseMinutes),
        status: thread.status
      };
    }).filter(Boolean).sort((a, b) => b.responseMinutes - a.responseMinutes);
  }

  engagementChannelWiseMessages(messages = []) {
    const byChannel = new Map();
    for (const message of messages) {
      const channel = message.channel || "unknown";
      if (!byChannel.has(channel)) {
        byChannel.set(channel, { channel, total: 0, inbound: 0, outbound: 0, delivered: 0, failed: 0, pending: 0, read: 0, blocked: 0 });
      }
      const bucket = byChannel.get(channel);
      bucket.total += 1;
      if (message.direction === "inbound") bucket.inbound += 1;
      if (message.direction === "outbound") bucket.outbound += 1;
      const delivery = text(message.delivery_status || message.status).toLowerCase();
      if (["delivered", "sent"].includes(delivery)) bucket.delivered += 1;
      else if (["failed", "send_blocked", "blocked"].includes(delivery)) {
        if (delivery.includes("blocked")) bucket.blocked += 1;
        else bucket.failed += 1;
      } else if (delivery === "read") bucket.read += 1;
      else bucket.pending += 1;
    }
    return [...byChannel.values()].sort((a, b) => b.total - a.total || a.channel.localeCompare(b.channel));
  }

  engagementStaffWiseReport({ threads = [], messages = [], recovery = [], conversions = [], responseRows = [], access }) {
    const groups = new Map();
    const ensure = (staffKey) => {
      const key = staffKey || "unassigned";
      if (!groups.has(key)) {
        const staff = key === "unassigned" ? null : this.recoveryStaff(key, access);
        groups.set(key, {
          staffId: staff?.id || (key === "unassigned" ? "" : key),
          staffName: staff?.name || (key === "unassigned" ? "Unassigned" : key),
          threads: 0,
          messages: 0,
          outboundMessages: 0,
          inboundMessages: 0,
          recoveries: 0,
          conversions: 0,
          revenue: 0,
          responseSamples: []
        });
      }
      return groups.get(key);
    };
    for (const thread of threads) ensure(thread.assigned_to || thread.staff_id || "unassigned").threads += 1;
    for (const message of messages) {
      const group = ensure(message.sender_user_id || message.assigned_to || message.staff_id || "unassigned");
      group.messages += 1;
      if (message.direction === "outbound") group.outboundMessages += 1;
      if (message.direction === "inbound") group.inboundMessages += 1;
    }
    for (const row of recovery) ensure(row.assigned_to || row.staff_id || "unassigned").recoveries += 1;
    for (const row of conversions) {
      const group = ensure(row.assigned_to || row.staff_id || row.created_by || "unassigned");
      if (["converted", "won", "completed"].includes(text(row.status).toLowerCase()) || row.converted_at) group.conversions += 1;
      group.revenue += numberValue(row.amount);
    }
    for (const row of responseRows) {
      ensure(row.staffId || "unassigned").responseSamples.push(row.responseMinutes);
    }
    return [...groups.values()].map((group) => {
      const avgFirstResponseMinutes = average(group.responseSamples);
      const { responseSamples, ...safe } = group;
      return {
        ...safe,
        revenue: Math.round(safe.revenue),
        avgFirstResponseMinutes,
        avgFirstResponseLabel: minutesLabel(avgFirstResponseMinutes)
      };
    }).sort((a, b) => b.revenue - a.revenue || b.conversions - a.conversions || b.threads - a.threads);
  }

  engagementRecoveryRevenue(recovery = [], conversions = []) {
    const convertedRecoveryIds = new Set(conversions.filter((row) => row.status === "converted" || row.converted_at).map((row) => row.source_event_id || row.thread_id).filter(Boolean));
    const byType = new Map();
    for (const row of recovery) {
      const type = row.opportunity_type || "recovery";
      if (!byType.has(type)) byType.set(type, { type, count: 0, open: 0, converted: 0, expectedValue: 0, conversionRevenue: 0 });
      const bucket = byType.get(type);
      bucket.count += 1;
      bucket.expectedValue += numberValue(row.expected_value);
      if (["done", "converted"].includes(text(row.status).toLowerCase()) || row.recovered_at || convertedRecoveryIds.has(row.id)) bucket.converted += 1;
      else bucket.open += 1;
    }
    for (const row of conversions) {
      const type = row.conversion_type || "conversion";
      if (!byType.has(type)) byType.set(type, { type, count: 0, open: 0, converted: 0, expectedValue: 0, conversionRevenue: 0 });
      byType.get(type).conversionRevenue += numberValue(row.amount);
    }
    const rows = [...byType.values()].map((row) => ({
      ...row,
      expectedValue: Math.round(row.expectedValue),
      conversionRevenue: Math.round(row.conversionRevenue)
    })).sort((a, b) => b.conversionRevenue - a.conversionRevenue || b.expectedValue - a.expectedValue);
    return {
      totalRevenue: Math.round(sumValue(conversions, "amount")),
      expectedPipeline: Math.round(sumValue(recovery, "expected_value")),
      converted: recovery.filter((row) => ["done", "converted"].includes(text(row.status).toLowerCase()) || row.recovered_at).length,
      rows
    };
  }

  engagementAbandonedConversion(recovery = [], conversions = []) {
    const rows = recovery.filter((row) => row.opportunity_type === "abandoned_appointment");
    const converted = rows.filter((row) => ["done", "converted"].includes(text(row.status).toLowerCase()) || row.recovered_at || row.conversion_id).length;
    const revenue = sumValue(conversions.filter((row) => row.conversion_type === "abandoned_appointment" || row.conversion_type === "recovery_booking"), "amount");
    return {
      abandoned: rows.length,
      converted,
      conversionRate: percentValue(converted, rows.length),
      revenue: Math.round(revenue),
      rows: rows.slice(0, 100).map((row) => rowToRecoveryOpportunity(row))
    };
  }

  engagementReviewPerformance(reviews = [], replies = []) {
    const negativeReviews = reviews.filter(isNegativeReview);
    const approved = replies.filter((row) => row.approval_status === "approved");
    const posted = replies.filter((row) => Number(row.posted_to_platform || 0) === 1 || row.posted_at);
    return {
      totalReviews: reviews.length,
      negativeReviews: negativeReviews.length,
      aiDrafts: replies.filter((row) => Number(row.ai_generated || 0) === 1).length,
      approvedResponses: approved.length,
      sentPlaceholders: posted.length,
      pendingApproval: replies.filter((row) => row.approval_status === "pending").length,
      providerMissing: approved.length - posted.length,
      responseRate: percentValue(replies.length, reviews.length)
    };
  }

  engagementExpiryRecovery(recovery = [], conversions = []) {
    const rows = recovery.filter((row) => ["membership_expiry", "package_expiry"].includes(row.opportunity_type));
    const membership = rows.filter((row) => row.opportunity_type === "membership_expiry");
    const packages = rows.filter((row) => row.opportunity_type === "package_expiry");
    const revenue = sumValue(conversions.filter((row) => ["membership_expiry", "package_expiry", "membership_recovery", "package_recovery"].includes(row.conversion_type)), "amount");
    return {
      total: rows.length,
      membership: membership.length,
      package: packages.length,
      converted: rows.filter((row) => ["done", "converted"].includes(text(row.status).toLowerCase()) || row.recovered_at).length,
      revenue: Math.round(revenue),
      rows: rows.slice(0, 100).map((row) => rowToRecoveryOpportunity(row))
    };
  }

  engagementPaymentDueRecovery(recovery = [], conversions = []) {
    const rows = recovery.filter((row) => row.opportunity_type === "payment_due");
    const revenue = sumValue(conversions.filter((row) => row.conversion_type === "payment_due" || row.invoice_id), "amount");
    return {
      total: rows.length,
      open: rows.filter((row) => !["done", "lost", "archived"].includes(text(row.status).toLowerCase())).length,
      done: rows.filter((row) => ["done", "converted"].includes(text(row.status).toLowerCase()) || row.recovered_at).length,
      revenue: Math.round(revenue),
      rows: rows.slice(0, 100).map((row) => rowToRecoveryOpportunity(row))
    };
  }

  engagementAiSuggestionAcceptance(drafts = [], auditRows = []) {
    const suggestionRows = drafts.filter((row) => {
      const source = text(row.source).toLowerCase();
      return source.includes("ai") || row.confidence > 0 || row.approval_required || row.draft_type === "recovery_opportunity";
    });
    const approved = suggestionRows.filter((row) => row.approval_status === "approved").length;
    const rejected = suggestionRows.filter((row) => row.approval_status === "rejected").length;
    const pending = suggestionRows.filter((row) => row.approval_status === "pending").length;
    return {
      suggestions: suggestionRows.length,
      approved,
      rejected,
      pending,
      generatedSummaries: auditRows.filter((row) => row.action === "engagement.ai_summary.generated").length,
      acceptanceRate: percentValue(approved, approved + rejected + pending)
    };
  }

  engagementTemplatePerformance(templates = [], messages = [], drafts = [], auditRows = []) {
    const rendered = auditRows.filter((row) => row.action === "engagement.template.rendered").length;
    const byTemplate = new Map();
    const ensure = (id, fallback = {}) => {
      const key = id || fallback.id || "manual";
      if (!byTemplate.has(key)) {
        byTemplate.set(key, {
          templateId: key === "manual" ? "" : key,
          name: fallback.name || fallback.template_key || (key === "manual" ? "Manual / no template" : key),
          channel: fallback.channel || "",
          status: fallback.status || "",
          rendered: 0,
          draftsCreated: 0,
          messagesSent: 0,
          approvals: 0
        });
      }
      return byTemplate.get(key);
    };
    for (const template of templates) ensure(template.id, template);
    for (const message of messages) {
      const bucket = ensure(message.template_id || "manual");
      if (message.status === "sent" || message.sent_at) bucket.messagesSent += 1;
      if (message.approval_status === "approved") bucket.approvals += 1;
    }
    for (const draft of drafts) {
      const bucket = ensure(draft.metadata_json ? objectValue(draft.metadata_json).templateId : "manual");
      bucket.draftsCreated += 1;
      if (draft.approval_status === "approved") bucket.approvals += 1;
    }
    for (const row of auditRows.filter((audit) => audit.action === "engagement.template.rendered")) {
      const details = objectValue(row.details_json);
      ensure(details.templateId || details.id || "manual").rendered += 1;
    }
    return {
      totalTemplates: templates.length,
      rendered,
      draftsCreated: drafts.length,
      messagesSent: messages.filter((row) => row.status === "sent" || row.sent_at).length,
      byTemplate: [...byTemplate.values()].sort((a, b) => b.rendered + b.messagesSent - (a.rendered + a.messagesSent)).slice(0, 100)
    };
  }

  engagementWhatsappDeliveryStatus(messages = [], providers = []) {
    const whatsappMessages = messages.filter((row) => row.channel === "whatsapp");
    const configured = providers.some((row) => row.channel === "whatsapp" && row.provider_status === "configured" && Number(row.direct_send_enabled || 0) === 1 && row.status === "active");
    const counts = {
      sent: 0,
      delivered: 0,
      read: 0,
      failed: 0,
      pending: 0,
      blocked: 0
    };
    for (const row of whatsappMessages) {
      const status = text(row.delivery_status || row.status).toLowerCase();
      if (status === "read") counts.read += 1;
      else if (status === "delivered") counts.delivered += 1;
      else if (status === "sent") counts.sent += 1;
      else if (["send_blocked", "blocked"].includes(status)) counts.blocked += 1;
      else if (status === "failed") counts.failed += 1;
      else counts.pending += 1;
    }
    return {
      configured,
      placeholder: !configured,
      total: whatsappMessages.length,
      ...counts,
      note: configured
        ? "WhatsApp provider is configured; delivery rows reflect stored provider statuses."
        : "WhatsApp delivery is a placeholder until a provider account is configured."
    };
  }

  engagementReportExportRows(reportSets = {}) {
    const rows = [];
    const push = (section, metric, value, date = "", note = "", extra = {}) => rows.push({
      section,
      metric,
      value,
      date,
      note,
      branchId: reportSets.filters?.branchId || "",
      ...extra
    });
    push("summary", "conversation_volume", reportSets.threads.length);
    push("summary", "channel_messages", reportSets.messages.length);
    push("summary", "sla_breaches", reportSets.breachedSlaEvents.length);
    push("summary", "recovery_revenue", Math.round(reportSets.recoveryRevenue.totalRevenue || 0));
    push("summary", "ai_suggestion_acceptance_rate", `${reportSets.aiSuggestionAcceptance.acceptanceRate || 0}%`);
    for (const row of reportSets.channelWiseMessages) push("channel_wise_messages", row.channel, row.total, "", `${row.inbound} inbound / ${row.outbound} outbound`);
    for (const row of reportSets.staffWiseEngagement) push("staff_wise_engagement", row.staffName || row.staffId || "Unassigned", row.messages, "", `Revenue ${row.revenue}; conversions ${row.conversions}`, { staffId: row.staffId });
    for (const row of reportSets.recoveryRevenue.rows) push("recovery_revenue", row.type, row.conversionRevenue || row.expectedValue, "", `${row.converted} converted / ${row.open} open`);
    push("abandoned_appointment_conversion", "conversion_rate", `${reportSets.abandonedAppointmentConversion.conversionRate || 0}%`, "", `${reportSets.abandonedAppointmentConversion.converted || 0}/${reportSets.abandonedAppointmentConversion.abandoned || 0}`);
    push("review_response_performance", "approved_responses", reportSets.reviewResponsePerformance.approvedResponses || 0, "", `${reportSets.reviewResponsePerformance.negativeReviews || 0} negative reviews`);
    push("membership_package_expiry_recovery", "total", reportSets.membershipPackageExpiryRecovery.total || 0, "", `${reportSets.membershipPackageExpiryRecovery.membership || 0} membership / ${reportSets.membershipPackageExpiryRecovery.package || 0} package`);
    push("payment_due_recovery", "total", reportSets.paymentDueRecovery.total || 0, "", `${reportSets.paymentDueRecovery.done || 0} done / ${reportSets.paymentDueRecovery.open || 0} open`);
    push("template_performance", "rendered", reportSets.templatePerformance.rendered || 0, "", `${reportSets.templatePerformance.messagesSent || 0} messages sent`);
    for (const row of reportSets.templatePerformance.byTemplate.slice(0, 50)) push("template_performance", row.name, row.rendered + row.messagesSent, "", `${row.draftsCreated} drafts / ${row.approvals} approvals`, { templateId: row.templateId });
    push("whatsapp_delivery_status", "placeholder", reportSets.whatsappDeliveryStatus.placeholder ? "yes" : "no", "", reportSets.whatsappDeliveryStatus.note);
    push("whatsapp_delivery_status", "failed_or_blocked", (reportSets.whatsappDeliveryStatus.failed || 0) + (reportSets.whatsappDeliveryStatus.blocked || 0), "", `${reportSets.whatsappDeliveryStatus.pending || 0} pending`);
    return rows.slice(0, 3000);
  }

  csvCell(value) {
    return `"${String(value ?? "").replace(/"/g, '""')}"`;
  }

  simplePdf(lines = []) {
    const safeLines = lines.slice(0, 90).map((line) => this.pdfText(line).slice(0, 115));
    const stream = [
      "BT",
      "/F1 11 Tf",
      "50 780 Td",
      "14 TL",
      ...safeLines.flatMap((line) => [`(${line}) Tj`, "T*"]),
      "ET"
    ].join("\n");
    const objects = [
      "<< /Type /Catalog /Pages 2 0 R >>\n",
      "<< /Type /Pages /Kids [3 0 R] /Count 1 >>\n",
      "<< /Type /Page /Parent 2 0 R /MediaBox [0 0 595 842] /Contents 4 0 R /Resources << /Font << /F1 5 0 R >> >> >>\n",
      `<< /Length ${stream.length} >>\nstream\n${stream}\nendstream\n`,
      "<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>\n"
    ];
    let pdf = "%PDF-1.4\n";
    const offsets = [];
    objects.forEach((object, index) => {
      offsets.push(pdf.length);
      pdf += `${index + 1} 0 obj\n${object}endobj\n`;
    });
    const xrefOffset = pdf.length;
    pdf += `xref\n0 ${objects.length + 1}\n`;
    pdf += "0000000000 65535 f \n";
    pdf += offsets.map((offset) => `${String(offset).padStart(10, "0")} 00000 n \n`).join("");
    pdf += `trailer\n<< /Size ${objects.length + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`;
    return pdf;
  }

  pdfText(value) {
    return String(value ?? "").replace(/[()\\]/g, " ").replace(/[^\x20-\x7E]/g, " ");
  }

  escalateThread(id, payload = {}, access, requestMeta = {}) {
    const existing = this.mustGetThread(id, access);
    const reason = text(payload.reason || "Manager SLA escalation");
    const priority = normalizeSlaPriority(payload.priority || "urgent");
    const stamp = now();
    const snapshot = this.threadSlaSnapshot(existing, access);
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_threads
         SET status = 'escalated',
             priority = ?,
             risk_level = CASE WHEN risk_level IN ('critical', 'high') THEN risk_level ELSE 'high' END,
             sla_status = 'escalated',
             updated_at = ?,
             version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(priority, stamp, access.tenantId, id);
      this.recordSlaEvent({
        thread: { ...existing, status: "escalated", priority },
        eventType: "escalated",
        dueAt: snapshot.dueAt,
        breachedAt: snapshot.overdue ? stamp : "",
        status: "open",
        severity: priority,
        evidence: { reason, overdueMinutes: snapshot.overdueMinutes || 0 },
        metadata: { escalatedBy: actor(access).userId, previousStatus: existing.status },
        access
      });
      this.createSlaClientAlert({
        thread: existing,
        alertType: "sla_escalation",
        title: "Engagement thread escalated",
        summary: `${existing.subject || existing.displayName || "Conversation"} was escalated for manager follow-up.`,
        priority,
        riskLevel: "high",
        riskScore: 82,
        dueAt: snapshot.dueAt,
        evidence: [{ reason, overdueMinutes: snapshot.overdueMinutes || 0 }],
        suggestedAction: "Manager should review the conversation, assign owner and resolve with client-safe response.",
        access
      });
      this.audit({
        action: "engagement.thread.escalated",
        entityType: "engagement_thread",
        entityId: id,
        threadId: id,
        branchId: existing.branchId,
        clientId: existing.clientId,
        before: { status: existing.status, priority: existing.priority, slaStatus: existing.slaStatus },
        after: { status: "escalated", priority, reason },
        access,
        requestMeta,
        severity: "warning"
      });
    })();
    return rowToThread(db.prepare("SELECT * FROM engagement_threads WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  threadSlaSnapshot(thread = {}, access = {}) {
    const latestAssignment = db.prepare(
      `SELECT * FROM engagement_assignments
       WHERE tenant_id = ? AND thread_id = ? AND archived_at = ''
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, thread.id);
    const latestEvent = db.prepare(
      `SELECT * FROM engagement_sla_events
       WHERE tenant_id = ? AND thread_id = ? AND archived_at = ''
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, thread.id);
    const firstInbound = db.prepare(
      `SELECT created_at FROM engagement_messages
       WHERE tenant_id = ? AND thread_id = ? AND direction = 'inbound' AND archived_at = ''
       ORDER BY created_at ASC
       LIMIT 1`
    ).get(access.tenantId, thread.id);
    const firstOutbound = db.prepare(
      `SELECT COALESCE(NULLIF(sent_at, ''), NULLIF(updated_at, ''), created_at) AS responded_at
       FROM engagement_messages
       WHERE tenant_id = ? AND thread_id = ? AND direction = 'outbound' AND archived_at = ''
         AND approval_status IN ('approved', 'not_required')
       ORDER BY COALESCE(NULLIF(sent_at, ''), NULLIF(updated_at, ''), created_at) ASC
       LIMIT 1`
    ).get(access.tenantId, thread.id);
    const baseAt = firstInbound?.created_at || thread.lastMessageAt || thread.createdAt || thread.updatedAt || now();
    const priority = normalizeSlaPriority(thread.priority);
    const metadata = thread.metadata || {};
    const dueAt = text(latestEvent?.due_at || latestAssignment?.sla_due_at || metadata.slaDueAt || metadata.sla_due_at || addMinutesSafeIso(baseAt, slaPolicyMinutes(priority)));
    const resolved = !isOpenThreadStatus(thread.status);
    const resolvedAt = resolved ? text(thread.archivedAt || thread.updatedAt || now()) : "";
    const responseAt = text(firstOutbound?.responded_at || "");
    const firstResponseSeconds = responseAt ? secondsBetween(baseAt, responseAt) : 0;
    const firstResponseMinutes = responseAt ? Math.round(firstResponseSeconds / 60) : null;
    const resolutionSeconds = resolvedAt ? secondsBetween(thread.createdAt || baseAt, resolvedAt) : 0;
    const resolutionMinutes = resolvedAt ? Math.round(resolutionSeconds / 60) : null;
    const overdue = !resolved && Boolean(dateMs(dueAt)) && dateMs(dueAt) < Date.now();
    const overdueMinutes = overdue ? minutesBetween(dueAt, now()) : 0;
    const staff = this.recoveryStaff(thread.assignedTo || thread.staffId, access);
    const slaStatus = thread.status === "escalated"
      ? "escalated"
      : overdue
        ? "overdue"
        : responseAt
          ? "responded"
          : (thread.slaStatus || "on_track");
    return {
      thread,
      threadId: thread.id,
      subject: thread.subject || "",
      clientId: thread.clientId || "",
      clientName: thread.displayName || "",
      assignedTo: thread.assignedTo || "",
      assignedStaff: staff,
      assignedStaffName: staff?.name || thread.assignedTo || "Unassigned",
      priority,
      status: thread.status || "open",
      slaStatus,
      baseAt,
      dueAt,
      overdue,
      overdueMinutes,
      overdueLabel: minutesLabel(overdueMinutes),
      firstResponseAt: responseAt,
      firstResponseSeconds,
      firstResponseMinutes,
      firstResponseLabel: firstResponseMinutes === null ? "Waiting" : minutesLabel(firstResponseMinutes),
      resolutionAt: resolvedAt,
      resolutionSeconds,
      resolutionMinutes,
      resolutionLabel: resolutionMinutes === null ? "Open" : minutesLabel(resolutionMinutes),
      latestAssignment: latestAssignment || null,
      latestEvent: latestEvent || null
    };
  }

  ensureSlaBreach(snapshot = {}, access = {}, requestMeta = {}) {
    const thread = snapshot.thread || {};
    const existingEvent = db.prepare(
      `SELECT id FROM engagement_sla_events
       WHERE tenant_id = ? AND thread_id = ? AND event_type = 'sla_breached' AND status = 'breached' AND archived_at = ''
       LIMIT 1`
    ).get(access.tenantId, thread.id);
    const existingAlert = db.prepare(
      `SELECT id FROM engagement_client_alerts
       WHERE tenant_id = ? AND thread_id = ? AND alert_type = 'sla_breach' AND status = 'open' AND archived_at = ''
       LIMIT 1`
    ).get(access.tenantId, thread.id);
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_threads
         SET sla_status = 'overdue', updated_at = ?, version = version + 1
         WHERE tenant_id = ? AND id = ? AND sla_status != 'overdue' AND status NOT IN ('resolved', 'archived')`
      ).run(now(), access.tenantId, thread.id);
      if (!existingEvent) {
        this.recordSlaEvent({
          thread,
          eventType: "sla_breached",
          dueAt: snapshot.dueAt,
          breachedAt: now(),
          status: "breached",
          severity: snapshot.priority === "urgent" ? "critical" : "high",
          responseTimeSeconds: snapshot.firstResponseSeconds || 0,
          resolutionTimeSeconds: snapshot.resolutionSeconds || 0,
          evidence: { overdueMinutes: snapshot.overdueMinutes || 0, assignedTo: snapshot.assignedTo || "" },
          metadata: { source: "sla_overdue_queue" },
          access
        });
      }
      if (!existingAlert) {
        this.createSlaClientAlert({
          thread,
          alertType: "sla_breach",
          title: "Engagement SLA breached",
          summary: `${thread.subject || thread.displayName || "Conversation"} is overdue by ${snapshot.overdueLabel || "0m"}.`,
          priority: snapshot.priority === "urgent" ? "urgent" : "high",
          riskLevel: snapshot.priority === "urgent" ? "critical" : "high",
          riskScore: snapshot.priority === "urgent" ? 95 : 82,
          dueAt: snapshot.dueAt,
          evidence: [{ overdueMinutes: snapshot.overdueMinutes || 0, assignedTo: snapshot.assignedTo || "" }],
          suggestedAction: "Escalate to manager or reassign staff before client experience is affected.",
          access
        });
      }
      this.audit({
        action: "engagement.sla.breach_checked",
        entityType: "engagement_thread",
        entityId: thread.id,
        threadId: thread.id,
        branchId: thread.branchId,
        clientId: thread.clientId,
        after: { slaStatus: "overdue", dueAt: snapshot.dueAt, overdueMinutes: snapshot.overdueMinutes || 0 },
        access,
        requestMeta,
        severity: "warning"
      });
    })();
  }

  recordSlaEvent({ thread = {}, eventType = "response_due", dueAt = "", breachedAt = "", status = "open", severity = "normal", responseTimeSeconds = 0, resolutionTimeSeconds = 0, evidence = {}, metadata = {}, access }) {
    db.prepare(
      `INSERT INTO engagement_sla_events
       (id, tenant_id, branch_id, thread_id, message_id, client_id, appointment_id, invoice_id, membership_id, package_id,
        staff_id, assigned_to, event_type, sla_policy_key, due_at, breached_at, status, severity,
        response_time_seconds, resolution_time_seconds, evidence_json, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, '', ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      makeId("eng_sla"),
      access.tenantId,
      thread.branchId || "",
      thread.id || "",
      thread.clientId || "",
      thread.appointmentId || "",
      thread.invoiceId || "",
      thread.membershipId || "",
      thread.packageId || "",
      thread.staffId || "",
      thread.assignedTo || "",
      eventType,
      `priority_${normalizeSlaPriority(thread.priority || severity)}`,
      text(dueAt || ""),
      text(breachedAt || ""),
      text(status || "open"),
      text(severity || "normal"),
      Math.max(0, Math.round(Number(responseTimeSeconds || 0))),
      Math.max(0, Math.round(Number(resolutionTimeSeconds || 0))),
      stringify(evidence, {}),
      stringify(metadata, {}),
      now(),
      now()
    );
  }

  createSlaClientAlert({ thread = {}, alertType = "sla_breach", title = "", summary = "", priority = "high", riskLevel = "high", riskScore = 80, dueAt = "", evidence = [], suggestedAction = "", access }) {
    db.prepare(
      `INSERT INTO engagement_client_alerts
       (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id,
        assigned_to, alert_type, alert_source, title, summary, risk_level, risk_score, priority, status, review_status,
        suggested_action, evidence_json, due_at, created_by, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'sla_manager', ?, ?, ?, ?, ?, 'open', 'unreviewed', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      makeId("eng_alert"),
      access.tenantId,
      thread.branchId || "",
      thread.id || "",
      thread.clientId || "",
      thread.appointmentId || "",
      thread.invoiceId || "",
      thread.membershipId || "",
      thread.packageId || "",
      thread.staffId || "",
      thread.assignedTo || "",
      alertType,
      title,
      summary,
      riskLevel,
      Math.max(0, Math.round(Number(riskScore || 0))),
      priority,
      suggestedAction,
      stringify(evidence, []),
      text(dueAt || ""),
      actor(access).userId,
      stringify({ source: "sla_accountability" }, {}),
      now(),
      now()
    );
  }

  listMessages(query = {}, access) {
    const branchId = branchScope(access, query.branchId);
    const params = [access.tenantId];
    const clauses = ["tenant_id = ?"];
    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    for (const [queryKey, column] of [
      ["threadId", "thread_id"],
      ["clientId", "client_id"],
      ["status", "status"],
      ["direction", "direction"],
      ["approvalStatus", "approval_status"]
    ]) {
      if (query[queryKey]) {
        clauses.push(`${column} = ?`);
        params.push(text(query[queryKey]));
      }
    }
    if (query.channel) {
      clauses.push("channel = ?");
      params.push(normalizeChannel(query.channel));
    }
    if (!["1", "true"].includes(String(query.includeArchived || "").toLowerCase())) {
      clauses.push("archived_at = ''");
    }
    params.push(limit(query.limit, 100));
    return db.prepare(
      `SELECT * FROM engagement_messages
       WHERE ${clauses.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT ?`
    ).all(...params).map(rowToMessage);
  }

  listRecoveryOpportunities(query = {}, access, requestMeta = {}) {
    const branchId = branchScope(access, query.branchId);
    this.detectRecoveryOpportunities(access, branchId, requestMeta);
    const params = [access.tenantId];
    const clauses = ["tenant_id = ?", "archived_at = ''"];
    if (branchId) {
      clauses.push("branch_id = ?");
      params.push(branchId);
    }
    if (query.type || query.opportunityType) {
      clauses.push("opportunity_type = ?");
      params.push(normalizeRecoveryType(query.type || query.opportunityType));
    }
    if (query.status) {
      clauses.push("status = ?");
      params.push(normalizeRecoveryStatus(query.status));
    } else if (!["1", "true"].includes(String(query.includeDone || "").toLowerCase())) {
      clauses.push("status NOT IN ('done', 'lost', 'archived')");
    }
    for (const [queryKey, column] of [
      ["clientId", "client_id"],
      ["assignedTo", "assigned_to"],
      ["staffId", "staff_id"],
      ["priority", "priority"]
    ]) {
      if (query[queryKey]) {
        clauses.push(`${column} = ?`);
        params.push(text(query[queryKey]));
      }
    }
    if (query.search) {
      clauses.push(`lower(title || ' ' || reason || ' ' || suggested_action || ' ' || opportunity_type || ' ' || source_channel) LIKE ?`);
      params.push(`%${text(query.search).toLowerCase()}%`);
    }
    params.push(limit(query.limit, 100));
    const rows = db.prepare(
      `SELECT * FROM engagement_recovery_opportunities
       WHERE ${clauses.join(" AND ")}
       ORDER BY
         CASE priority WHEN 'urgent' THEN 0 WHEN 'high' THEN 1 WHEN 'normal' THEN 2 ELSE 3 END,
         COALESCE(NULLIF(due_at, ''), updated_at) ASC
       LIMIT ?`
    ).all(...params);
    return rows.map((row) => this.enrichRecoveryOpportunity(rowToRecoveryOpportunity(row), access));
  }

  assignRecoveryOpportunity(id, payload = {}, access, requestMeta = {}) {
    const existing = this.mustGetRecoveryOpportunity(id, access);
    const assignedTo = text(payload.assignedTo || payload.userId || payload.staffId);
    if (!assignedTo) throw badRequest("assignedTo is required");
    const staffId = text(payload.staffId || existing.staffId || "");
    const stamp = now();
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_recovery_opportunities
         SET assigned_to = ?,
             staff_id = ?,
             status = CASE WHEN status = 'open' THEN 'assigned' ELSE status END,
             priority = ?,
             due_at = ?,
             updated_at = ?,
             version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(
        assignedTo,
        staffId,
        normalizeRecoveryPriority(payload.priority || existing.priority),
        text(payload.dueAt || existing.dueAt || ""),
        stamp,
        access.tenantId,
        id
      );
      db.prepare(
        `INSERT INTO engagement_assignments
        (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id,
         assigned_to, assigned_role, assigned_by, assignment_reason, queue_name, priority, sla_due_at, status, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'assigned', ?, ?)`
      ).run(
        makeId("eng_assign"),
        access.tenantId,
        existing.branchId,
        existing.threadId,
        existing.clientId,
        existing.appointmentId,
        existing.invoiceId,
        existing.membershipId,
        existing.packageId,
        staffId,
        assignedTo,
        text(payload.assignedRole || ""),
        actor(access).userId,
        text(payload.reason || "Recovery opportunity assignment"),
        "recovery_board",
        normalizeRecoveryPriority(payload.priority || existing.priority),
        text(payload.dueAt || existing.dueAt || ""),
        stamp,
        stamp
      );
      this.audit({
        action: "engagement.recovery.assigned",
        entityType: "engagement_recovery_opportunity",
        entityId: id,
        threadId: existing.threadId,
        branchId: existing.branchId,
        clientId: existing.clientId,
        before: { assignedTo: existing.assignedTo, staffId: existing.staffId, status: existing.status },
        after: { assignedTo, staffId, status: existing.status === "open" ? "assigned" : existing.status },
        access,
        requestMeta
      });
    })();
    return this.enrichRecoveryOpportunity(this.mustGetRecoveryOpportunity(id, access), access);
  }

  createDraftForRecoveryOpportunity(id, payload = {}, access, requestMeta = {}) {
    const opportunity = this.mustGetRecoveryOpportunity(id, access);
    const client = this.recoveryClient(opportunity.clientId, access);
    const thread = opportunity.threadId
      ? this.mustGetThread(opportunity.threadId, access)
      : this.createThread({
        type: "whatsapp",
        branchId: opportunity.branchId,
        clientId: opportunity.clientId,
        appointmentId: opportunity.appointmentId,
        invoiceId: opportunity.invoiceId,
        membershipId: opportunity.membershipId,
        packageId: opportunity.packageId,
        staffId: opportunity.staffId,
        assignedTo: opportunity.assignedTo,
        source: "recovery_opportunity",
        subject: opportunity.title,
        displayName: client?.name || opportunity.clientName || "Recovery client",
        phone: client?.phone || "",
        email: client?.email || "",
        priority: opportunity.priority,
        riskLevel: opportunity.priority === "urgent" ? "high" : opportunity.priority === "high" ? "medium" : "low",
        tags: ["recovery", opportunity.opportunityType],
        metadata: { opportunityId: opportunity.id, opportunityType: opportunity.opportunityType }
      }, access, requestMeta);
    const body = text(payload.body || payload.message || opportunity.metadata?.suggestedMessage || opportunity.suggestedAction);
    if (!body) throw badRequest("suggested message is required");
    const draft = this.createDraft({
      threadId: thread.id,
      body,
      channel: payload.channel || "whatsapp",
      draftType: "recovery_opportunity",
      source: "recovery_board",
      approvalRequired: true,
      optOutChecked: true,
      riskLevel: opportunity.priority === "urgent" || opportunity.priority === "high" ? "medium" : "low",
      riskReasons: [opportunity.reason].filter(Boolean),
      metadata: {
        opportunityId: opportunity.id,
        opportunityType: opportunity.opportunityType,
        expectedValue: opportunity.expectedValue,
        sourceEventId: opportunity.sourceEventId
      }
    }, access, requestMeta);
    const stamp = now();
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_recovery_opportunities
         SET thread_id = ?,
             status = 'draft_created',
             updated_at = ?,
             version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(thread.id, stamp, access.tenantId, id);
      this.audit({
        action: "engagement.recovery.draft_created",
        entityType: "engagement_recovery_opportunity",
        entityId: id,
        threadId: thread.id,
        messageId: draft.message?.id || "",
        branchId: opportunity.branchId,
        clientId: opportunity.clientId,
        before: { status: opportunity.status, threadId: opportunity.threadId },
        after: { status: "draft_created", threadId: thread.id, messageId: draft.message?.id || "", draftId: draft.draft?.id || "" },
        access,
        requestMeta
      });
    })();
    return {
      opportunity: this.enrichRecoveryOpportunity(this.mustGetRecoveryOpportunity(id, access), access),
      thread,
      message: draft.message,
      draft: draft.draft
    };
  }

  markRecoveryOpportunityDone(id, payload = {}, access, requestMeta = {}) {
    const existing = this.mustGetRecoveryOpportunity(id, access);
    const status = normalizeRecoveryStatus(payload.status || (String(payload.outcome || "").toLowerCase() === "lost" ? "lost" : "done"), "done");
    if (!["done", "lost", "archived"].includes(status)) throw badRequest("Recovery opportunity can only be marked done, lost or archived");
    const stamp = now();
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_recovery_opportunities
         SET status = ?,
             outcome = ?,
             recovered_at = CASE WHEN ? = 'done' THEN ? ELSE recovered_at END,
             lost_at = CASE WHEN ? = 'lost' THEN ? ELSE lost_at END,
             archived_at = CASE WHEN ? = 'archived' THEN ? ELSE archived_at END,
             archived_by = CASE WHEN ? = 'archived' THEN ? ELSE archived_by END,
             archive_reason = CASE WHEN ? = 'archived' THEN ? ELSE archive_reason END,
             updated_at = ?,
             version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(
        status,
        text(payload.outcome || status),
        status,
        stamp,
        status,
        stamp,
        status,
        stamp,
        status,
        actor(access).userId,
        status,
        text(payload.note || payload.reason || ""),
        stamp,
        access.tenantId,
        id
      );
      this.audit({
        action: "engagement.recovery.marked_done",
        entityType: "engagement_recovery_opportunity",
        entityId: id,
        threadId: existing.threadId,
        branchId: existing.branchId,
        clientId: existing.clientId,
        before: { status: existing.status, outcome: existing.outcome },
        after: { status, outcome: text(payload.outcome || status), note: text(payload.note || payload.reason || "") },
        access,
        requestMeta
      });
    })();
    return this.enrichRecoveryOpportunity(this.mustGetRecoveryOpportunity(id, access), access);
  }

  client360(clientId, access) {
    const id = text(clientId);
    if (!id) throw badRequest("clientId is required");
    const scoped = tenantService.accessScope(access);
    const requestedBranchId = text(scoped.branchId || access.requestedBranchId || "");
    if (requestedBranchId) tenantService.assertBranchAccess(access, requestedBranchId);
    const clientRow = db.prepare(
      `SELECT * FROM clients
       WHERE tenantId = ?
         AND id = ?
         AND COALESCE(deletedAt, '') = ''`
    ).get(access.tenantId, id);
    if (!clientRow) return emptyClient360(id);
    if (requestedBranchId && clientRow.branchId && clientRow.branchId !== requestedBranchId) return emptyClient360(id);
    const branchId = requestedBranchId || clientRow.branchId || "";
    if (clientRow.branchId) tenantService.assertBranchAccess(access, clientRow.branchId);
    const branch = clientRow.branchId && tableExists("branches")
      ? db.prepare("SELECT id, name, city, status FROM branches WHERE tenantId = ? AND id = ?").get(access.tenantId, clientRow.branchId)
      : null;
    const appointmentParams = [access.tenantId, id];
    const appointmentClauses = ["tenantId = ?", "clientId = ?"];
    if (branchId) {
      appointmentClauses.push("branchId = ?");
      appointmentParams.push(branchId);
    }
    const appointmentRows = db.prepare(
      `SELECT * FROM appointments
       WHERE ${appointmentClauses.join(" AND ")}
       ORDER BY startAt DESC
       LIMIT 100`
    ).all(...appointmentParams);

    const staffIds = [...new Set(appointmentRows.map((item) => text(item.staffId)).filter(Boolean))];
    const serviceIds = [...new Set(appointmentRows.flatMap((item) => arrayValue(item.serviceIds).map(String)))];
    const staffNames = new Map();
    const serviceNames = new Map();
    if (staffIds.length && tableExists("staff")) {
      const placeholders = staffIds.map(() => "?").join(",");
      db.prepare(`SELECT id, name FROM staff WHERE tenantId = ? AND id IN (${placeholders})`).all(access.tenantId, ...staffIds)
        .forEach((row) => staffNames.set(row.id, row.name));
    }
    if (staffIds.length && tableExists("staff_master")) {
      const placeholders = staffIds.map(() => "?").join(",");
      db.prepare(`SELECT id, full_name FROM staff_master WHERE tenant_id = ? AND id IN (${placeholders})`).all(access.tenantId, ...staffIds)
        .forEach((row) => staffNames.set(row.id, row.full_name));
    }
    if (serviceIds.length && tableExists("services")) {
      const placeholders = serviceIds.map(() => "?").join(",");
      db.prepare(`SELECT id, name FROM services WHERE tenantId = ? AND id IN (${placeholders})`).all(access.tenantId, ...serviceIds)
        .forEach((row) => serviceNames.set(row.id, row.name));
    }
    const appointments = appointmentRows.map((row) => compactAppointment(row, staffNames, serviceNames));
    const upcoming = appointments.filter((item) => dateMs(item.startAt) > Date.now()).sort((a, b) => dateMs(a.startAt) - dateMs(b.startAt));
    const past = appointments.filter((item) => !dateMs(item.startAt) || dateMs(item.startAt) <= Date.now()).sort((a, b) => dateMs(b.startAt) - dateMs(a.startAt));

    const invoiceParams = [access.tenantId, id, id];
    const invoiceClauses = ["COALESCE(tenantId, tenant_id, '') = ?", "(clientId = ? OR customer_id = ?)"];
    if (branchId) {
      invoiceClauses.push("COALESCE(branchId, branch_id, '') = ?");
      invoiceParams.push(branchId);
    }
    const invoiceRows = db.prepare(
      `SELECT * FROM invoices
       WHERE ${invoiceClauses.join(" AND ")}
       ORDER BY COALESCE(NULLIF(createdAt, ''), NULLIF(created_at, ''), updatedAt, updated_at) DESC
       LIMIT 80`
    ).all(...invoiceParams);
    const invoices = invoiceRows.map(compactInvoice);
    const dueAmount = invoices.reduce((sum, item) => sum + Math.max(0, numberValue(item.due)), 0);
    const totalSpend = Math.max(numberValue(clientRow.totalSpend), invoices.reduce((sum, item) => sum + numberValue(item.total), 0));
    const unpaidInvoices = invoices.filter((item) => numberValue(item.due) > 0).length;

    const ledgerParams = [access.tenantId, id];
    const ledgerClauses = ["tenant_id = ?", "client_id = ?"];
    if (branchId) {
      ledgerClauses.push("(branch_id = ? OR branch_id = '')");
      ledgerParams.push(branchId);
    }
    const ledgerRows = tableExists("client_membership_ledger")
      ? db.prepare(
        `SELECT * FROM client_membership_ledger
         WHERE ${ledgerClauses.join(" AND ")}
         ORDER BY datetime(created_at) DESC
         LIMIT 25`
      ).all(...ledgerParams)
      : [];
    const planIds = [...new Set(ledgerRows.map((row) => text(row.plan_id)).filter(Boolean))];
    const planNames = new Map();
    if (planIds.length && tableExists("membership_plans")) {
      const placeholders = planIds.map(() => "?").join(",");
      db.prepare(`SELECT id, name, price, validity_days FROM membership_plans WHERE tenant_id = ? AND id IN (${placeholders})`).all(access.tenantId, ...planIds)
        .forEach((row) => planNames.set(row.id, row));
    }
    const membershipLedger = ledgerRows.map((row) => {
      const snapshot = objectValue(row.snapshot_json);
      const plan = planNames.get(row.plan_id);
      return {
        id: row.id,
        action: row.action,
        membershipId: row.membership_id || "",
        planId: row.plan_id || "",
        planName: snapshot.planName || snapshot.name || plan?.name || row.plan_id || "",
        amount: numberValue(row.amount),
        paidAmount: numberValue(row.paid_amount),
        creditsBefore: numberValue(row.credits_before),
        creditsAfter: numberValue(row.credits_after),
        startsOn: row.starts_on || "",
        expiresOn: row.expires_on || "",
        invoiceId: row.invoice_id || "",
        saleId: row.sale_id || "",
        note: row.note || "",
        createdAt: row.created_at || ""
      };
    });
    const activeMemberships = membershipLedger.filter((row) => {
      const action = String(row.action || "").toLowerCase();
      return !["cancel", "cancelled", "expired"].includes(action) && (!row.expiresOn || daysUntil(row.expiresOn) >= 0);
    });
    const activeMembership = activeMemberships[0] || null;

    const packageItems = extractPackageItems([...invoiceRows]);
    const expiringPackages = packageItems.filter((item) => {
      const days = daysUntil(item.expiresOn);
      return days !== null && days >= 0 && days <= 30;
    });

    const preferredStaff = countBy(appointments, "staffId").slice(0, 5).map((item) => ({
      ...item,
      name: staffNames.get(item.id) || item.id
    }));
    const preferredServices = serviceIds.map((serviceId) => ({
      id: serviceId,
      name: serviceNames.get(serviceId) || serviceId,
      count: appointments.filter((appt) => (appt.serviceIds || []).includes(serviceId)).length
    })).sort((a, b) => b.count - a.count).slice(0, 5);

    const compactedClient = compactClient(clientRow, branch);
    const tags = compactedClient.tags.map((label) => ({ key: `tag_${label}`, label, tone: "neutral", reason: "Client profile tag" }));
    if (totalSpend >= 25000) pushTag(tags, "high_spender", "High spender", "success", `Lifetime spend ₹${totalSpend}`);
    if (activeMembership) pushTag(tags, "member", "Member", "success", activeMembership.planName || "Active membership");
    if (compactedClient.allergies.length || Object.keys(compactedClient.safetyFlags).length) pushTag(tags, "profile_alert", "Profile alert", "warning", "Allergy, safety flag or preference captured");
    if (dueAmount > 0) pushTag(tags, "due_balance", "Due balance", "danger", `Outstanding ₹${dueAmount}`);
    if (compactedClient.noShowCount > 0 || appointments.some((item) => item.status === "no_show" || numberValue(item.noShowRiskScore) >= 60)) {
      pushTag(tags, "no_show_risk", "No-show risk", "warning", "Past no-show or high booking risk score");
    }
    if (expiringPackages.length) pushTag(tags, "package_expiring", "Package expiring", "warning", "Package expiry within 30 days");
    if (annualDateWithin(compactedClient.birthday)) pushTag(tags, "birthday", "Birthday", "success", "Birthday within 30 days");
    if (annualDateWithin(compactedClient.anniversary)) pushTag(tags, "anniversary", "Anniversary", "success", "Anniversary within 30 days");

    const alerts = tags
      .filter((tag) => ["warning", "danger"].includes(tag.tone))
      .map((tag) => ({ title: tag.label, summary: tag.reason, status: tag.tone }));
    const membershipName = activeMembership?.planName || "no active membership";
    const aiSummary = `${compactedClient.name || "Client"} has ${membershipName}, wallet ₹${compactedClient.walletBalance}, loyalty ${compactedClient.loyaltyPoints}, due ₹${dueAmount}, ${past.length} past appointments and ${upcoming.length} upcoming appointments.`;

    return {
      clientId: id,
      client: { ...compactedClient, dueAmount, totalSpend },
      branch: branch ? { id: branch.id, name: branch.name, city: branch.city || "", status: branch.status || "" } : null,
      tags,
      membership: {
        activeMembership,
        activeMemberships,
        ledger: membershipLedger,
        empty: !activeMembership,
        summaryText: activeMembership?.planName || "No active membership"
      },
      package: {
        activePackage: packageItems[0] || null,
        recentPackages: packageItems.slice(0, 8),
        expiringSoon: expiringPackages.length > 0,
        empty: packageItems.length === 0,
        summaryText: packageItems[0]?.name || "No active package"
      },
      wallet: { balance: compactedClient.walletBalance, source: "clients.walletBalance" },
      loyalty: { points: compactedClient.loyaltyPoints, source: "clients.loyaltyPoints" },
      balance: { dueAmount, unpaidInvoices },
      appointments: { last: past[0] || null, upcoming: upcoming.slice(0, 8), past: past.slice(0, 12), allCount: appointments.length },
      invoices: { past: invoices.slice(0, 12), totalSpend, dueAmount, unpaidCount: unpaidInvoices },
      notes: { text: compactedClient.notes, preferences: compactedClient.preferences, allergies: compactedClient.allergies },
      files: { available: false, count: 0, placeholder: "Files placeholder ready for consultation forms, photos and signed documents." },
      preferences: {
        preferredStaff,
        preferredServices,
        allergies: compactedClient.allergies,
        communicationPreferences: compactedClient.communicationPreferences,
        rawPreferences: compactedClient.preferences
      },
      alerts,
      aiSummary
    };
  }

  generateClientAiSummary(clientId, payload = {}, access, requestMeta = {}) {
    const id = text(clientId);
    if (!id) throw badRequest("clientId is required");
    const thread = payload.threadId ? this.mustGetThread(payload.threadId, access) : null;
    if (thread?.clientId && thread.clientId !== id) {
      throw badRequest("Thread is linked to a different client");
    }
    const profile = this.client360(id, access);
    if (!profile.client) throw notFound("Client not found");
    const branchId = text(profile.client.branchId || thread?.branchId || tenantService.accessScope(access).branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const summary = buildLocalAiGuestSummary(profile, payload);
    const latest = db.prepare(
      `SELECT COALESCE(MAX(version), 0) AS version
       FROM engagement_ai_summaries
       WHERE tenant_id = ?
         AND client_id = ?
         AND summary_scope = 'client'`
    ).get(access.tenantId, id);
    const version = Number(latest?.version || 0) + 1;
    const summaryId = makeId("eng_ai");
    const stamp = now();
    const membershipId = text(profile.membership?.activeMembership?.membershipId || payload.membershipId || "");
    const packageId = text(profile.package?.activePackage?.id || payload.packageId || "");
    const preferredStaff = (profile.preferences?.preferredStaff || [])[0] || {};
    const staffId = text(payload.staffId || thread?.staffId || preferredStaff.id || "");
    const assignedTo = text(payload.assignedTo || thread?.assignedTo || "");
    db.transaction(() => {
      db.prepare(
        `INSERT INTO engagement_ai_summaries
        (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id, assigned_to,
         summary_scope, summary_text, highlights_json, risks_json, next_best_actions_json, data_sources_json,
         model_provider, model_name, confidence, status, generated_by, expires_at, metadata_json, version, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'client', ?, ?, ?, ?, ?, ?, ?, ?, 'generated', ?, ?, ?, ?, ?, ?)`
      ).run(
        summaryId,
        access.tenantId,
        branchId,
        text(thread?.id || payload.threadId || ""),
        id,
        text(payload.appointmentId || thread?.appointmentId || profile.appointments?.upcoming?.[0]?.id || profile.appointments?.last?.id || ""),
        text(payload.invoiceId || thread?.invoiceId || profile.invoices?.past?.[0]?.id || ""),
        membershipId,
        packageId,
        staffId,
        assignedTo,
        summary.summaryText,
        stringify(summary.insights, []),
        stringify(summary.risks, []),
        stringify(summary.nextBestActions, []),
        stringify(summary.dataSources, []),
        "local_deterministic",
        "aura-engagement-local-v1",
        summary.confidence,
        actor(access).userId,
        text(payload.expiresAt || ""),
        stringify(summary.metadata, {}),
        version,
        stamp,
        stamp
      );
      this.audit({
        action: "engagement.ai_summary.generated",
        entityType: "engagement_ai_summary",
        entityId: summaryId,
        threadId: text(thread?.id || payload.threadId || ""),
        branchId,
        clientId: id,
        after: {
          version,
          confidence: summary.confidence,
          modelProvider: "local_deterministic",
          riskCount: summary.risks.length,
          nextBestActionCount: summary.nextBestActions.length
        },
        details: {
          dataSources: summary.dataSources,
          fallbackReason: summary.metadata.fallbackReason
        },
        access,
        requestMeta
      });
    })();
    return rowToAiSummary(db.prepare("SELECT * FROM engagement_ai_summaries WHERE tenant_id = ? AND id = ?").get(access.tenantId, summaryId));
  }

  enterpriseControlPolicy({ payload = {}, thread = {}, body = "", channel = "whatsapp", access = {} }) {
    const metadata = plainObject(payload.metadata);
    const sensitive = detectSensitiveMessage({ body, payload, metadata });
    const broadcast = isBroadcastMessage({ payload, thread, metadata });
    const privateNote = truthyFlag(metadata.privateNote) || text(payload.draftType).toLowerCase() === "note" || text(payload.messageType).toLowerCase() === "private_note";
    const draftOnlyRole = roleKey(access.role) === "staff";
    const requestedNoApproval = payload.approvalRequired === false;
    const requiresApproval = !privateNote && (sensitive.sensitive || broadcast || draftOnlyRole || !requestedNoApproval);
    const reasons = [
      ...(broadcast ? ["Broadcast messages require owner or manager approval"] : []),
      ...(draftOnlyRole ? ["Staff can create drafts only; manager approval is required before send"] : []),
      ...sensitive.reasons
    ];
    return {
      policyVersion: 1,
      role: roleKey(access.role),
      channel,
      privateNote,
      draftOnlyRole,
      broadcast,
      sensitiveTypes: sensitive.types,
      requiresApproval,
      reasons,
      riskLevel: sensitive.riskLevel,
      quietHours: plainObject(metadata.quietHours),
      contactPolicy: {
        optOutChecked: Boolean(payload.optOutChecked),
        doNotContactChecked: true
      }
    };
  }

  assertApprovalControl(message, access, requestMeta, actionName = "approve") {
    const controls = enterpriseControlsFromMessage(message);
    const broadcast = truthyFlag(controls.broadcast);
    const allowed = broadcast ? canApproveBroadcast(access) : canApproveEngagement(access);
    if (allowed) return;
    const reason = broadcast
      ? "Only owner or manager can approve broadcast engagement messages"
      : "Only owner or manager can approve or reject engagement messages";
    this.audit({
      action: "engagement.enterprise_control.denied",
      entityType: "engagement_message",
      entityId: message.id,
      threadId: message.threadId,
      messageId: message.id,
      branchId: message.branchId,
      clientId: message.clientId,
      after: { control: actionName, reason, actorRole: roleKey(access.role), broadcast },
      access,
      requestMeta,
      severity: "warn"
    });
    throw forbidden(reason);
  }

  assertSendRole(message, access, requestMeta) {
    if (canSendEngagement(access)) return;
    const reason = "Staff can create engagement drafts, but cannot send messages directly";
    this.audit({
      action: "engagement.enterprise_control.denied",
      entityType: "engagement_message",
      entityId: message.id,
      threadId: message.threadId,
      messageId: message.id,
      branchId: message.branchId,
      clientId: message.clientId,
      after: { control: "send", reason, actorRole: roleKey(access.role) },
      access,
      requestMeta,
      severity: "warn"
    });
    throw forbidden(reason);
  }

  clientCommunicationPolicy(message = {}, access = {}) {
    const metadata = messageMetadata(message);
    const profile = {
      doNotContact: metadataFlag(metadata, ["doNotContact", "do_not_contact", "dnc", "doNotContactClient"]),
      whatsappOptOut: metadataFlag(metadata, ["whatsappOptOut", "whatsapp_opt_out", "optOutWhatsapp", "communicationOptOut"]),
      source: "message_metadata"
    };
    if (!message.clientId || !tableExists("clients")) return profile;
    const columns = tableColumns("clients");
    const idColumn = firstColumn(columns, ["id", "client_id", "clientId"]);
    if (!idColumn) return profile;
    const tenantColumn = firstColumn(columns, ["tenant_id", "tenantId"]);
    const branchColumn = firstColumn(columns, ["branch_id", "branchId"]);
    const flagColumns = [
      "do_not_contact",
      "doNotContact",
      "dnc",
      "is_dnc",
      "marketing_opt_out",
      "marketingOptOut",
      "whatsapp_opt_out",
      "whatsappOptOut",
      "opt_out_whatsapp",
      "optOutWhatsapp",
      "communication_opt_out",
      "communicationOptOut"
    ].filter((column) => columns.has(column));
    if (!flagColumns.length) return profile;
    const where = [`${idColumn} = ?`];
    const params = [message.clientId];
    if (tenantColumn) {
      where.push(`${tenantColumn} = ?`);
      params.push(access.tenantId);
    }
    if (branchColumn && message.branchId) {
      where.push(`(${branchColumn} = ? OR ${branchColumn} IS NULL OR ${branchColumn} = '')`);
      params.push(message.branchId);
    }
    const row = db.prepare(`SELECT ${flagColumns.join(", ")} FROM clients WHERE ${where.join(" AND ")} LIMIT 1`).get(...params);
    if (!row) return profile;
    const dncColumns = ["do_not_contact", "doNotContact", "dnc", "is_dnc", "marketing_opt_out", "marketingOptOut"];
    const whatsAppColumns = ["whatsapp_opt_out", "whatsappOptOut", "opt_out_whatsapp", "optOutWhatsapp", "communication_opt_out", "communicationOptOut"];
    return {
      doNotContact: profile.doNotContact || dncColumns.some((column) => truthyFlag(row[column])),
      whatsappOptOut: profile.whatsappOptOut || whatsAppColumns.some((column) => truthyFlag(row[column])),
      source: "client_profile"
    };
  }

  sendPolicyBlock(message, access) {
    const metadata = messageMetadata(message);
    const controls = enterpriseControlsFromMessage(message);
    if ((truthyFlag(controls.broadcast) || (controls.sensitiveTypes || []).length || truthyFlag(controls.requiresApproval)) && message.approvalStatus !== "approved") {
      return { code: "approval_required", reason: "Sensitive, broadcast, or staff-authored message must be approved before send" };
    }
    const contact = this.clientCommunicationPolicy(message, access);
    if (contact.doNotContact) return { code: "do_not_contact", reason: "Client is marked do-not-contact. Message blocked by enterprise controls." };
    if (message.channel === "whatsapp" && (contact.whatsappOptOut || !message.optOutChecked)) {
      return { code: "whatsapp_opt_out", reason: "WhatsApp opt-out status is not cleared. Message blocked by enterprise controls." };
    }
    const quietHours = plainObject(metadata.quietHours || controls.quietHours);
    if (quietHoursActive(quietHours)) {
      return { code: "quiet_hours", reason: "Quiet hours are active for this branch/client. Message remains blocked until allowed hours." };
    }
    return null;
  }

  createDraft(payload = {}, access, requestMeta = {}) {
    const threadId = text(payload.threadId);
    if (!threadId) throw badRequest("threadId is required");
    const thread = this.mustGetThread(threadId, access);
    const body = text(payload.body || payload.message || payload.editedBody || payload.suggestedBody);
    if (!body) throw badRequest("message body is required");
    const channel = normalizeChannel(payload.channel || thread.primaryChannel);
    const controls = this.enterpriseControlPolicy({ payload, thread, body, channel, access });
    const approvalRequired = controls.requiresApproval ? 1 : 0;
    const approvalStatus = approvalRequired ? "pending" : "not_required";
    if (!MESSAGE_APPROVAL_STATUSES.has(approvalStatus)) throw badRequest("Unsupported approval status");
    const stamp = now();
    const messageId = makeId("eng_msg");
    const draftId = makeId("eng_draft");
    const bodyPreview = body.length > 140 ? `${body.slice(0, 137)}...` : body;
    const metadata = {
      ...plainObject(payload.metadata),
      enterpriseControls: controls
    };
    const riskLevel = RISK_LEVELS.has(text(payload.riskLevel).toLowerCase())
      ? text(payload.riskLevel).toLowerCase()
      : controls.riskLevel;
    const riskReasons = [
      ...(Array.isArray(payload.riskReasons) ? payload.riskReasons.map((item) => text(item)).filter(Boolean) : []),
      ...controls.reasons
    ];
    db.transaction(() => {
      db.prepare(
        `INSERT INTO engagement_messages
        (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id, assigned_to,
         provider_account_id, channel, direction, message_type, event_type, sender_user_id, sender_role, recipient_name, recipient_address,
         body, body_preview, template_id, status, delivery_status, approval_status, risk_level, consent_status, opt_out_checked,
         provider_payload_json, metadata_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'outbound', ?, 'draft_created', ?, ?, ?, ?, ?, ?, ?, 'draft', 'pending', ?, ?, ?, ?, ?, ?, ?, ?, ?)`
      ).run(
        messageId,
        access.tenantId,
        thread.branchId,
        thread.id,
        thread.clientId,
        thread.appointmentId,
        thread.invoiceId,
        thread.membershipId,
        thread.packageId,
        thread.staffId,
        thread.assignedTo,
        text(payload.providerAccountId || ""),
        channel,
        text(payload.messageType || "text"),
        actor(access).userId,
        actor(access).role,
        text(payload.recipientName || thread.displayName),
        text(payload.recipientAddress || thread.phone || thread.email),
        body,
        bodyPreview,
        text(payload.templateId || ""),
        approvalStatus,
        riskLevel,
        text(payload.consentStatus || "unknown"),
        payload.optOutChecked ? 1 : 0,
        stringify(payload.providerPayload, {}),
        stringify(metadata, {}),
        actor(access).userId,
        stamp,
        stamp
      );
      db.prepare(
        `INSERT INTO engagement_drafts
        (id, tenant_id, branch_id, thread_id, message_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id,
         assigned_to, provider_account_id, channel, draft_type, source, prompt, incoming_message, suggested_body, edited_body,
         detected_intent, confidence, approval_required, approval_status, status, risk_level, risk_reasons_json, audit_trail_json,
         metadata_json, created_by, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 'draft', ?, ?, '[]', ?, ?, ?, ?)`
      ).run(
        draftId,
        access.tenantId,
        thread.branchId,
        thread.id,
        messageId,
        thread.clientId,
        thread.appointmentId,
        thread.invoiceId,
        thread.membershipId,
        thread.packageId,
        thread.staffId,
        thread.assignedTo,
        text(payload.providerAccountId || ""),
        channel,
        text(payload.draftType || "reply"),
        text(payload.source || "manual"),
        text(payload.prompt || ""),
        text(payload.incomingMessage || ""),
        text(payload.suggestedBody || body),
        text(payload.editedBody || body),
        text(payload.detectedIntent || ""),
        Number(payload.confidence || 0),
        approvalRequired,
        approvalStatus,
        riskLevel,
        stringify(riskReasons, []),
        stringify(metadata, {}),
        actor(access).userId,
        stamp,
        stamp
      );
      this.audit({
        action: "engagement.message.draft_created",
        entityType: "engagement_message",
        entityId: messageId,
        threadId: thread.id,
        messageId,
        branchId: thread.branchId,
        clientId: thread.clientId,
        after: { messageId, draftId, channel, approvalStatus, enterpriseControls: controls },
        access,
        requestMeta
      });
    })();
    return {
      message: rowToMessage(db.prepare("SELECT * FROM engagement_messages WHERE tenant_id = ? AND id = ?").get(access.tenantId, messageId)),
      draft: rowToDraft(db.prepare("SELECT * FROM engagement_drafts WHERE tenant_id = ? AND id = ?").get(access.tenantId, draftId))
    };
  }

  approveMessage(id, payload = {}, access, requestMeta = {}) {
    const message = this.mustGetMessage(id, access);
    this.assertApprovalControl(message, access, requestMeta, "approve");
    if (message.approvalStatus === "rejected") throw badRequest("Rejected message cannot be approved");
    const stamp = now();
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_messages
         SET approval_status = 'approved', status = 'approved', updated_at = ?, version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(stamp, access.tenantId, id);
      db.prepare(
        `UPDATE engagement_drafts
         SET approval_status = 'approved', status = 'approved', approved_by = ?, approved_at = ?, updated_at = ?, version = version + 1
         WHERE tenant_id = ? AND message_id = ?`
      ).run(actor(access).userId, stamp, stamp, access.tenantId, id);
      this.audit({
        action: "engagement.message.approved",
        entityType: "engagement_message",
        entityId: id,
        threadId: message.threadId,
        messageId: id,
        branchId: message.branchId,
        clientId: message.clientId,
        before: { approvalStatus: message.approvalStatus, status: message.status },
        after: { approvalStatus: "approved", status: "approved", note: text(payload.note || "") },
        access,
        requestMeta
      });
    })();
    return rowToMessage(db.prepare("SELECT * FROM engagement_messages WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  rejectMessage(id, payload = {}, access, requestMeta = {}) {
    const message = this.mustGetMessage(id, access);
    this.assertApprovalControl(message, access, requestMeta, "reject");
    const reason = text(payload.reason || payload.rejectionReason);
    if (!reason) throw badRequest("rejection reason is required");
    const stamp = now();
    db.transaction(() => {
      db.prepare(
        `UPDATE engagement_messages
         SET approval_status = 'rejected', status = 'rejected', failure_reason = ?, failed_at = ?, updated_at = ?, version = version + 1
         WHERE tenant_id = ? AND id = ?`
      ).run(reason, stamp, stamp, access.tenantId, id);
      db.prepare(
        `UPDATE engagement_drafts
         SET approval_status = 'rejected', status = 'rejected', updated_at = ?, version = version + 1
         WHERE tenant_id = ? AND message_id = ?`
      ).run(stamp, access.tenantId, id);
      this.audit({
        action: "engagement.message.rejected",
        entityType: "engagement_message",
        entityId: id,
        threadId: message.threadId,
        messageId: id,
        branchId: message.branchId,
        clientId: message.clientId,
        before: { approvalStatus: message.approvalStatus, status: message.status },
        after: { approvalStatus: "rejected", status: "rejected", reason },
        access,
        requestMeta,
        severity: "warn"
      });
    })();
    return rowToMessage(db.prepare("SELECT * FROM engagement_messages WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  sendMessage(id, payload = {}, access, requestMeta = {}) {
    const message = this.mustGetMessage(id, access);
    this.assertSendRole(message, access, requestMeta);
    if (!["approved", "not_required"].includes(message.approvalStatus)) {
      throw badRequest("Message must be approved before send");
    }
    const policyBlock = this.sendPolicyBlock(message, access);
    if (policyBlock) {
      return this.markSendFailed({
        message,
        failureReason: policyBlock.reason,
        failureCode: policyBlock.code,
        access,
        requestMeta
      });
    }
    this.audit({
      action: "engagement.message.send_attempted",
      entityType: "engagement_message",
      entityId: message.id,
      threadId: message.threadId,
      messageId: message.id,
      branchId: message.branchId,
      clientId: message.clientId,
      before: { status: message.status, deliveryStatus: message.deliveryStatus, approvalStatus: message.approvalStatus },
      after: { channel: message.channel, requestedProviderAccountId: text(payload.providerAccountId || "") },
      access,
      requestMeta
    });
    const readiness = this.providerForMessage(message, access);
    if (!readiness?.providerConfigured) {
      return this.markSendPending({
        message,
        reason: readiness?.note || `Engagement provider is disabled or not configured for ${message.channel}. Message remains pending send only.`,
        pendingCode: readiness?.accountId ? "provider_adapter_pending" : "provider_not_configured",
        access,
        requestMeta,
        providerId: readiness?.accountId || ""
      });
    }
    return this.markSendPending({
      message,
      reason: `${readiness.label || readiness.providerName} adapter is prepared, but external dispatch is disabled until live credentials and webhooks are implemented.`,
      pendingCode: "provider_adapter_pending",
      access,
      requestMeta,
      providerId: readiness.accountId || ""
    });
  }

  bookingClientInsights(clientId, branchId, access) {
    const invoiceRows = tableExists("invoices")
      ? db.prepare(
        `SELECT COALESCE(balance, due_amount, 0) AS due
         FROM invoices
         WHERE COALESCE(tenantId, tenant_id, '') = ?
           AND (clientId = ? OR customer_id = ?)
           AND (? = '' OR COALESCE(branchId, branch_id, '') = ?)`
      ).all(access.tenantId, clientId, clientId, branchId, branchId)
      : [];
    const dueAmount = invoiceRows.reduce((sum, row) => sum + Math.max(0, numberValue(row.due)), 0);
    const openRows = tableExists("appointments")
      ? db.prepare(
        `SELECT id, startAt, status
         FROM appointments
         WHERE tenantId = ?
           AND clientId = ?
           AND (? = '' OR branchId = ?)
           AND status IN ('booked', 'arrived', 'in-service', 'confirmed')
         ORDER BY startAt ASC`
      ).all(access.tenantId, clientId, branchId, branchId)
      : [];
    return {
      dueAmount,
      openAppointmentsCount: openRows.length,
      openAppointments: openRows
    };
  }

  recordBookingEvent(thread, appointment, payload = {}, access, requestMeta = {}) {
    const stamp = now();
    const messageId = makeId("eng_msg");
    const body = [
      `Appointment booked for ${new Date(appointment.startAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`,
      appointment.staffId ? `Staff: ${appointment.staffId}.` : "",
      appointment.chair ? `Resource: ${appointment.chair}.` : "",
      payload.familyBooking ? `Family booking for ${payload.numberOfGuests || 1} guest(s).` : "",
      payload.notes ? `Notes: ${text(payload.notes)}` : ""
    ].filter(Boolean).join(" ");
    db.prepare(
      `INSERT INTO engagement_messages
      (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id, assigned_to,
       provider_account_id, channel, direction, message_type, event_type, sender_user_id, sender_role, recipient_name, recipient_address,
       body, body_preview, template_id, status, delivery_status, approval_status, risk_level, consent_status, opt_out_checked,
       provider_payload_json, metadata_json, created_by, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, '', 'appointment', 'system', 'event', 'appointment_booked', ?, ?, ?, ?,
       ?, ?, '', 'recorded', 'not_required', 'not_required', 'low', 'not_required', 1, '{}', ?, ?, ?, ?)`
    ).run(
      messageId,
      access.tenantId,
      appointment.branchId || thread.branchId,
      thread.id,
      appointment.clientId || thread.clientId,
      appointment.id,
      thread.invoiceId || "",
      thread.membershipId || "",
      thread.packageId || "",
      appointment.staffId || thread.staffId || "",
      thread.assignedTo || "",
      actor(access).userId,
      actor(access).role,
      thread.displayName || "",
      thread.phone || thread.email || "",
      body,
      body.length > 140 ? `${body.slice(0, 137)}...` : body,
      stringify({
        source: "engagement_booking_drawer",
        appointmentCategory: payload.appointmentCategory || "",
        familyBooking: Boolean(payload.familyBooking),
        numberOfGuests: payload.numberOfGuests || 1,
        surpriseVisit: booleanValue(payload.surpriseVisit),
        advancedMode: booleanValue(payload.advancedMode),
        roomResource: payload.roomResource || ""
      }, {}),
      actor(access).userId,
      stamp,
      stamp
    );
    return rowToMessage(db.prepare("SELECT * FROM engagement_messages WHERE tenant_id = ? AND id = ?").get(access.tenantId, messageId));
  }

  enrichReviewForEngagement(review = {}, access = {}) {
    const branchId = text(review.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const clientId = text(review.customerId || review.clientId || "");
    const staffId = text(review.primaryStaffId || review.staffId || "");
    const serviceIds = Array.isArray(review.serviceIds) ? review.serviceIds : arrayValue(review.serviceIds);
    const client = clientId && tableExists("clients")
      ? db.prepare("SELECT id, name, phone, email, branchId FROM clients WHERE tenantId = ? AND id = ?").get(access.tenantId, clientId)
      : null;
    const staff = staffId && tableExists("staff")
      ? db.prepare("SELECT id, name, role, branchId FROM staff WHERE tenantId = ? AND id = ?").get(access.tenantId, staffId)
      : null;
    const services = serviceIds.length && tableExists("services")
      ? db.prepare(`SELECT id, name, category FROM services WHERE tenantId = ? AND id IN (${serviceIds.map(() => "?").join(",")})`).all(access.tenantId, ...serviceIds)
      : [];
    const risk = reviewRisk(review);
    return {
      ...review,
      clientId,
      client: client ? {
        id: client.id,
        name: client.name || "",
        phone: client.phone || "",
        email: client.email || "",
        branchId: client.branchId || ""
      } : null,
      staff: staff ? {
        id: staff.id,
        name: staff.name || "",
        role: staff.role || "",
        branchId: staff.branchId || ""
      } : null,
      services,
      serviceStaffLabel: [
        services.map((service) => service.name).filter(Boolean).join(", "),
        staff?.name || ""
      ].filter(Boolean).join(" · "),
      reviewDate: review.reviewedAt || review.createdAt || review.updatedAt || "",
      riskLevel: risk.riskLevel,
      riskScore: risk.riskScore,
      suggestedAction: risk.riskScore >= 82
        ? "Manager should approve a recovery response and call the client before marking resolved."
        : risk.riskScore >= 55
          ? "Respond with apology/retention tone and track recovery outcome."
          : "Approve a warm response and keep the review in normal monitoring."
    };
  }

  latestReviewReply(reviewId, access, approvalStatus = "") {
    const clauses = ["tenant_id = ?", "review_id = ?"];
    const params = [access.tenantId, reviewId];
    if (approvalStatus) {
      clauses.push("approval_status = ?");
      params.push(approvalStatus);
    }
    const row = db.prepare(
      `SELECT * FROM review_replies
       WHERE ${clauses.join(" AND ")}
       ORDER BY updated_at DESC, created_at DESC
       LIMIT 1`
    ).get(...params);
    return row ? {
      id: row.id,
      tenantId: row.tenant_id,
      branchId: row.branch_id || "",
      reviewId: row.review_id,
      replyText: row.reply_text || "",
      replyLanguage: row.reply_language || "",
      aiGenerated: Boolean(row.ai_generated),
      aiModelUsed: row.ai_model_used || "",
      aiPromptVersion: row.ai_prompt_version || "",
      approvalStatus: row.approval_status || "pending",
      approvedBy: row.approved_by || "",
      approvedAt: row.approved_at || "",
      postedToPlatform: Boolean(row.posted_to_platform),
      postedAt: row.posted_at || "",
      platformResponseId: row.platform_response_id || "",
      createdBy: row.created_by || "",
      createdAt: row.created_at || "",
      updatedAt: row.updated_at || ""
    } : null;
  }

  ensureNegativeReviewAlert(review = {}, access = {}, requestMeta = {}, metadata = {}) {
    if (!isNegativeReview(review)) return null;
    const clientId = text(review.customerId || review.clientId || "");
    const branchId = text(review.branchId || "");
    const existing = db.prepare(
      `SELECT * FROM engagement_client_alerts
       WHERE tenant_id = ?
         AND alert_type = 'negative_review'
         AND client_id = ?
         AND metadata_json LIKE ?
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, clientId, `%${review.id}%`);
    if (existing) return rowToClientAlert(existing);
    const risk = reviewRisk(review);
    const alertId = makeId("eng_alert");
    const stamp = now();
    const suggestedAction = risk.riskScore >= 82
      ? "Owner or manager should review, approve recovery response, and contact client."
      : "Front desk should send approved apology response and track recovery.";
    db.prepare(
      `INSERT INTO engagement_client_alerts
      (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id, assigned_to,
       alert_type, alert_source, title, summary, risk_level, risk_score, priority, status, review_status, suggested_action,
       evidence_json, due_at, created_by, metadata_json, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, '', '', ?, '', 'negative_review', 'review_response_center', ?, ?, ?, ?, ?, 'open', 'unreviewed', ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      alertId,
      access.tenantId,
      branchId,
      text(metadata.threadId || ""),
      clientId,
      text(review.appointmentId || ""),
      text(review.invoiceId || ""),
      text(review.primaryStaffId || ""),
      "Negative review needs recovery",
      `${review.reviewerName || review.reviewer || "Client"} rated ${review.rating || 0}/5. ${text(review.reviewText).slice(0, 180)}`,
      risk.riskLevel,
      risk.riskScore,
      risk.priority,
      suggestedAction,
      stringify([{
        reviewId: review.id,
        rating: review.rating,
        sentiment: review.sentiment || "",
        reviewText: review.reviewText || "",
        source: metadata.source || "review_response_center"
      }], []),
      new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
      actor(access).userId,
      stringify({ reviewId: review.id, replyId: metadata.replyId || "", tone: metadata.tone || "" }, {}),
      stamp,
      stamp
    );
    this.audit({
      action: "engagement.review.negative_alert_created",
      entityType: "engagement_client_alert",
      entityId: alertId,
      branchId,
      clientId,
      after: { reviewId: review.id, riskLevel: risk.riskLevel, riskScore: risk.riskScore },
      details: { source: metadata.source || "review_response_center" },
      access,
      requestMeta,
      severity: risk.riskScore >= 82 ? "error" : "warn"
    });
    return rowToClientAlert(db.prepare("SELECT * FROM engagement_client_alerts WHERE tenant_id = ? AND id = ?").get(access.tenantId, alertId));
  }

  riskSignalView(row, access = {}) {
    const alert = rowToClientAlert(row);
    if (!alert) return null;
    const client = this.recoveryClient(alert.clientId, access);
    const staff = this.recoveryStaff(alert.staffId || alert.assignedTo, access);
    return {
      ...alert,
      reason: alert.summary || alert.title,
      risk_level: alert.riskLevel,
      risk_score: alert.riskScore,
      suggested_action: alert.suggestedAction,
      review_status: alert.reviewStatus,
      client: client ? {
        id: client.id,
        name: client.name || "",
        phone: client.phone || "",
        email: client.email || "",
        branchId: client.branchId || ""
      } : null,
      clientName: client?.name || "",
      staff: staff ? {
        id: staff.id,
        name: staff.name || "",
        role: staff.role || "",
        branchId: staff.branchId || ""
      } : null,
      staffName: staff?.name || ""
    };
  }

  upsertRiskSignal(input = {}, access, requestMeta = {}) {
    const alertType = normalizeRiskSignalType(input.alertType || input.type);
    const branchId = text(input.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const sourceEventId = text(input.sourceEventId || input.source_event_id || `${alertType}:${input.clientId || input.staffId || input.title || makeId("source")}`);
    const existing = db.prepare(
      `SELECT * FROM engagement_client_alerts
       WHERE tenant_id = ?
         AND alert_source = 'ai_risk_engine'
         AND alert_type = ?
         AND metadata_json LIKE ?
         AND archived_at = ''
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, alertType, `%\"sourceEventId\":\"${sourceEventId}\"%`);
    if (existing) return rowToClientAlert(existing);

    const score = Math.max(0, Math.min(100, Math.round(numberValue(input.riskScore ?? input.risk_score ?? 50))));
    const level = normalizeRiskLevel(input.riskLevel || input.risk_level, score);
    const priority = normalizeRecoveryPriority(input.priority || riskPriority(level, score), riskPriority(level, score));
    const stamp = now();
    const id = makeId("eng_risk");
    const row = {
      id,
      tenant_id: access.tenantId,
      branch_id: branchId,
      thread_id: text(input.threadId || ""),
      client_id: text(input.clientId || ""),
      appointment_id: text(input.appointmentId || ""),
      invoice_id: text(input.invoiceId || ""),
      membership_id: text(input.membershipId || ""),
      package_id: text(input.packageId || ""),
      staff_id: text(input.staffId || ""),
      assigned_to: text(input.assignedTo || ""),
      alert_type: alertType,
      alert_source: "ai_risk_engine",
      title: text(input.title || alertType.replace(/_/g, " ")),
      summary: text(input.reason || input.summary || ""),
      risk_level: level,
      risk_score: score,
      priority,
      status: text(input.status || "open").toLowerCase(),
      review_status: normalizeRiskReviewStatus(input.reviewStatus || input.review_status, "unreviewed"),
      suggested_action: text(input.suggestedAction || input.suggested_action || ""),
      evidence_json: stringify(input.evidence, []),
      due_at: text(input.dueAt || addDaysIso(level === "critical" ? 0.25 : level === "high" ? 1 : 2)),
      created_by: actor(access).userId,
      metadata_json: stringify({
        ...(input.metadata && typeof input.metadata === "object" ? input.metadata : {}),
        sourceEventId,
        detector: alertType,
        generatedAt: stamp
      }, {}),
      created_at: stamp,
      updated_at: stamp
    };
    db.prepare(
      `INSERT INTO engagement_client_alerts
      (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id, assigned_to,
       alert_type, alert_source, title, summary, risk_level, risk_score, priority, status, review_status, suggested_action,
       evidence_json, due_at, created_by, metadata_json, created_at, updated_at)
       VALUES (@id, @tenant_id, @branch_id, @thread_id, @client_id, @appointment_id, @invoice_id, @membership_id, @package_id,
       @staff_id, @assigned_to, @alert_type, @alert_source, @title, @summary, @risk_level, @risk_score, @priority, @status,
       @review_status, @suggested_action, @evidence_json, @due_at, @created_by, @metadata_json, @created_at, @updated_at)`
    ).run(row);
    this.audit({
      action: "engagement.risk.detected",
      entityType: "engagement_client_alert",
      entityId: id,
      threadId: row.thread_id,
      branchId,
      clientId: row.client_id,
      appointmentId: row.appointment_id,
      invoiceId: row.invoice_id,
      membershipId: row.membership_id,
      packageId: row.package_id,
      staffId: row.staff_id,
      assignedTo: row.assigned_to,
      after: { alertType, riskLevel: level, riskScore: score, reviewStatus: row.review_status },
      details: { sourceEventId, evidenceCount: parseJson(row.evidence_json, []).length },
      access,
      requestMeta,
      severity: level === "critical" ? "error" : level === "high" ? "warn" : "info"
    });
    return rowToClientAlert(db.prepare("SELECT * FROM engagement_client_alerts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  detectRiskSignals(access, branchId = "", requestMeta = {}) {
    return [
      ...this.detectAngryClientRisks(access, branchId, requestMeta),
      ...this.detectRepeatedCancellationRisks(access, branchId, requestMeta),
      ...this.detectUnpaidDueRisks(access, branchId, requestMeta),
      ...this.detectPackageExpiryRisks(access, branchId, requestMeta),
      ...this.detectMembershipExpiryRisks(access, branchId, requestMeta),
      ...this.detectNegativeReviewRisks(access, branchId, requestMeta),
      ...this.detectNoShowRisks(access, branchId, requestMeta),
      ...this.detectHighValueInactiveRisks(access, branchId, requestMeta),
      ...this.detectRepeatedStaffComplaintRisks(access, branchId, requestMeta),
      ...this.detectAppointmentDelayRisks(access, branchId, requestMeta),
      ...this.detectWhatsAppOptOutRisks(access, branchId, requestMeta),
      ...this.detectFailedPaymentLinkRisks(access, branchId, requestMeta),
      ...this.detectAbandonedBookingRisks(access, branchId, requestMeta)
    ];
  }

  detectAngryClientRisks(access, branchId, requestMeta) {
    const risks = [];
    const angryWords = ["angry", "upset", "complaint", "bad", "worst", "refund", "rude", "late", "delay", "wait", "disappointed", "not happy", "gussa", "naraz", "kharab"];
    for (const row of scopedRows("engagement_messages", access, branchId, { orderBy: "created_at", max: 300 })) {
      if (text(row.direction).toLowerCase() !== "inbound") continue;
      const body = `${row.body || ""} ${row.body_preview || ""} ${row.failure_reason || ""}`.toLowerCase();
      const matched = angryWords.filter((word) => body.includes(word));
      if (!matched.length) continue;
      const score = Math.min(96, 68 + matched.length * 7 + (body.includes("refund") || body.includes("worst") || body.includes("rude") ? 12 : 0));
      risks.push(this.upsertRiskSignal({
        alertType: "angry_client",
        sourceEventId: `angry_client:${row.id}`,
        branchId: row.branch_id || "",
        threadId: row.thread_id || "",
        clientId: row.client_id || "",
        appointmentId: row.appointment_id || "",
        invoiceId: row.invoice_id || "",
        membershipId: row.membership_id || "",
        packageId: row.package_id || "",
        staffId: row.staff_id || "",
        title: "Angry client message detected",
        reason: `Inbound ${row.channel || "message"} includes complaint language: ${matched.slice(0, 4).join(", ")}.`,
        riskScore: score,
        riskLevel: normalizeRiskLevel("", score),
        suggestedAction: "Assign manager, acknowledge the issue, and prepare an approval-safe recovery reply.",
        evidence: [{ messageId: row.id, threadId: row.thread_id, channel: row.channel, matchedWords: matched, bodyPreview: row.body_preview || text(row.body).slice(0, 180) }],
        dueAt: addDaysIso(0.25)
      }, access, requestMeta));
    }
    return risks;
  }

  detectRepeatedCancellationRisks(access, branchId, requestMeta) {
    const rows = scopedRows("appointments", access, branchId, { orderBy: "startAt", max: 500 })
      .filter((row) => text(row.status).toLowerCase().includes("cancel") && text(row.clientId));
    const byClient = new Map();
    rows.forEach((row) => {
      const key = text(row.clientId);
      byClient.set(key, [...(byClient.get(key) || []), row]);
    });
    return [...byClient.entries()].filter(([, items]) => items.length >= 2).map(([clientId, items]) => {
      const latest = items[0];
      const score = items.length >= 4 ? 86 : 72;
      return this.upsertRiskSignal({
        alertType: "repeated_cancellation",
        sourceEventId: `repeated_cancellation:${clientId}:${latest.id}`,
        branchId: latest.branchId || "",
        clientId,
        appointmentId: latest.id || "",
        staffId: latest.staffId || "",
        title: "Repeated appointment cancellation",
        reason: `${items.length} cancelled appointments found for this client.`,
        riskScore: score,
        suggestedAction: "Require manager review before premium slot booking and send retention-safe follow-up.",
        evidence: items.slice(0, 8).map((row) => ({ appointmentId: row.id, status: row.status, startAt: row.startAt, staffId: row.staffId }))
      }, access, requestMeta);
    });
  }

  detectUnpaidDueRisks(access, branchId, requestMeta) {
    return scopedRows("invoices", access, branchId, { orderBy: "createdAt", max: 300 }).map(compactInvoice).filter((invoice) => numberValue(invoice.due) > 0).map((invoice) => {
      const due = numberValue(invoice.due);
      const score = due >= 10000 ? 90 : due >= 5000 ? 78 : 58;
      return this.upsertRiskSignal({
        alertType: "unpaid_due",
        sourceEventId: `unpaid_due:${invoice.id}`,
        branchId: invoice.branchId,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        staffId: invoice.staffId,
        title: "Unpaid due balance",
        reason: `Invoice ${invoice.invoiceNumber} has ${money(due)} pending.`,
        riskScore: score,
        suggestedAction: "Create payment reminder draft and block further credit if policy requires manager approval.",
        evidence: [{ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, due, total: invoice.total, paid: invoice.paid, status: invoice.status }],
        dueAt: invoice.dueDate || addDaysIso(1)
      }, access, requestMeta);
    });
  }

  detectPackageExpiryRisks(access, branchId, requestMeta) {
    const risks = [];
    for (const row of scopedRows("invoices", access, branchId, { orderBy: "createdAt", max: 300 })) {
      const invoice = compactInvoice(row);
      for (const item of extractPackageItems([row])) {
        const days = daysUntil(item.expiresOn);
        if (days === null || days < 0 || days > 30 || numberValue(item.remainingCredits) <= 0) continue;
        const score = days <= 3 ? 82 : days <= 7 ? 72 : 52;
        risks.push(this.upsertRiskSignal({
          alertType: "package_expiry",
          sourceEventId: `package_expiry:${invoice.id}:${item.id}:${item.expiresOn}`,
          branchId: invoice.branchId,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          packageId: item.id,
          staffId: invoice.staffId,
          title: "Package credits expiring",
          reason: `${item.name} has ${item.remainingCredits} credit(s) and expires in ${daysLabel(days)}.`,
          riskScore: score,
          suggestedAction: "Send package usage reminder and suggest a bookable slot before expiry.",
          evidence: [{ invoiceId: invoice.id, packageId: item.id, packageName: item.name, remainingCredits: item.remainingCredits, expiresOn: item.expiresOn, daysLeft: days }],
          dueAt: item.expiresOn
        }, access, requestMeta));
      }
    }
    return risks;
  }

  detectMembershipExpiryRisks(access, branchId, requestMeta) {
    const risks = [];
    for (const row of scopedRows("client_membership_ledger", access, branchId, { orderBy: "expires_on", max: 300 })) {
      const action = text(row.action).toLowerCase();
      if (["cancel", "cancelled", "expired"].includes(action)) continue;
      const days = daysUntil(row.expires_on);
      if (days === null || days < 0 || days > 30) continue;
      const planName = objectValue(row.snapshot_json).planName || objectValue(row.snapshot_json).name || row.plan_id || "membership";
      const score = days <= 3 ? 84 : days <= 7 ? 74 : 52;
      risks.push(this.upsertRiskSignal({
        alertType: "membership_expiry",
        sourceEventId: `membership_expiry:${row.membership_id || row.id}:${row.expires_on}`,
        branchId: row.branch_id || "",
        clientId: row.client_id || "",
        invoiceId: row.invoice_id || "",
        membershipId: row.membership_id || "",
        title: "Membership expiry risk",
        reason: `${planName} expires in ${daysLabel(days)}.`,
        riskScore: score,
        suggestedAction: "Create renewal reminder draft with benefits and pending credits context.",
        evidence: [{ ledgerId: row.id, membershipId: row.membership_id, planId: row.plan_id, expiresOn: row.expires_on, daysLeft: days, action: row.action }],
        dueAt: row.expires_on || addDaysIso(2)
      }, access, requestMeta));
    }
    return risks;
  }

  detectNegativeReviewRisks(access, branchId, requestMeta) {
    return scopedRows("reviews_v2", access, branchId, { orderBy: "reviewed_at", max: 250 }).filter(isNegativeReview).map((review) => {
      const risk = reviewRisk(review);
      return this.upsertRiskSignal({
        alertType: "negative_review",
        sourceEventId: `negative_review:${review.id}`,
        branchId: review.branch_id || "",
        clientId: review.customer_id || "",
        appointmentId: review.appointment_id || "",
        staffId: review.primary_staff_id || "",
        title: "Negative review risk",
        reason: `${review.reviewer_name || "Client"} rated ${review.rating || 0}/5.`,
        riskScore: risk.riskScore,
        riskLevel: risk.riskLevel,
        suggestedAction: "Generate manager-approved review response and create recovery follow-up.",
        evidence: [{ reviewId: review.id, rating: review.rating, sentiment: review.sentiment, reviewText: review.review_text }],
        dueAt: addDaysIso(1)
      }, access, requestMeta);
    });
  }

  detectNoShowRisks(access, branchId, requestMeta) {
    return scopedRows("appointments", access, branchId, { orderBy: "startAt", max: 400 }).filter((row) => {
      const status = text(row.status).toLowerCase();
      return numberValue(row.noShowRiskScore) >= 70 || status.includes("no_show") || status.includes("no-show");
    }).map((row) => {
      const riskScore = Math.max(numberValue(row.noShowRiskScore), text(row.status).toLowerCase().includes("no") ? 80 : 70);
      return this.upsertRiskSignal({
        alertType: "no_show_risk",
        sourceEventId: `no_show_risk:${row.id}`,
        branchId: row.branchId || "",
        clientId: row.clientId || "",
        appointmentId: row.id || "",
        staffId: row.staffId || "",
        title: "No-show risk",
        reason: `Appointment has no-show risk score ${riskScore}.`,
        riskScore,
        suggestedAction: "Confirm attendance on WhatsApp and keep backup/waitlist option ready.",
        evidence: [{ appointmentId: row.id, status: row.status, startAt: row.startAt, noShowRiskScore: row.noShowRiskScore, serviceIds: arrayValue(row.serviceIds) }],
        dueAt: row.startAt || addDaysIso(1)
      }, access, requestMeta);
    });
  }

  detectHighValueInactiveRisks(access, branchId, requestMeta) {
    return scopedRows("clients", access, branchId, { orderBy: "lastVisitAt", max: 300 }).filter((row) => {
      if (row.deletedAt) return false;
      const inactiveDays = ageDays(row.lastVisitAt);
      return numberValue(row.totalSpend) >= 25000 && (inactiveDays === null || inactiveDays >= 60);
    }).map((row) => {
      const inactiveDays = ageDays(row.lastVisitAt) ?? 120;
      const score = inactiveDays >= 180 ? 88 : 74;
      return this.upsertRiskSignal({
        alertType: "high_value_client_inactive",
        sourceEventId: `high_value_inactive:${row.id}:${row.lastVisitAt || "unknown"}`,
        branchId: row.branchId || "",
        clientId: row.id || "",
        title: "High-value client inactive",
        reason: `${row.name || "Client"} has lifetime spend ${money(row.totalSpend)} and no recent visit for ${inactiveDays} days.`,
        riskScore: score,
        suggestedAction: "Assign owner or manager follow-up with personalized next best offer.",
        evidence: [{ clientId: row.id, lastVisitAt: row.lastVisitAt, inactiveDays, totalSpend: numberValue(row.totalSpend), visitCount: numberValue(row.visitCount) }],
        dueAt: addDaysIso(1)
      }, access, requestMeta);
    });
  }

  detectRepeatedStaffComplaintRisks(access, branchId, requestMeta) {
    const negativeReviews = scopedRows("reviews_v2", access, branchId, { orderBy: "reviewed_at", max: 300 })
      .filter((row) => text(row.primary_staff_id) && isNegativeReview(row));
    const byStaff = new Map();
    negativeReviews.forEach((row) => {
      const key = text(row.primary_staff_id);
      byStaff.set(key, [...(byStaff.get(key) || []), row]);
    });
    return [...byStaff.entries()].filter(([, rows]) => rows.length >= 2).map(([staffId, rows]) => {
      const latest = rows[0];
      const score = rows.length >= 4 ? 92 : 78;
      return this.upsertRiskSignal({
        alertType: "repeated_staff_complaint",
        sourceEventId: `staff_complaint:${staffId}:${rows.map((row) => row.id).slice(0, 4).join(":")}`,
        branchId: latest.branch_id || "",
        clientId: latest.customer_id || "",
        appointmentId: latest.appointment_id || "",
        staffId,
        title: "Repeated staff complaint signal",
        reason: `${rows.length} negative review(s) are linked to the same staff member.`,
        riskScore: score,
        suggestedAction: "Manager should review staff coaching, service recovery and future assignment rules.",
        evidence: rows.slice(0, 8).map((row) => ({ reviewId: row.id, customerId: row.customer_id, rating: row.rating, sentiment: row.sentiment, reviewText: row.review_text }))
      }, access, requestMeta);
    });
  }

  detectAppointmentDelayRisks(access, branchId, requestMeta) {
    const openStatuses = ["booked", "confirmed", "arrived", "checked_in", "checked-in", "in-service", "in_service", "running"];
    return scopedRows("appointments", access, branchId, { orderBy: "startAt", max: 400 }).filter((row) => {
      const status = text(row.status).toLowerCase();
      if (!openStatuses.some((candidate) => status.includes(candidate))) return false;
      const start = dateMs(row.startAt || row.appointmentDate || row.date);
      if (!start) return false;
      const delayMinutes = Math.round((Date.now() - start) / 60000);
      return delayMinutes >= 15 && delayMinutes <= 1440;
    }).map((row) => {
      const delayMinutes = Math.round((Date.now() - dateMs(row.startAt || row.appointmentDate || row.date)) / 60000);
      const score = delayMinutes >= 60 ? 82 : 66;
      return this.upsertRiskSignal({
        alertType: "appointment_delay_risk",
        sourceEventId: `appointment_delay:${row.id}:${Math.floor(delayMinutes / 15)}`,
        branchId: row.branchId || "",
        clientId: row.clientId || "",
        appointmentId: row.id || "",
        staffId: row.staffId || "",
        title: "Appointment delay risk",
        reason: `Open appointment appears delayed by ${delayMinutes} minute(s).`,
        riskScore: score,
        suggestedAction: "Notify client, update expected start time and escalate to floor manager if needed.",
        evidence: [{ appointmentId: row.id, status: row.status, startAt: row.startAt, delayMinutes, staffId: row.staffId }],
        dueAt: addDaysIso(0)
      }, access, requestMeta);
    });
  }

  detectWhatsAppOptOutRisks(access, branchId, requestMeta) {
    return scopedRows("engagement_messages", access, branchId, { orderBy: "created_at", max: 300 }).filter((row) => {
      const body = text(row.body || row.body_preview).toLowerCase();
      return text(row.channel).toLowerCase() === "whatsapp" && (text(row.consent_status).toLowerCase() === "opt_out" || /(^|\s)(stop|unsubscribe|opt\s*out)(\s|$)/i.test(body));
    }).map((row) => this.upsertRiskSignal({
      alertType: "whatsapp_opt_out",
      sourceEventId: `whatsapp_opt_out:${row.id}`,
      branchId: row.branch_id || "",
      threadId: row.thread_id || "",
      clientId: row.client_id || "",
      title: "WhatsApp opt-out detected",
      reason: "Client may have opted out of WhatsApp communication.",
      riskScore: 88,
      suggestedAction: "Stop promotional WhatsApp messages and verify consent before any further outbound communication.",
      evidence: [{ messageId: row.id, threadId: row.thread_id, consentStatus: row.consent_status, bodyPreview: row.body_preview || text(row.body).slice(0, 160) }],
      dueAt: addDaysIso(0)
    }, access, requestMeta));
  }

  detectFailedPaymentLinkRisks(access, branchId, requestMeta) {
    return scopedRows("engagement_messages", access, branchId, { orderBy: "updated_at", max: 300 }).filter((row) => {
      const combined = `${row.body || ""} ${row.body_preview || ""} ${row.failure_reason || ""} ${row.metadata_json || ""}`.toLowerCase();
      const failed = ["failed", "send_blocked", "undelivered"].includes(text(row.status || row.delivery_status).toLowerCase()) || text(row.delivery_status).toLowerCase().includes("fail") || text(row.failure_reason);
      return failed && /payment|pay\s?link|upi|card|razorpay|link/.test(combined);
    }).map((row) => this.upsertRiskSignal({
      alertType: "failed_payment_link",
      sourceEventId: `failed_payment_link:${row.id}`,
      branchId: row.branch_id || "",
      threadId: row.thread_id || "",
      clientId: row.client_id || "",
      invoiceId: row.invoice_id || "",
      title: "Failed payment link",
      reason: row.failure_reason || "Payment link message failed or was blocked.",
      riskScore: 76,
      suggestedAction: "Create a new payment follow-up draft and verify client contact details before resending.",
      evidence: [{ messageId: row.id, threadId: row.thread_id, status: row.status, deliveryStatus: row.delivery_status, failureReason: row.failure_reason }],
      dueAt: addDaysIso(0.5)
    }, access, requestMeta));
  }

  detectAbandonedBookingRisks(access, branchId, requestMeta) {
    return scopedRows("appointments", access, branchId, { orderBy: "updatedAt", max: 300 }).filter((row) => {
      const status = text(row.status).toLowerCase();
      return status.includes("abandon") || status.includes("draft") || status.includes("incomplete");
    }).map((row) => this.upsertRiskSignal({
      alertType: "abandoned_booking",
      sourceEventId: `abandoned_booking:${row.id}`,
      branchId: row.branchId || "",
      clientId: row.clientId || "",
      appointmentId: row.id || "",
      staffId: row.staffId || "",
      title: "Abandoned booking",
      reason: `Appointment booking stopped in '${row.status || "unknown"}' status.`,
      riskScore: 62,
      suggestedAction: "Create a booking recovery draft and offer suggested slots.",
      evidence: [{ appointmentId: row.id, status: row.status, startAt: row.startAt, serviceIds: arrayValue(row.serviceIds) }],
      dueAt: addDaysIso(1)
    }, access, requestMeta));
  }

  detectRecoveryOpportunities(access, branchId = "", requestMeta = {}) {
    return [
      ...this.detectAppointmentRecovery(access, branchId, requestMeta),
      ...this.detectMissedCallRecovery(access, branchId, requestMeta),
      ...this.detectInvoiceRecovery(access, branchId, requestMeta),
      ...this.detectMembershipExpiryRecovery(access, branchId, requestMeta),
      ...this.detectPackageExpiryRecovery(access, branchId, requestMeta),
      ...this.detectClientLifecycleRecovery(access, branchId, requestMeta),
      ...this.detectNegativeReviewRecovery(access, branchId, requestMeta)
    ];
  }

  upsertRecoveryOpportunity(input = {}, access, requestMeta = {}) {
    const opportunityType = normalizeRecoveryType(input.opportunityType || input.type);
    const branchId = text(input.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const sourceEventId = text(input.sourceEventId || input.source_event_id || `${opportunityType}:${input.clientId || input.title || makeId("source")}`);
    const existing = db.prepare(
      `SELECT * FROM engagement_recovery_opportunities
       WHERE tenant_id = ?
         AND opportunity_type = ?
         AND source_event_id = ?
         AND archived_at = ''
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, opportunityType, sourceEventId);
    if (existing) return rowToRecoveryOpportunity(existing);

    const stamp = now();
    const id = makeId("eng_recovery");
    const row = {
      id,
      tenant_id: access.tenantId,
      branch_id: branchId,
      thread_id: text(input.threadId || ""),
      client_id: text(input.clientId || ""),
      appointment_id: text(input.appointmentId || ""),
      invoice_id: text(input.invoiceId || ""),
      membership_id: text(input.membershipId || ""),
      package_id: text(input.packageId || ""),
      staff_id: text(input.staffId || ""),
      assigned_to: text(input.assignedTo || ""),
      opportunity_type: opportunityType,
      source_event_id: sourceEventId,
      source_channel: text(input.sourceChannel || "system_detection"),
      title: text(input.title || opportunityType.replace(/_/g, " ")),
      reason: text(input.reason || ""),
      suggested_action: text(input.suggestedAction || ""),
      expected_value: Number(input.expectedValue || 0),
      confidence: Number(input.confidence || 0.72),
      status: normalizeRecoveryStatus(input.status || "open"),
      priority: normalizeRecoveryPriority(input.priority || "normal"),
      conversion_id: text(input.conversionId || ""),
      due_at: text(input.dueAt || addDaysIso(2)),
      evidence_json: stringify(input.evidence, []),
      metadata_json: stringify(input.metadata, {}),
      created_at: stamp,
      updated_at: stamp
    };
    db.prepare(
      `INSERT INTO engagement_recovery_opportunities
      (id, tenant_id, branch_id, thread_id, client_id, appointment_id, invoice_id, membership_id, package_id, staff_id, assigned_to,
       opportunity_type, source_event_id, source_channel, title, reason, suggested_action, expected_value, confidence, status,
       priority, conversion_id, due_at, evidence_json, metadata_json, created_at, updated_at)
       VALUES (@id, @tenant_id, @branch_id, @thread_id, @client_id, @appointment_id, @invoice_id, @membership_id, @package_id,
       @staff_id, @assigned_to, @opportunity_type, @source_event_id, @source_channel, @title, @reason, @suggested_action,
       @expected_value, @confidence, @status, @priority, @conversion_id, @due_at, @evidence_json, @metadata_json, @created_at, @updated_at)`
    ).run(row);
    this.audit({
      action: "engagement.recovery.detected",
      entityType: "engagement_recovery_opportunity",
      entityId: id,
      threadId: row.thread_id,
      branchId,
      clientId: row.client_id,
      after: {
        opportunityType,
        sourceEventId,
        priority: row.priority,
        expectedValue: row.expected_value,
        dueAt: row.due_at
      },
      details: { sourceChannel: row.source_channel, evidenceCount: parseJson(row.evidence_json, []).length },
      access,
      requestMeta
    });
    return rowToRecoveryOpportunity(db.prepare("SELECT * FROM engagement_recovery_opportunities WHERE tenant_id = ? AND id = ?").get(access.tenantId, id));
  }

  detectAppointmentRecovery(access, branchId, requestMeta) {
    const opportunities = [];
    for (const row of scopedRows("appointments", access, branchId, { orderBy: "startAt", max: 300 })) {
      const status = text(row.status).toLowerCase().replace(/\s+/g, "_");
      let opportunityType = "";
      if (status.includes("no_show") || status.includes("no-show")) opportunityType = "no_show";
      else if (status.includes("cancel")) opportunityType = "cancelled_appointment";
      else if (status.includes("abandon") || status.includes("incomplete") || status.includes("draft")) opportunityType = "abandoned_appointment";
      if (!opportunityType) continue;
      const startAt = row.startAt || row.appointmentDate || row.date || "";
      const serviceIds = arrayValue(row.serviceIds || row.service_ids);
      const expectedValue = this.serviceValue(serviceIds, access) || numberValue(row.total || row.amount || row.price, 1200);
      const clientName = this.recoveryClient(row.clientId, access)?.name || "client";
      const serviceName = this.serviceNames(serviceIds, access).join(", ") || "service";
      const title = opportunityType === "no_show"
        ? "No-show recovery"
        : opportunityType === "cancelled_appointment"
          ? "Cancelled appointment recovery"
          : "Abandoned appointment recovery";
      const message = `Hi ${clientName}, we noticed your ${serviceName} booking was not completed. Reply here and we will help you choose a comfortable slot.`;
      opportunities.push(this.upsertRecoveryOpportunity({
        branchId: row.branchId || "",
        clientId: row.clientId || "",
        appointmentId: row.id || "",
        staffId: row.staffId || "",
        opportunityType,
        sourceEventId: `appointment:${opportunityType}:${row.id}`,
        sourceChannel: "appointment",
        title,
        reason: `${title} detected from appointment status '${row.status || "unknown"}'.`,
        suggestedAction: "Create a WhatsApp recovery draft and offer a new slot.",
        expectedValue,
        confidence: opportunityType === "no_show" ? 0.86 : 0.78,
        priority: opportunityType === "no_show" ? "high" : "normal",
        dueAt: startAt && dateMs(startAt) > Date.now() ? startAt : addDaysIso(1),
        evidence: [{ appointmentId: row.id, status: row.status, startAt, serviceIds }],
        metadata: { suggestedMessage: message, serviceName, startAt }
      }, access, requestMeta));
    }
    return opportunities;
  }

  detectMissedCallRecovery(access, branchId, requestMeta) {
    const opportunities = [];
    for (const row of scopedRows("engagement_call_logs", access, branchId, { orderBy: "started_at", max: 200 })) {
      const status = text(row.status).toLowerCase();
      const outcome = text(row.outcome).toLowerCase();
      const missed = row.direction === "inbound" && (Number(row.follow_up_required || 0) || status.includes("miss") || status.includes("unanswered") || outcome.includes("miss") || Number(row.duration_seconds || 0) === 0);
      if (!missed) continue;
      const clientName = this.recoveryClient(row.client_id, access)?.name || row.caller_name || "client";
      opportunities.push(this.upsertRecoveryOpportunity({
        branchId: row.branch_id || "",
        threadId: row.thread_id || "",
        clientId: row.client_id || "",
        appointmentId: row.appointment_id || "",
        invoiceId: row.invoice_id || "",
        membershipId: row.membership_id || "",
        packageId: row.package_id || "",
        staffId: row.staff_id || "",
        assignedTo: row.assigned_to || "",
        opportunityType: "missed_call",
        sourceEventId: `call:${row.id}`,
        sourceChannel: "call",
        title: "Missed call follow-up",
        reason: `Inbound call from ${row.phone || clientName} needs follow-up.`,
        suggestedAction: "Assign front desk and create a WhatsApp or callback draft.",
        expectedValue: 1000,
        confidence: 0.82,
        priority: "high",
        dueAt: addDaysIso(0.25),
        evidence: [{ callId: row.id, phone: row.phone, startedAt: row.started_at, status: row.status, outcome: row.outcome }],
        metadata: { suggestedMessage: `Hi ${clientName}, we missed your call. Please reply here or tell us a good time to call you back.` }
      }, access, requestMeta));
    }
    return opportunities;
  }

  detectInvoiceRecovery(access, branchId, requestMeta) {
    const opportunities = [];
    for (const row of scopedRows("invoices", access, branchId, { orderBy: "createdAt", max: 300 })) {
      const invoice = compactInvoice(row);
      const due = numberValue(invoice.due);
      if (due <= 0) continue;
      const client = this.recoveryClient(invoice.clientId, access);
      opportunities.push(this.upsertRecoveryOpportunity({
        branchId: invoice.branchId,
        clientId: invoice.clientId,
        invoiceId: invoice.id,
        staffId: invoice.staffId,
        opportunityType: "payment_due",
        sourceEventId: `invoice_due:${invoice.id}`,
        sourceChannel: "invoice",
        title: "Payment due recovery",
        reason: `Invoice ${invoice.invoiceNumber} has ${money(due)} due.`,
        suggestedAction: "Create a payment reminder draft with invoice context.",
        expectedValue: due,
        confidence: 0.9,
        priority: due >= 5000 ? "high" : "normal",
        dueAt: invoice.dueDate || addDaysIso(1),
        evidence: [{ invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, due, total: invoice.total, status: invoice.status }],
        metadata: { suggestedMessage: `Hi ${client?.name || "client"}, your pending invoice balance is ${money(due)}. Please reply here and our team will help complete the payment.` }
      }, access, requestMeta));
    }
    return opportunities;
  }

  detectMembershipExpiryRecovery(access, branchId, requestMeta) {
    const opportunities = [];
    for (const row of scopedRows("client_membership_ledger", access, branchId, { orderBy: "expires_on", max: 300 })) {
      const action = text(row.action).toLowerCase();
      if (["cancel", "cancelled", "expired"].includes(action)) continue;
      const days = daysUntil(row.expires_on);
      if (days === null || days < 0 || days > 30) continue;
      const snapshot = objectValue(row.snapshot_json);
      const planName = snapshot.planName || snapshot.name || row.plan_id || "membership";
      const client = this.recoveryClient(row.client_id, access);
      opportunities.push(this.upsertRecoveryOpportunity({
        branchId: row.branch_id || "",
        clientId: row.client_id || "",
        membershipId: row.membership_id || "",
        invoiceId: row.invoice_id || "",
        opportunityType: "membership_expiry",
        sourceEventId: `membership_expiry:${row.membership_id || row.id}:${row.expires_on}`,
        sourceChannel: "membership",
        title: "Membership expiry recovery",
        reason: `${planName} expires in ${daysLabel(days)}.`,
        suggestedAction: "Create a renewal reminder draft before benefits lapse.",
        expectedValue: numberValue(row.amount || row.paid_amount, 0),
        confidence: 0.84,
        priority: days <= 7 ? "high" : "normal",
        dueAt: row.expires_on || addDaysIso(2),
        evidence: [{ membershipId: row.membership_id, planId: row.plan_id, expiresOn: row.expires_on, daysLeft: days }],
        metadata: { suggestedMessage: `Hi ${client?.name || "client"}, your ${planName} membership expires in ${daysLabel(days)}. Renew now to keep your benefits active.` }
      }, access, requestMeta));
    }
    return opportunities;
  }

  detectPackageExpiryRecovery(access, branchId, requestMeta) {
    const opportunities = [];
    for (const row of scopedRows("invoices", access, branchId, { orderBy: "createdAt", max: 300 })) {
      const invoice = compactInvoice(row);
      const client = this.recoveryClient(invoice.clientId, access);
      for (const item of extractPackageItems([row])) {
        const days = daysUntil(item.expiresOn);
        if (days === null || days < 0 || days > 30 || numberValue(item.remainingCredits) <= 0) continue;
        opportunities.push(this.upsertRecoveryOpportunity({
          branchId: invoice.branchId,
          clientId: invoice.clientId,
          invoiceId: invoice.id,
          packageId: item.id,
          staffId: invoice.staffId,
          opportunityType: "package_expiry",
          sourceEventId: `package_expiry:${invoice.id}:${item.id}:${item.expiresOn}`,
          sourceChannel: "package",
          title: "Package expiry recovery",
          reason: `${item.name} has ${item.remainingCredits} credit(s) and expires in ${daysLabel(days)}.`,
          suggestedAction: "Create package usage reminder draft.",
          expectedValue: Math.max(numberValue(invoice.total) / 4, 750),
          confidence: 0.8,
          priority: days <= 7 ? "high" : "normal",
          dueAt: item.expiresOn || addDaysIso(2),
          evidence: [{ invoiceId: invoice.id, packageId: item.id, name: item.name, remainingCredits: item.remainingCredits, expiresOn: item.expiresOn }],
          metadata: { suggestedMessage: `Hi ${client?.name || "client"}, your ${item.name} package has ${item.remainingCredits} credit(s) left and expires in ${daysLabel(days)}. Please book your session soon.` }
        }, access, requestMeta));
      }
    }
    return opportunities;
  }

  detectClientLifecycleRecovery(access, branchId, requestMeta) {
    const opportunities = [];
    for (const row of scopedRows("clients", access, branchId, { orderBy: "lastVisitAt", max: 300 })) {
      if (row.deletedAt) continue;
      const client = compactClient(row, null);
      const lastAge = ageDays(client.lastVisitAt);
      const inactiveDays = lastAge === null ? 120 : lastAge;
      const totalSpend = numberValue(client.totalSpend);
      const visitCount = numberValue(client.visitCount);
      const walletBalance = numberValue(client.walletBalance);
      const baseValue = Math.max(750, Math.min(8000, totalSpend * 0.12 || 1200));
      if ((visitCount > 0 || totalSpend > 0) && inactiveDays >= 90) {
        opportunities.push(this.upsertRecoveryOpportunity({
          branchId: client.branchId,
          clientId: client.id,
          opportunityType: "inactive_client",
          sourceEventId: `inactive_client:${client.id}:${client.lastVisitAt || "unknown"}`,
          sourceChannel: "client_360",
          title: "Inactive client recovery",
          reason: `${client.name || "Client"} has no recent visit for ${inactiveDays} days.`,
          suggestedAction: "Create a personalized win-back draft with preferred service context.",
          expectedValue: baseValue,
          confidence: 0.76,
          priority: inactiveDays >= 180 ? "high" : "normal",
          dueAt: addDaysIso(3),
          evidence: [{ clientId: client.id, lastVisitAt: client.lastVisitAt, inactiveDays, totalSpend, visitCount }],
          metadata: { suggestedMessage: `Hi ${client.name || "there"}, we would love to welcome you back to AuraShine. Reply here and we will help book your next visit.` }
        }, access, requestMeta));
      }
      if (totalSpend >= 25000 && inactiveDays >= 60) {
        opportunities.push(this.upsertRecoveryOpportunity({
          branchId: client.branchId,
          clientId: client.id,
          opportunityType: "high_value_client_inactive",
          sourceEventId: `high_value_inactive:${client.id}:${client.lastVisitAt || "unknown"}`,
          sourceChannel: "client_360",
          title: "High-value client inactive",
          reason: `${client.name || "Client"} has lifetime spend ${money(totalSpend)} and has been inactive for ${inactiveDays} days.`,
          suggestedAction: "Assign manager follow-up before churn risk increases.",
          expectedValue: Math.max(2500, Math.min(15000, totalSpend * 0.16)),
          confidence: 0.86,
          priority: "high",
          dueAt: addDaysIso(1),
          evidence: [{ clientId: client.id, lastVisitAt: client.lastVisitAt, inactiveDays, totalSpend }],
          metadata: { suggestedMessage: `Hi ${client.name || "there"}, your AuraShine team misses you. We can reserve a priority slot for your next preferred service.` }
        }, access, requestMeta));
      }
      if (walletBalance > 0 && inactiveDays >= 30) {
        opportunities.push(this.upsertRecoveryOpportunity({
          branchId: client.branchId,
          clientId: client.id,
          opportunityType: "wallet_balance_unused",
          sourceEventId: `wallet_unused:${client.id}:${walletBalance}`,
          sourceChannel: "wallet",
          title: "Wallet balance unused",
          reason: `${client.name || "Client"} has ${money(walletBalance)} wallet balance unused.`,
          suggestedAction: "Create wallet reminder draft.",
          expectedValue: walletBalance,
          confidence: 0.78,
          priority: walletBalance >= 2000 ? "high" : "normal",
          dueAt: addDaysIso(4),
          evidence: [{ clientId: client.id, walletBalance, inactiveDays }],
          metadata: { suggestedMessage: `Hi ${client.name || "there"}, you still have ${money(walletBalance)} in your AuraShine wallet. Use it on your next visit.` }
        }, access, requestMeta));
      }
      if (visitCount > 0 && inactiveDays >= 45) {
        opportunities.push(this.upsertRecoveryOpportunity({
          branchId: client.branchId,
          clientId: client.id,
          opportunityType: "service_due_reminder",
          sourceEventId: `service_due:${client.id}:${client.lastVisitAt || "unknown"}`,
          sourceChannel: "client_360",
          title: "Service due reminder",
          reason: `${client.name || "Client"} may be due for a follow-up service after ${inactiveDays} days.`,
          suggestedAction: "Create service due reminder draft.",
          expectedValue: baseValue,
          confidence: 0.7,
          priority: "normal",
          dueAt: addDaysIso(5),
          evidence: [{ clientId: client.id, lastVisitAt: client.lastVisitAt, inactiveDays, visitCount }],
          metadata: { suggestedMessage: `Hi ${client.name || "there"}, it may be time for your next salon service. Reply here and we will suggest a good slot.` }
        }, access, requestMeta));
      }
    }
    return opportunities;
  }

  detectNegativeReviewRecovery(access, branchId, requestMeta) {
    const opportunities = [];
    for (const review of scopedRows("reviews_v2", access, branchId, { orderBy: "reviewed_at", max: 200 })) {
      if (!isNegativeReview(review)) continue;
      const risk = reviewRisk(review);
      const client = this.recoveryClient(review.customer_id, access);
      opportunities.push(this.upsertRecoveryOpportunity({
        branchId: review.branch_id || "",
        clientId: review.customer_id || "",
        appointmentId: review.appointment_id || "",
        staffId: review.primary_staff_id || "",
        opportunityType: "negative_review",
        sourceEventId: `negative_review:${review.id}`,
        sourceChannel: "review",
        title: "Negative review recovery",
        reason: `${review.reviewer_name || "Client"} rated ${review.rating || 0}/5.`,
        suggestedAction: "Create manager-approved apology response and follow-up draft.",
        expectedValue: risk.riskScore >= 82 ? 3500 : 1800,
        confidence: 0.88,
        priority: risk.priority,
        dueAt: addDaysIso(1),
        evidence: [{ reviewId: review.id, rating: review.rating, sentiment: review.sentiment, reviewText: review.review_text }],
        metadata: { suggestedMessage: `Hi ${client?.name || review.reviewer_name || "there"}, we are sorry your experience was not ideal. Our manager will personally review this and help resolve it.` }
      }, access, requestMeta));
    }
    return opportunities;
  }

  serviceNames(serviceIds = [], access) {
    const ids = [...new Set(arrayValue(serviceIds).map(String).map(text).filter(Boolean))];
    if (!ids.length || !tableExists("services")) return [];
    const rows = db.prepare(`SELECT id, name FROM services WHERE tenantId = ? AND id IN (${ids.map(() => "?").join(",")})`).all(access.tenantId, ...ids);
    return rows.map((row) => row.name || row.id).filter(Boolean);
  }

  serviceValue(serviceIds = [], access) {
    const ids = [...new Set(arrayValue(serviceIds).map(String).map(text).filter(Boolean))];
    if (!ids.length || !tableExists("services")) return 0;
    const rows = db.prepare(`SELECT price FROM services WHERE tenantId = ? AND id IN (${ids.map(() => "?").join(",")})`).all(access.tenantId, ...ids);
    return rows.reduce((sum, row) => sum + numberValue(row.price), 0);
  }

  recoveryClient(clientId, access) {
    const id = text(clientId);
    if (!id || !tableExists("clients")) return null;
    return db.prepare("SELECT id, name, phone, email, branchId, totalSpend, walletBalance, lastVisitAt FROM clients WHERE tenantId = ? AND id = ?").get(access.tenantId, id) || null;
  }

  recoveryStaff(staffId, access) {
    const id = text(staffId);
    if (!id) return null;
    if (tableExists("staff")) {
      const columns = tableColumns("staff");
      const tenantColumn = columns.has("tenantId") ? "tenantId" : columns.has("tenant_id") ? "tenant_id" : "";
      const nameColumn = columns.has("name") ? "name" : columns.has("full_name") ? "full_name" : "";
      const roleColumn = columns.has("role") ? "role" : columns.has("category") ? "category" : "";
      const branchColumn = columns.has("branchId") ? "branchId" : columns.has("branch_id") ? "branch_id" : "";
      if (tenantColumn) {
        const select = [
          "id",
          nameColumn ? `${nameColumn} AS name` : "'' AS name",
          roleColumn ? `${roleColumn} AS role` : "'' AS role",
          branchColumn ? `${branchColumn} AS branchId` : "'' AS branchId"
        ].join(", ");
        const row = db.prepare(`SELECT ${select} FROM staff WHERE ${tenantColumn} = ? AND id = ?`).get(access.tenantId, id);
        if (row) return { id: row.id, name: row.name || "", role: row.role || "", branchId: row.branchId || "" };
      }
    }
    if (tableExists("staff_master")) {
      const columns = tableColumns("staff_master");
      const tenantColumn = columns.has("tenant_id") ? "tenant_id" : columns.has("tenantId") ? "tenantId" : "";
      const nameColumn = columns.has("full_name") ? "full_name" : columns.has("name") ? "name" : "";
      const roleColumn = columns.has("role") ? "role" : columns.has("category") ? "category" : "";
      const branchColumn = columns.has("branch_id") ? "branch_id" : columns.has("branchId") ? "branchId" : "";
      if (tenantColumn) {
        const select = [
          "id",
          nameColumn ? `${nameColumn} AS name` : "'' AS name",
          roleColumn ? `${roleColumn} AS role` : "'' AS role",
          branchColumn ? `${branchColumn} AS branchId` : "'' AS branchId"
        ].join(", ");
        const row = db.prepare(`SELECT ${select} FROM staff_master WHERE ${tenantColumn} = ? AND id = ?`).get(access.tenantId, id);
        if (row) return { id: row.id, name: row.name || "", role: row.role || "", branchId: row.branchId || "" };
      }
    }
    return null;
  }

  enrichRecoveryOpportunity(opportunity = {}, access = {}) {
    const client = this.recoveryClient(opportunity.clientId, access);
    const staff = this.recoveryStaff(opportunity.staffId || opportunity.assignedTo, access);
    return {
      ...opportunity,
      client: client ? {
        id: client.id,
        name: client.name || "",
        phone: client.phone || "",
        email: client.email || "",
        branchId: client.branchId || ""
      } : null,
      clientName: client?.name || "",
      assignedStaff: staff,
      assignedStaffName: staff?.name || opportunity.assignedTo || "",
      suggestedMessage: opportunity.metadata?.suggestedMessage || opportunity.suggestedAction,
      revenueValue: opportunity.expectedValue,
      dueDate: opportunity.dueAt
    };
  }

  mustGetRecoveryOpportunity(id, access) {
    const row = db.prepare("SELECT * FROM engagement_recovery_opportunities WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Recovery opportunity not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    return rowToRecoveryOpportunity(row);
  }

  mustGetThread(id, access) {
    const row = db.prepare("SELECT * FROM engagement_threads WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Engagement thread not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    return rowToThread(row);
  }

  mustGetMessage(id, access) {
    const row = db.prepare("SELECT * FROM engagement_messages WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Engagement message not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    return rowToMessage(row);
  }

  mustGetTemplate(id, access) {
    const row = db.prepare("SELECT * FROM engagement_templates WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Engagement template not found");
    if (row.branch_id) tenantService.assertBranchAccess(access, row.branch_id);
    return rowToTemplate(row);
  }

  providerForMessage(message, access) {
    const row = db.prepare(
      `SELECT * FROM engagement_provider_accounts
       WHERE tenant_id = ?
         AND channel = ?
         AND archived_at = ''
         AND (branch_id = ? OR branch_id = '')
       ORDER BY CASE WHEN branch_id = ? THEN 0 ELSE 1 END,
                CASE WHEN status = 'active' THEN 0 ELSE 1 END,
                updated_at DESC
       LIMIT 1`
    ).get(access.tenantId, message.channel, message.branchId, message.branchId);
    const account = rowToProviderAccount(row);
    const adapter = account
      ? PROVIDER_ADAPTERS.find((item) => item.providerName === account.providerName)
      : PROVIDER_ADAPTERS.find((item) => item.channel === message.channel);
    if (!adapter) return null;
    return this.providerReadinessView(adapter, account);
  }

  markSendPending({ message, reason, pendingCode, access, requestMeta, providerId = "" }) {
    const stamp = now();
    db.prepare(
      `UPDATE engagement_messages
       SET status = 'pending_send',
           delivery_status = 'pending',
           provider_account_id = COALESCE(NULLIF(?, ''), provider_account_id),
           failure_reason = ?,
           updated_at = ?,
           version = version + 1
       WHERE tenant_id = ? AND id = ?`
    ).run(providerId, reason, stamp, access.tenantId, message.id);
    this.audit({
      action: "engagement.message.send_pending",
      entityType: "engagement_message",
      entityId: message.id,
      threadId: message.threadId,
      messageId: message.id,
      branchId: message.branchId,
      clientId: message.clientId,
      before: { status: message.status, deliveryStatus: message.deliveryStatus },
      after: { status: "pending_send", deliveryStatus: "pending", pendingCode, reason, providerId },
      access,
      requestMeta,
      severity: "warn"
    });
    return rowToMessage(db.prepare("SELECT * FROM engagement_messages WHERE tenant_id = ? AND id = ?").get(access.tenantId, message.id));
  }

  markSendFailed({ message, failureReason, failureCode, access, requestMeta, providerId = "" }) {
    const stamp = now();
    db.prepare(
      `UPDATE engagement_messages
       SET status = 'send_blocked',
           delivery_status = 'failed',
           provider_account_id = COALESCE(NULLIF(?, ''), provider_account_id),
           failed_at = ?,
           failure_reason = ?,
           updated_at = ?,
           version = version + 1
       WHERE tenant_id = ? AND id = ?`
    ).run(providerId, stamp, failureReason, stamp, access.tenantId, message.id);
    this.audit({
      action: "engagement.message.send_failed",
      entityType: "engagement_message",
      entityId: message.id,
      threadId: message.threadId,
      messageId: message.id,
      branchId: message.branchId,
      clientId: message.clientId,
      before: { status: message.status, deliveryStatus: message.deliveryStatus },
      after: { status: "send_blocked", deliveryStatus: "failed", failureCode, failureReason, providerId },
      access,
      requestMeta,
      severity: "error"
    });
    return rowToMessage(db.prepare("SELECT * FROM engagement_messages WHERE tenant_id = ? AND id = ?").get(access.tenantId, message.id));
  }

  audit({
    action,
    entityType,
    entityId,
    threadId = "",
    messageId = "",
    branchId = "",
    clientId = "",
    appointmentId = "",
    invoiceId = "",
    membershipId = "",
    packageId = "",
    staffId = "",
    assignedTo = "",
    before = {},
    after = {},
    details = {},
    access,
    requestMeta = {},
    severity = "info"
  }) {
    const actorInfo = actor(access);
    db.prepare(
      `INSERT INTO engagement_audit_logs
       (id, tenant_id, branch_id, thread_id, message_id, client_id, appointment_id, invoice_id, membership_id, package_id,
        staff_id, assigned_to, actor_user_id, actor_role, action, entity_type, entity_id, before_json, after_json,
        details_json, ip_address, user_agent, severity, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`
    ).run(
      makeId("eng_audit"),
      access.tenantId,
      branchId,
      threadId,
      messageId,
      clientId,
      appointmentId,
      invoiceId,
      membershipId,
      packageId,
      staffId,
      assignedTo,
      actorInfo.userId,
      actorInfo.role,
      action,
      entityType,
      entityId,
      stringify(before, {}),
      stringify(after, {}),
      stringify(details, {}),
      text(requestMeta.ipAddress || ""),
      text(requestMeta.userAgent || ""),
      severity,
      now()
    );
  }
}

export const engagementService = new EngagementService();
