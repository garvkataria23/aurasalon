import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { tenantService } from "./tenant.service.js";
import { badRequest, forbidden, notFound } from "../utils/app-error.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const pct = (value) => Math.round((Number(value) || 0) * 100) / 100;

function ensureSuperAdmin(access = {}) {
  if (access.role !== "superAdmin") throw forbidden("Super admin access is required");
}

function count(table, tenantId = "") {
  if (tenantId) return db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE tenantId = ?`).get(tenantId).count;
  return db.prepare(`SELECT COUNT(*) AS count FROM ${table}`).get().count;
}

function sumRows(items, selector) {
  return items.reduce((total, item) => total + Number(selector(item) || 0), 0);
}

function share(part, total) {
  return total ? pct((Number(part || 0) / total) * 100) : 0;
}

function tenantHealth(tenant, rows) {
  const overdue = tenant.subscriptionStatus === "suspended" || tenant.status === "suspended";
  const activityScore = Math.min(100, rows.appointments * 5 + rows.sales * 8 + rows.clients * 2);
  const subscriptionScore = overdue ? 5 : tenant.subscriptionStatus === "trialing" ? 72 : 95;
  return pct((activityScore + subscriptionScore) / 2);
}

function daysUntil(dateValue) {
  if (!dateValue) return null;
  const target = new Date(dateValue).getTime();
  if (Number.isNaN(target)) return null;
  return Math.ceil((target - Date.now()) / 86400000);
}

function healthBreakdown(tenant, usage, outstanding, monthlyRecurringRevenue) {
  const subscriptionScore = tenant.subscriptionStatus === "suspended" || tenant.status === "suspended"
    ? 5
    : tenant.subscriptionStatus === "trialing"
      ? 72
      : 95;
  const usageScore = Math.min(100, usage.appointments * 5 + usage.sales * 8 + usage.clients * 2);
  const billingScore = outstanding <= 0
    ? 100
    : Math.max(20, 100 - share(outstanding, Math.max(monthlyRecurringRevenue, 1)));
  const readinessScore = pct((Number(Boolean(tenant.primaryDomain)) * 35) + Math.min(35, usage.branches * 12) + Math.min(30, usage.staff * 2));
  return {
    subscriptionScore: pct(subscriptionScore),
    usageScore: pct(usageScore),
    billingScore: pct(billingScore),
    readinessScore,
    overall: pct((subscriptionScore + usageScore + billingScore + readinessScore) / 4)
  };
}

function tenantRiskAlerts(tenant) {
  const alerts = [];
  const trialDaysLeft = daysUntil(tenant.trialEndsAt);
  if (tenant.subscriptionStatus === "suspended" || tenant.status === "suspended") {
    alerts.push({ severity: "high", type: "subscription", title: "Tenant suspended", message: "Reactivate only after billing and owner approval checks are clear." });
  }
  if (tenant.outstanding > 0) {
    alerts.push({
      severity: tenant.outstanding > tenant.monthlyRecurringRevenue ? "high" : "medium",
      type: "billing",
      title: "Outstanding billing",
      message: `Collect INR ${tenant.outstanding} before extending plan access.`
    });
  }
  if (trialDaysLeft !== null && trialDaysLeft >= 0 && trialDaysLeft <= 7) {
    alerts.push({ severity: "medium", type: "trial", title: "Trial ending soon", message: `${trialDaysLeft} days left to convert this tenant.` });
  }
  if (tenant.healthScore < 45) {
    alerts.push({ severity: "high", type: "health", title: "Low health score", message: "Usage, billing and setup health need immediate review." });
  } else if (tenant.healthScore < 70) {
    alerts.push({ severity: "medium", type: "health", title: "Health score watch", message: "Monitor adoption before this tenant becomes a churn risk." });
  }
  if (!tenant.primaryDomain) {
    alerts.push({ severity: "low", type: "readiness", title: "Domain not configured", message: "White-label readiness is incomplete for this salon." });
  }
  if (!tenant.usage.appointments || !tenant.usage.clients) {
    alerts.push({ severity: "medium", type: "adoption", title: "Low platform adoption", message: "Client or appointment activity is missing." });
  }
  return alerts;
}

function tenantActions(tenant) {
  const actions = [];
  if (tenant.outstanding > 0) actions.push("Collect outstanding billing balance");
  if (tenant.subscriptionStatus === "trialing") actions.push("Schedule trial conversion follow-up");
  if (tenant.subscriptionStatus === "suspended") actions.push("Review suspension reason before reactivation");
  if (!tenant.primaryDomain) actions.push("Complete domain and white-label setup");
  if (tenant.healthScore < 70) actions.push("Run adoption review for branches, staff and booking usage");
  return actions.length ? actions : ["Tenant is healthy; continue normal account monitoring"];
}

function tenant360(tenant) {
  const alerts = tenantRiskAlerts(tenant);
  return {
    profile: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug,
      ownerEmail: tenant.ownerEmail,
      primaryDomain: tenant.primaryDomain,
      status: tenant.status,
      subscriptionStatus: tenant.subscriptionStatus,
      planName: tenant.planName,
      trialEndsAt: tenant.trialEndsAt,
      trialDaysLeft: daysUntil(tenant.trialEndsAt)
    },
    billing: {
      monthlyRecurringRevenue: tenant.monthlyRecurringRevenue,
      meteredUsageRevenue: tenant.meteredUsageRevenue,
      totalBillingAmount: tenant.totalBillingAmount,
      transactionRevenue: tenant.transactionRevenue,
      outstanding: tenant.outstanding
    },
    usage: tenant.usage,
    health: tenant.healthBreakdown,
    alerts,
    alertSummary: {
      total: alerts.length,
      high: alerts.filter((alert) => alert.severity === "high").length,
      medium: alerts.filter((alert) => alert.severity === "medium").length,
      low: alerts.filter((alert) => alert.severity === "low").length
    },
    recommendedActions: tenantActions(tenant)
  };
}

function clampPercent(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value ?? 100))));
}

function normalizeRules(rules = {}) {
  if (typeof rules === "string") {
    try {
      return JSON.parse(rules || "{}");
    } catch {
      return {};
    }
  }
  return rules && typeof rules === "object" ? rules : {};
}

function enrichFeatureToggle(toggle, tenants, plans) {
  const rules = normalizeRules(toggle.rules);
  const rolloutPercentage = clampPercent(rules.rolloutPercentage);
  const expiresAt = rules.expiresAt || "";
  const killSwitch = Boolean(rules.killSwitch);
  const isExpired = expiresAt ? String(expiresAt).slice(0, 10) < now().slice(0, 10) : false;
  const targetTenant = toggle.tenantId ? tenants.find((tenant) => tenant.id === toggle.tenantId) : null;
  const targetPlan = toggle.planId ? plans.find((plan) => plan.id === toggle.planId) : null;
  const targetSummary = targetTenant?.name || targetPlan?.name || (toggle.scope === "global" ? "All tenants" : toggle.scope);
  const guardrails = [];
  if (killSwitch) guardrails.push("Kill switch armed");
  if (isExpired) guardrails.push("Expired");
  if (rolloutPercentage < 100) guardrails.push(`${rolloutPercentage}% rollout`);
  if (rules.dependencyKey) guardrails.push(`Depends on ${rules.dependencyKey}`);
  const statusLabel = killSwitch
    ? "killed"
    : !toggle.enabled
      ? "disabled"
      : isExpired
        ? "expired"
        : rolloutPercentage < 100
          ? "partial"
          : "enabled";
  return {
    ...toggle,
    rules: { ...rules, rolloutPercentage, expiresAt, killSwitch },
    rolloutPercentage,
    expiresAt,
    killSwitch,
    dependencyKey: rules.dependencyKey || "",
    targetSummary,
    isExpired,
    statusLabel,
    guardrails
  };
}

function featureFlagCommand(featureToggles) {
  return {
    total: featureToggles.length,
    enabled: featureToggles.filter((toggle) => toggle.statusLabel === "enabled" || toggle.statusLabel === "partial").length,
    partialRollouts: featureToggles.filter((toggle) => toggle.rolloutPercentage < 100 && !toggle.killSwitch).length,
    killSwitches: featureToggles.filter((toggle) => toggle.killSwitch).length,
    expired: featureToggles.filter((toggle) => toggle.isExpired).length,
    tenantScoped: featureToggles.filter((toggle) => toggle.scope === "tenant").length,
    planScoped: featureToggles.filter((toggle) => toggle.scope === "plan").length,
    attention: featureToggles
      .filter((toggle) => toggle.killSwitch || toggle.isExpired || !toggle.enabled)
      .slice(0, 6)
      .map((toggle) => ({
        id: toggle.id,
        key: toggle.key,
        name: toggle.name,
        statusLabel: toggle.statusLabel,
        targetSummary: toggle.targetSummary,
        guardrails: toggle.guardrails
      }))
  };
}

function requireSafetyConfirmation(payload = {}, action = "action") {
  const reason = String(payload.reason || "").trim();
  const confirmation = String(payload.confirmation || "").trim();
  if (reason.length < 8) throw badRequest(`Safety reason is required for ${action}`);
  if (confirmation !== "CONFIRM") throw badRequest(`Type CONFIRM to approve ${action}`);
  return { reason, confirmation };
}

function actionSafetyCommand(tenantRows, featureToggles) {
  const auditRows = repositories.superAdminAudit.list({ limit: 200 }).sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
  const resolvedIds = new Set(
    auditRows
      .filter((row) => row.action === "super_admin.action_approval.resolved")
      .map((row) => normalizeRules(row.details).requestId)
      .filter(Boolean)
  );
  const pendingApprovals = auditRows
    .filter((row) => row.action === "super_admin.action_approval.requested" && !resolvedIds.has(row.id))
    .map((row) => {
      const details = normalizeRules(row.details);
      return {
        id: row.id,
        action: details.action || row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        reason: details.reason || "",
        priority: details.priority || "medium",
        requestedBy: row.actorUserId,
        createdAt: row.createdAt
      };
    });
  const requiredReviews = [
    ...tenantRows
      .filter((tenant) => tenant.subscriptionStatus === "suspended" || tenant.status === "suspended")
      .slice(0, 6)
      .map((tenant) => ({
        targetType: "tenant",
        targetId: tenant.id,
        name: tenant.name,
        action: "reactivation.review",
        severity: "high",
        reason: "Tenant is suspended; require reason and confirmation before reactivation."
      })),
    ...featureToggles
      .filter((toggle) => toggle.killSwitch)
      .slice(0, 6)
      .map((toggle) => ({
        targetType: "feature_toggle",
        targetId: toggle.id,
        name: toggle.name,
        action: "kill_switch.review",
        severity: "high",
        reason: "Kill switch is armed; review before enabling or rollout changes."
      }))
  ];
  return {
    pendingApprovals,
    requiredReviews,
    timeline: auditRows.slice(0, 12).map((row) => {
      const details = normalizeRules(row.details);
      return {
        id: row.id,
        action: row.action,
        targetType: row.targetType,
        targetId: row.targetId,
        actorUserId: row.actorUserId,
        createdAt: row.createdAt,
        reason: details.reason || "",
        status: details.status || "",
        summary: details.key || details.action || details.status || details.reason || ""
      };
    }),
    stats: {
      pending: pendingApprovals.length,
      requiredReviews: requiredReviews.length,
      recentActions: auditRows.length
    }
  };
}

function revenueCommand(metrics, tenants, plans) {
  const activeTenants = tenants.filter((tenant) => ["active", "trialing"].includes(tenant.subscriptionStatus));
  const planMix = plans.map((plan) => {
    const planTenants = tenants.filter((tenant) => tenant.planId === plan.id);
    const mrr = money(sumRows(planTenants, (tenant) => tenant.monthlyRecurringRevenue));
    return {
      planId: plan.id,
      name: plan.name,
      tenantCount: planTenants.length,
      mrr,
      arr: money(mrr * 12),
      sharePct: share(mrr, metrics.monthlyRecurringRevenue),
      averageHealth: planTenants.length ? pct(sumRows(planTenants, (tenant) => tenant.healthScore) / planTenants.length) : 0
    };
  }).sort((a, b) => b.mrr - a.mrr);
  const statusMix = ["active", "trialing", "suspended", "cancelled"].map((status) => ({
    status,
    tenants: tenants.filter((tenant) => tenant.subscriptionStatus === status).length,
    mrr: money(sumRows(tenants.filter((tenant) => tenant.subscriptionStatus === status), (tenant) => tenant.monthlyRecurringRevenue))
  })).filter((row) => row.tenants || row.mrr);
  const suspendedMrrAtRisk = money(sumRows(tenants.filter((tenant) => tenant.subscriptionStatus === "suspended"), (tenant) => tenant.monthlyRecurringRevenue));
  const trialMrr = money(sumRows(tenants.filter((tenant) => tenant.subscriptionStatus === "trialing"), (tenant) => tenant.monthlyRecurringRevenue));
  return {
    arr: money(metrics.monthlyRecurringRevenue * 12),
    arpu: activeTenants.length ? money(metrics.monthlyRecurringRevenue / activeTenants.length) : 0,
    revenueQuality: share(metrics.monthlyRecurringRevenue, metrics.monthlyRecurringRevenue + metrics.outstanding),
    outstanding: metrics.outstanding,
    suspendedMrrAtRisk,
    trialMrr,
    planMix,
    statusMix,
    topRevenueTenants: tenants
      .slice()
      .sort((a, b) => b.totalBillingAmount - a.totalBillingAmount)
      .slice(0, 5)
      .map((tenant) => ({
        id: tenant.id,
        name: tenant.name,
        planName: tenant.planName,
        subscriptionStatus: tenant.subscriptionStatus,
        totalBillingAmount: tenant.totalBillingAmount,
        monthlyRecurringRevenue: tenant.monthlyRecurringRevenue,
        transactionRevenue: tenant.transactionRevenue,
        outstanding: tenant.outstanding,
        healthScore: tenant.healthScore
      })),
    revenueRisks: tenants
      .filter((tenant) => tenant.outstanding > 0 || tenant.subscriptionStatus === "suspended" || tenant.healthScore < 45)
      .sort((a, b) => (b.outstanding + b.monthlyRecurringRevenue) - (a.outstanding + a.monthlyRecurringRevenue))
      .slice(0, 6)
      .map((tenant) => ({
        tenantId: tenant.id,
        tenantName: tenant.name,
        severity: tenant.subscriptionStatus === "suspended" || tenant.outstanding > tenant.monthlyRecurringRevenue ? "high" : "medium",
        reason: tenant.subscriptionStatus === "suspended"
          ? "Subscription is suspended"
          : tenant.outstanding > 0
            ? "Outstanding billing balance"
            : "Low tenant health score",
        amountAtRisk: money(tenant.outstanding + tenant.monthlyRecurringRevenue),
        healthScore: tenant.healthScore
      }))
  };
}

export class SuperAdminService {
  overview(access) {
    ensureSuperAdmin(access);
    const tenants = repositories.tenants.list({ limit: 10000 });
    const plans = repositories.subscriptionPlans.list({ limit: 10000 });
    const subscriptions = repositories.subscriptions.list({ limit: 10000 });
    const sales = repositories.sales.list({ limit: 100000 });
    const invoices = repositories.invoices.list({ limit: 100000 });
    const planById = new Map(plans.map((plan) => [plan.id, plan]));
    const subscriptionByTenant = new Map(subscriptions.map((sub) => [sub.tenantId, sub]));
    const tenantRows = tenants.map((tenant) => {
      const tenantSales = sales.filter((sale) => sale.tenantId === tenant.id);
      const tenantInvoices = invoices.filter((invoice) => invoice.tenantId === tenant.id);
      const plan = planById.get(tenant.planId);
      const billingPreview = tenantService.billingPreview(tenant.id);
      const usage = {
        branches: count("branches", tenant.id),
        staff: count("staff", tenant.id),
        clients: count("clients", tenant.id),
        appointments: count("appointments", tenant.id),
        sales: tenantSales.length,
        campaigns: count("campaigns", tenant.id)
      };
      const monthlyRecurringRevenue = Number(plan?.priceMonthly || 0);
      const outstanding = money(sumRows(tenantInvoices.filter((invoice) => invoice.status !== "paid"), (invoice) => invoice.balance));
      const health = healthBreakdown(tenant, usage, outstanding, monthlyRecurringRevenue);
      const row = {
        id: tenant.id,
        name: tenant.name,
        slug: tenant.slug,
        ownerEmail: tenant.ownerEmail,
        status: tenant.status,
        subscriptionStatus: tenant.subscriptionStatus,
        trialEndsAt: tenant.trialEndsAt,
        primaryDomain: tenant.primaryDomain,
        planName: plan?.name || tenant.planId,
        planId: tenant.planId,
        monthlyRecurringRevenue,
        meteredUsageRevenue: Number(billingPreview.usageAmount || 0),
        billingPreview,
        totalBillingAmount: Number(billingPreview.totalAmount || 0),
        transactionRevenue: money(sumRows(tenantSales, (sale) => sale.total)),
        outstanding,
        usage,
        healthBreakdown: health,
        healthScore: tenantHealth(tenant, usage),
        subscription: subscriptionByTenant.get(tenant.id) || null
      };
      return { ...row, tenant360: tenant360(row) };
    });
    const metrics = {
      salons: tenants.length,
      activeSalons: tenants.filter((tenant) => ["active", "trialing"].includes(tenant.subscriptionStatus)).length,
      suspendedSalons: tenants.filter((tenant) => tenant.subscriptionStatus === "suspended" || tenant.status === "suspended").length,
      trialSalons: tenants.filter((tenant) => tenant.subscriptionStatus === "trialing").length,
      monthlyRecurringRevenue: money(sumRows(tenantRows, (tenant) => tenant.monthlyRecurringRevenue)),
      meteredUsageRevenue: money(sumRows(tenantRows, (tenant) => tenant.meteredUsageRevenue)),
      totalPlatformBilling: money(sumRows(tenantRows, (tenant) => tenant.totalBillingAmount)),
      transactionRevenue: money(sumRows(tenantRows, (tenant) => tenant.transactionRevenue)),
      outstanding: money(sumRows(tenantRows, (tenant) => tenant.outstanding)),
      averageHealth: tenantRows.length ? pct(sumRows(tenantRows, (tenant) => tenant.healthScore) / tenantRows.length) : 0
    };
    const featureToggles = repositories.featureToggles.list({ limit: 10000 })
      .map((toggle) => enrichFeatureToggle(toggle, tenantRows, plans));
    return {
      metrics,
      tenants: tenantRows.sort((a, b) => b.monthlyRecurringRevenue - a.monthlyRecurringRevenue),
      plans,
      featureToggles,
      featureFlagCommand: featureFlagCommand(featureToggles),
      actionSafetyCommand: actionSafetyCommand(tenantRows, featureToggles),
      revenueCommand: revenueCommand(metrics, tenantRows, plans),
      tenantRiskCommand: {
        alertCount: sumRows(tenantRows, (tenant) => tenant.tenant360.alertSummary.total),
        highRiskTenants: tenantRows
          .filter((tenant) => tenant.tenant360.alertSummary.high || tenant.healthScore < 45)
          .sort((a, b) => b.tenant360.alertSummary.high - a.tenant360.alertSummary.high || a.healthScore - b.healthScore)
          .slice(0, 8)
          .map((tenant) => ({
            id: tenant.id,
            name: tenant.name,
            healthScore: tenant.healthScore,
            alerts: tenant.tenant360.alertSummary,
            topAlert: tenant.tenant360.alerts[0] || null
          }))
      },
      insights: this.insights(metrics, tenantRows)
    };
  }

  analytics(input = {}, access) {
    ensureSuperAdmin(access);
    const periodEnd = input.periodEnd || now().slice(0, 10);
    const periodStart = input.periodStart || new Date(Date.now() - 89 * 86400000).toISOString().slice(0, 10);
    const overview = this.overview(access);
    const sales = repositories.sales.list({ limit: 100000 }).filter((sale) => {
      const key = String(sale.createdAt || "").slice(0, 10);
      return (!periodStart || key >= periodStart) && (!periodEnd || key <= periodEnd);
    });
    const planMix = overview.plans.map((plan) => ({
      planId: plan.id,
      name: plan.name,
      tenants: overview.tenants.filter((tenant) => tenant.planId === plan.id).length,
      mrr: money(sumRows(overview.tenants.filter((tenant) => tenant.planId === plan.id), (tenant) => tenant.monthlyRecurringRevenue))
    }));
    const metrics = {
      ...overview.metrics,
      periodStart,
      periodEnd,
      periodTransactionRevenue: money(sumRows(sales, (sale) => sale.total)),
      planMix,
      topTenants: overview.tenants.slice(0, 8)
    };
    const insights = this.insights(overview.metrics, overview.tenants);
    const snapshot = repositories.platformAnalytics.create({
      id: makeId("plat"),
      type: input.type || "global",
      periodStart,
      periodEnd,
      metrics,
      insights,
      status: "generated"
    });
    this.audit(access, "platform.analytics.generated", "platform_analytics_snapshot", snapshot.id, { periodStart, periodEnd });
    return { snapshot, metrics, insights };
  }

  suspendTenant(tenantId, payload = {}, access) {
    ensureSuperAdmin(access);
    const safety = requireSafetyConfirmation(payload, "tenant suspension/reactivation");
    const tenant = repositories.tenants.getById(tenantId);
    if (!tenant) throw notFound("Tenant not found");
    const status = payload.status || "suspended";
    const updatedTenant = repositories.tenants.update(tenantId, {
      status,
      subscriptionStatus: status === "suspended" ? "suspended" : "active"
    });
    const subscription = db.prepare("SELECT id FROM subscriptions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1").get(tenantId);
    if (subscription) {
      repositories.subscriptions.update(subscription.id, {
        status: status === "suspended" ? "suspended" : "active",
        cancelAt: status === "suspended" ? now() : ""
      }, { tenantId });
    }
    this.audit(access, status === "suspended" ? "tenant.suspended" : "tenant.reactivated", "tenant", tenantId, { reason: safety.reason, confirmation: safety.confirmation });
    return updatedTenant;
  }

  updateTenantSubscription(tenantId, payload = {}, access) {
    ensureSuperAdmin(access);
    const safety = requireSafetyConfirmation(payload, "subscription update");
    if (!payload.planId && !payload.status) throw badRequest("planId or status is required");
    const tenant = repositories.tenants.getById(tenantId);
    if (!tenant) throw notFound("Tenant not found");
    const plan = payload.planId ? repositories.subscriptionPlans.getById(payload.planId) : null;
    if (payload.planId && !plan) throw badRequest("Plan does not exist");
    const updatedTenant = repositories.tenants.update(tenantId, {
      planId: payload.planId || tenant.planId,
      subscriptionStatus: payload.status || tenant.subscriptionStatus,
      status: payload.status === "suspended" ? "suspended" : tenant.status === "suspended" ? "active" : tenant.status
    });
    const existing = db.prepare("SELECT id FROM subscriptions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1").get(tenantId);
    const subscriptionPayload = {
      planId: payload.planId || tenant.planId,
      status: payload.status || tenant.subscriptionStatus,
      currentPeriodStart: payload.currentPeriodStart || now(),
      currentPeriodEnd: payload.currentPeriodEnd || new Date(Date.now() + 30 * 86400000).toISOString()
    };
    const subscription = existing
      ? repositories.subscriptions.update(existing.id, subscriptionPayload, { tenantId })
      : repositories.subscriptions.create({ id: makeId("sub"), ...subscriptionPayload }, { tenantId });
    this.audit(access, "tenant.subscription.updated", "tenant", tenantId, { planId: subscriptionPayload.planId, status: subscriptionPayload.status, reason: safety.reason, confirmation: safety.confirmation });
    return { tenant: updatedTenant, subscription, plan: plan || repositories.subscriptionPlans.getById(updatedTenant.planId) };
  }

  requestActionApproval(payload = {}, access) {
    ensureSuperAdmin(access);
    const safety = requireSafetyConfirmation(payload, "approval request");
    if (!payload.action || !payload.targetType || !payload.targetId) throw badRequest("action, targetType and targetId are required");
    return this.audit(access, "super_admin.action_approval.requested", payload.targetType, payload.targetId, {
      action: payload.action,
      reason: safety.reason,
      confirmation: safety.confirmation,
      priority: payload.priority || "medium",
      status: "pending",
      requestedAt: now()
    });
  }

  resolveActionApproval(requestId, payload = {}, access) {
    ensureSuperAdmin(access);
    const safety = requireSafetyConfirmation(payload, "approval resolution");
    const request = repositories.superAdminAudit.getById(requestId);
    if (!request || request.action !== "super_admin.action_approval.requested") throw notFound("Approval request not found");
    const status = ["approved", "rejected"].includes(payload.status) ? payload.status : "";
    if (!status) throw badRequest("status must be approved or rejected");
    return this.audit(access, "super_admin.action_approval.resolved", request.targetType, request.targetId, {
      requestId,
      status,
      reason: safety.reason,
      confirmation: safety.confirmation,
      resolvedAt: now()
    });
  }

  createPlan(payload = {}, access) {
    ensureSuperAdmin(access);
    if (!payload.name || !payload.code) throw badRequest("name and code are required");
    const existing = repositories.subscriptionPlans.list({ limit: 10000 }).find((plan) => plan.code === payload.code);
    if (existing) throw badRequest("Plan code already exists");
    const plan = repositories.subscriptionPlans.create({
      id: payload.id || makeId("plan"),
      name: payload.name,
      code: payload.code,
      priceMonthly: Number(payload.priceMonthly || 0),
      trialDays: Number(payload.trialDays || 14),
      limits: payload.limits || {},
      features: payload.features || [],
      status: payload.status || "active"
    });
    this.audit(access, "plan.created", "subscription_plan", plan.id, { code: plan.code });
    return plan;
  }

  updatePlan(planId, payload = {}, access) {
    ensureSuperAdmin(access);
    const plan = repositories.subscriptionPlans.getById(planId);
    if (!plan) throw notFound("Plan not found");
    const updated = repositories.subscriptionPlans.update(planId, {
      name: payload.name ?? plan.name,
      code: payload.code ?? plan.code,
      priceMonthly: Number(payload.priceMonthly ?? plan.priceMonthly),
      trialDays: Number(payload.trialDays ?? plan.trialDays),
      limits: payload.limits ?? plan.limits,
      features: payload.features ?? plan.features,
      status: payload.status ?? plan.status
    });
    this.audit(access, "plan.updated", "subscription_plan", planId, payload);
    return updated;
  }

  upsertFeatureToggle(payload = {}, access) {
    ensureSuperAdmin(access);
    if (!payload.key || !payload.name) throw badRequest("key and name are required");
    const scope = payload.scope || "global";
    if (scope === "tenant" && !payload.tenantId) throw badRequest("tenantId is required for tenant-scoped flags");
    if (scope === "plan" && !payload.planId) throw badRequest("planId is required for plan-scoped flags");
    if (payload.tenantId && !repositories.tenants.getById(payload.tenantId)) throw badRequest("Tenant target does not exist");
    if (payload.planId && !repositories.subscriptionPlans.getById(payload.planId)) throw badRequest("Plan target does not exist");
    const existing = repositories.featureToggles.list({ limit: 10000 }).find((toggle) => toggle.key === payload.key);
    const rules = {
      ...normalizeRules(payload.rules),
      rolloutPercentage: clampPercent(payload.rolloutPercentage ?? normalizeRules(payload.rules).rolloutPercentage),
      expiresAt: payload.expiresAt || normalizeRules(payload.rules).expiresAt || "",
      killSwitch: Boolean(payload.killSwitch ?? normalizeRules(payload.rules).killSwitch),
      dependencyKey: payload.dependencyKey || normalizeRules(payload.rules).dependencyKey || "",
      updatedBy: access.userId || "system",
      updatedAt: now()
    };
    const record = {
      key: payload.key,
      name: payload.name,
      description: payload.description || "",
      scope,
      tenantId: scope === "tenant" ? payload.tenantId || "" : "",
      planId: scope === "plan" ? payload.planId || "" : "",
      enabled: rules.killSwitch ? 0 : payload.enabled ? 1 : 0,
      rules
    };
    const toggle = existing
      ? repositories.featureToggles.update(existing.id, record)
      : repositories.featureToggles.create({ id: makeId("ft"), ...record });
    this.audit(access, existing ? "feature_toggle.updated" : "feature_toggle.created", "feature_toggle", toggle.id, {
      key: toggle.key,
      enabled: toggle.enabled,
      scope: record.scope,
      tenantId: record.tenantId,
      planId: record.planId,
      rules
    });
    return toggle;
  }

  setFeatureToggleEnabled(id, enabled, access) {
    ensureSuperAdmin(access);
    const row = repositories.featureToggles.getById(id);
    if (!row) throw notFound("Feature toggle not found");
    const updated = repositories.featureToggles.update(id, { enabled: enabled ? 1 : 0, updatedAt: now() });
    this.audit(access, "feature_toggle.enabled_changed", "feature_toggle", id, { key: row.key, enabled: !!enabled });
    return updated;
  }

  deleteFeatureToggle(id, access) {
    ensureSuperAdmin(access);
    const row = repositories.featureToggles.getById(id);
    if (!row) throw notFound("Feature toggle not found");
    repositories.featureToggles.delete(id);
    this.audit(access, "feature_toggle.deleted", "feature_toggle", id, { key: row.key });
    return { ok: true, id };
  }

  audit(access, action, targetType, targetId, details = {}) {
    return repositories.superAdminAudit.create({
      id: makeId("audit"),
      actorUserId: access.userId || "system",
      action,
      targetType,
      targetId,
      details,
      createdAt: now()
    });
  }

  insights(metrics, tenants) {
    const insights = [];
    insights.push(`Platform MRR is INR ${metrics.monthlyRecurringRevenue} across ${metrics.salons} salons.`);
    if (metrics.suspendedSalons) insights.push(`${metrics.suspendedSalons} salons are suspended and need account review.`);
    const weak = tenants.filter((tenant) => tenant.healthScore < 45);
    if (weak.length) insights.push(`${weak.length} tenants have low health scores; review usage, support tickets and payment status.`);
    const top = tenants[0];
    if (top) insights.push(`${top.name} leads platform revenue with INR ${top.monthlyRecurringRevenue} MRR and INR ${top.transactionRevenue} tenant sales.`);
    return insights;
  }
}

export const superAdminService = new SuperAdminService();
