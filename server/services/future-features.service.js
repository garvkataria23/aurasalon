import { repositories } from "../repositories/repository-registry.js";
import { badRequest } from "../utils/app-error.js";
import { salonOperationsService } from "./salon-operations.service.js";
import { smartBookingService } from "./smart-booking.service.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;

const allowedTypes = new Set([
  "growth-advisor",
  "pricing-optimizer",
  "offer-engine",
  "emotion-analysis",
  "no-show-prediction",
  "demand-forecasting",
  "inventory-prediction",
  "voice-booking-assistant",
  "smart-kiosk-mode",
  "ai-receptionist"
]);

const workflowDefinitions = [
  {
    type: "growth-advisor",
    label: "AI salon growth advisor",
    category: "Growth",
    sourceKeys: ["clients", "sales", "appointments", "products", "campaigns"],
    modules: ["Client CRM", "POS Billing", "Appointments", "Inventory", "Marketing"],
    routes: ["/clients", "/pos", "/appointments", "/inventory", "/marketing"],
    action: "Create weekly growth plan"
  },
  {
    type: "pricing-optimizer",
    label: "AI pricing optimizer",
    category: "Revenue",
    sourceKeys: ["services", "sales", "appointments"],
    modules: ["Services", "POS Billing", "Appointments"],
    routes: ["/services", "/pos", "/appointments"],
    action: "Review service price upside"
  },
  {
    type: "offer-engine",
    label: "AI offer engine",
    category: "Marketing",
    sourceKeys: ["clients", "services", "campaigns", "whatsappThreads"],
    modules: ["Client CRM", "Services", "Marketing", "WhatsApp"],
    routes: ["/clients", "/services", "/marketing", "/whatsapp"],
    action: "Draft segmented WhatsApp offers"
  },
  {
    type: "emotion-analysis",
    label: "AI customer emotion analysis",
    category: "Experience",
    sourceKeys: ["clients", "whatsappThreads", "sales"],
    modules: ["Client CRM", "WhatsApp", "POS Billing"],
    routes: ["/clients", "/whatsapp", "/pos"],
    action: "Detect unhappy clients and recovery scripts"
  },
  {
    type: "no-show-prediction",
    label: "AI no-show prediction",
    category: "Calendar",
    sourceKeys: ["appointments", "clients", "whatsappThreads"],
    modules: ["Appointments", "Client CRM", "WhatsApp"],
    routes: ["/appointments", "/clients", "/whatsapp"],
    action: "Trigger confirmation reminders"
  },
  {
    type: "demand-forecasting",
    label: "AI demand forecasting",
    category: "Operations",
    sourceKeys: ["appointments", "staff", "campaigns", "branches"],
    modules: ["Appointments", "Staff", "Marketing", "Branches"],
    routes: ["/appointments", "/staff", "/marketing", "/settings"],
    action: "Plan staffing and peak slots"
  },
  {
    type: "inventory-prediction",
    label: "AI inventory prediction",
    category: "Inventory",
    sourceKeys: ["products", "services", "sales", "appointments"],
    modules: ["Inventory", "Services", "POS Billing", "Appointments"],
    routes: ["/inventory", "/inventory/recipes", "/pos", "/appointments"],
    action: "Create reorder and stockout prevention list"
  },
  {
    type: "voice-booking-assistant",
    label: "Voice booking assistant",
    category: "Front desk",
    sourceKeys: ["services", "appointments", "branches", "staff"],
    modules: ["Services", "Appointments", "Branches", "Staff"],
    routes: ["/services", "/appointments", "/staff"],
    action: "Recommend bookable slots from voice transcript"
  },
  {
    type: "smart-kiosk-mode",
    label: "Smart kiosk mode",
    category: "Front desk",
    sourceKeys: ["appointments", "clients", "branches"],
    modules: ["Appointments", "Client CRM", "Branches"],
    routes: ["/appointments", "/clients"],
    action: "Start self check-in with queue estimate"
  },
  {
    type: "ai-receptionist",
    label: "AI receptionist",
    category: "Front desk",
    sourceKeys: ["clients", "appointments", "services", "memberships", "whatsappThreads"],
    modules: ["Client CRM", "Appointments", "Services", "Memberships", "WhatsApp"],
    routes: ["/clients", "/appointments", "/services", "/memberships", "/whatsapp"],
    action: "Route booking, complaint, payment or membership intent"
  }
];

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function daysSince(value) {
  if (!value) return 999;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

function latestActivity(items, keys = ["updatedAt", "createdAt", "startAt", "date"]) {
  let latest = "";
  for (const item of items || []) {
    for (const key of keys) {
      const value = item?.[key];
      if (value && (!latest || new Date(value).getTime() > new Date(latest).getTime())) latest = value;
    }
  }
  return latest;
}

export class FutureFeaturesService {
  summary(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const runs = repositories.innovationRuns.list({ branchId, limit: 100 }, scope(access, branchId));
    const voiceSessions = repositories.voiceBookingSessions.list({ branchId, limit: 100 }, scope(access, branchId));
    const kioskSessions = repositories.kioskSessions.list({ branchId, limit: 100 }, scope(access, branchId));
    const context = this.context(access, branchId);
    const liveDataSources = this.liveDataSources(context);
    const workflowMap = this.workflowMap(runs, liveDataSources);
    const actionRail = this.actionRail(context, workflowMap);
    const sourceHealth = this.sourceHealth(liveDataSources, workflowMap);
    return {
      metrics: {
        innovationRuns: runs.length,
        voiceSessions: voiceSessions.length,
        kioskSessions: kioskSessions.length,
        noShowRisk: this.noShowPrediction({}, context).highRiskCount,
        demandIndex: this.demandForecasting({}, context).demandIndex,
        pricingOpportunity: this.pricingOptimizer({}, context).totalMonthlyOpportunity,
        liveSources: sourceHealth.liveSources,
        connectedModules: sourceHealth.connectedModules,
        automationReady: sourceHealth.readyWorkflows,
        actionPaths: actionRail.length
      },
      runs,
      voiceSessions,
      kioskSessions,
      liveDataSources,
      workflowMap,
      actionRail,
      sourceHealth,
      advisorPreview: this.growthAdvisor({}, context),
      featureMap: workflowDefinitions.map((workflow) => workflow.label)
    };
  }

  run(type, payload = {}, access) {
    if (!allowedTypes.has(type)) throw badRequest("Unknown future feature workflow");
    tenantService.ensureSubscriptionActive(access.tenantId);
    const branchId = payload.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const context = this.context(access, branchId);
    const output = this.dispatch(type, payload, context, access);
    const sourceTrace = this.sourceTraceFor(type, context);
    const metadata = workflowDefinitions.find((workflow) => workflow.type === type) || {};
    const outputWithTrace = {
      ...output,
      sourceTrace,
      connectedModules: metadata.modules || [],
      nextRoutes: metadata.routes || [],
      safetyMode: "review-before-action",
      liveEvidence: sourceTrace.map((source) => `${source.name}: ${source.count} records`)
    };
    const actions = outputWithTrace.actions || [];
    const run = repositories.innovationRuns.create({
      id: makeId("innov"),
      branchId,
      type,
      input: payload,
      signals: this.signals(context),
      output: outputWithTrace,
      actions,
      confidence: outputWithTrace.confidence || 0.84,
      status: "generated"
    }, scope(access, branchId));
    tenantService.recordUsage({ tenantId: access.tenantId, metric: `innovation:${type}`, referenceType: "innovation_run", referenceId: run.id });
    return { run, output: outputWithTrace };
  }

  dispatch(type, payload, context, access) {
    switch (type) {
      case "growth-advisor":
        return this.growthAdvisor(payload, context);
      case "pricing-optimizer":
        return this.pricingOptimizer(payload, context);
      case "offer-engine":
        return this.offerEngine(payload, context);
      case "emotion-analysis":
        return this.emotionAnalysis(payload, context);
      case "no-show-prediction":
        return this.noShowPrediction(payload, context);
      case "demand-forecasting":
        return this.demandForecasting(payload, context);
      case "inventory-prediction":
        return this.inventoryPrediction(payload, context);
      case "voice-booking-assistant":
        return this.voiceBookingAssistant(payload, context, access);
      case "smart-kiosk-mode":
        return this.smartKioskMode(payload, context, access);
      case "ai-receptionist":
        return this.aiReceptionist(payload, context);
      default:
        throw badRequest("Unknown future feature workflow");
    }
  }

  context(access, branchId = "") {
    const queryScope = scope(access, branchId);
    const branchQuery = branchId ? { branchId, limit: 10000 } : { limit: 10000 };
    return {
      access,
      branchId,
      dashboard: salonOperationsService.dashboardReport(branchId, access),
      advanced: salonOperationsService.advancedReport(access),
      branches: repositories.branches.list(branchQuery, queryScope),
      clients: repositories.clients.list(branchQuery, queryScope),
      staff: repositories.staff.list(branchQuery, queryScope),
      services: repositories.services.list({ limit: 10000 }, scope(access)),
      products: repositories.products.list(branchQuery, queryScope),
      appointments: repositories.appointments.list(branchQuery, queryScope),
      sales: repositories.sales.list(branchQuery, queryScope),
      memberships: repositories.memberships.list(branchQuery, queryScope),
      campaigns: repositories.campaigns.list({ limit: 10000 }, scope(access)),
      whatsappThreads: repositories.whatsappThreads.list(branchQuery, queryScope)
    };
  }

  liveDataSources(context) {
    const inactiveClients = context.clients.filter((client) => daysSince(client.lastVisitAt) > 60).length;
    const lowStock = context.products.filter((item) => Number(item.stock || 0) <= Number(item.lowStockThreshold || 0)).length;
    const booked = context.appointments.filter((appointment) => ["booked", "arrived"].includes(appointment.status)).length;
    const revenue = context.sales.reduce((sum, sale) => sum + Number(sale.total || sale.totalAmount || 0), 0);
    return [
      {
        key: "clients",
        name: "Client CRM",
        route: "/clients",
        count: context.clients.length,
        signal: `${inactiveClients} inactive clients`,
        freshness: latestActivity(context.clients, ["updatedAt", "createdAt", "lastVisitAt"]),
        status: context.clients.length ? "live" : "needs data"
      },
      {
        key: "sales",
        name: "POS Billing",
        route: "/pos",
        count: context.sales.length,
        signal: `INR ${money(revenue)} revenue base`,
        freshness: latestActivity(context.sales),
        status: context.sales.length ? "live" : "needs data"
      },
      {
        key: "appointments",
        name: "Appointments",
        route: "/appointments",
        count: context.appointments.length,
        signal: `${booked} active bookings`,
        freshness: latestActivity(context.appointments, ["updatedAt", "createdAt", "startAt"]),
        status: context.appointments.length ? "live" : "needs data"
      },
      {
        key: "services",
        name: "Services",
        route: "/services",
        count: context.services.length,
        signal: `${context.services.length} priced services`,
        freshness: latestActivity(context.services),
        status: context.services.length ? "live" : "needs data"
      },
      {
        key: "products",
        name: "Inventory",
        route: "/inventory",
        count: context.products.length,
        signal: `${lowStock} low-stock products`,
        freshness: latestActivity(context.products),
        status: context.products.length ? "live" : "needs data"
      },
      {
        key: "staff",
        name: "Staff",
        route: "/staff",
        count: context.staff.length,
        signal: `${context.staff.length} roster records`,
        freshness: latestActivity(context.staff),
        status: context.staff.length ? "live" : "needs data"
      },
      {
        key: "campaigns",
        name: "Marketing",
        route: "/marketing",
        count: context.campaigns.length,
        signal: `${context.campaigns.length} campaign records`,
        freshness: latestActivity(context.campaigns),
        status: context.campaigns.length ? "live" : "needs data"
      },
      {
        key: "whatsappThreads",
        name: "WhatsApp",
        route: "/whatsapp",
        count: context.whatsappThreads.length,
        signal: `${context.whatsappThreads.length} conversation threads`,
        freshness: latestActivity(context.whatsappThreads),
        status: context.whatsappThreads.length ? "live" : "needs data"
      },
      {
        key: "memberships",
        name: "Memberships",
        route: "/memberships",
        count: context.memberships.length,
        signal: `${context.memberships.length} membership records`,
        freshness: latestActivity(context.memberships),
        status: context.memberships.length ? "live" : "needs data"
      },
      {
        key: "branches",
        name: "Branches",
        route: "/settings",
        count: context.branches.length,
        signal: context.branchId ? `Scoped to ${context.branchId}` : `${context.branches.length} branches available`,
        freshness: latestActivity(context.branches),
        status: context.branches.length || context.branchId ? "live" : "needs data"
      }
    ];
  }

  workflowMap(runs, liveDataSources) {
    const sourceByKey = new Map(liveDataSources.map((source) => [source.key, source]));
    const runStats = new Map();
    for (const run of runs || []) {
      const stat = runStats.get(run.type) || { count: 0, lastRunAt: "" };
      stat.count += 1;
      if (run.createdAt && (!stat.lastRunAt || new Date(run.createdAt).getTime() > new Date(stat.lastRunAt).getTime())) {
        stat.lastRunAt = run.createdAt;
      }
      runStats.set(run.type, stat);
    }
    return workflowDefinitions.map((workflow) => {
      const sources = workflow.sourceKeys.map((key) => sourceByKey.get(key)).filter(Boolean);
      const readySources = sources.filter((source) => Number(source.count || 0) > 0 || source.key === "branches").length;
      const stat = runStats.get(workflow.type) || { count: 0, lastRunAt: "" };
      return {
        ...workflow,
        sourceCount: sources.length,
        readySources,
        liveRecordCount: sources.reduce((sum, source) => sum + Number(source.count || 0), 0),
        status: readySources ? "connected" : "waiting for data",
        runCount: stat.count,
        lastRunAt: stat.lastRunAt,
        sourceSignals: sources.map((source) => `${source.name}: ${source.signal}`)
      };
    });
  }

  actionRail(context, workflowMap) {
    const inactiveClients = context.clients.filter((client) => daysSince(client.lastVisitAt) > 60).length;
    const lowStock = context.products.filter((item) => Number(item.stock || 0) <= Number(item.lowStockThreshold || 0)).length;
    const openBookings = context.appointments.filter((item) => ["booked", "arrived"].includes(item.status)).length;
    const pricingOpportunity = this.pricingOptimizer({}, context).totalMonthlyOpportunity;
    return [
      {
        title: "Client recovery loop",
        route: "/clients",
        source: "Client CRM",
        target: "WhatsApp + Marketing",
        count: inactiveClients,
        workflow: "growth-advisor",
        status: inactiveClients ? "ready" : "monitoring"
      },
      {
        title: "Price and margin review",
        route: "/pos",
        source: "POS Billing + Services",
        target: "Pricing optimizer",
        count: pricingOpportunity,
        workflow: "pricing-optimizer",
        status: pricingOpportunity > 0 ? "ready" : "monitoring"
      },
      {
        title: "No-show prevention",
        route: "/appointments",
        source: "Appointments + Client CRM",
        target: "WhatsApp reminder",
        count: openBookings,
        workflow: "no-show-prediction",
        status: openBookings ? "ready" : "monitoring"
      },
      {
        title: "Stockout prevention",
        route: "/inventory",
        source: "Inventory + Services",
        target: "Purchase planning",
        count: lowStock,
        workflow: "inventory-prediction",
        status: lowStock ? "ready" : "monitoring"
      },
      {
        title: "Front desk automation",
        route: "/appointments",
        source: "Services + Slots + Staff",
        target: "Voice assistant / kiosk",
        count: workflowMap.filter((workflow) => workflow.category === "Front desk").length,
        workflow: "voice-booking-assistant",
        status: "connected"
      }
    ];
  }

  sourceHealth(liveDataSources, workflowMap) {
    const connectedModules = new Set(workflowDefinitions.flatMap((workflow) => workflow.modules));
    return {
      liveSources: liveDataSources.filter((source) => source.status === "live").length,
      totalSources: liveDataSources.length,
      connectedModules: connectedModules.size,
      readyWorkflows: workflowMap.filter((workflow) => workflow.status === "connected").length,
      totalWorkflows: workflowMap.length
    };
  }

  sourceTraceFor(type, context) {
    const workflow = workflowDefinitions.find((item) => item.type === type);
    if (!workflow) return [];
    const sourceByKey = new Map(this.liveDataSources(context).map((source) => [source.key, source]));
    return workflow.sourceKeys.map((key) => sourceByKey.get(key)).filter(Boolean);
  }

  signals(context) {
    return {
      revenueMonth: context.dashboard.revenueMonth,
      bookings: context.appointments.length,
      clients: context.clients.length,
      noShows: context.appointments.filter((item) => item.status === "no-show").length,
      lowStock: context.products.filter((item) => Number(item.stock || 0) <= Number(item.lowStockThreshold || 0)).length,
      repeatRate: context.dashboard.repeatCustomerRate
    };
  }

  growthAdvisor(_payload, context) {
    const lowStock = context.products.filter((item) => Number(item.stock || 0) <= Number(item.lowStockThreshold || 0));
    const inactive = context.clients.filter((client) => daysSince(client.lastVisitAt) > 60);
    const topService = [...context.services].sort((a, b) => Number(b.price || 0) - Number(a.price || 0))[0];
    return {
      title: "AI salon growth advisor",
      summary: `Focus this week on reactivating ${inactive.length} inactive clients and lifting premium service mix with ${topService?.name || "your top service"}.`,
      priorities: [
        { area: "Retention", action: "Launch a WhatsApp comeback offer for inactive clients", impact: money(inactive.length * 850) },
        { area: "Premium mix", action: `Bundle ${topService?.name || "premium service"} with a low-cost add-on`, impact: money(Number(topService?.price || 0) * 0.18 * Math.max(1, context.appointments.length)) },
        { area: "Inventory", action: lowStock.length ? "Reorder low-stock products before the weekend rush" : "Keep current inventory cadence", impact: lowStock.length }
      ],
      actions: ["Create retention segment", "Generate offer", "Review low-stock reorder list"],
      confidence: 0.88
    };
  }

  pricingOptimizer(_payload, context) {
    const avgTicket = context.sales.length ? context.sales.reduce((sum, sale) => sum + Number(sale.total || 0), 0) / context.sales.length : 0;
    const recommendations = context.services.slice(0, 8).map((service) => {
      const current = Number(service.price || 0);
      const elasticity = current < avgTicket ? 1.08 : 1.04;
      const suggested = money(Math.ceil((current * elasticity) / 50) * 50);
      return {
        serviceId: service.id,
        service: service.name,
        currentPrice: current,
        suggestedPrice: suggested,
        uplift: money(suggested - current),
        rationale: current < avgTicket ? "Below average ticket; safe premium repositioning" : "Premium service with low price friction"
      };
    });
    return {
      title: "AI pricing optimizer",
      averageTicket: money(avgTicket),
      totalMonthlyOpportunity: money(recommendations.reduce((sum, item) => sum + Math.max(0, item.uplift) * 6, 0)),
      recommendations,
      actions: ["Review suggested service prices", "Test price change at one branch", "Track conversion after 14 days"],
      confidence: 0.82
    };
  }

  offerEngine(payload, context) {
    const segment = payload.segment || "inactive clients";
    const services = context.services.slice(0, 3);
    const offers = services.map((service, index) => ({
      name: `${service.name} ${index === 0 ? "Glowback" : "Upgrade"} offer`,
      segment,
      offer: index === 0 ? "15% off + free consultation" : "Add-on upgrade at INR 299",
      expectedLift: `${12 + index * 4}%`,
      message: `Hi {{name}}, ${service.name} has a limited ${index === 0 ? "comeback" : "upgrade"} offer this week.`
    }));
    return { title: "AI offer engine", offers, actions: ["Create campaign", "Send WhatsApp sequence", "Track conversion"], confidence: 0.86 };
  }

  emotionAnalysis(payload, context) {
    const text = [payload.message, payload.review, payload.notes].filter(Boolean).join(" ") || "Loved the service but waited too long";
    const lower = text.toLowerCase();
    const sentiment = lower.includes("bad") || lower.includes("late") || lower.includes("wait") ? "frustrated" : lower.includes("love") || lower.includes("great") ? "happy" : "neutral";
    return {
      title: "AI customer emotion analysis",
      sentiment,
      emotionScore: sentiment === "happy" ? 86 : sentiment === "frustrated" ? 42 : 64,
      detectedDrivers: sentiment === "frustrated" ? ["wait time", "service recovery needed"] : ["service satisfaction", "upsell readiness"],
      suggestedReply: sentiment === "frustrated"
        ? "Thank you for telling us. We are sorry for the wait and will prioritize your next visit with a smoother check-in."
        : "Thank you for the kind words. We would love to welcome you again soon.",
      contextClients: context.clients.length,
      actions: ["Save note to client profile", "Trigger review reply", "Create follow-up task"],
      confidence: 0.8
    };
  }

  noShowPrediction(_payload, context) {
    const predictions = context.appointments
      .filter((appointment) => ["booked", "arrived"].includes(appointment.status))
      .slice(0, 20)
      .map((appointment) => {
        const client = context.clients.find((item) => item.id === appointment.clientId);
        const inactive = daysSince(client?.lastVisitAt);
        const score = Math.min(95, 18 + (inactive > 90 ? 35 : inactive > 45 ? 18 : 0) + (appointment.source === "online" ? 10 : 0));
        return {
          appointmentId: appointment.id,
          clientName: client?.name || appointment.clientId,
          startAt: appointment.startAt,
          score,
          risk: score > 65 ? "high" : score > 40 ? "medium" : "low",
          prevention: score > 65 ? "Send deposit link and personal WhatsApp confirmation" : "Send reminder with quick confirm button"
        };
      });
    return {
      title: "AI no-show prediction",
      highRiskCount: predictions.filter((item) => item.risk === "high").length,
      predictions,
      actions: ["Send confirmation reminder", "Collect token deposit", "Offer waitlist backup"],
      confidence: 0.84
    };
  }

  demandForecasting(_payload, context) {
    const byDay = new Map();
    for (const appointment of context.appointments) {
      const key = appointment.startAt?.slice(0, 10) || "unknown";
      byDay.set(key, (byDay.get(key) || 0) + 1);
    }
    const avg = byDay.size ? [...byDay.values()].reduce((sum, count) => sum + count, 0) / byDay.size : 0;
    const forecast = Array.from({ length: 7 }, (_, index) => {
      const date = new Date();
      date.setDate(date.getDate() + index + 1);
      const weekend = [0, 6].includes(date.getDay());
      const demand = Math.round(avg * (weekend ? 1.35 : 1.05) + context.campaigns.length * 0.2);
      return { date: date.toISOString().slice(0, 10), demand, staffingNeed: Math.max(1, Math.ceil(demand / 5)) };
    });
    return {
      title: "AI demand forecasting",
      demandIndex: Math.round((forecast.reduce((sum, item) => sum + item.demand, 0) / Math.max(1, forecast.length)) * 10),
      forecast,
      actions: ["Adjust staff shifts", "Prepare campaign slots", "Confirm inventory for peak days"],
      confidence: 0.83
    };
  }

  inventoryPrediction(_payload, context) {
    const suggestions = context.products
      .filter((product) => Number(product.stock || 0) <= Number(product.lowStockThreshold || 0) + 3)
      .map((product) => ({
        productId: product.id,
        product: product.name,
        stock: Number(product.stock || 0),
        suggestedOrder: Math.max(5, Number(product.lowStockThreshold || 5) * 2 - Number(product.stock || 0)),
        urgency: Number(product.stock || 0) <= Number(product.lowStockThreshold || 0) ? "high" : "medium"
      }));
    return {
      title: "AI inventory prediction",
      suggestions,
      stockoutRisk: suggestions.filter((item) => item.urgency === "high").length,
      actions: ["Create purchase entry", "Notify supplier", "Reduce campaign on unavailable services"],
      confidence: 0.85
    };
  }

  voiceBookingAssistant(payload, context, access) {
    const phrase = payload.transcript || payload.prompt || "Book hair color tomorrow evening";
    const service = context.services.find((item) => phrase.toLowerCase().includes(String(item.name).toLowerCase().split(" ")[0])) || context.services[0];
    const branchId = payload.branchId || context.branchId || context.branches[0]?.id || "";
    const recommendations = service
      ? smartBookingService.recommendSlots({ branchId, serviceIds: [service.id], source: "voice", limit: 3 }, access).recommendations
      : [];
    const session = repositories.voiceBookingSessions.create({
      id: makeId("voice"),
      branchId,
      clientId: payload.clientId || "",
      channel: payload.channel || "voice",
      transcript: [{ at: now(), speaker: "client", text: phrase }],
      entities: { serviceId: service?.id || "", serviceName: service?.name || "", branchId },
      actions: recommendations.map((slot) => ({ type: "slot-option", slot })),
      status: "active"
    }, scope(access, branchId));
    return {
      title: "Voice booking assistant",
      session,
      reply: recommendations.length ? `I found ${recommendations.length} available slots for ${service.name}.` : "I could not find a slot yet.",
      recommendedSlots: recommendations,
      actions: ["Confirm slot", "Send WhatsApp confirmation", "Create appointment"],
      confidence: 0.81
    };
  }

  smartKioskMode(payload, context, access) {
    const branchId = payload.branchId || context.branchId || context.branches[0]?.id || "";
    const queue = smartBookingService.queuePrediction({ branchId }, access);
    const session = repositories.kioskSessions.create({
      id: makeId("kiosk"),
      branchId,
      clientId: payload.clientId || "",
      mode: payload.mode || "self-check-in",
      state: {
        screen: "welcome",
        estimatedWait: queue.predictedWaitMinutes,
        language: payload.language || "en-IN"
      },
      events: [{ at: now(), event: "session-started" }],
      status: "active"
    }, scope(access, branchId));
    return {
      title: "Smart kiosk mode",
      session,
      queue,
      actions: ["QR check-in", "Consent capture", "Upsell recommendation", "Queue status display"],
      confidence: 0.86
    };
  }

  aiReceptionist(payload, context) {
    const intent = payload.intent || "booking";
    return {
      title: "AI receptionist",
      intent,
      script: intent === "complaint"
        ? "I am sorry about that. I can alert the manager and arrange a priority follow-up."
        : "I can help you book, reschedule, check prices, redeem membership credits or join the waitlist.",
      routing: {
        booking: "smart-booking",
        payment: "pos",
        complaint: "human-handoff",
        membership: "memberships"
      },
      actions: ["Classify intent", "Offer next best action", "Escalate when confidence is low"],
      context: { openBookings: context.appointments.filter((item) => item.status === "booked").length },
      confidence: 0.87
    };
  }
}

export const futureFeaturesService = new FutureFeaturesService();
