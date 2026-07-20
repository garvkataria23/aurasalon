import { db } from "../db.js";
import { badRequest, forbidden } from "../utils/app-error.js";

export const ownerControlRoles = new Set(["owner", "admin", "superAdmin"]);

export function normalizeRole(role = "") {
  const value = String(role || "").trim();
  const compact = value.replace(/[\s_-]+/g, "").toLowerCase();
  if (compact === "superadmin") return "superAdmin";
  if (compact === "frontdesk") return "frontDesk";
  if (compact === "inventorymanager") return "inventoryManager";
  if (compact === "custommarketinglead") return "customMarketingLead";
  if (compact === "marketinglead") return "marketingLead";
  return value;
}

export function isOwnerControlRole(role = "") {
  return ownerControlRoles.has(normalizeRole(role));
}

export function assertOwnerControl(access = {}) {
  if (!isOwnerControlRole(access.role)) throw forbidden("Only owner, admin or super admin can manage user access");
}

export function ensureTenantUserAccessColumns() {
  const columns = db.prepare("PRAGMA table_info(tenant_users)").all().map((row) => row.name);
  if (!columns.includes("accessApprovedBy")) db.prepare("ALTER TABLE tenant_users ADD COLUMN accessApprovedBy TEXT DEFAULT ''").run();
  if (!columns.includes("accessApprovedAt")) db.prepare("ALTER TABLE tenant_users ADD COLUMN accessApprovedAt TEXT DEFAULT ''").run();
  if (!columns.includes("permissionVersion")) db.prepare("ALTER TABLE tenant_users ADD COLUMN permissionVersion INTEGER DEFAULT 1").run();
}

export function normalizeBranchIdsForRole(value, role = "") {
  const branchIds = Array.isArray(value)
    ? value.map((item) => String(item || "").trim()).filter(Boolean)
    : String(value || "").split(/[\n,;]+/).map((item) => item.trim()).filter(Boolean);
  const unique = [...new Set(branchIds)];
  if (isOwnerControlRole(role)) return unique;
  if (!unique.length) throw badRequest("Branch access is required for non-admin users");
  return unique;
}

export function assertLoginBranchScope(user = {}, requestedBranchId = "") {
  const role = normalizeRole(user.role);
  if (isOwnerControlRole(role)) return requestedBranchId || "";
  const branchIds = Array.isArray(user.branchIds) ? user.branchIds : [];
  if (!branchIds.length) throw forbidden("This login has no branch access assigned");
  if (requestedBranchId && !branchIds.includes(requestedBranchId)) {
    throw forbidden("This user does not have access to the requested branch");
  }
  return requestedBranchId || branchIds[0] || "";
}
