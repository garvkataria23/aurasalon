import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
import {
  assertBranch,
  branchIdFrom,
  camel,
  emitStaffEvent,
  hashPayload,
  makeId,
  now,
  number,
  payrollRoles,
  requireManager,
  requireRole,
  requireTenant,
  scopedBranchWhere,
  staffAudit,
  staffById,
  toJson
} from "./staff-os-advanced-utils.js";

export class StaffPayrollComplianceService {
  listRules(query = {}, access) {
    access = requireTenant(access);
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      rule_type: query.ruleType || query.rule_type || "",
      limit: Math.min(Number(query.limit || 100), 500)
    };
    const filters = ["tenant_id = @tenant_id"];
    if (params.branch_id) filters.push("(branch_id = @branch_id OR branch_id IS NULL OR branch_id = '')");
    if (params.rule_type) filters.push("rule_type = @rule_type");
    return db.prepare(`SELECT * FROM payroll_statutory_rules WHERE ${filters.join(" AND ")} ORDER BY effective_from DESC LIMIT @limit`).all(params).map(camel);
  }

  createRule(payload = {}, access) {
    access = requireTenant(access);
    requireRole(access, payrollRoles, "Payroll compliance rules are restricted");
    const branchId = branchIdFrom(payload, access);
    if (branchId) assertBranch(access, branchId);
    const row = {
      id: makeId("stat_rule"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      rule_type: payload.ruleType || payload.rule_type || "",
      state_code: payload.stateCode || payload.state_code || "",
      rule_json: toJson(payload.rule || payload.ruleJson || {}),
      effective_from: payload.effectiveFrom || payload.effective_from || now().slice(0, 10),
      effective_to: payload.effectiveTo || payload.effective_to || "",
      status: payload.status || "active",
      created_by: access.userId || ""
    };
    if (!row.rule_type) throw badRequest("ruleType is required");
    db.prepare(`INSERT INTO payroll_statutory_rules
      (id, tenant_id, branch_id, rule_type, state_code, rule_json, effective_from, effective_to, status, created_by)
      VALUES (@id, @tenant_id, @branch_id, @rule_type, @state_code, @rule_json, @effective_from, @effective_to, @status, @created_by)`).run(row);
    return camel(db.prepare("SELECT * FROM payroll_statutory_rules WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  summary(query = {}, access) {
    access = requireTenant(access);
    requireRole(access, payrollRoles, "Payroll compliance summary is restricted");
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      period_start: query.periodStart || query.period_start || "",
      period_end: query.periodEnd || query.period_end || ""
    };
    const filters = [scopedBranchWhere(access, params)];
    if (params.period_start) filters.push("period_start >= @period_start");
    if (params.period_end) filters.push("period_end <= @period_end");
    const row = db.prepare(`SELECT COUNT(*) AS calculations, SUM(pf_employee) AS pf_employee, SUM(pf_employer) AS pf_employer,
      SUM(esic_employee) AS esic_employee, SUM(esic_employer) AS esic_employer, SUM(professional_tax) AS professional_tax,
      SUM(tds_amount) AS tds_amount, SUM(net_statutory_deduction) AS net_statutory_deduction
      FROM payroll_statutory_calculations WHERE ${filters.join(" AND ")}`).get(params);
    return camel(row || {});
  }

  calculate(payload = {}, access) {
    access = requireTenant(access);
    requireRole(access, payrollRoles, "Payroll statutory calculation is restricted");
    const staff = staffById(payload.staffId || payload.staff_id, access);
    const branchId = branchIdFrom(payload, access) || staff.branch_id;
    assertBranch(access, branchId);
    const gross = number(payload.grossAmount ?? payload.gross_amount, 0) || this.effectiveMonthlySalary(staff.id, payload.periodEnd || payload.period_end, access) || 0;
    const periodStart = payload.periodStart || payload.period_start;
    const periodEnd = payload.periodEnd || payload.period_end;
    if (!periodStart || !periodEnd) throw badRequest("periodStart and periodEnd are required");
    const profile = this.profileFor(staff.id, branchId, access);
    const pfWage = Math.min(gross, number(payload.pfWageCap, 15000));
    const pfEmployee = profile.pf_enabled ? pfWage * 0.12 : 0;
    const pfEmployer = profile.pf_enabled ? pfWage * 0.12 : 0;
    const esicEligible = profile.esic_enabled && gross <= 21000;
    const esicEmployee = esicEligible ? gross * 0.0075 : 0;
    const esicEmployer = esicEligible ? gross * 0.0325 : 0;
    const professionalTax = gross >= 10000 && gross <= 15000 ? 200 : gross > 15000 ? 300 : 0;
    const tds = profile.tds_enabled && gross > 50000 ? gross * 0.05 : 0;
    const gratuity = gross * 0.0481;
    const bonus = profile.bonus_eligible ? gross * 0.0833 : 0;
    const deduction = pfEmployee + esicEmployee + professionalTax + tds;
    const row = {
      id: makeId("stat_calc"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      staff_id: staff.id,
      payroll_run_id: payload.payrollRunId || payload.payroll_run_id || "",
      period_start: periodStart,
      period_end: periodEnd,
      gross_amount: gross,
      pf_employee: pfEmployee,
      pf_employer: pfEmployer,
      esic_employee: esicEmployee,
      esic_employer: esicEmployer,
      professional_tax: professionalTax,
      tds_amount: tds,
      gratuity_accrual: gratuity,
      bonus_accrual: bonus,
      net_statutory_deduction: deduction,
      snapshot_json: toJson({
        profile,
        formulas: {
          pf: "12% capped at PF wage",
          esic: "0.75% employee and 3.25% employer when gross <= 21000",
          professionalTax: "state placeholder",
          tds: "placeholder 5% above monthly gross 50000",
          gratuity: "4.81% accrual placeholder",
          bonus: "8.33% accrual placeholder"
        }
      }),
      status: payload.freeze ? "frozen" : "calculated",
      frozen: payload.freeze ? 1 : 0
    };
    db.transaction(() => {
      db.prepare(`INSERT INTO payroll_statutory_calculations
        (id, tenant_id, branch_id, staff_id, payroll_run_id, period_start, period_end, gross_amount, pf_employee, pf_employer,
         esic_employee, esic_employer, professional_tax, tds_amount, gratuity_accrual, bonus_accrual, net_statutory_deduction, snapshot_json, status, frozen)
        VALUES (@id, @tenant_id, @branch_id, @staff_id, @payroll_run_id, @period_start, @period_end, @gross_amount, @pf_employee, @pf_employer,
         @esic_employee, @esic_employer, @professional_tax, @tds_amount, @gratuity_accrual, @bonus_accrual, @net_statutory_deduction, @snapshot_json, @status, @frozen)`).run(row);
      staffAudit("staff.statutory_calculated", "payroll_statutory_calculations", row.id, access, { after: row, branchId });
    })();
    emitStaffEvent("staff:statutory_calculated", access, branchId, row.id);
    return camel(db.prepare("SELECT * FROM payroll_statutory_calculations WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  exportCompliance(payload = {}, access) {
    access = requireTenant(access);
    requireRole(access, payrollRoles, "Payroll compliance export is restricted");
    const branchId = branchIdFrom(payload, access);
    if (branchId) assertBranch(access, branchId);
    const periodStart = payload.periodStart || payload.period_start;
    const periodEnd = payload.periodEnd || payload.period_end;
    if (!periodStart || !periodEnd) throw badRequest("periodStart and periodEnd are required");
    const params = { tenant_id: access.tenantId, branch_id: branchId, period_start: periodStart, period_end: periodEnd };
    const where = scopedBranchWhere(access, params);
    const rows = db.prepare(`SELECT * FROM payroll_statutory_calculations WHERE ${where} AND period_start >= @period_start AND period_end <= @period_end`)
      .all(params).map(camel);
    const row = {
      id: makeId("stat_exp"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      export_type: payload.exportType || payload.export_type || "monthly_statutory_json",
      period_start: periodStart,
      period_end: periodEnd,
      export_json: toJson({ generatedAt: now(), rows }),
      created_by: access.userId || ""
    };
    db.prepare(`INSERT INTO payroll_compliance_exports
      (id, tenant_id, branch_id, export_type, period_start, period_end, export_json, created_by)
      VALUES (@id, @tenant_id, @branch_id, @export_type, @period_start, @period_end, @export_json, @created_by)`).run(row);
    emitStaffEvent("staff:compliance_export_created", access, branchId, row.id);
    return camel(db.prepare("SELECT * FROM payroll_compliance_exports WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  salaryHistory(staffId, access) {
    access = requireTenant(access);
    staffById(staffId, access);
    return db.prepare("SELECT * FROM salary_revision_history WHERE tenant_id = ? AND staff_id = ? ORDER BY effective_date DESC, created_at DESC")
      .all(access.tenantId, staffId).map(camel);
  }

  createSalaryRevision(staffId, payload = {}, access) {
    access = requireTenant(access);
    requireRole(access, payrollRoles, "Salary revision is restricted");
    const staff = staffById(staffId, access);
    const branchId = branchIdFrom(payload, access) || staff.branch_id;
    assertBranch(access, branchId);
    const oldCtc = number(payload.oldCtc ?? payload.old_ctc, this.latestApprovedCtc(staffId, access));
    const newCtc = number(payload.newCtc ?? payload.new_ctc, 0);
    if (!newCtc) throw badRequest("newCtc is required");
    const row = {
      id: makeId("salrev"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      staff_id: staffId,
      effective_date: payload.effectiveDate || payload.effective_date || now().slice(0, 10),
      old_ctc: oldCtc,
      new_ctc: newCtc,
      old_components_json: toJson(payload.oldComponents || payload.old_components || {}),
      new_components_json: toJson(payload.newComponents || payload.new_components || {}),
      reason: payload.reason || "",
      requested_by: access.userId || "",
      approval_status: "pending",
      document_url: payload.documentUrl || payload.document_url || ""
    };
    row.immutable_hash = hashPayload(row);
    db.transaction(() => {
      db.prepare(`INSERT INTO salary_revision_history
        (id, tenant_id, branch_id, staff_id, effective_date, old_ctc, new_ctc, old_components_json, new_components_json, reason, requested_by, approval_status, document_url, immutable_hash)
        VALUES (@id, @tenant_id, @branch_id, @staff_id, @effective_date, @old_ctc, @new_ctc, @old_components_json, @new_components_json, @reason, @requested_by, @approval_status, @document_url, @immutable_hash)`).run(row);
      db.prepare(`INSERT INTO approval_requests
        (id, tenant_id, branch_id, request_type, entity_type, entity_id, amount, status, requested_by, payload_json)
        VALUES (?, ?, ?, 'salary_revision', 'salary_revision_history', ?, ?, 'pending', ?, ?)`)
        .run(makeId("appr"), access.tenantId, branchId, row.id, newCtc - oldCtc, access.userId || "", toJson(row));
      staffAudit("staff.salary_revision_requested", "salary_revision_history", row.id, access, { after: row, branchId });
    })();
    emitStaffEvent("staff:salary_revision_requested", access, branchId, row.id);
    emitStaffEvent("staff:salary_revision_created", access, branchId, row.id);
    return camel(db.prepare("SELECT * FROM salary_revision_history WHERE id = ? AND tenant_id = ?").get(row.id, access.tenantId));
  }

  approveSalaryRevision(id, access) {
    return this.decideSalaryRevision(id, "approved", access);
  }

  rejectSalaryRevision(id, access) {
    return this.decideSalaryRevision(id, "rejected", access);
  }

  correctSalaryRevision(id, payload = {}, access) {
    access = requireTenant(access);
    requireRole(access, payrollRoles, "Salary correction is restricted");
    const original = db.prepare("SELECT * FROM salary_revision_history WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!original) throw notFound("Salary revision not found");
    assertBranch(access, original.branch_id);
    const correction = this.createSalaryRevision(original.staff_id, {
      branchId: original.branch_id,
      effectiveDate: payload.effectiveDate || original.effective_date,
      oldCtc: original.new_ctc,
      newCtc: payload.newCtc || original.old_ctc,
      oldComponents: JSON.parse(original.new_components_json || "{}"),
      newComponents: payload.newComponents || JSON.parse(original.old_components_json || "{}"),
      reason: payload.reason || `Correction for ${id}`,
      documentUrl: payload.documentUrl || ""
    }, access);
    db.prepare("UPDATE salary_revision_history SET correction_of_id = ?, updated_at = ? WHERE id = ? AND tenant_id = ?")
      .run(id, now(), correction.id, access.tenantId);
    emitStaffEvent("staff:salary_revision_corrected", access, original.branch_id, correction.id);
    return this.salaryRevisionById(correction.id, access);
  }

  decideSalaryRevision(id, status, access) {
    access = requireTenant(access);
    requireRole(access, payrollRoles, "Salary revision approval is restricted");
    const row = db.prepare("SELECT * FROM salary_revision_history WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Salary revision not found");
    assertBranch(access, row.branch_id);
    if (row.approval_status !== "pending") throw conflict("Salary revision already decided");
    const stamp = now();
    db.transaction(() => {
      db.prepare(`UPDATE salary_revision_history SET approval_status = ?, approved_by = CASE WHEN ? = 'approved' THEN ? ELSE approved_by END,
        approved_at = CASE WHEN ? = 'approved' THEN ? ELSE approved_at END,
        rejected_by = CASE WHEN ? = 'rejected' THEN ? ELSE rejected_by END,
        rejected_at = CASE WHEN ? = 'rejected' THEN ? ELSE rejected_at END,
        updated_at = ? WHERE id = ? AND tenant_id = ?`)
        .run(status, status, access.userId || "", status, stamp, status, access.userId || "", status, stamp, stamp, id, access.tenantId);
      staffAudit(`staff.salary_revision_${status}`, "salary_revision_history", id, access, { before: row, branchId: row.branch_id });
    })();
    emitStaffEvent(status === "approved" ? "staff:salary_revision_approved" : "staff:salary_revision_rejected", access, row.branch_id, id);
    return this.salaryRevisionById(id, access);
  }

  salaryRevisionById(id, access) {
    const row = db.prepare("SELECT * FROM salary_revision_history WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Salary revision not found");
    return camel(row);
  }

  profileFor(staffId, branchId, access) {
    let profile = db.prepare("SELECT * FROM statutory_profiles WHERE tenant_id = ? AND staff_id = ?").get(access.tenantId, staffId);
    if (!profile) {
      const row = {
        id: makeId("stat_prof"),
        tenant_id: access.tenantId,
        staff_id: staffId,
        branch_id: branchId,
        pf_enabled: 1,
        esic_enabled: 1,
        tds_enabled: 1,
        professional_tax_state: "IN",
        bonus_eligible: 1
      };
      db.prepare(`INSERT INTO statutory_profiles
        (id, tenant_id, staff_id, branch_id, pf_enabled, esic_enabled, tds_enabled, professional_tax_state, bonus_eligible)
        VALUES (@id, @tenant_id, @staff_id, @branch_id, @pf_enabled, @esic_enabled, @tds_enabled, @professional_tax_state, @bonus_eligible)`).run(row);
      profile = row;
    }
    return profile;
  }

  latestApprovedCtc(staffId, access) {
    return number(db.prepare(`SELECT new_ctc FROM salary_revision_history
      WHERE tenant_id = ? AND staff_id = ? AND approval_status = 'approved'
      ORDER BY effective_date DESC, approved_at DESC LIMIT 1`).get(access.tenantId, staffId)?.new_ctc, 0);
  }

  effectiveMonthlySalary(staffId, periodEnd, access) {
    const row = db.prepare(`SELECT new_ctc FROM salary_revision_history
      WHERE tenant_id = ? AND staff_id = ? AND approval_status = 'approved' AND effective_date <= ?
      ORDER BY effective_date DESC, approved_at DESC LIMIT 1`).get(access.tenantId, staffId, periodEnd || now().slice(0, 10));
    return row ? number(row.new_ctc, 0) / 12 : 0;
  }
}

export const staffPayrollComplianceService = new StaffPayrollComplianceService();
