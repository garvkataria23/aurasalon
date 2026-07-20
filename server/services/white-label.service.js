import { db } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

const defaultTheme = {
  primary: "#4B1238",
  accent: "#4B1238",
  surface: "#ffffff",
  ink: "#17202d",
  bookingButton: "#4B1238"
};

export class WhiteLabelService {
  summary(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const profiles = repositories.whiteLabelProfiles.list({ limit: 100 }, scope(access));
    const branchBranding = repositories.branchBranding.list({ branchId, limit: 100 }, scope(access, branchId));
    const domains = repositories.domainMappings.list({ limit: 100 }, scope(access));
    const resolved = this.resolve({ branchId, domain: query.domain || "" }, access);
    return {
      metrics: {
        profiles: profiles.length,
        customDomains: domains.filter((item) => item.status === "verified").length,
        brandedBranches: branchBranding.length,
        defaultProfiles: profiles.filter((item) => Number(item.isDefault) === 1).length
      },
      profiles,
      branchBranding,
      domains,
      resolved,
      themeSystem: {
        tokens: ["primary", "accent", "surface", "ink", "bookingButton"],
        supportsBranchOverride: true,
        supportsCustomDomain: true,
        supportsInvoiceBranding: true
      }
    };
  }

  upsertProfile(payload = {}, access) {
    if (!payload.name && !payload.brandName) throw badRequest("name or brandName is required");
    const existing = payload.id
      ? repositories.whiteLabelProfiles.getById(payload.id, scope(access))
      : payload.domain
        ? db.prepare("SELECT id FROM white_label_profiles WHERE tenantId = ? AND lower(domain) = lower(?)").get(access.tenantId, payload.domain)
        : null;
    const data = {
      name: payload.name || payload.brandName,
      brandName: payload.brandName || payload.name,
      logoUrl: payload.logoUrl || "",
      faviconUrl: payload.faviconUrl || "",
      domain: payload.domain || "",
      theme: { ...defaultTheme, ...(payload.theme || {}) },
      assets: payload.assets || {},
      settings: payload.settings || {},
      isDefault: payload.isDefault ? 1 : 0,
      status: payload.status || "active"
    };
    if (data.isDefault) {
      for (const profile of repositories.whiteLabelProfiles.list({ limit: 100 }, scope(access))) {
        repositories.whiteLabelProfiles.update(profile.id, { isDefault: 0 }, scope(access));
      }
    }
    return existing?.id
      ? repositories.whiteLabelProfiles.update(existing.id, data, scope(access))
      : repositories.whiteLabelProfiles.create({ id: makeId("brand"), ...data }, scope(access));
  }

  upsertBranchBranding(payload = {}, access) {
    const branchId = payload.branchId || access.branchId;
    if (!branchId) throw badRequest("branchId is required");
    tenantService.assertBranchAccess(access, branchId);
    const branch = repositories.branches.getById(branchId, scope(access));
    if (!branch) throw notFound("Branch not found");
    const existing = db.prepare("SELECT id FROM branch_branding WHERE tenantId = ? AND branchId = ?").get(access.tenantId, branchId);
    const profile = payload.profileId ? repositories.whiteLabelProfiles.getById(payload.profileId, scope(access)) : null;
    const data = {
      branchId,
      profileId: payload.profileId || profile?.id || "",
      brandName: payload.brandName || profile?.brandName || branch.name,
      logoUrl: payload.logoUrl || profile?.logoUrl || "",
      theme: { ...(profile?.theme || defaultTheme), ...(payload.theme || {}) },
      assets: { ...(profile?.assets || {}), ...(payload.assets || {}) },
      status: payload.status || "active"
    };
    return existing?.id
      ? repositories.branchBranding.update(existing.id, data, scope(access, branchId))
      : repositories.branchBranding.create({ id: makeId("bbrand"), ...data }, scope(access, branchId));
  }

  mapDomain(payload = {}, access) {
    if (!payload.domain) throw badRequest("domain is required");
    const existing = db.prepare("SELECT id FROM domain_mappings WHERE tenantId = ? AND lower(domain) = lower(?)").get(access.tenantId, payload.domain);
    const data = {
      domain: payload.domain,
      status: payload.status || "pending",
      isPrimary: payload.isPrimary ? 1 : 0,
      verifiedAt: payload.status === "verified" ? new Date().toISOString() : ""
    };
    const mapping = existing?.id
      ? repositories.domainMappings.update(existing.id, data, scope(access))
      : repositories.domainMappings.create({ id: makeId("domain"), ...data }, scope(access));
    if (payload.profileId) {
      repositories.whiteLabelProfiles.update(payload.profileId, { domain: payload.domain }, scope(access));
    }
    return mapping;
  }

  resolve(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    const domain = String(query.domain || "").split(":")[0].toLowerCase();
    const profiles = repositories.whiteLabelProfiles.list({ limit: 100 }, scope(access));
    const byDomain = domain ? profiles.find((profile) => String(profile.domain || "").toLowerCase() === domain) : null;
    const defaultProfile = profiles.find((profile) => Number(profile.isDefault) === 1) || profiles[0] || null;
    const branchBrand = branchId
      ? repositories.branchBranding.list({ branchId, limit: 10 }, scope(access, branchId))[0] || null
      : null;
    const profile = byDomain || (branchBrand?.profileId ? profiles.find((item) => item.id === branchBrand.profileId) : null) || defaultProfile;
    return {
      profile,
      branchBranding: branchBrand,
      brandName: branchBrand?.brandName || profile?.brandName || "Aura Salon",
      logoUrl: branchBrand?.logoUrl || profile?.logoUrl || "",
      theme: { ...defaultTheme, ...(profile?.theme || {}), ...(branchBrand?.theme || {}) },
      assets: { ...(profile?.assets || {}), ...(branchBrand?.assets || {}) },
      settings: profile?.settings || {}
    };
  }
}

export const whiteLabelService = new WhiteLabelService();
