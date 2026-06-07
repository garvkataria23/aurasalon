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
    return { tenant, subscription, plan, domains, usage, access };
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
