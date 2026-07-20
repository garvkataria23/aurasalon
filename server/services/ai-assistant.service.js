import { env } from "../config/env.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { salonOperationsService } from "./salon-operations.service.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const allowedTypes = new Set([
  "appointment-booking",
  "upsell",
  "service-recommendation",
  "chatbot",
  "follow-up",
  "review-reply",
  "marketing-caption",
  "analytics-summary",
  "churn-prediction"
]);

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function text(value = "") {
  return String(value || "").toLowerCase();
}

function daysSince(value) {
  if (!value) return 999;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

function nextHourIso() {
  const date = new Date();
  date.setMinutes(0, 0, 0);
  date.setHours(date.getHours() + 2);
  return date.toISOString();
}

function firstMatchByPrompt(records, prompt, fields = ["name", "category"]) {
  const lowered = text(prompt);
  if (!lowered) return null;
  return records.find((record) => fields.some((field) => text(record[field]).split(" ").some((part) => part.length > 2 && lowered.includes(part)))) || null;
}

function findClient(context, payload) {
  if (payload.clientId) return context.clients.find((client) => client.id === payload.clientId) || null;
  return firstMatchByPrompt(context.clients, payload.prompt, ["name", "phone", "email"]);
}

function findService(context, payload) {
  if (payload.serviceId) return context.services.find((service) => service.id === payload.serviceId) || null;
  const service = firstMatchByPrompt(context.services, [payload.prompt, payload.concern].join(" "), ["name", "category"]);
  if (service) return service;
  const lowered = text([payload.prompt, payload.concern].join(" "));
  if (lowered.includes("skin") || lowered.includes("facial") || lowered.includes("glow")) {
    return context.services.find((item) => text(item.category).includes("skin") || text(item.name).includes("facial")) || null;
  }
  if (lowered.includes("hair") || lowered.includes("color") || lowered.includes("cut")) {
    return context.services.find((item) => text(item.category).includes("hair")) || null;
  }
  return context.services[0] || null;
}

function staffForService(context, service, branchId) {
  return context.staff.find((person) => {
    const branchMatch = branchId ? person.branchId === branchId : true;
    const serviceMatch = service?.id ? (person.assignedServices || []).includes(service.id) : true;
    return branchMatch && serviceMatch;
  }) || context.staff.find((person) => (branchId ? person.branchId === branchId : true)) || null;
}

function compactContext(context) {
  return {
    tenantId: context.access.tenantId,
    branchId: context.branchId,
    clientCount: context.clients.length,
    serviceCount: context.services.length,
    productCount: context.products.length,
    appointmentCount: context.appointments.length,
    dashboard: {
      revenueToday: context.dashboard.revenueToday,
      revenueMonth: context.dashboard.revenueMonth,
      totalBookings: context.dashboard.totalBookings,
      pendingPayments: context.dashboard.pendingPayments,
      lowStockAlerts: context.dashboard.lowStockAlerts?.length || 0,
      repeatCustomerRate: context.dashboard.repeatCustomerRate,
      clientRetention: context.dashboard.clientRetention
    }
  };
}

export class AiAssistantService {
  async run(type, payload = {}, access) {
    if (!allowedTypes.has(type)) throw badRequest("Unknown AI assistant workflow");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = payload.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const context = this.context(access, branchId);
    const output = await this.dispatch(type, payload, context, access);
    const interaction = this.persistInteraction(type, payload, context, output, access);
    tenantService.recordUsage({ tenantId: access.tenantId, metric: `ai:${type}`, referenceType: "ai_interaction", referenceId: interaction.id });
    return { interaction, output };
  }

  history(query = {}, access) {
    return repositories.aiInteractions.list(query, scope(access));
  }

  context(access, branchId = "") {
    const queryScope = scope(access, branchId);
    const branchQuery = branchId ? { branchId, limit: 10000 } : { limit: 10000 };
    return {
      access,
      branchId,
      branches: repositories.branches.list(branchQuery, queryScope),
      clients: repositories.clients.list(branchQuery, queryScope),
      staff: repositories.staff.list(branchQuery, queryScope),
      services: repositories.services.list({ limit: 10000 }, scope(access)),
      products: repositories.products.list(branchQuery, queryScope),
      appointments: repositories.appointments.list(branchQuery, queryScope),
      sales: repositories.sales.list(branchQuery, queryScope),
      memberships: repositories.memberships.list(branchQuery, queryScope),
      campaigns: repositories.campaigns.list({ limit: 10000 }, scope(access)),
      dashboard: salonOperationsService.dashboardReport(branchId, access),
      advanced: salonOperationsService.advancedReport(access)
    };
  }

  async dispatch(type, payload, context, access) {
    switch (type) {
      case "appointment-booking":
        return this.appointmentBooking(payload, context, access);
      case "upsell":
        return this.upsellSuggestions(payload, context);
      case "service-recommendation":
        return this.serviceRecommendation(payload, context);
      case "chatbot":
        return this.chatbot(payload, context);
      case "follow-up":
        return this.followUp(payload, context, access);
      case "review-reply":
        return this.reviewReply(payload, context);
      case "marketing-caption":
        return this.marketingCaption(payload, context);
      case "analytics-summary":
        return this.analyticsSummary(payload, context);
      case "churn-prediction":
        return this.churnPrediction(payload, context);
      default:
        throw badRequest("Unknown AI assistant workflow");
    }
  }

  async appointmentBooking(payload, context, access) {
    const client = findClient(context, payload);
    const service = findService(context, payload);
    const branchId = payload.branchId || client?.branchId || context.branchId || context.branches?.[0]?.id || "";
    const staff = payload.staffId
      ? context.staff.find((person) => person.id === payload.staffId) || null
      : staffForService(context, service, branchId);
    const startAt = payload.startAt ? new Date(payload.startAt).toISOString() : nextHourIso();
    const endAt = service ? new Date(new Date(startAt).getTime() + Number(service.durationMinutes || 45) * 60000).toISOString() : "";
    const draft = {
      clientId: client?.id || "",
      clientName: client?.name || "Select client",
      serviceId: service?.id || "",
      serviceName: service?.name || "Select service",
      branchId,
      staffId: staff?.id || "",
      staffName: staff?.name || "Auto assign",
      startAt,
      endAt,
      source: payload.source || "ai-assistant",
      onlineStatus: "confirmed"
    };

    let appointment = null;
    let notification = null;
    if (payload.confirmBooking) {
      if (!draft.clientId || !draft.serviceId || !draft.staffId || !draft.branchId || !draft.startAt) {
        throw badRequest("clientId, serviceId, staffId, branchId and startAt are required to confirm an AI booking");
      }
      appointment = repositories.appointments.create({
        id: makeId("appt"),
        clientId: draft.clientId,
        staffId: draft.staffId,
        branchId: draft.branchId,
        serviceIds: [draft.serviceId],
        startAt: draft.startAt,
        endAt: draft.endAt,
        status: payload.walkIn ? "arrived" : "booked",
        source: payload.walkIn ? "walk-in-ai" : "ai-assistant",
        onlineStatus: payload.walkIn ? "not-online" : "confirmed",
        chair: payload.chair || "Chair 1",
        notes: payload.prompt || "Booked by AI assistant"
      }, scope(access, draft.branchId));
      notification = repositories.notifications.create({
        id: makeId("note"),
        clientId: draft.clientId,
        type: "ai-booking-confirmation",
        channel: "WhatsApp",
        message: `Hi ${client.name}, your ${service.name} booking is confirmed for ${new Date(draft.startAt).toLocaleString("en-IN", { dateStyle: "medium", timeStyle: "short" })}.`,
        status: "queued-whatsapp"
      }, scope(access, draft.branchId));
    }

    return this.withModelText("appointment-booking", payload, context, {
      title: appointment ? "Appointment booked" : "Booking draft ready",
      message: appointment
        ? `${client.name} is booked for ${service.name} with ${staff.name}. WhatsApp confirmation is queued.`
        : `Recommended ${service?.name || "a matching service"} with ${staff?.name || "available staff"}. Confirm to create the appointment.`,
      appointmentDraft: draft,
      appointment,
      notification,
      actions: appointment ? ["appointment-created", "whatsapp-confirmation-queued"] : ["review-draft"]
    });
  }

  async upsellSuggestions(payload, context) {
    const client = findClient(context, payload);
    const service = findService(context, payload);
    const branchProducts = context.products.filter((product) => product.usageType === "retail" && Number(product.stock || 0) > 0);
    const serviceAddOns = (service?.addOns || []).map((name) => ({
      type: "add-on",
      name,
      reason: `Pairs naturally with ${service.name}.`,
      estimatedValue: 400
    }));
    const productSuggestions = branchProducts.slice(0, 3).map((product) => ({
      type: "product",
      id: product.id,
      name: product.name,
      reason: `${product.category || "Retail"} product available in stock for aftercare.`,
      estimatedValue: Number(product.price || 0)
    }));
    const membershipSuggestion = client && Number(client.visitCount || 0) >= 3
      ? [{
          type: "membership",
          name: "Convert to membership",
          reason: `${client.name} has ${client.visitCount} visits and can be moved to prepaid service credits.`,
          estimatedValue: Math.max(2500, Math.round(Number(client.totalSpend || 0) * 0.15))
        }]
      : [];
    return this.withModelText("upsell", payload, context, {
      title: "Upsell suggestions",
      message: `Built from saved client history, selected service and live retail stock.`,
      client,
      service,
      suggestions: [...serviceAddOns, ...productSuggestions, ...membershipSuggestion].slice(0, 6),
      actions: ["show-at-pos", "attach-to-follow-up"]
    });
  }

  async serviceRecommendation(payload, context) {
    const client = findClient(context, payload);
    const service = findService(context, payload);
    const lowered = text([payload.prompt, payload.concern, client?.notes].join(" "));
    const recommendations = context.services
      .filter((candidate) => {
        if (!lowered) return true;
        return lowered.includes(text(candidate.category)) || text(candidate.name).split(" ").some((part) => part.length > 3 && lowered.includes(part));
      })
      .slice(0, 4);
    if (service && !recommendations.some((item) => item.id === service.id)) recommendations.unshift(service);
    const finalRecommendations = (recommendations.length ? recommendations : context.services.slice(0, 4)).map((item) => ({
      id: item.id,
      name: item.name,
      category: item.category,
      price: Number(item.price || 0),
      durationMinutes: Number(item.durationMinutes || 0),
      reason: client ? `Matches ${client.name}'s history, tags and stated concern.` : "Matches the requested concern and available salon catalogue."
    }));
    return this.withModelText("service-recommendation", payload, context, {
      title: "Service recommendations",
      message: "Recommendations are calculated from service catalogue, client notes, tags, history and the current prompt.",
      client,
      recommendations: finalRecommendations,
      actions: ["book-selected-service", "add-to-package"]
    });
  }

  async chatbot(payload, context) {
    const pending = context.dashboard.pendingPayments;
    const lowStock = context.dashboard.lowStockAlerts || [];
    const answer = [
      `Today revenue is INR ${money(context.dashboard.revenueToday)} and month revenue is INR ${money(context.dashboard.revenueMonth)}.`,
      `${context.dashboard.totalBookings} bookings are in scope with ${context.dashboard.clientRetention}% completion retention.`,
      pending > 0 ? `Pending invoice balance is INR ${money(pending)}.` : "No pending invoice balance is visible in this scope.",
      lowStock.length ? `${lowStock.length} product(s) need stock attention.` : "Inventory is above low-stock threshold."
    ].join(" ");
    return this.withModelText("chatbot", payload, context, {
      title: "AI salon assistant",
      answer,
      suggestedQuestions: [
        "Which clients are at churn risk?",
        "What should front desk sell today?",
        "Generate a WhatsApp win-back message"
      ],
      actions: ["answer-from-live-data"]
    });
  }

  async followUp(payload, context, access) {
    const client = findClient(context, payload);
    if (!client) throw notFound("Client not found for AI follow-up");
    const service = findService(context, payload);
    const channel = payload.channel || "WhatsApp";
    const reason = payload.reason || payload.prompt || "post-visit care";
    const message = `Hi ${client.name}, thank you for choosing us. ${service ? `Your ${service.name} care plan is ready, and we recommend a quick follow-up in 2 weeks.` : "We hope you loved your salon visit."} Reply here to book your next slot or use your loyalty points.`;
    let notification = null;
    if (payload.saveNotification) {
      notification = repositories.notifications.create({
        id: makeId("note"),
        clientId: client.id,
        type: "ai-follow-up",
        channel,
        message,
        status: channel.toLowerCase() === "whatsapp" ? "queued-whatsapp" : "draft-ai"
      }, scope(access, client.branchId));
      if (channel.toLowerCase() === "whatsapp") {
        repositories.clients.update(client.id, {
          whatsappHistory: [
            { date: now().slice(0, 10), message, status: "draft-ai" },
            ...(client.whatsappHistory || [])
          ].slice(0, 50)
        }, scope(access));
      }
    }
    return this.withModelText("follow-up", payload, context, {
      title: "AI follow-up",
      message,
      client,
      service,
      reason,
      notification,
      actions: notification ? ["notification-created"] : ["copy-message"]
    });
  }

  async reviewReply(payload, context) {
    const rating = Number(payload.rating || 5);
    const reviewText = payload.reviewText || payload.prompt || "";
    const reply = rating >= 4
      ? `Thank you for the lovely review. We are glad the salon experience felt right, and the team would love to welcome you back soon.`
      : `Thank you for sharing this. We are sorry the visit did not meet expectations. Please contact the salon manager so we can review the service and make this right.`;
    return this.withModelText("review-reply", payload, context, {
      title: "Review reply",
      rating,
      reviewText,
      reply,
      tone: rating >= 4 ? "warm-appreciative" : "empathetic-recovery",
      actions: ["copy-reply"]
    });
  }

  async marketingCaption(payload, context) {
    const offer = payload.offer || payload.prompt || "salon glow offer";
    const channel = payload.channel || "WhatsApp";
    const captions = [
      `Glow week is live: ${offer}. Book your slot today and leave with a look that feels fresh.`,
      `Your next salon refresh is waiting. ${offer}. Limited slots available this week.`,
      `A little care, a visible glow. ${offer}. Message us to reserve your appointment.`
    ];
    return this.withModelText("marketing-caption", payload, context, {
      title: "Marketing captions",
      channel,
      offer,
      captions,
      segmentIdeas: ["VIP clients", "inactive clients", "birthday month clients", "membership clients"],
      actions: ["create-campaign", "copy-caption"]
    });
  }

  async analyticsSummary(_payload, context) {
    const report = context.advanced;
    const summary = [
      `Sales revenue is INR ${money(report.sales.revenue)} across ${report.sales.count} saved sales.`,
      `GST collected is INR ${money(report.gst.collected)} from ${report.gst.invoices} invoices.`,
      `Repeat customer rate is ${report.retention.repeatCustomerRate}%.`,
      `${report.inventory.lowStock} products are below threshold.`
    ];
    const actions = [];
    if (report.retention.repeatCustomerRate < 45) actions.push("Launch inactive client win-back campaign");
    if (report.inventory.lowStock > 0) actions.push("Create purchase entries for low-stock products");
    if (report.dailyClosing.upi > report.dailyClosing.cash) actions.push("Highlight UPI reconciliation in daily closing");
    if (!actions.length) actions.push("Review high spender clients for membership conversion");
    return this.withModelText("analytics-summary", {}, context, {
      title: "AI analytics summary",
      summary,
      actions,
      report
    });
  }

  async churnPrediction(_payload, context) {
    const clients = context.clients.map((client) => {
      const inactiveDays = daysSince(client.lastVisitAt);
      const tagBoost = (client.tags || []).map((item) => text(item)).includes("inactive") ? 25 : 0;
      const visitPenalty = Number(client.visitCount || 0) <= 1 ? 15 : 0;
      const spendProtect = Number(client.totalSpend || 0) > 25000 ? -10 : 0;
      const membershipProtect = client.membershipId ? -12 : 0;
      const score = Math.max(0, Math.min(100, Math.round(inactiveDays * 0.8 + tagBoost + visitPenalty + spendProtect + membershipProtect)));
      return {
        id: client.id,
        name: client.name,
        branchId: client.branchId,
        score,
        risk: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
        inactiveDays,
        reason: `${inactiveDays} days since last visit, ${client.visitCount || 0} visits, INR ${money(client.totalSpend)} lifetime spend.`,
        recommendedAction: score >= 70 ? "Send WhatsApp win-back with a service credit" : score >= 40 ? "Send check-in and personalized offer" : "Keep in loyalty nurture"
      };
    }).sort((a, b) => b.score - a.score);
    return this.withModelText("churn-prediction", {}, context, {
      title: "AI churn prediction",
      message: "Risk scores use saved visit history, spend, tags and membership status.",
      clients,
      actions: ["send-win-back", "create-segment"]
    });
  }

  async withModelText(task, payload, context, fallback) {
    if (env.aiProvider !== "openai" || !env.openaiApiKey) {
      return { ...fallback, model: "local-business-rules", confidence: this.confidenceFor(task, fallback) };
    }
    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${env.openaiApiKey}`
        },
        body: JSON.stringify({
          model: env.openaiModel,
          input: [
            {
              role: "system",
              content: "You are an expert India-focused salon CRM assistant. Be concise, practical, and use only the provided business context."
            },
            {
              role: "user",
              content: JSON.stringify({ task, payload, context: compactContext(context), fallback })
            }
          ]
        })
      });
      if (!response.ok) throw new Error(`AI provider returned ${response.status}`);
      const data = await response.json();
      const modelText = data.output_text || data.output?.flatMap((item) => item.content || []).map((item) => item.text).filter(Boolean).join("\n") || "";
      return { ...fallback, model: env.openaiModel, modelText, confidence: this.confidenceFor(task, fallback) };
    } catch (error) {
      return {
        ...fallback,
        model: "local-business-rules",
        providerWarning: error.message,
        confidence: this.confidenceFor(task, fallback) - 0.08
      };
    }
  }

  confidenceFor(task, output) {
    const base = {
      "appointment-booking": output.appointment ? 0.92 : 0.74,
      upsell: output.suggestions?.length ? 0.86 : 0.66,
      "service-recommendation": output.recommendations?.length ? 0.86 : 0.68,
      chatbot: 0.82,
      "follow-up": 0.88,
      "review-reply": 0.84,
      "marketing-caption": 0.82,
      "analytics-summary": 0.9,
      "churn-prediction": output.clients?.length ? 0.83 : 0.62
    };
    return money(base[task] || 0.75);
  }

  persistInteraction(type, payload, context, output, access) {
    return repositories.aiInteractions.create({
      id: makeId("ai"),
      branchId: payload.branchId || context.branchId || "",
      clientId: payload.clientId || output.client?.id || output.appointment?.clientId || "",
      appointmentId: output.appointment?.id || "",
      type,
      prompt: payload.prompt || output.title || type,
      input: payload,
      context: compactContext(context),
      output,
      actions: output.actions || [],
      model: output.model || "local-business-rules",
      status: "completed",
      confidence: output.confidence || 0.75
    }, scope(access));
  }
}

export const aiAssistantService = new AiAssistantService();
