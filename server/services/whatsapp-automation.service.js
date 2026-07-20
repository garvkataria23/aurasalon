import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { salonOperationsService } from "./salon-operations.service.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function normalizePhone(phone = "") {
  const digits = String(phone).replace(/\D/g, "");
  if (!digits) return "";
  return digits.startsWith("91") && digits.length === 12 ? `+${digits}` : digits.length === 10 ? `+91${digits}` : `+${digits}`;
}

function text(value = "") {
  return String(value || "").toLowerCase();
}

function render(template, data = {}) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_match, key) => data[key] ?? "");
}

function dateLabel(value) {
  return value
    ? new Date(value).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })
    : "";
}

function sameMonthDay(left = "", right = "") {
  return left && right && left.slice(5, 10) === right.slice(5, 10);
}

export class WhatsAppAutomationService {
  summary(access) {
    const queryScope = scope(access);
    const threads = repositories.whatsappThreads.list({ limit: 10000 }, queryScope);
    const messages = repositories.whatsappMessages.list({ limit: 10000 }, queryScope);
    const handoffs = repositories.whatsappHandoffs.list({ limit: 10000 }, queryScope);
    const today = now().slice(0, 10);
    return {
      openThreads: threads.filter((thread) => thread.status !== "closed").length,
      activeHandoffs: handoffs.filter((handoff) => handoff.status !== "resolved").length,
      hotLeads: threads.filter((thread) => Number(thread.leadScore || 0) >= 70).length,
      autoRepliesToday: messages.filter((message) => message.eventType === "auto-reply" && message.createdAt?.startsWith(today)).length,
      broadcastsToday: messages.filter((message) => message.eventType === "campaign-broadcast" && message.createdAt?.startsWith(today)).length,
      pendingOutbound: messages.filter((message) => message.direction === "outbound" && ["queued", "queued-whatsapp"].includes(message.status)).length,
      rulesActive: repositories.whatsappRules.list({ limit: 10000 }, queryScope).filter((rule) => rule.status === "active").length
    };
  }

  threads(query = {}, access) {
    return repositories.whatsappThreads.list(query, scope(access));
  }

  messages(query = {}, access) {
    return repositories.whatsappMessages.list(query, scope(access)).filter((message) => {
      return query.threadId ? message.threadId === query.threadId : true;
    });
  }

  rules(query = {}, access) {
    return repositories.whatsappRules.list(query, scope(access));
  }

  handoffs(query = {}, access) {
    return repositories.whatsappHandoffs.list(query, scope(access));
  }

  processInbound(payload = {}, access) {
    const phone = normalizePhone(payload.phone);
    const body = payload.body || payload.message || "";
    if (!phone || !body) throw badRequest("phone and body are required");

    const client = this.findClientByPhone(phone, access);
    const branchId = payload.branchId || client?.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const thread = this.ensureThread({
      phone,
      displayName: payload.displayName || client?.name || "WhatsApp Lead",
      client,
      branchId,
      source: payload.source || "inbound"
    }, access);

    const detection = this.detectIntent(body);
    const qualification = this.scoreLead({ body, client, detection, phone });
    const inbound = this.createMessage(thread, {
      direction: "inbound",
      eventType: "inbound-message",
      body,
      intent: detection.intent,
      status: "received",
      metadata: { detection, qualification, raw: payload }
    }, access);

    const threadStatus = detection.intent === "human_handoff" ? "handoff" : qualification.stage === "hot" ? "qualified" : "open";
    const updatedThread = repositories.whatsappThreads.update(thread.id, {
      intent: detection.intent,
      leadScore: qualification.score,
      status: threadStatus,
      tags: Array.from(new Set([...(thread.tags || []), detection.intent, qualification.stage])),
      metadata: { ...(thread.metadata || {}), detection, qualification }
    }, scope(access, branchId));

    let autoReply = null;
    if (!payload.suppressAutoReply) {
      autoReply = this.sendAutoReply(updatedThread, { detection, qualification, inboundBody: body }, access);
    }

    let handoff = null;
    if (detection.intent === "human_handoff" || detection.sentiment === "negative") {
      handoff = this.createHandoff({
        threadId: updatedThread.id,
        reason: detection.reason,
        priority: detection.sentiment === "negative" ? "high" : "normal"
      }, access);
    }

    tenantService.recordUsage({ tenantId: access.tenantId, metric: "whatsapp:inbound", referenceType: "whatsapp_message", referenceId: inbound.id });
    return { thread: updatedThread, inbound, detection, qualification, autoReply, handoff };
  }

  sendAutoReply(thread, { detection, qualification } = {}, access) {
    const client = thread.clientId ? repositories.clients.getById(thread.clientId, scope(access)) : null;
    const templates = {
      booking: "Hi {{name}}, we can help you book. Please share your preferred service, date and time.",
      pricing: "Hi {{name}}, happy to help with pricing. Tell us the service you are considering and your branch preference.",
      payment: "Hi {{name}}, our front desk can help with invoice and UPI payment details.",
      campaign_interest: "Hi {{name}}, thanks for your interest. We will share available offers and help you reserve a slot.",
      missed_call: "Hi {{name}}, we noticed your missed call. Tell us how we can help or reply BOOK to schedule.",
      human_handoff: "Hi {{name}}, I am connecting you to our front desk team for personal assistance.",
      unknown: "Hi {{name}}, thanks for messaging us. Tell us the service you need and your preferred time."
    };
    const body = render(templates[detection?.intent] || templates.unknown, {
      name: client?.name || thread.displayName || "there"
    });
    return this.createOutbound(thread, {
      body,
      eventType: "auto-reply",
      templateKey: `auto_${detection?.intent || "unknown"}`,
      intent: detection?.intent || "unknown",
      metadata: { detection, qualification }
    }, access);
  }

  bookingConfirmation({ appointmentId }, access) {
    if (!appointmentId) throw badRequest("appointmentId is required");
    const appointment = repositories.appointments.getById(appointmentId, scope(access));
    if (!appointment) throw notFound("Appointment not found");
    tenantService.assertBranchAccess(access, appointment.branchId);
    const client = repositories.clients.getById(appointment.clientId, scope(access));
    const branch = repositories.branches.getById(appointment.branchId, scope(access));
    const services = (appointment.serviceIds || []).map((id) => repositories.services.getById(id, scope(access))).filter(Boolean);
    const serviceName = services.map((service) => service.name).join(", ") || "service";
    const thread = this.ensureThread({ phone: client.phone, displayName: client.name, client, branchId: appointment.branchId, source: "booking" }, access);
    const body = `Hi ${client.name}, your ${serviceName} appointment is confirmed for ${dateLabel(appointment.startAt)} at ${branch?.name || "our salon"}.`;
    const message = this.createOutbound(thread, {
      body,
      eventType: "booking-confirmation",
      templateKey: "booking_confirmation",
      metadata: { appointmentId, serviceIds: appointment.serviceIds }
    }, access);
    return { thread, message, appointment };
  }

  reminderMessages({ hoursAhead = 24, branchId = "" } = {}, access) {
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const start = Date.now();
    const end = start + Number(hoursAhead || 24) * 3600000;
    const appointments = repositories.appointments.list({ branchId, limit: 10000 }, scope(access, branchId)).filter((appointment) => {
      const time = new Date(appointment.startAt).getTime();
      return ["booked", "arrived"].includes(appointment.status) && time >= start && time <= end;
    });
    const messages = appointments.map((appointment) => this.bookingReminderForAppointment(appointment, access));
    return { count: messages.length, messages };
  }

  bookingReminderForAppointment(appointment, access) {
    const client = repositories.clients.getById(appointment.clientId, scope(access));
    const services = (appointment.serviceIds || []).map((id) => repositories.services.getById(id, scope(access))).filter(Boolean);
    const thread = this.ensureThread({ phone: client.phone, displayName: client.name, client, branchId: appointment.branchId, source: "reminder" }, access);
    return this.createOutbound(thread, {
      body: `Hi ${client.name}, reminder for your ${services.map((item) => item.name).join(", ") || "appointment"} on ${dateLabel(appointment.startAt)}. Reply 1 to confirm.`,
      eventType: "appointment-reminder",
      templateKey: "appointment_reminder",
      metadata: { appointmentId: appointment.id }
    }, access);
  }

  missedCallFollowUp(payload = {}, access) {
    const phone = normalizePhone(payload.phone);
    if (!phone) throw badRequest("phone is required");
    const client = this.findClientByPhone(phone, access);
    const branchId = payload.branchId || client?.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const thread = this.ensureThread({ phone, displayName: payload.displayName || client?.name || "Missed call lead", client, branchId, source: "missed-call" }, access);
    const message = this.createOutbound(thread, {
      body: `Hi ${client?.name || payload.displayName || "there"}, we noticed your missed call. Reply with your service need or preferred time and our front desk will help.`,
      eventType: "missed-call-follow-up",
      templateKey: "missed_call_follow_up",
      metadata: payload
    }, access);
    return { thread, message };
  }

  paymentReminders({ branchId = "" } = {}, access) {
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const invoices = repositories.invoices.list({ limit: 10000 }, scope(access)).filter((invoice) => Number(invoice.balance || 0) > 0 && invoice.status !== "paid");
    const messages = invoices.map((invoice) => {
      const client = repositories.clients.getById(invoice.clientId, scope(access));
      if (!client) return null;
      if (branchId && client.branchId !== branchId) return null;
      const thread = this.ensureThread({ phone: client.phone, displayName: client.name, client, branchId: client.branchId || branchId, source: "payment" }, access);
      return this.createOutbound(thread, {
        body: `Hi ${client.name}, your invoice ${invoice.invoiceNumber} has a pending balance of ₹${money(invoice.balance)}. You can pay by UPI or at the salon.`,
        eventType: "payment-reminder",
        templateKey: "payment_reminder",
        metadata: { invoiceId: invoice.id, invoiceNumber: invoice.invoiceNumber, balance: invoice.balance }
      }, access);
    }).filter(Boolean);
    return { count: messages.length, messages };
  }

  birthdayWishes({ date = now().slice(0, 10), branchId = "" } = {}, access) {
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const clients = repositories.clients.list({ branchId, limit: 10000 }, scope(access, branchId)).filter((client) => sameMonthDay(client.birthday, date));
    const messages = clients.map((client) => {
      const thread = this.ensureThread({ phone: client.phone, displayName: client.name, client, branchId: client.branchId || branchId, source: "birthday" }, access);
      return this.createOutbound(thread, {
        body: `Happy birthday ${client.name}! Aura Salon wishes you a beautiful year. Enjoy a special birthday glow offer this week.`,
        eventType: "birthday-wish",
        templateKey: "birthday_wish",
        metadata: { date }
      }, access);
    });
    return { count: messages.length, messages };
  }

  campaignBroadcast({ campaignId = "", segmentRule = {}, template = "", branchId = "" } = {}, access) {
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const campaign = campaignId ? repositories.campaigns.getById(campaignId, scope(access)) : null;
    const rule = campaign?.segmentRule || segmentRule || {};
    const segment = salonOperationsService.segmentClients({ ...rule, branchId: branchId || rule.branchId || "" }, access);
    const messageTemplate = template || campaign?.template || "Hi {{name}}, your salon offer is waiting. Reply BOOK to reserve a slot.";
    const messages = segment.clients.map((client) => {
      const thread = this.ensureThread({ phone: client.phone, displayName: client.name, client, branchId: client.branchId || branchId, source: "campaign" }, access);
      return this.createOutbound(thread, {
        body: render(messageTemplate, { name: client.name }),
        eventType: "campaign-broadcast",
        templateKey: campaignId || "manual_campaign",
        metadata: { campaignId, segmentRule: rule }
      }, access);
    });
    if (campaign) {
      repositories.campaigns.update(campaign.id, {
        status: "sent",
        sentCount: Number(campaign.sentCount || 0) + messages.length
      }, scope(access));
    }
    return { count: messages.length, messages, segment };
  }

  qualifyLead(payload = {}, access) {
    const phone = normalizePhone(payload.phone);
    const body = payload.body || payload.message || "";
    const client = phone ? this.findClientByPhone(phone, access) : null;
    const detection = this.detectIntent(body);
    const qualification = this.scoreLead({ body, client, detection, phone });
    let thread = null;
    if (phone) {
      thread = this.ensureThread({
        phone,
        displayName: payload.displayName || client?.name || "Qualified lead",
        client,
        branchId: payload.branchId || client?.branchId || access.branchId || "",
        source: "lead-qualification"
      }, access);
      thread = repositories.whatsappThreads.update(thread.id, {
        intent: detection.intent,
        leadScore: qualification.score,
        status: qualification.stage === "hot" ? "qualified" : "open",
        metadata: { ...(thread.metadata || {}), detection, qualification }
      }, scope(access, thread.branchId));
    }
    return { detection, qualification, thread };
  }

  createHandoff(payload = {}, access) {
    const thread = repositories.whatsappThreads.getById(payload.threadId, scope(access));
    if (!thread) throw notFound("WhatsApp thread not found");
    if (thread.branchId) tenantService.assertBranchAccess(access, thread.branchId);
    const handoff = repositories.whatsappHandoffs.create({
      id: makeId("handoff"),
      threadId: thread.id,
      clientId: thread.clientId || "",
      branchId: thread.branchId || "",
      reason: payload.reason || "Human assistance requested",
      priority: payload.priority || "normal",
      status: "open",
      assignedTo: payload.assignedTo || "",
      history: [{ at: now(), status: "open", note: payload.reason || "Created" }]
    }, scope(access, thread.branchId));
    repositories.whatsappThreads.update(thread.id, {
      status: "handoff",
      handoffStatus: handoff.assignedTo ? "assigned" : "requested",
      assignedUserId: handoff.assignedTo || thread.assignedUserId || ""
    }, scope(access, thread.branchId));
    return handoff;
  }

  updateHandoff(id, payload = {}, access) {
    const handoff = repositories.whatsappHandoffs.getById(id, scope(access));
    if (!handoff) throw notFound("Handoff not found");
    if (handoff.branchId) tenantService.assertBranchAccess(access, handoff.branchId);
    const status = payload.status || handoff.status;
    const next = repositories.whatsappHandoffs.update(id, {
      status,
      assignedTo: payload.assignedTo ?? handoff.assignedTo,
      priority: payload.priority ?? handoff.priority,
      history: [
        { at: now(), status, note: payload.note || "Updated" },
        ...(handoff.history || [])
      ]
    }, scope(access, handoff.branchId));
    repositories.whatsappThreads.update(handoff.threadId, {
      handoffStatus: status === "resolved" ? "resolved" : next.assignedTo ? "assigned" : "requested",
      assignedUserId: next.assignedTo || "",
      status: status === "resolved" ? "open" : "handoff"
    }, scope(access, handoff.branchId));
    return next;
  }

  detectIntent(body = "") {
    const value = text(body);
    const detection = { intent: "unknown", confidence: 0.54, sentiment: "neutral", reason: "No strong keyword match", entities: {} };
    if (/(angry|bad|complaint|refund|manager|not happy|terrible|worst|issue|problem)/.test(value)) {
      return { intent: "human_handoff", confidence: 0.93, sentiment: "negative", reason: "Complaint or escalation language detected", entities: {} };
    }
    if (/(book|appointment|slot|available|today|tomorrow|schedule|reserve)/.test(value)) {
      detection.intent = "booking";
      detection.confidence = 0.88;
      detection.reason = "Booking intent keywords detected";
    } else if (/(price|cost|rate|package|membership|charges|how much)/.test(value)) {
      detection.intent = "pricing";
      detection.confidence = 0.82;
      detection.reason = "Pricing keywords detected";
    } else if (/(pay|payment|invoice|upi|balance|pending)/.test(value)) {
      detection.intent = "payment";
      detection.confidence = 0.84;
      detection.reason = "Payment keywords detected";
    } else if (/(missed call|call back|called)/.test(value)) {
      detection.intent = "missed_call";
      detection.confidence = 0.8;
      detection.reason = "Missed-call keywords detected";
    } else if (/(offer|discount|coupon|deal|campaign)/.test(value)) {
      detection.intent = "campaign_interest";
      detection.confidence = 0.78;
      detection.reason = "Offer keywords detected";
    }
    if (/(hair|cut|color|facial|skin|cleanup|spa)/.test(value)) {
      detection.entities.serviceHint = value.match(/hair|cut|color|facial|skin|cleanup|spa/)?.[0] || "";
    }
    if (/(today|urgent|now|asap)/.test(value)) detection.entities.urgency = "high";
    if (/(thanks|great|good|love)/.test(value)) detection.sentiment = "positive";
    return detection;
  }

  scoreLead({ body = "", client = null, detection = {}, phone = "" }) {
    const value = text(body);
    let score = client ? 35 : 20;
    if (detection.intent === "booking") score += 30;
    if (detection.intent === "pricing") score += 18;
    if (detection.intent === "campaign_interest") score += 15;
    if (/(today|tomorrow|now|asap|urgent)/.test(value)) score += 15;
    if (/(hair|cut|color|facial|skin|cleanup|spa)/.test(value)) score += 15;
    if (/(budget|price|cost|package|membership)/.test(value)) score += 8;
    if (phone) score += 7;
    if (detection.intent === "human_handoff") score = Math.max(score, 65);
    score = Math.max(0, Math.min(100, score));
    return {
      score,
      stage: score >= 70 ? "hot" : score >= 45 ? "warm" : "cold",
      existingClient: Boolean(client),
      nextBestAction: score >= 70 ? "Offer appointment slots and assign front desk" : score >= 45 ? "Ask one qualifying question" : "Send nurture response"
    };
  }

  ensureThread({ phone, displayName = "", client = null, branchId = "", source = "inbound" }, access) {
    const normalized = normalizePhone(phone);
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const threads = repositories.whatsappThreads.list({ limit: 10000 }, scope(access, branchId));
    const existing = threads.find((thread) => thread.phone === normalized);
    if (existing) {
      return repositories.whatsappThreads.update(existing.id, {
        displayName: displayName || existing.displayName,
        clientId: client?.id || existing.clientId,
        branchId: branchId || existing.branchId,
        source: existing.source || source
      }, scope(access, branchId || existing.branchId));
    }
    return repositories.whatsappThreads.create({
      id: makeId("wath"),
      phone: normalized,
      displayName,
      clientId: client?.id || "",
      branchId,
      source,
      status: "open",
      intent: "unknown",
      tags: [],
      metadata: {}
    }, scope(access, branchId));
  }

  createOutbound(thread, payload, access) {
    const message = this.createMessage(thread, {
      direction: "outbound",
      status: payload.status || "queued-whatsapp",
      ...payload
    }, access);
    repositories.notifications.create({
      id: makeId("note"),
      clientId: thread.clientId || "",
      type: payload.eventType || "whatsapp",
      channel: "WhatsApp",
      message: payload.body,
      status: "queued-whatsapp"
    }, scope(access, thread.branchId));
    this.appendClientHistory(thread.clientId, payload.body, message.status, access);
    return message;
  }

  createMessage(thread, payload, access) {
    const branchId = payload.branchId || thread.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const message = repositories.whatsappMessages.create({
      id: makeId("wamg"),
      threadId: thread.id,
      clientId: payload.clientId || thread.clientId || "",
      branchId,
      direction: payload.direction,
      eventType: payload.eventType || "",
      body: payload.body,
      templateKey: payload.templateKey || "",
      intent: payload.intent || "",
      status: payload.status || "queued",
      providerMessageId: payload.providerMessageId || "",
      metadata: payload.metadata || {}
    }, scope(access, branchId));
    repositories.whatsappThreads.update(thread.id, {
      lastMessageAt: message.createdAt,
      lastMessagePreview: message.body.slice(0, 140),
      unreadCount: payload.direction === "inbound" ? Number(thread.unreadCount || 0) + 1 : thread.unreadCount || 0
    }, scope(access, branchId));
    return message;
  }

  appendClientHistory(clientId, message, status, access) {
    if (!clientId) return;
    const client = repositories.clients.getById(clientId, scope(access));
    if (!client) return;
    repositories.clients.update(client.id, {
      whatsappHistory: [
        { date: now().slice(0, 10), message, status },
        ...(client.whatsappHistory || [])
      ].slice(0, 50)
    }, scope(access));
  }

  findClientByPhone(phone, access) {
    const normalized = normalizePhone(phone);
    const last10 = normalized.replace(/\D/g, "").slice(-10);
    return repositories.clients.list({ limit: 10000 }, scope(access)).find((client) => {
      return normalizePhone(client.phone).replace(/\D/g, "").slice(-10) === last10;
    }) || null;
  }
}

export const whatsappAutomationService = new WhatsAppAutomationService();
