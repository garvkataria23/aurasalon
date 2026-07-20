import { db } from "../../db.js";
import { badRequest } from "../../utils/app-error.js";
import {
  defaultStateForBranch,
  fiscalYear,
  logCompliance,
  makeId,
  money,
  now,
  payrollById,
  payrollRowsForMonth,
  staffById,
  staffStatutoryProfile,
  wageMonth
} from "./compliance-utils.js";

function rateFor(tenantId, stateCode, date = now()) {
  const row = db.prepare(`
    SELECT * FROM lwf_rate_master
    WHERE tenant_id = ? AND state_code = ? AND effective_from <= ?
    ORDER BY effective_from DESC LIMIT 1
  `).get(tenantId, stateCode, String(date).slice(0, 10));
  return row || null;
}

export class LwfService {
  preview(payload = {}, access = {}) {
    const payroll = payload.payrollId ? payrollById(payload.payrollId, access) : payload.payroll || {};
    const staff = staffById(payload.staffId || payroll.staffId, access);
    const profile = staffStatutoryProfile(staff.id, access);
    const month = payload.wageMonth || wageMonth(payroll.periodEnd || now());
    const branchId = payload.branchId || payroll.branchId || staff.branchId || access.branchId || "";
    const stateCode = String(payload.stateCode || profile.pt_state || defaultStateForBranch(access.tenantId, branchId)).toUpperCase();
    const rate = Number(profile.lwf_applicable || 0) === 1 ? rateFor(access.tenantId, stateCode, `${month}-01`) : null;
    const contributionMonths = String(rate?.contribution_month || "").split(",").map((item) => item.trim()).filter(Boolean);
    const dueThisMonth = rate && (!contributionMonths.length || contributionMonths.includes(month.slice(5, 7)));
    return {
      staffId: staff.id,
      payrollId: payload.payrollId || payroll.id || "manual",
      branchId,
      contributionPeriod: payload.contributionPeriod || `${fiscalYear(`${month}-01`)}:${month}`,
      stateCode,
      employeeAmount: dueThisMonth ? Number(rate.employee_contribution || 0) : 0,
      employerAmount: dueThisMonth ? Number(rate.employer_contribution || 0) : 0,
      totalAmount: dueThisMonth ? money(Number(rate.employee_contribution || 0) + Number(rate.employer_contribution || 0)) : 0,
      dueThisMonth: Boolean(dueThisMonth),
      frequency: rate?.contribution_frequency || ""
    };
  }

  calculate(payload = {}, access = {}) {
    const result = this.preview(payload, access);
    const row = {
      id: makeId("lwf"),
      tenant_id: access.tenantId,
      branch_id: result.branchId,
      staff_id: result.staffId,
      payroll_id: result.payrollId,
      contribution_period: result.contributionPeriod,
      employee_amount: result.employeeAmount,
      employer_amount: result.employerAmount,
      total_amount: result.totalAmount,
      status: "pending",
      created_at: now()
    };
    db.prepare(`
      INSERT INTO lwf_contributions
        (id, tenant_id, branch_id, staff_id, payroll_id, contribution_period, employee_amount, employer_amount, total_amount, status, created_at)
      VALUES
        (@id, @tenant_id, @branch_id, @staff_id, @payroll_id, @contribution_period, @employee_amount, @employer_amount, @total_amount, @status, @created_at)
      ON CONFLICT(tenant_id, staff_id, payroll_id, contribution_period) DO UPDATE SET
        branch_id = excluded.branch_id, employee_amount = excluded.employee_amount, employer_amount = excluded.employer_amount,
        total_amount = excluded.total_amount, status = 'pending'
    `).run(row);
    logCompliance({ tenantId: access.tenantId, branchId: row.branch_id, module: "lwf", action: "calculate", entityId: row.staff_id, newValue: row, access });
    return row;
  }

  calculateBatch(payload = {}, access = {}) {
    const rows = payrollRowsForMonth({ tenantId: access.tenantId, branchId: payload.branchId || "", wageMonth: payload.wageMonth || wageMonth() });
    const tx = db.transaction((payrollRows) => payrollRows.map((payroll) => this.calculate({ payrollId: payroll.id }, access)));
    return { count: rows.length, rows: tx(rows) };
  }

  list(query = {}, access = {}) {
    return db.prepare("SELECT * FROM lwf_contributions WHERE tenant_id = ? AND (? = '' OR branch_id = ?) ORDER BY created_at DESC LIMIT ?")
      .all(access.tenantId, query.branchId || "", query.branchId || "", Number(query.limit || 100));
  }

  rateUpdate(payload = {}, access = {}) {
    if (!payload.stateCode || !payload.effectiveFrom) throw badRequest("stateCode and effectiveFrom are required");
    const row = {
      id: makeId("lwf_rate"),
      tenant_id: access.tenantId,
      state_code: String(payload.stateCode).toUpperCase(),
      employee_contribution: Number(payload.employeeContribution || 0),
      employer_contribution: Number(payload.employerContribution || 0),
      contribution_frequency: payload.contributionFrequency || "annual",
      contribution_month: payload.contributionMonth || "12",
      effective_from: payload.effectiveFrom
    };
    db.prepare(`
      INSERT INTO lwf_rate_master
        (id, tenant_id, state_code, employee_contribution, employer_contribution, contribution_frequency, contribution_month, effective_from)
      VALUES
        (@id, @tenant_id, @state_code, @employee_contribution, @employer_contribution, @contribution_frequency, @contribution_month, @effective_from)
    `).run(row);
    logCompliance({ tenantId: access.tenantId, module: "lwf", action: "rate_update", entityId: row.id, newValue: row, access, severity: "warning" });
    return row;
  }
}

export const lwfService = new LwfService();
