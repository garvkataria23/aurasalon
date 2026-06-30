import { repositories } from "../repositories/repository-registry.js";
import { badRequest } from "../utils/app-error.js";
import { salonOperationsService } from "./salon-operations.service.js";
import { tenantService } from "./tenant.service.js";
import { complete } from "./ai/llmProvider.js";
import { assertAiTaskAllowed } from "./ai/aiPolicy.js";
import { aiGovernanceService } from "./ai/aiGovernance.service.js";
import { buildCustomerAiContext } from "./ai/customerContext.service.js";
import { buildCalendarAiContext } from "./ai/calendarContext.service.js";
import { buildPosAiContext, requireCartItems } from "./ai/posContext.service.js";
import { buildInventoryAiContext } from "./ai/inventoryContext.service.js";
import { buildDashboardAiContext } from "./ai/dashboardContext.service.js";
import * as reviewReplyPrompt from "./ai/prompts/reviewReply.js";
import * as marketingCaptionPrompt from "./ai/prompts/marketingCaption.js";
import * as analyticsSummaryPrompt from "./ai/prompts/analyticsSummary.js";
import * as customerHealthPrompt from "./ai/prompts/customerHealthScore.js";
import * as customerChurnPrompt from "./ai/prompts/customerChurnRisk.js";
import * as customerNextActionPrompt from "./ai/prompts/customerNextBestAction.js";
import * as customerUpsellPrompt from "./ai/prompts/customerUpsellRecommendation.js";
import * as customerRebookingPrompt from "./ai/prompts/customerRebookingRecommendation.js";
import * as calendarPrompt from "./ai/prompts/calendarIntelligence.js";
import * as posPrompt from "./ai/prompts/posIntelligence.js";
import * as inventoryPrompt from "./ai/prompts/inventoryIntelligence.js";
import * as whatsappPrompt from "./ai/prompts/whatsappDrafting.js";
import * as dashboardPrompt from "./ai/prompts/dashboardIntelligence.js";
import * as knowledgePrompt from "./ai/prompts/knowledgeSearchSummary.js";
import { knowledgeBaseService } from "./ai/knowledgeBase.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

const workflowMap = new Map([
  ["review-reply", "review.reply"],
  ["marketing-caption", "marketing.caption"],
  ["analytics-summary", "analytics.summary"],
  ["customer-health-score", "customer360.health_score"],
  ["customer-churn-risk", "customer360.churn_risk"],
  ["customer-next-best-action", "customer360.next_best_action"],
  ["customer-upsell-recommendation", "customer360.upsell_recommendation"],
  ["customer-rebooking-recommendation", "customer360.rebooking_recommendation"],
  ["calendar-smart-slot-score", "calendar.smart_slot_score"],
  ["calendar-no-show-risk", "calendar.no_show_risk"],
  ["calendar-conflict-doctor", "calendar.conflict_doctor"],
  ["calendar-revenue-gap-filler", "calendar.revenue_gap_filler"],
  ["calendar-staff-load-signal", "calendar.staff_load_signal"],
  ["calendar-delay-prediction", "calendar.delay_prediction"],
  ["calendar-booking-quality-score", "calendar.booking_quality_score"],
  ["pos-smart-upsell", "pos.smart_upsell"],
  ["pos-membership-suggestion", "pos.membership_suggestion"],
  ["pos-discount-guard", "pos.discount_guard"],
  ["pos-payment-recovery", "pos.payment_recovery"],
  ["pos-cart-profitability", "pos.cart_profitability"],
  ["inventory-reorder-prediction", "inventory.reorder_prediction"],
  ["inventory-expiry-waste-risk", "inventory.expiry_waste_risk"],
  ["inventory-service-stock-readiness", "inventory.service_stock_readiness"],
  ["inventory-low-stock-reason", "inventory.low_stock_reason"],
  ["inventory-purchase-plan", "inventory.purchase_plan"],
  ["whatsapp-intent-detection", "whatsapp.intent_detection"],
  ["whatsapp-reply-generation", "whatsapp.reply_generation"],
  ["whatsapp-followup-draft", "whatsapp.followup_draft"],
  ["whatsapp-rebooking-draft", "whatsapp.rebooking_draft"],
  ["whatsapp-payment-reminder-draft", "whatsapp.payment_reminder_draft"],
  ["dashboard-executive-summary", "dashboard.executive_summary"],
  ["dashboard-risk-briefing", "dashboard.risk_briefing"],
  ["dashboard-revenue-actions", "dashboard.revenue_actions"],
  ["dashboard-owner-daily-brief", "dashboard.owner_daily_brief"],
  ["knowledge-search-summary", "knowledge.search_summary"]
]);

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function compactContextForInteraction(taskKey, context) {
  return {
    taskKey,
    tenantId: context?.tenantId || "",
    branchId: context?.branchId || "",
    sourceCounts: context?.sourceCounts || {},
    metrics: context?.metrics || {},
    generatedAt: now()
  };
}

function confidence(score = 0.82) {
  return money(score);
}

function asArray(value) {
  return Array.isArray(value) ? value : [];
}

function taskFamily(taskKey) {
  return String(taskKey || "").split(".")[0];
}

function choosePrompt(taskKey) {
  const prompts = {
    "review.reply": {
      version: reviewReplyPrompt.version,
      systemPrompt: reviewReplyPrompt.systemPrompt,
      buildUserPrompt: reviewReplyPrompt.buildUserPrompt,
      jsonSchema: reviewReplyPrompt.jsonSchema
    },
    "marketing.caption": {
      version: marketingCaptionPrompt.version,
      systemPrompt: marketingCaptionPrompt.systemPrompt,
      buildUserPrompt: marketingCaptionPrompt.buildUserPrompt,
      jsonSchema: marketingCaptionPrompt.jsonSchema
    },
    "analytics.summary": {
      version: analyticsSummaryPrompt.version,
      systemPrompt: analyticsSummaryPrompt.systemPrompt,
      buildUserPrompt: analyticsSummaryPrompt.buildUserPrompt,
      jsonSchema: analyticsSummaryPrompt.jsonSchema
    },
    "customer360.health_score": {
      version: customerHealthPrompt.version,
      systemPrompt: customerHealthPrompt.systemPrompt,
      buildUserPrompt: customerHealthPrompt.buildUserPrompt,
      jsonSchema: customerHealthPrompt.jsonSchema
    },
    "customer360.churn_risk": {
      version: customerChurnPrompt.version,
      systemPrompt: customerChurnPrompt.systemPrompt,
      buildUserPrompt: customerChurnPrompt.buildUserPrompt,
      jsonSchema: customerChurnPrompt.jsonSchema
    },
    "customer360.next_best_action": {
      version: customerNextActionPrompt.version,
      systemPrompt: customerNextActionPrompt.systemPrompt,
      buildUserPrompt: customerNextActionPrompt.buildUserPrompt,
      jsonSchema: customerNextActionPrompt.jsonSchema
    },
    "customer360.upsell_recommendation": {
      version: customerUpsellPrompt.version,
      systemPrompt: customerUpsellPrompt.systemPrompt,
      buildUserPrompt: customerUpsellPrompt.buildUserPrompt,
      jsonSchema: customerUpsellPrompt.jsonSchema
    },
    "customer360.rebooking_recommendation": {
      version: customerRebookingPrompt.version,
      systemPrompt: customerRebookingPrompt.systemPrompt,
      buildUserPrompt: customerRebookingPrompt.buildUserPrompt,
      jsonSchema: customerRebookingPrompt.jsonSchema
    }
  };
  if (prompts[taskKey]) return prompts[taskKey];
  if (taskKey.startsWith("calendar.")) {
    return {
      version: calendarPrompt.version,
      systemPrompt: calendarPrompt.systemPromptFor(taskKey),
      buildUserPrompt: (input) => calendarPrompt.buildUserPrompt(taskKey, input),
      jsonSchema: calendarPrompt.jsonSchema
    };
  }
  if (taskKey.startsWith("pos.")) {
    return {
      version: posPrompt.version,
      systemPrompt: posPrompt.systemPromptFor(taskKey),
      buildUserPrompt: (input) => posPrompt.buildUserPrompt(taskKey, input),
      jsonSchema: posPrompt.jsonSchema
    };
  }
  if (taskKey.startsWith("inventory.")) {
    return {
      version: inventoryPrompt.version,
      systemPrompt: inventoryPrompt.systemPromptFor(taskKey),
      buildUserPrompt: (input) => inventoryPrompt.buildUserPrompt(taskKey, input),
      jsonSchema: inventoryPrompt.jsonSchema
    };
  }
  if (taskKey.startsWith("whatsapp.")) {
    return {
      version: whatsappPrompt.version,
      systemPrompt: whatsappPrompt.systemPromptFor(taskKey),
      buildUserPrompt: (input) => whatsappPrompt.buildUserPrompt(taskKey, input),
      jsonSchema: whatsappPrompt.jsonSchema
    };
  }
  if (taskKey.startsWith("dashboard.")) {
    return {
      version: dashboardPrompt.version,
      systemPrompt: dashboardPrompt.systemPromptFor(taskKey),
      buildUserPrompt: (input) => dashboardPrompt.buildUserPrompt(taskKey, input),
      jsonSchema: dashboardPrompt.jsonSchema
    };
  }
  if (taskKey.startsWith("knowledge.")) {
    return {
      version: knowledgePrompt.version,
      systemPrompt: knowledgePrompt.systemPrompt,
      buildUserPrompt: knowledgePrompt.buildUserPrompt,
      jsonSchema: knowledgePrompt.jsonSchema
    };
  }
  throw badRequest("Unknown AI assistant workflow");
}

export class AiAssistantLlmService {
  history(query = {}, access) {
    return repositories.aiInteractions.list(query, scope(access));
  }

  promptRegistry(access) {
    return {
      tenantId: access.tenantId,
      providerMode: process.env.AI_PROVIDER || "local",
      fallbackMode: "local-business-rules",
      safetyPolicy: {
        piiRedaction: true,
        tenantScoped: true,
        rolePolicy: true,
        approvalFirstActions: true,
        promptLengthGuard: true
      },
      prompts: [...workflowMap.entries()].map(([workflowType, taskKey]) => {
        const prompt = choosePrompt(taskKey);
        return {
          workflowType,
          taskKey,
          family: taskFamily(taskKey),
          promptVersion: prompt.version || "v1",
          outputMode: prompt.jsonSchema ? "json_schema" : "text",
          fallbackMode: "local-business-rules",
          safety: ["tenant_scope", "role_policy", "pii_redaction", "usage_limit", "local_fallback"]
        };
      })
    };
  }

  async run(type, payload = {}, access) {
    const taskKey = workflowMap.get(type);
    if (!taskKey) throw badRequest("Unknown AI assistant workflow");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = String(payload.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    aiGovernanceService.assertTaskOverride({ taskKey, tenantId: access.tenantId, branchId, role: access.role });
    assertAiTaskAllowed({ taskKey, tenantId: access.tenantId, role: access.role });

    const context = this.buildContext(taskKey, payload, access);
    const prompt = choosePrompt(taskKey);
    const localOutput = this.localOutput(taskKey, payload, context);
    const userPrompt = prompt.buildUserPrompt({
      ...payload,
      ...context,
      extraContext: payload.extraContext || payload.context || {},
      context
    });
    const result = await complete({
      taskKey,
      systemPrompt: prompt.systemPrompt,
      userPrompt,
      jsonSchema: prompt.jsonSchema,
      tenantId: access.tenantId,
      branchId: context.branchId || branchId,
      context: { access, role: access.role },
      promptVersion: prompt.version || "v1",
      localOutput
    });

    const output = {
      ...result.output,
      model: result.model,
      confidence: result.output?.confidence ?? localOutput.confidence ?? confidence(),
      ai: {
        taskKey,
        provider: result.provider,
        model: result.model,
        cached: Boolean(result.cached),
        latencyMs: result.latencyMs,
        requestId: result.requestId,
        providerWarning: result.output?.providerWarning || ""
      }
    };
    if (context.knowledge) {
      output.knowledge = {
        query: context.knowledge.query,
        sources: context.knowledge.sources,
        confidence: context.knowledge.confidence,
        unmatchedTerms: context.knowledge.unmatchedTerms
      };
      output.sources = output.sources || context.knowledge.sources;
      output.citations = output.citations || context.knowledge.matches.map((match) => ({
        title: match.title,
        category: match.category,
        excerpt: match.excerpt,
        confidence: match.confidence
      }));
    }
    if (result.output?.providerWarning) output.providerWarning = result.output.providerWarning;
    const interaction = this.persistInteraction({ type, taskKey, payload, context, output, access });
    tenantService.recordUsage({ tenantId: access.tenantId, metric: `ai:${taskKey}`, referenceType: "ai_interaction", referenceId: interaction.id });
    return { interaction, output };
  }

  buildContext(taskKey, payload, access) {
    const family = taskFamily(taskKey);
    if (family === "customer360") {
      return buildCustomerAiContext({ clientId: payload.clientId, access });
    }
    if (family === "calendar") {
      return buildCalendarAiContext({
        appointmentId: payload.appointmentId || "",
        branchId: payload.branchId || "",
        staffId: payload.staffId || "",
        serviceId: payload.serviceId || "",
        startAt: payload.startAt || payload.startTime || "",
        access
      });
    }
    if (family === "pos") {
      const context = buildPosAiContext({
        clientId: payload.clientId || "",
        branchId: payload.branchId || "",
        staffId: payload.staffId || "",
        appointmentId: payload.appointmentId || "",
        items: payload.items || payload.cartItems || [],
        discount: payload.discount || 0,
        payments: payload.payments || [],
        access
      });
      if (taskKey === "pos.cart_profitability") requireCartItems(context);
      return context;
    }
    if (family === "inventory") {
      return buildInventoryAiContext({
        branchId: payload.branchId || "",
        productId: payload.productId || "",
        serviceId: payload.serviceId || "",
        access
      });
    }
    if (family === "dashboard") {
      return buildDashboardAiContext({ branchId: payload.branchId || "", access });
    }
    if (family === "knowledge") {
      const branchId = String(payload.branchId || access.branchId || "");
      const query = String(payload.query || payload.prompt || payload.message || "").trim();
      const knowledge = knowledgeBaseService.search({
        query,
        branchId,
        limit: payload.limit || 5,
        minimumScore: payload.minimumScore ?? 3
      }, access);
      return {
        tenantId: access.tenantId,
        branchId,
        query,
        knowledge,
        sourceCounts: {
          knowledgeMatches: knowledge.matches.length,
          knowledgeSources: knowledge.sources.length
        }
      };
    }
    if (family === "whatsapp") {
      const message = String(payload.message || payload.prompt || payload.body || "").trim();
      if (!message && !payload.clientId && !payload.threadId) throw badRequest("WhatsApp message or clientId is required");
      return {
        tenantId: access.tenantId,
        branchId: payload.branchId || access.branchId || "",
        message,
        clientId: payload.clientId || "",
        phone: payload.phone || "",
        context: payload.context || {},
        sourceCounts: {}
      };
    }
    return this.operationsContext(payload, access);
  }

  operationsContext(payload, access) {
    const branchId = String(payload.branchId || access.branchId || "");
    const scoped = scope(access, branchId);
    return {
      tenantId: access.tenantId,
      branchId,
      dashboard: salonOperationsService.dashboardReport(branchId, access),
      advanced: salonOperationsService.advancedReport(access),
      sourceCounts: {
        clients: repositories.clients.list(branchId ? { branchId, limit: 10000 } : { limit: 10000 }, scoped).length,
        appointments: repositories.appointments.list(branchId ? { branchId, limit: 10000 } : { limit: 10000 }, scoped).length
      }
    };
  }

  localOutput(taskKey, payload, context) {
    if (taskKey === "review.reply") return this.reviewLocal(payload);
    if (taskKey === "marketing.caption") return this.marketingLocal(payload);
    if (taskKey === "analytics.summary") return this.analyticsLocal(context);
    if (taskKey === "customer360.health_score") return this.customerHealthLocal(context);
    if (taskKey === "customer360.churn_risk") return this.customerChurnLocal(context);
    if (taskKey === "customer360.next_best_action") return this.customerActionLocal(context);
    if (taskKey === "customer360.upsell_recommendation") return this.customerUpsellLocal(context);
    if (taskKey === "customer360.rebooking_recommendation") return this.customerRebookingLocal(context);
    if (taskKey.startsWith("calendar.")) return this.calendarLocal(taskKey, context);
    if (taskKey.startsWith("pos.")) return this.posLocal(taskKey, context);
    if (taskKey.startsWith("inventory.")) return this.inventoryLocal(taskKey, context);
    if (taskKey.startsWith("whatsapp.")) return this.whatsappLocal(taskKey, payload, context);
    if (taskKey.startsWith("dashboard.")) return this.dashboardLocal(taskKey, context);
    if (taskKey.startsWith("knowledge.")) return this.knowledgeLocal(context);
    return { title: "AI insight", result: "Local salon intelligence generated.", confidence: confidence() };
  }

  reviewLocal(payload) {
    const rating = Number(payload.rating || 5);
    const reviewText = String(payload.reviewText || payload.prompt || "");
    const reply = rating >= 4
      ? `Thank you for the lovely review. We are glad you enjoyed your salon visit and the team would love to welcome you back soon.`
      : `Thank you for sharing this. We are sorry the visit did not meet expectations. Please contact the salon manager so we can review the service and make this right.`;
    return {
      title: "Review reply",
      rating,
      reviewText,
      reply,
      result: reply,
      tone: rating >= 4 ? "warm-appreciative" : "empathetic-recovery",
      actions: ["copy-reply"],
      confidence: confidence(0.84)
    };
  }

  marketingLocal(payload) {
    const offer = String(payload.offer || payload.prompt || "salon glow offer");
    const channel = String(payload.channel || "WhatsApp");
    return {
      title: "Marketing captions",
      channel,
      offer,
      captions: [
        `Glow week is live: ${offer}. Book your slot today and leave with a fresh salon look.`,
        `Your next salon refresh is waiting. ${offer}. Limited slots available this week.`,
        `A little care, a visible glow. ${offer}. Message us to reserve your appointment.`
      ],
      result: `Generated ${channel} captions for ${offer}.`,
      segmentIdeas: ["VIP clients", "inactive clients", "birthday month clients", "membership clients"],
      actions: ["create-campaign", "copy-caption"],
      confidence: confidence(0.82)
    };
  }

  analyticsLocal(context) {
    const report = context.advanced || {};
    const dashboard = context.dashboard || {};
    const summary = [
      `Revenue is INR ${money(report.sales?.revenue ?? dashboard.revenueToday)} across ${report.sales?.count ?? dashboard.totalBookings ?? 0} saved records.`,
      `Pending payments are INR ${money(dashboard.pendingPayments || context.metrics?.pendingPaymentAmount || 0)}.`,
      `${report.inventory?.lowStock ?? context.metrics?.lowStockProducts ?? 0} inventory items need attention.`
    ];
    return {
      title: "AI analytics summary",
      summary,
      result: summary.join(" "),
      actions: ["Review pending payments", "Check low stock", "Run client win-back"],
      report,
      confidence: confidence(0.9)
    };
  }

  customerHealthLocal(context) {
    const metrics = context.metrics || {};
    const score = Math.max(5, Math.min(100, Math.round(82 - (metrics.daysSinceLastVisit || 0) * 0.35 - (metrics.noShowBookings || 0) * 12 - (metrics.pendingPaymentAmount ? 10 : 0) + (metrics.visitsCount || 0) * 2)));
    return {
      title: "Client health score",
      result: `${context.client?.name || "Client"} health score is ${score}.`,
      score,
      riskLevel: score < 45 ? "high" : score < 70 ? "medium" : "low",
      recommendedAction: score < 70 ? "Send rebooking and recovery follow-up" : "Keep in loyalty nurture",
      reason: (context.churnSignals || []).join(", ") || "Healthy repeat behavior from saved salon data.",
      signals: context.churnSignals || [],
      confidence: confidence(0.86)
    };
  }

  customerChurnLocal(context) {
    const days = Number(context.metrics?.daysSinceLastVisit || 0);
    const noShows = Number(context.metrics?.noShowBookings || 0);
    const score = Math.min(100, Math.round(days * 0.8 + noShows * 18 + (context.metrics?.pendingPaymentAmount ? 12 : 0)));
    return {
      title: "Churn risk",
      result: `${context.client?.name || "Client"} has ${score >= 70 ? "high" : score >= 40 ? "medium" : "low"} churn risk.`,
      score,
      riskLevel: score >= 70 ? "high" : score >= 40 ? "medium" : "low",
      recommendedAction: score >= 70 ? "Send personal win-back WhatsApp today" : "Schedule next visit reminder",
      reason: (context.churnSignals || []).join(", ") || `${days} days since last visit.`,
      confidence: confidence(0.84)
    };
  }

  customerActionLocal(context) {
    const action = context.metrics?.pendingPaymentAmount
      ? "Send polite payment reminder and then rebooking offer"
      : context.metrics?.daysSinceLastVisit >= 30
        ? "Send WhatsApp rebooking message"
        : "Offer next best service during the next visit";
    return {
      title: "Next best action",
      result: action,
      recommendedAction: action,
      reason: (context.churnSignals || context.upsellSignals || []).slice(0, 3).join(", ") || "Based on live client history.",
      actions: ["copy-message", "book-appointment"],
      confidence: confidence(0.86)
    };
  }

  customerUpsellLocal(context) {
    return {
      title: "Upsell recommendation",
      result: (context.upsellSignals || []).join(", ") || "Recommend membership or retail aftercare based on service history.",
      recommendedAction: context.metrics?.activeMembership ? "Offer retail aftercare product" : "Offer membership conversion",
      reason: (context.upsellSignals || []).join(", ") || "Repeat service behavior detected.",
      actions: ["show-at-pos"],
      confidence: confidence(0.82)
    };
  }

  customerRebookingLocal(context) {
    return {
      title: "Rebooking recommendation",
      result: `${context.client?.name || "Client"} should be rebooked in the preferred ${context.metrics?.preferredVisitTime || "time"} window.`,
      recommendedAction: "Create a rebooking draft and send by WhatsApp after approval",
      reason: `Favorite service: ${context.metrics?.favoriteService || "not enough history"}.`,
      actions: ["create-rebooking-draft"],
      confidence: confidence(0.83)
    };
  }

  calendarLocal(taskKey, context) {
    const staffLoad = asArray(context.staffLoad);
    const overloaded = staffLoad.find((row) => row.bookedMinutes >= 360);
    const lowStock = asArray(context.inventory?.lowStockProducts);
    const score = taskKey === "calendar.no_show_risk"
      ? Math.min(100, (context.metrics?.noShowRate || 0) + (context.metrics?.unpaidInvoiceBalance ? 25 : 0))
      : Math.max(35, 92 - (overloaded ? 18 : 0) - lowStock.length * 3);
    return {
      title: taskKey.replace("calendar.", "").replaceAll("_", " "),
      result: taskKey === "calendar.revenue_gap_filler"
        ? "Use idle gaps for quick high-margin services and rebooking calls."
        : "Calendar intelligence generated from bookings, staff load and branch inventory.",
      score,
      riskLevel: score >= 70 && taskKey.includes("risk") ? "high" : score >= 45 ? "medium" : "low",
      recommendedAction: overloaded ? `Balance workload away from ${overloaded.name}` : "Keep this slot and confirm by WhatsApp",
      reason: `${context.metrics?.dayBookingCount || 0} bookings, ${staffLoad.length} staff rows, ${lowStock.length} low-stock item(s).`,
      insights: [
        overloaded ? `${overloaded.name} has ${overloaded.bookedMinutes} booked minutes.` : "Staff load is within range.",
        lowStock.length ? "Inventory readiness needs review." : "Inventory readiness looks clear."
      ],
      actions: ["review-slot", "copy-recommendation"],
      confidence: confidence(0.82)
    };
  }

  posLocal(taskKey, context) {
    const cart = context.cart || {};
    const payable = Number(cart.payable || 0);
    return {
      title: taskKey.replace("pos.", "").replaceAll("_", " "),
      result: taskKey === "pos.payment_recovery"
        ? `Recover INR ${money(context.history?.pendingPaymentAmount || 0)} pending balance with a polite reminder.`
        : `Cart value is INR ${money(payable)} with ${cart.itemCount || 0} item(s).`,
      recommendedAction: taskKey === "pos.discount_guard" ? "Keep discount within approved margin" : "Suggest one ethical add-on only",
      reason: `Service revenue INR ${money(cart.serviceRevenue || 0)}, product margin INR ${money(cart.productMargin || 0)}.`,
      estimatedValue: Math.max(0, Math.round(payable * 0.12)),
      riskLevel: Number(cart.discount || 0) > payable * 0.2 ? "high" : "low",
      suggestions: ["Retail aftercare", "Membership conversion", "Collect pending balance"],
      actions: ["show-suggestion"],
      confidence: confidence(0.83)
    };
  }

  inventoryLocal(taskKey, context) {
    const lowStock = asArray(context.lowStock);
    const selected = context.selectedProduct || lowStock[0] || {};
    return {
      title: taskKey.replace("inventory.", "").replaceAll("_", " "),
      result: lowStock.length ? `${lowStock.length} product(s) need stock action.` : "Inventory looks stable for this scope.",
      recommendedAction: lowStock.length ? `Reorder ${selected.name || "priority products"}` : "Continue daily stock watch",
      reason: `${context.metrics?.lowStockCount || 0} low-stock and ${context.metrics?.expiringSoonCount || 0} expiring-soon product(s).`,
      riskLevel: lowStock.length ? "high" : "low",
      products: lowStock.slice(0, 5).map((product) => product.name),
      suggestions: ["Create purchase plan", "Check professional stock readiness"],
      actions: ["open-purchase-entry"],
      confidence: confidence(0.83)
    };
  }

  whatsappLocal(taskKey, payload, context) {
    const message = String(payload.message || payload.prompt || "");
    const intent = taskKey === "whatsapp.intent_detection"
      ? (message.toLowerCase().includes("book") ? "booking_request" : message.toLowerCase().includes("pay") ? "payment_reminder_response" : "service_inquiry")
      : "";
    const draft = `Hi, thanks for messaging Aura Salon. We will verify your request and share the safest next step.`;
    return {
      title: taskKey.replace("whatsapp.", "").replaceAll("_", " "),
      result: intent || "WhatsApp draft generated for manual approval.",
      intent,
      messageDraft: draft,
      actionRequired: context.phone ? "" : "Verify phone before sending",
      recommendedAction: "Review and approve manually; AI will not send.",
      reason: "Draft-only WhatsApp workflow.",
      actions: ["copy-draft", "approve-manually"],
      confidence: confidence(0.78)
    };
  }

  dashboardLocal(taskKey, context) {
    const metrics = context.metrics || {};
    return {
      title: taskKey.replace("dashboard.", "").replaceAll("_", " "),
      result: `Revenue INR ${money(metrics.salesRevenue || 0)}, ${metrics.appointments || 0} bookings, pending INR ${money(metrics.pendingPaymentAmount || 0)}.`,
      summary: [
        `${metrics.completedAppointments || 0} completed appointments.`,
        `${metrics.lowStockProducts || 0} low-stock products.`,
        `${metrics.staff || 0} staff in scope.`
      ],
      risks: [
        metrics.pendingPaymentAmount ? "Pending payments need recovery." : "No major payment risk.",
        metrics.lowStockProducts ? "Low-stock products may affect service readiness." : "Inventory risk is low."
      ],
      recommendedAction: metrics.pendingPaymentAmount ? "Run payment recovery actions today" : "Focus on rebooking and retail add-ons",
      reason: "Generated from saved dashboard and report data.",
      actions: ["review-dashboard"],
      confidence: confidence(0.86)
    };
  }

  knowledgeLocal(context) {
    const knowledge = context.knowledge || { matches: [], sources: [], unmatchedTerms: [] };
    const citations = asArray(knowledge.matches).slice(0, 5).map((match) => ({
      title: match.title,
      category: match.category,
      excerpt: match.excerpt,
      confidence: match.confidence
    }));
    const answer = citations.length
      ? citations.map((item) => item.excerpt).join(" ")
      : "No active knowledge-base article matched this question. Add or import a source before using this as a customer-facing answer.";
    return {
      title: "Knowledge grounded answer",
      result: answer,
      answer,
      citations,
      sources: knowledge.sources || [],
      unmatchedTerms: knowledge.unmatchedTerms || [],
      recommendedAction: citations.length ? "Review the cited knowledge before sharing." : "Add a knowledge-base article for this question.",
      actions: citations.length ? ["review-citations", "copy-answer"] : ["add-knowledge-document"],
      confidence: confidence(knowledge.confidence || 0.35)
    };
  }

  persistInteraction({ type, taskKey, payload, context, output, access }) {
    return repositories.aiInteractions.create({
      id: makeId("ai"),
      branchId: context.branchId || payload.branchId || "",
      clientId: payload.clientId || context.client?.id || "",
      appointmentId: payload.appointmentId || context.target?.id || "",
      type,
      prompt: payload.prompt || payload.message || output.title || type,
      input: payload,
      context: compactContextForInteraction(taskKey, context),
      output,
      actions: output.actions || [],
      model: output.model || "local-business-rules",
      status: "completed",
      confidence: output.confidence || 0.75
    }, scope(access, context.branchId || payload.branchId || ""));
  }
}

export const aiAssistantLlmService = new AiAssistantLlmService();
