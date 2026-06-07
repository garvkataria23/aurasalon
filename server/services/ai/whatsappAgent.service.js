import { db } from "../../db.js";
import { badRequest, forbidden, notFound } from "../../utils/app-error.js";
import { assertAiTaskAllowed } from "./aiPolicy.js";
import { knowledgeBaseService } from "./knowledgeBase.service.js";
import { securityService } from "../security.service.js";
import { tenantService } from "../tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const manualSendRoles = new Set(["owner", "admin", "superAdmin", "manager", "frontDesk", "receptionist"]);

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function normalizePhone(value = "") {
  return String(value || "").replace(/\D/g, "").slice(-10);
}

function rowToDraft(row) {
  return row
    ? {
        ...row,
        detectedIntent: parseJson(row.detectedIntent, {}),
        suggestedAction: parseJson(row.suggestedAction, {}),
        auditTrail: parseJson(row.auditTrail, [])
      }
    : null;
}

function detectIntent(message = "") {
  const text = String(message || "").toLowerCase();
  const rules = [
    ["complaint", ["bad", "angry", "complaint", "not happy", "poor", "refund"]],
    ["reschedule", ["reschedule", "change time", "shift", "another time", "postpone"]],
    ["cancel", ["cancel", "can't come", "cannot come", "not coming"]],
    ["booking_request", ["book", "appointment", "slot", "available", "tomorrow", "today"]],
    ["price_inquiry", ["price", "cost", "rate", "charges", "kitna", "how much"]],
    ["service_inquiry", ["service", "hair", "facial", "wax", "spa", "color"]],
    ["payment_reminder_response", ["paid", "payment", "upi", "balance", "invoice"]],
    ["review", ["review", "rating", "feedback"]],
    ["human_handoff", ["call me", "manager", "human", "talk to", "front desk"]]
  ];
  const found = rules.find(([, terms]) => terms.some((term) => text.includes(term)));
  const intent = found?.[0] || "service_inquiry";
  const confidence = found ? Math.min(0.94, 0.62 + found[1].filter((term) => text.includes(term)).length * 0.1) : 0.52;
  return {
    intent,
    confidence: Math.round(confidence * 100) / 100,
    reason: found ? `Matched ${found[1].filter((term) => text.includes(term)).slice(0, 3).join(", ")}` : "General salon message"
  };
}

function actionFor(intent, client, branchId) {
  const base = { branchId, clientId: client?.id || "", approvalRequired: true, executed: false };
  if (intent === "booking_request") return { ...base, type: "create_booking_draft", label: "Create booking draft" };
  if (intent === "reschedule") return { ...base, type: "reschedule_booking_draft", label: "Prepare reschedule options" };
  if (intent === "cancel") return { ...base, type: "cancel_booking_draft", label: "Prepare cancellation note" };
  if (intent === "complaint") return { ...base, type: "mark_complaint_follow_up", label: "Create complaint follow-up" };
  if (intent === "human_handoff") return { ...base, type: "human_handoff", label: "Move to front desk handoff" };
  return { ...base, type: "create_follow_up_task", label: "Create follow-up task" };
}

function replyFor({ intent, client, message, sources, actionRequired }) {
  const name = client?.name || "there";
  if (actionRequired) return `Hi ${name}, thanks for messaging Aura Salon. A front desk teammate will verify your profile before replying.`;
  if (intent === "booking_request") return `Hi ${name}, we can help you book this. Please share your preferred branch, service and time window, and our front desk will confirm the best available slot.`;
  if (intent === "reschedule") return `Hi ${name}, we can help reschedule your appointment. Please share your preferred new time and we will confirm availability before updating it.`;
  if (intent === "cancel") return `Hi ${name}, we can help with cancellation. Please confirm the appointment date/time so the front desk can update it safely.`;
  if (intent === "price_inquiry") return `Hi ${name}, pricing depends on service, length and stylist. Share the service you want and we will confirm the exact price before booking.`;
  if (intent === "complaint") return `Hi ${name}, sorry about this experience. We are escalating this to the salon team and will follow up personally.`;
  if (intent === "payment_reminder_response") return `Hi ${name}, thank you for the update. Our team will verify the payment against your invoice and confirm shortly.`;
  const sourceLine = sources?.length ? ` Based on ${sources.slice(0, 2).join(", ")}.` : "";
  return `Hi ${name}, thanks for your message. Our team will guide you with the right service and next step.${sourceLine}`;
}

export class WhatsappAgentService {
  findClient(access, payload = {}) {
    if (payload.clientId) {
      return db.prepare("SELECT * FROM clients WHERE id = ? AND tenantId = ?").get(payload.clientId, access.tenantId) || null;
    }
    const digits = normalizePhone(payload.phone || payload.from || "");
    if (!digits) return null;
    const rows = db.prepare("SELECT * FROM clients WHERE tenantId = ?").all(access.tenantId);
    return rows.find((client) => normalizePhone(client.phone) === digits) || null;
  }

  hasDnd(client) {
    const tags = parseJson(client?.tags, []).map((tag) => String(tag).toLowerCase());
    return tags.some((tag) => ["dnd", "opt-out", "optout", "do-not-disturb"].includes(tag));
  }

  audit(action, draft, access, details = {}) {
    try {
      securityService.audit({
        action,
        targetType: "ai_whatsapp_draft",
        targetId: draft.id,
        details: {
          branchId: draft.branchId || "",
          clientId: draft.clientId || "",
          status: draft.status,
          ...details
        },
        severity: "info"
      }, access);
    } catch {
      // AI workflow audit must not block the front desk.
    }
  }

  draft(payload = {}, access) {
    assertAiTaskAllowed({ taskKey: "whatsapp.reply_generation", tenantId: access.tenantId, role: access.role });
    const message = String(payload.message || payload.body || "").trim();
    if (!message) throw badRequest("WhatsApp message is required");
    const branchId = String(payload.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const client = this.findClient(access, payload);
    const phone = String(payload.phone || payload.from || client?.phone || "").trim();
    const missingPhone = !normalizePhone(phone);
    const blocked = this.hasDnd(client);
    const detectedIntent = detectIntent(message);
    let knowledge = { sources: [], matches: [] };
    try {
      knowledge = knowledgeBaseService.search({ query: message, branchId, limit: 3 }, access);
    } catch {
      knowledge = { sources: [], matches: [] };
    }
    const suggestedAction = actionFor(detectedIntent.intent, client, branchId);
    const actionRequired = blocked
      ? "Client is tagged DND/opt-out. Do not send a WhatsApp message."
      : missingPhone
        ? "Phone number is missing. Capture phone before drafting a sendable reply."
        : "";
    const suggestedReply = replyFor({
      intent: detectedIntent.intent,
      client,
      message,
      sources: knowledge.sources,
      actionRequired
    });
    const stamp = now();
    const draft = {
      id: makeId("wa_ai"),
      tenantId: access.tenantId,
      branchId,
      threadId: String(payload.threadId || ""),
      clientId: client?.id || "",
      phone,
      message,
      detectedIntent,
      confidence: detectedIntent.confidence,
      suggestedReply,
      suggestedAction,
      status: actionRequired ? "needs_review" : "draft",
      approvedAt: "",
      handoffAt: "",
      auditTrail: [
        {
          at: stamp,
          event: "draft_created",
          role: access.role,
          sent: false,
          actionRequired,
          sources: knowledge.sources
        }
      ],
      createdAt: stamp,
      updatedAt: stamp
    };
    db.prepare(`
      INSERT INTO ai_whatsapp_drafts
        (id, tenantId, branchId, threadId, clientId, phone, message, detectedIntent, confidence, suggestedReply, suggestedAction, status, approvedAt, handoffAt, auditTrail, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @threadId, @clientId, @phone, @message, @detectedIntent, @confidence, @suggestedReply, @suggestedAction, @status, @approvedAt, @handoffAt, @auditTrail, @createdAt, @updatedAt)
    `).run({
      ...draft,
      detectedIntent: JSON.stringify(draft.detectedIntent),
      suggestedAction: JSON.stringify(draft.suggestedAction),
      auditTrail: JSON.stringify(draft.auditTrail)
    });
    this.audit("whatsapp.ai_draft_created", draft, access, {
      intent: detectedIntent.intent,
      confidence: detectedIntent.confidence,
      actionRequired
    });
    return {
      draft: { ...draft, message: undefined },
      detectedIntent,
      confidence: detectedIntent.confidence,
      suggestedReply,
      suggestedAction,
      approvalRequired: true,
      sent: false,
      actionRequired,
      sources: knowledge.sources
    };
  }

  list(query = {}, access) {
    const status = String(query.status || "all");
    const params = [access.tenantId];
    let sql = "SELECT * FROM ai_whatsapp_drafts WHERE tenantId = ?";
    if (status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY createdAt DESC LIMIT ?";
    params.push(Math.min(Number(query.limit) || 50, 200));
    return db.prepare(sql).all(...params).map((row) => {
      const draft = rowToDraft(row);
      delete draft.message;
      return draft;
    });
  }

  validateSendable(row, access) {
    if (!manualSendRoles.has(access.role)) {
      throw forbidden("Manual WhatsApp send status requires front desk or manager access");
    }
    const client = row.clientId
      ? db.prepare("SELECT * FROM clients WHERE id = ? AND tenantId = ?").get(row.clientId, access.tenantId)
      : null;
    if (!normalizePhone(row.phone)) {
      throw badRequest("Phone number is missing; cannot mark WhatsApp draft as sent");
    }
    if (this.hasDnd(client)) {
      throw badRequest("Client is DND/opt-out; cannot mark WhatsApp draft as sent");
    }
  }

  updateStatus(id, status, event, access, options = {}) {
    const row = db.prepare("SELECT * FROM ai_whatsapp_drafts WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!row) throw notFound("WhatsApp AI draft not found");
    if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
    const draft = rowToDraft(row);
    const stamp = now();
    draft.auditTrail.push({
      at: stamp,
      event,
      role: access.role,
      sent: false,
      details: options.details || {}
    });
    db.prepare(`
      UPDATE ai_whatsapp_drafts
      SET status = ?, approvedAt = ?, handoffAt = ?, auditTrail = ?, updatedAt = ?
      WHERE id = ? AND tenantId = ?
    `).run(
      status,
      status === "approved" ? stamp : row.approvedAt || "",
      status === "handoff" ? stamp : row.handoffAt || "",
      JSON.stringify(draft.auditTrail),
      stamp,
      id,
      access.tenantId
    );
    const updated = rowToDraft(db.prepare("SELECT * FROM ai_whatsapp_drafts WHERE id = ? AND tenantId = ?").get(id, access.tenantId));
    delete updated.message;
    const auditAction = {
      approved: "whatsapp.ai_draft_approved",
      copied: "whatsapp.ai_draft_copied",
      handoff: "whatsapp.ai_handoff",
      sent_manually: "whatsapp.manual_send_requested"
    }[status];
    if (auditAction) this.audit(auditAction, updated, access, options.details || {});
    return {
      draft: updated,
      sent: false,
      approvalRequired: true,
      manuallyMarkedSent: status === "sent_manually",
      message: options.message ||
        (status === "approved"
          ? "Draft approved. Send manually from WhatsApp workflow."
          : status === "copied"
            ? "Draft copied. Paste it into WhatsApp manually."
            : status === "sent_manually"
              ? "Draft marked as sent manually. AI did not send it."
              : "Draft moved to human handoff.")
    };
  }

  approve(id, _payload, access) {
    return this.updateStatus(id, "approved", "draft_approved", access);
  }

  handoff(id, _payload, access) {
    return this.updateStatus(id, "handoff", "handoff_marked", access);
  }

  copy(id, _payload, access) {
    return this.updateStatus(id, "copied", "draft_copied", access, {
      message: "Draft copied. Paste it into WhatsApp manually."
    });
  }

  markSentManually(id, _payload, access) {
    const row = db.prepare("SELECT * FROM ai_whatsapp_drafts WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!row) throw notFound("WhatsApp AI draft not found");
    if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
    this.validateSendable(row, access);
    return this.updateStatus(id, "sent_manually", "manual_send_marked", access, {
      message: "Draft marked as sent manually. AI did not send it.",
      details: { manuallyConfirmed: true }
    });
  }
}

export const whatsappAgentService = new WhatsappAgentService();
