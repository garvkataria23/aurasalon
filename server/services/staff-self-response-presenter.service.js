import { can, normalizeRole } from "../middleware/rbac.js";

const adminRoles = new Set(["owner", "admin", "superAdmin"]);
const financialResources = ["finance", "sales", "payments", "invoices"];
const financialExactFields = new Set(["total", "paid", "sales", "salescount", "appointmentvalue", "aicoach"]);
const sensitiveClientFields = new Set([
  "allergies",
  "medicalnotes",
  "medicalhistory",
  "privatenotes",
  "healthnotes"
]);

function normalizedField(field) {
  return String(field || "").replace(/[^a-z0-9]/gi, "").toLowerCase();
}

function grants(access, action, resource) {
  const permissions = access?.permissions || [];
  return permissions.includes("*") ||
    permissions.includes(`${action}:*`) ||
    permissions.includes(`${action}:${resource}`) ||
    permissions.includes(`write:${resource}`) ||
    permissions.includes(`admin:${resource}`);
}

function hasFinancialAccess(access = {}) {
  const role = normalizeRole(access.role || "staff");
  if (adminRoles.has(role)) return true;
  return financialResources.some((resource) =>
    grants(access, "read", resource) ||
    can(role, "read", resource, access) ||
    can(role, "write", resource, access)
  );
}

function hasSensitiveClientAccess(access = {}) {
  const role = normalizeRole(access.role || "staff");
  return adminRoles.has(role) ||
    grants(access, "read", "sensitive-client") ||
    can(role, "read", "sensitive-client", access);
}

function withoutFields(value, restricted) {
  if (Array.isArray(value)) return value.map((item) => withoutFields(item, restricted));
  if (!value || typeof value !== "object") return value;
  return Object.fromEntries(
    Object.entries(value)
      .filter(([field]) => !restricted(field))
      .map(([field, child]) => [field, withoutFields(child, restricted)])
  );
}

function isFinancialField(field) {
  const normalized = normalizedField(field);
  return financialExactFields.has(normalized) ||
    /(revenue|payment|invoice|amount|balance|commission|spend|price|wallet)/.test(normalized) ||
    ["targetprogress", "targetvalue", "achievedvalue", "remaining"].includes(normalized);
}

function isSensitiveClientField(field) {
  const normalized = normalizedField(field);
  return normalized === "notes" || sensitiveClientFields.has(normalized);
}

export class StaffSelfResponsePresenterService {
  dashboard(result, access) {
    return hasFinancialAccess(access) ? result : withoutFields(result, isFinancialField);
  }

  enterprise(result, access) {
    return hasFinancialAccess(access) ? result : withoutFields(result, isFinancialField);
  }

  clients(result, access) {
    return hasSensitiveClientAccess(access) ? result : withoutFields(result, isSensitiveClientField);
  }

  client360(result, access) {
    return hasSensitiveClientAccess(access) ? result : withoutFields(result, isSensitiveClientField);
  }
}

export const staffSelfResponsePresenterService = new StaffSelfResponsePresenterService();
