import { DEFAULT_TENANT_ID, columnsFor, db } from "../db.js";
import { repositories, repositoryForTable } from "../repositories/repository-registry.js";
import { badRequest, conflict, forbidden, notFound } from "../utils/app-error.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

const limitResourceMap = {
  branches: { metric: "branches", table: "branches" },
  staff: { metric: "staff", table: "staff" },
  clients: { metric: "clients", table: "clients" },
  appointments: { metric: "monthlyAppointments", table: "appointments" },
  marketing: { metric: "campaigns", table: "campaigns" }
};

const meteredUsageCatalog = [
  { key: "aiRequests", label: "AI requests", prefixes: ["ai:"], included: { starter: 100, growth: 1000, enterprise: 10000 }, unitPrice: 2 },
  { key: "whatsappMessages", label: "WhatsApp messages", prefixes: ["whatsapp:"], included: { starter: 250, growth: 2500, enterprise: 25000 }, unitPrice: 0.25 },
  { key: "workflowRuns", label: "Workflow runs", prefixes: ["workflow:"], included: { starter: 50, growth: 500, enterprise: 5000 }, unitPrice: 1 },
  { key: "analyticsSnapshots", label: "Analytics snapshots", prefixes: ["analytics:"], included: { starter: 10, growth: 100, enterprise: 1000 }, unitPrice: 5 },
  { key: "innovationRuns", label: "Future feature runs", prefixes: ["innovation:"], included: { starter: 0, growth: 25, enterprise: 250 }, unitPrice: 10 }
];

export class TenantService {
  resolveTenant({ tenantId = "", host = "" } = {}) {
    if (tenantId) {
      const tenant = repositories.tenants?.getById ? repositories.tenants.getById(tenantId) : repositoryForTable("tenants").getById(tenantId);
      if (tenant) return tenant;
      return null;
    }

    const domain = String(host || "").split(":")[0].toLowerCase();
    if (domain) {
      const mapping = db.prepare("SELECT * FROM domain_mappings WHERE lower(domain) = lower(?)").get(domain);
      if (mapping?.tenantId) {
        const tenant = repositoryForTable("tenants").getById(mapping.tenantId);
        if (tenant) return tenant;
      }
    }

    return repositoryForTable("tenants").getById(DEFAULT_TENANT_ID);
  }

  getTenantUser({ tenantId, userId = "", email = "", fallbackRole = "owner", fallbackBranchId = "" }) {
    const byId = userId
      ? db.prepare("SELECT * FROM tenant_users WHERE tenantId = ? AND id = ?").get(tenantId, userId)
      : null;
    const byEmail = !byId && email
      ? db.prepare("SELECT * FROM tenant_users WHERE tenantId = ? AND lower(email) = lower(?)").get(tenantId, email)
      : null;
    const row = byId || byEmail;
    if (!row) {
      return {
        id: userId || "system-user",
        email,
        role: fallbackRole,
        branchIds: fallbackBranchId ? [fallbackBranchId] : [],
        branchId: fallbackBranchId
      };
    }
    const user = repositories.tenantUsers.getById(row.id, { tenantId });
    return {
      ...user,
      branchId: fallbackBranchId || user.branchIds?.[0] || ""
    };
  }

  accessScope(access, resource = "") {
    const scope = { tenantId: access.tenantId };
    const branchLimited = ["staff", "frontDesk"].includes(access.role);
    if (access.branchId && (branchLimited || access.requestedBranchId)) {
      scope.branchId = access.branchId;
    }
    return scope;
  }

  assertBranchAccess(access, branchId) {
    if (!branchId || ["superAdmin", "owner", "admin", "manager", "analyst"].includes(access.role)) return;
    const allowed = access.branchIds || [];
    if (!allowed.length || !allowed.includes(branchId)) {
      throw forbidden("This user does not have access to the requested branch");
    }
  }

  ensureSubscriptionActive(tenantId) {
    const tenant = repositoryForTable("tenants").getById(tenantId);
    if (!tenant) throw notFound("Tenant not found");
    if (["active", "trialing"].includes(tenant.subscriptionStatus)) return tenant;
    throw forbidden("Tenant subscription is not active");
  }

  enforceUsageLimit(tenantId, resource) {
    const target = limitResourceMap[resource];
    if (!target) return;
    const tenant = this.ensureSubscriptionActive(tenantId);
    const plan = tenant.planId ? repositoryForTable("subscription_plans").getById(tenant.planId) : null;
    const limit = plan?.limits?.[target.metric];
    if (!limit) return;
    const repo = repositoryForTable(target.table);
    const current = repo.count({ tenantId });
    if (current >= Number(limit)) {
      throw conflict(`Usage limit reached for ${target.metric}. Current plan allows ${limit}.`, {
        metric: target.metric,
        limit,
        current
      });
    }
  }

  recordUsage({ tenantId, metric, quantity = 1, referenceType = "", referenceId = "" }) {
    return repositoryForTable("usage_events").create(
      {
        id: makeId("usage"),
        metric,
        quantity,
        periodStart: now().slice(0, 7),
        periodEnd: "",
        referenceType,
        referenceId
      },
      { tenantId }
    );
  }

  getContext(access) {
    const tenant = repositoryForTable("tenants").getById(access.tenantId);
    const subscription = db.prepare("SELECT * FROM subscriptions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1").get(access.tenantId);
    const plan = tenant?.planId ? repositoryForTable("subscription_plans").getById(tenant.planId) : null;
    const domains = repositoryForTable("domain_mappings").list({}, { tenantId: access.tenantId });
    const usage = this.usageSummary(access.tenantId);
    const billingPreview = this.billingPreview(access.tenantId);
    const featureAccess = this.featureAccess(access.tenantId);
    const subscriptionLimits = this.subscriptionLimits(access.tenantId);
    const usageBasedBilling = this.usageBasedBilling(access.tenantId);
    const whiteLabelReadiness = this.whiteLabelReadiness(access.tenantId);
    const tenantHealth = this.tenantHealth(access.tenantId);
    return { tenant, subscription, plan, domains, usage, billingPreview, featureAccess, subscriptionLimits, usageBasedBilling, whiteLabelReadiness, tenantHealth, access };
  }

  usageSummary(tenantId) {
    const tenant = repositoryForTable("tenants").getById(tenantId);
    const plan = tenant?.planId ? repositoryForTable("subscription_plans").getById(tenant.planId) : null;
    const limits = plan?.limits || {};
    return Object.fromEntries(
      Object.entries(limitResourceMap).map(([resource, target]) => [
        target.metric,
        {
          resource,
          used: repositoryForTable(target.table).count({ tenantId }),
          limit: limits[target.metric] ?? null
        }
      ])
    );
  }

  usageEventsSummary(tenantId, periodStart = now().slice(0, 7)) {
    const rows = db.prepare(`
      SELECT metric, SUM(quantity) AS quantity
      FROM usage_events
      WHERE tenantId = ? AND periodStart = ?
      GROUP BY metric
      ORDER BY metric ASC
    `).all(tenantId, periodStart);
    return rows.map((row) => ({
      metric: row.metric,
      quantity: Number(row.quantity || 0)
    }));
  }

  billingPreview(tenantId, periodStart = now().slice(0, 7)) {
    const tenant = repositoryForTable("tenants").getById(tenantId);
    if (!tenant) throw notFound("Tenant not found");
    const subscription = db.prepare("SELECT * FROM subscriptions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1").get(tenantId);
    const plan = tenant.planId ? repositoryForTable("subscription_plans").getById(tenant.planId) : null;
    const usageEvents = this.usageEventsSummary(tenantId, periodStart);
    const planCode = plan?.code || "starter";
    const usageRows = meteredUsageCatalog.map((item) => {
      const used = usageEvents
        .filter((event) => item.prefixes.some((prefix) => event.metric.startsWith(prefix)))
        .reduce((total, event) => total + Number(event.quantity || 0), 0);
      const included = Number(item.included[planCode] ?? item.included.starter ?? 0);
      const overage = Math.max(0, used - included);
      const amount = Math.round(overage * Number(item.unitPrice || 0) * 100) / 100;
      return { ...item, used, included, overage, amount };
    });
    const baseAmount = Number(plan?.priceMonthly || 0);
    const usageAmount = Math.round(usageRows.reduce((total, row) => total + row.amount, 0) * 100) / 100;
    return {
      tenantId,
      periodStart,
      periodEnd: subscription?.currentPeriodEnd || "",
      status: tenant.subscriptionStatus || subscription?.status || "unknown",
      plan: plan ? { id: plan.id, code: plan.code, name: plan.name, priceMonthly: baseAmount } : null,
      subscription: subscription || null,
      baseAmount,
      usageAmount,
      totalAmount: Math.round((baseAmount + usageAmount) * 100) / 100,
      usageRows,
      rawUsageEvents: usageEvents
    };
  }

  subscriptionLimits(tenantId) {
    const usage = this.usageSummary(tenantId);
    const rows = Object.entries(usage).map(([metric, value]) => {
      const used = Number(value.used || 0);
      const limit = value.limit == null ? null : Number(value.limit || 0);
      const percent = limit ? Math.min(100, Math.round((used / limit) * 100)) : 0;
      return {
        metric,
        resource: value.resource,
        used,
        limit,
        percent,
        status: !limit ? "unlimited" : percent >= 100 ? "blocked" : percent >= 85 ? "near_limit" : "healthy",
        remaining: limit ? Math.max(0, limit - used) : null
      };
    });
    return {
      rows,
      blocked: rows.filter((row) => row.status === "blocked"),
      nearLimit: rows.filter((row) => row.status === "near_limit"),
      status: rows.some((row) => row.status === "blocked") ? "limit_blocked" : rows.some((row) => row.status === "near_limit") ? "watch" : "healthy"
    };
  }

  usageBasedBilling(tenantId, periodStart = now().slice(0, 7)) {
    const preview = this.billingPreview(tenantId, periodStart);
    const dayOfMonth = Math.max(1, new Date().getDate());
    const monthDays = 30;
    const projectedUsageAmount = Math.round((Number(preview.usageAmount || 0) / dayOfMonth) * monthDays * 100) / 100;
    const projectedTotalAmount = Math.round((Number(preview.baseAmount || 0) + projectedUsageAmount) * 100) / 100;
    const overageRiskRows = preview.usageRows.filter((row) => Number(row.overage || 0) > 0 || Number(row.used || 0) >= Number(row.included || 0) * 0.85);
    return {
      ...preview,
      projectedUsageAmount,
      projectedTotalAmount,
      overageRiskRows,
      invoiceMode: "base_plus_usage",
      nextInvoiceEstimate: projectedTotalAmount,
      status: overageRiskRows.length ? "usage_watch" : "on_track"
    };
  }

  whiteLabelReadiness(tenantId) {
    const tenant = repositoryForTable("tenants").getById(tenantId);
    if (!tenant) throw notFound("Tenant not found");
    const domains = repositoryForTable("domain_mappings").list({}, { tenantId });
    const profiles = repositoryForTable("white_label_profiles").list({ limit: 100 }, { tenantId });
    const primaryDomain = domains.find((domain) => domain.isPrimary) || domains[0] || null;
    const activeProfile = profiles.find((profile) => ["active", "ready"].includes(profile.status)) || profiles[0] || null;
    const checks = [
      { key: "domain", label: "Primary domain mapped", status: primaryDomain ? "ready" : "gap", evidence: primaryDomain?.domain || "No domain mapped" },
      { key: "domain_verified", label: "Domain verified", status: primaryDomain?.status === "verified" ? "ready" : "gap", evidence: primaryDomain?.status || "not configured" },
      { key: "brand_profile", label: "Brand profile", status: activeProfile ? "ready" : "gap", evidence: activeProfile?.name || "No white-label profile" },
      { key: "theme_assets", label: "Theme and assets", status: activeProfile?.theme || activeProfile?.assets ? "ready" : "gap", evidence: activeProfile ? "Theme/assets object present" : "No theme assets" }
    ];
    const ready = checks.filter((check) => check.status === "ready").length;
    const score = Math.round((ready / checks.length) * 100);
    return {
      score,
      status: score >= 90 ? "ready" : score >= 60 ? "partial" : "needs_setup",
      checks,
      profiles,
      domains,
      blockers: checks.filter((check) => check.status !== "ready").map((check) => check.label)
    };
  }

  tenantHealth(tenantId) {
    const tenant = repositoryForTable("tenants").getById(tenantId);
    if (!tenant) throw notFound("Tenant not found");
    const limits = this.subscriptionLimits(tenantId);
    const billing = this.usageBasedBilling(tenantId);
    const features = this.featureAccess(tenantId);
    const whiteLabel = this.whiteLabelReadiness(tenantId);
    const subscriptionScore = ["active", "trialing"].includes(tenant.subscriptionStatus) ? 100 : tenant.subscriptionStatus === "past_due" ? 45 : 15;
    const limitScore = limits.status === "healthy" ? 100 : limits.status === "watch" ? 70 : 30;
    const billingScore = billing.status === "on_track" ? 100 : 76;
    const featureRows = features.length ? features : [{ allowed: true }];
    const featureScore = Math.round((featureRows.filter((feature) => feature.allowed).length / featureRows.length) * 100);
    const whiteLabelScore = Number(whiteLabel.score || 0);
    const score = Math.round((subscriptionScore * 0.3) + (limitScore * 0.22) + (billingScore * 0.18) + (featureScore * 0.15) + (whiteLabelScore * 0.15));
    return {
      score,
      status: score >= 85 ? "healthy" : score >= 65 ? "watch" : "at_risk",
      signals: [
        { label: "Subscription", score: subscriptionScore, status: tenant.subscriptionStatus || "unknown" },
        { label: "Limits", score: limitScore, status: limits.status },
        { label: "Usage billing", score: billingScore, status: billing.status },
        { label: "Feature access", score: featureScore, status: `${featureRows.filter((feature) => feature.allowed).length}/${featureRows.length} enabled` },
        { label: "White-label", score: whiteLabelScore, status: whiteLabel.status }
      ],
      nextActions: [
        ...limits.nearLimit.map((row) => `Upgrade or increase ${row.metric} limit`),
        ...limits.blocked.map((row) => `${row.metric} limit is blocked`),
        ...whiteLabel.blockers
      ]
    };
  }

  featureAccess(tenantId) {
    const tenant = repositoryForTable("tenants").getById(tenantId);
    if (!tenant) throw notFound("Tenant not found");
    const plan = tenant.planId ? repositoryForTable("subscription_plans").getById(tenant.planId) : null;
    const planCode = plan?.code || "";
    const planFeatures = new Set((plan?.features || []).map((feature) => String(feature).toLowerCase()));
    return repositoryForTable("feature_toggles").list({ limit: 10000 }).map((toggle) => {
      const rules = toggle.rules || {};
      const planAllowed = !rules.plans?.length || rules.plans.includes(planCode) || rules.plans.includes(plan?.id);
      const roleAllowed = !rules.roles?.length || rules.roles.includes("tenant");
      const scopedAllowed =
        toggle.scope === "tenant" ? toggle.tenantId === tenantId :
        toggle.scope === "plan" ? toggle.planId === plan?.id :
        true;
      const enabled = Boolean(toggle.enabled);
      const allowed = enabled && planAllowed && roleAllowed && scopedAllowed;
      return {
        id: toggle.id,
        key: toggle.key,
        name: toggle.name,
        description: toggle.description,
        scope: toggle.scope,
        enabled,
        allowed,
        includedInPlan: planFeatures.has(String(toggle.name || "").toLowerCase()) || planFeatures.has(String(toggle.key || "").toLowerCase()),
        reason: allowed ? "Included for this tenant plan" : !enabled ? "Feature disabled" : !planAllowed ? "Upgrade plan required" : "Scope does not match this tenant"
      };
    });
  }

  onboardTenant(payload) {
    const salonName = payload.salonName || payload.name;
    const ownerEmail = payload.ownerEmail;
    if (!salonName || !ownerEmail) throw badRequest("salonName and ownerEmail are required");
    const slug = (payload.slug || salonName)
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/(^-|-$)/g, "");
    const existing = db.prepare("SELECT id FROM tenants WHERE slug = ?").get(slug);
    if (existing) throw conflict("A tenant with this slug already exists");

    const plan = payload.planId
      ? repositoryForTable("subscription_plans").getById(payload.planId)
      : db.prepare("SELECT * FROM subscription_plans WHERE code = ?").get(payload.planCode || "starter");
    if (!plan) throw badRequest("Selected plan does not exist");

    const tenantId = makeId("tenant");
    const stamp = now();
    const trialEndsAt = new Date(Date.now() + Number(plan.trialDays || 14) * 24 * 60 * 60 * 1000).toISOString();
    const tenant = repositoryForTable("tenants").create({
      id: tenantId,
      name: salonName,
      slug,
      status: "trialing",
      planId: plan.id,
      subscriptionStatus: "trialing",
      trialEndsAt,
      ownerEmail,
      primaryDomain: payload.domain || `${slug}.localhost`,
      createdAt: stamp,
      updatedAt: stamp
    });
    const subscription = repositoryForTable("subscriptions").create(
      {
        id: makeId("sub"),
        planId: plan.id,
        status: "trialing",
        trialStart: stamp,
        trialEndsAt,
        currentPeriodStart: stamp,
        currentPeriodEnd: trialEndsAt
      },
      { tenantId }
    );
    const branch = repositoryForTable("branches").create(
      {
        id: makeId("branch"),
        name: payload.branchName || `${salonName} Main`,
        city: payload.city || "",
        address: payload.address || "",
        phone: payload.phone || "",
        gstin: payload.gstin || "",
        timezone: "Asia/Kolkata",
        status: "active"
      },
      { tenantId }
    );
    const owner = repositoryForTable("tenant_users").create(
      {
        id: makeId("tu"),
        name: payload.ownerName || "Salon Owner",
        email: ownerEmail,
        role: "owner",
        branchIds: [branch.id],
        status: "active"
      },
      { tenantId }
    );
    const domain = repositoryForTable("domain_mappings").create(
      {
        id: makeId("domain"),
        domain: payload.domain || `${slug}.localhost`,
        status: payload.domain ? "pending" : "verified",
        isPrimary: 1,
        verifiedAt: payload.domain ? "" : stamp
      },
      { tenantId }
    );
    return { tenant, subscription, branch, owner, domain };
  }

  addDomain(access, { domain, isPrimary = false }) {
    if (!domain) throw badRequest("domain is required");
    const existing = db.prepare("SELECT id FROM domain_mappings WHERE lower(domain) = lower(?)").get(domain);
    if (existing) throw conflict("Domain is already mapped");
    if (isPrimary) {
      db.prepare("UPDATE domain_mappings SET isPrimary = 0 WHERE tenantId = ?").run(access.tenantId);
      repositoryForTable("tenants").update(access.tenantId, { primaryDomain: domain });
    }
    return repositoryForTable("domain_mappings").create(
      {
        id: makeId("domain"),
        domain: domain.toLowerCase(),
        status: "pending",
        isPrimary: isPrimary ? 1 : 0,
        verifiedAt: ""
      },
      { tenantId: access.tenantId }
    );
  }

  verifyDomain(access, domainId) {
    const mapping = repositoryForTable("domain_mappings").getById(domainId, { tenantId: access.tenantId });
    if (!mapping) throw notFound("Domain mapping not found");
    return repositoryForTable("domain_mappings").update(domainId, {
      status: "verified",
      verifiedAt: now()
    }, { tenantId: access.tenantId });
  }

  switchPlan(access, planId) {
    const plan = repositoryForTable("subscription_plans").getById(planId);
    if (!plan) throw badRequest("Plan does not exist");
    const tenant = repositoryForTable("tenants").update(access.tenantId, {
      planId,
      subscriptionStatus: "active",
      status: "active"
    });
    const existing = db.prepare("SELECT id FROM subscriptions WHERE tenantId = ? ORDER BY createdAt DESC LIMIT 1").get(access.tenantId);
    const subscription = existing
      ? repositoryForTable("subscriptions").update(existing.id, {
          planId,
          status: "active",
          currentPeriodStart: now(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, { tenantId: access.tenantId })
      : repositoryForTable("subscriptions").create({
          id: makeId("sub"),
          planId,
          status: "active",
          currentPeriodStart: now(),
          currentPeriodEnd: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000).toISOString()
        }, { tenantId: access.tenantId });
    return { tenant, subscription, plan };
  }
}

export const tenantService = new TenantService();
