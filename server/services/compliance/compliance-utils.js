import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { db } from "../../db.js";
import { badRequest, forbidden, notFound } from "../../utils/app-error.js";
import { tenantService } from "../tenant.service.js";
import { realtimeService } from "../realtime.service.js";

export const now = () => new Date().toISOString();
export const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
export const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
export const rupeeCeil = (value) => Math.ceil(Number(value) || 0);
export const moduleDir = dirname(fileURLToPath(import.meta.url));
export const projectRoot = join(moduleDir, "..", "..", "..");

export function ensureTenant(access = {}) {
  if (!access.tenantId) throw badRequest("tenant_id is required");
  return access.tenantId;
}

export function fiscalYear(dateLike = now()) {
  const date = new Date(dateLike);
  const year = date.getUTCFullYear();
  const month = date.getUTCMonth() + 1;
  const start = month >= 4 ? year : year - 1;
  return `${start}-${String(start + 1).slice(-2)}`;
}

export function assessmentYear(fy) {
  const start = Number(String(fy || fiscalYear()).slice(0, 4));
  return `${start + 1}-${String(start + 2).slice(-2)}`;
}

export function wageMonth(dateLike = now()) {
  return String(dateLike || now()).slice(0, 7);
}

export function monthsRemainingInFy(month = wageMonth()) {
  const [year, monthNum] = String(month).split("-").map(Number);
  if (!year || !monthNum) return 1;
  const fyEndYear = monthNum >= 4 ? year + 1 : year;
  const endIndex = fyEndYear * 12 + 3;
  const currentIndex = year * 12 + monthNum;
  return Math.max(1, endIndex - currentIndex + 1);
}

export function maskPan(pan = "") {
  const value = String(pan || "").toUpperCase();
  if (value.length < 6) return value ? "*****" : "";
  return `${value.slice(0, 5)}****${value.slice(-1)}`;
}

export function maskAadhaar(aadhaar = "") {
  const digits = String(aadhaar || "").replace(/\D/g, "");
  return digits ? `****-****-${digits.slice(-4)}` : "";
}

export function maskBank(account = "") {
  const value = String(account || "");
  return value ? `****${value.slice(-4)}` : "";
}

export function assertBranch(access = {}, branchId = "") {
  if (branchId) tenantService.assertBranchAccess(access, branchId);
}

export function staffById(staffId, access = {}) {
  ensureTenant(access);
  if (!staffId) throw badRequest("staffId is required");
  const row = db.prepare("SELECT * FROM staff WHERE id = ? AND tenantId = ?").get(staffId, access.tenantId);
  if (!row) throw notFound("Staff member not found");
  assertBranch(access, row.branchId || "");
  return row;
}

export function branchById(branchId, access = {}) {
  ensureTenant(access);
  if (!branchId) throw badRequest("branchId is required");
  const row = db.prepare("SELECT * FROM branches WHERE id = ? AND tenantId = ?").get(branchId, access.tenantId);
  if (!row) throw notFound("Branch not found");
  assertBranch(access, branchId);
  return row;
}

export function payrollById(payrollId, access = {}) {
  ensureTenant(access);
  if (!payrollId) throw badRequest("payrollId is required");
  const row = db.prepare("SELECT * FROM staff_payroll_components WHERE id = ? AND tenantId = ?").get(payrollId, access.tenantId);
  if (!row) throw notFound("Payroll component not found");
  assertBranch(access, row.branchId || "");
  return row;
}

export function payrollRowsForMonth({ tenantId, branchId = "", wageMonth: month = wageMonth(), staffId = "" } = {}) {
  return db.prepare(`
    SELECT * FROM staff_payroll_components
    WHERE tenantId = ?
      AND (? = '' OR branchId = ?)
      AND (? = '' OR staffId = ?)
      AND periodEnd LIKE ?
    ORDER BY periodEnd DESC
  `).all(tenantId, branchId, branchId, staffId, staffId, `${month}%`);
}

export function latestPayrollForStaff(staffId, access = {}) {
  ensureTenant(access);
  const row = db.prepare(`
    SELECT * FROM staff_payroll_components
    WHERE tenantId = ? AND staffId = ?
    ORDER BY periodEnd DESC, createdAt DESC
    LIMIT 1
  `).get(access.tenantId, staffId);
  if (row) assertBranch(access, row.branchId || "");
  return row || null;
}

export function parseJson(value, fallback = {}) {
  if (value == null || value === "") return fallback;
  if (typeof value === "object") return value;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

export function staffStatutoryProfile(staffId, access = {}) {
  const staff = staffById(staffId, access);
  let profile = db.prepare("SELECT * FROM staff_statutory_profile WHERE tenant_id = ? AND staff_id = ?").get(access.tenantId, staffId);
  if (!profile) {
    profile = {
      id: makeId("statprof"),
      tenant_id: access.tenantId,
      staff_id: staffId,
      pan: "",
      aadhaar_masked: "",
      uan: "",
      pf_account_number: "",
      esi_number: "",
      pt_state: defaultStateForBranch(access.tenantId, staff.branchId || access.branchId || ""),
      pf_applicable: 1,
      esi_applicable: 1,
      pt_applicable: 1,
      lwf_applicable: 1,
      tax_regime: "new",
      vpf_percentage: 0,
      international_worker: 0,
      excluded_employee: 0,
      excluded_reason: "",
      bank_account_number: "",
      bank_ifsc: "",
      bank_name: "",
      account_holder_name: staff.name || "",
      nominee_name: "",
      nominee_relation: "",
      pf_join_date: staff.joiningDate || "",
      esi_join_date: staff.joiningDate || "",
      created_at: now(),
      updated_at: now()
    };
    db.prepare(`
      INSERT INTO staff_statutory_profile
        (id, tenant_id, staff_id, pan, aadhaar_masked, uan, pf_account_number, esi_number, pt_state,
         pf_applicable, esi_applicable, pt_applicable, lwf_applicable, tax_regime, vpf_percentage,
         international_worker, excluded_employee, excluded_reason, bank_account_number, bank_ifsc, bank_name,
         account_holder_name, nominee_name, nominee_relation, pf_join_date, esi_join_date, created_at, updated_at)
      VALUES
        (@id, @tenant_id, @staff_id, @pan, @aadhaar_masked, @uan, @pf_account_number, @esi_number, @pt_state,
         @pf_applicable, @esi_applicable, @pt_applicable, @lwf_applicable, @tax_regime, @vpf_percentage,
         @international_worker, @excluded_employee, @excluded_reason, @bank_account_number, @bank_ifsc, @bank_name,
         @account_holder_name, @nominee_name, @nominee_relation, @pf_join_date, @esi_join_date, @created_at, @updated_at)
    `).run(profile);
  }
  return profile;
}

export function defaultStateForBranch(tenantId, branchId = "") {
  if (branchId) {
    const est = db.prepare("SELECT state_code FROM statutory_establishment WHERE tenant_id = ? AND branch_id = ?").get(tenantId, branchId);
    if (est?.state_code) return est.state_code;
  }
  return "MH";
}

export function assertFyOpen(tenantId, fy) {
  const row = db.prepare("SELECT * FROM compliance_fy_locks WHERE tenant_id = ? AND fy = ?").get(tenantId, fy);
  if (row?.status === "closed") throw forbidden(`FY ${fy} is closed for statutory edits`);
}

export function logCompliance({ tenantId, branchId = "", module, action, entityId = "", oldValue = null, newValue = null, access = {}, severity = "info" }) {
  const row = {
    id: makeId("comp_audit"),
    tenant_id: tenantId || access.tenantId,
    branch_id: branchId || access.branchId || "",
    module,
    action,
    entity_id: entityId,
    old_value: oldValue == null ? "" : JSON.stringify(oldValue),
    new_value: newValue == null ? "" : JSON.stringify(newValue),
    actor_user_id: access.userId || "",
    actor_role: access.role || "",
    severity,
    created_at: now()
  };
  db.prepare(`
    INSERT INTO compliance_audit_events
      (id, tenant_id, branch_id, module, action, entity_id, old_value, new_value, actor_user_id, actor_role, severity, created_at)
    VALUES
      (@id, @tenant_id, @branch_id, @module, @action, @entity_id, @old_value, @new_value, @actor_user_id, @actor_role, @severity, @created_at)
  `).run(row);
  try {
    db.prepare(`
      INSERT INTO audit_log (id, tenant_id, user_id, action, entity_type, entity_id, old_value, new_value, created_at)
      VALUES (@id, @tenant_id, @user_id, @action, @entity_type, @entity_id, @old_value, @new_value, @created_at)
    `).run({
      id: makeId("audit"),
      tenant_id: row.tenant_id,
      user_id: row.actor_user_id,
      action: `compliance.${module}.${action}`,
      entity_type: module,
      entity_id: entityId,
      old_value: row.old_value,
      new_value: row.new_value,
      created_at: row.created_at
    });
  } catch {
    // audit_log schema is optional across older databases; compliance_audit_events remains authoritative.
  }
  return row;
}

export function emitCompliance(event, payload = {}, access = {}, branchId = "") {
  try {
    realtimeService.broadcast(event, payload, {
      tenantId: access.tenantId,
      branchId,
      channel: branchId ? `branch:${branchId}` : `tenant:${access.tenantId}`
    });
  } catch {
    // Realtime is best-effort for HTTP compliance operations.
  }
}

export function writeComplianceFile(relativePath, content) {
  const target = join(projectRoot, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
  return relativePath.replace(/\\/g, "/");
}

export function readComplianceFile(relativePath) {
  return readFileSync(join(projectRoot, relativePath), "utf8");
}

export function toDelimited(rows, columns, separator = "|") {
  return rows.map((row) => columns.map((column) => String(row[column] ?? "")).join(separator)).join("\n");
}

export function salaryParts(payroll = {}) {
  const basic = Number(payroll.basic || 0);
  const hra = Number(payroll.hra || 0);
  const allowances = Number(payroll.allowances || 0);
  const gross = Number(payroll.grossPay ?? basic + hra + allowances);
  return { basic, hra, allowances, gross, da: 0, retaining: 0 };
}
