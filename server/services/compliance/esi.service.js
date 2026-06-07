import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import {
  assertFyOpen,
  emitCompliance,
  fiscalYear,
  logCompliance,
  makeId,
  money,
  now,
  payrollById,
  payrollRowsForMonth,
  readComplianceFile,
  rupeeCeil,
  salaryParts,
  staffById,
  staffStatutoryProfile,
  wageMonth,
  writeComplianceFile
} from "./compliance-utils.js";

function latestRate(tenantId, date = now()) {
  const day = String(date).slice(0, 10);
  const row = db.prepare(`
    SELECT * FROM esi_rate_master
    WHERE tenant_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to = '' OR effective_to >= ?)
    ORDER BY effective_from DESC LIMIT 1
  `).get(tenantId, day, day);
  return row || {
    employee_esi_pct: 0.75,
    employer_esi_pct: 3.25,
    wage_ceiling: 21000,
    disabled_wage_ceiling: 25000
  };
}

function periods(month) {
  const [year, monthNum] = String(month).split("-").map(Number);
  if (monthNum >= 4 && monthNum <= 9) {
    return {
      contributionPeriod: `${year}-04_to_${year}-09`,
      benefitPeriod: `${year}-07_to_${year}-12`
    };
  }
  const startYear = monthNum >= 10 ? year : year - 1;
  return {
    contributionPeriod: `${startYear}-10_to_${startYear + 1}-03`,
    benefitPeriod: `${startYear + 1}-01_to_${startYear + 1}-06`
  };
}

export class EsiService {
  preview(payload = {}, access = {}) {
    const payroll = payload.payrollId ? payrollById(payload.payrollId, access) : payload.payroll || {};
    const staffId = payload.staffId || payroll.staffId;
    const staff = staffById(staffId, access);
    const profile = staffStatutoryProfile(staff.id, access);
    const parts = salaryParts({ ...payroll, ...payload });
    const month = payload.wageMonth || wageMonth(payroll.periodEnd || now());
    const fy = payload.fy || fiscalYear(`${month}-01`);
    const rate = latestRate(access.tenantId, `${month}-01`);
    const gross = Number(payload.esiWages ?? parts.gross);
    const ceiling = Number(payload.disabled ? rate.disabled_wage_ceiling : rate.wage_ceiling);
    const applicable = Number(profile.esi_applicable || 0) === 1 && gross <= ceiling;
    const employeeEsi = applicable ? rupeeCeil((gross * Number(rate.employee_esi_pct || 0.75)) / 100) : 0;
    const employerEsi = applicable ? rupeeCeil((gross * Number(rate.employer_esi_pct || 3.25)) / 100) : 0;
    const period = periods(month);
    return {
      staffId: staff.id,
      payrollId: payload.payrollId || payroll.id || "manual",
      branchId: payload.branchId || payroll.branchId || staff.branchId || access.branchId || "",
      wageMonth: month,
      fy,
      contributionPeriod: period.contributionPeriod,
      benefitPeriod: period.benefitPeriod,
      esiWages: money(gross),
      employeeEsi,
      employerEsi,
      totalEsi: money(employeeEsi + employerEsi),
      workingDays: Number(payload.workingDays || 0),
      applicable,
      ceiling
    };
  }

  calculate(payload = {}, access = {}) {
    const result = this.preview(payload, access);
    assertFyOpen(access.tenantId, result.fy);
    const row = {
      id: makeId("esi"),
      tenant_id: access.tenantId,
      branch_id: result.branchId,
      staff_id: result.staffId,
      payroll_id: result.payrollId,
      wage_month: result.wageMonth,
      fy: result.fy,
      contribution_period: result.contributionPeriod,
      benefit_period: result.benefitPeriod,
      esi_wages: result.esiWages,
      employee_esi: result.employeeEsi,
      employer_esi: result.employerEsi,
      total_esi: result.totalEsi,
      working_days: result.workingDays,
      status: "pending",
      return_file_id: "",
      created_at: now()
    };
    db.prepare(`
      INSERT INTO esi_contributions
        (id, tenant_id, branch_id, staff_id, payroll_id, wage_month, fy, contribution_period, benefit_period,
         esi_wages, employee_esi, employer_esi, total_esi, working_days, status, return_file_id, created_at)
      VALUES
        (@id, @tenant_id, @branch_id, @staff_id, @payroll_id, @wage_month, @fy, @contribution_period, @benefit_period,
         @esi_wages, @employee_esi, @employer_esi, @total_esi, @working_days, @status, @return_file_id, @created_at)
      ON CONFLICT(tenant_id, staff_id, payroll_id, wage_month) DO UPDATE SET
        branch_id = excluded.branch_id, fy = excluded.fy, contribution_period = excluded.contribution_period,
        benefit_period = excluded.benefit_period, esi_wages = excluded.esi_wages, employee_esi = excluded.employee_esi,
        employer_esi = excluded.employer_esi, total_esi = excluded.total_esi, working_days = excluded.working_days,
        status = 'pending'
    `).run(row);
    logCompliance({ tenantId: access.tenantId, branchId: row.branch_id, module: "esi", action: "calculate", entityId: row.staff_id, newValue: row, access });
    emitCompliance("compliance:esi_calculated", { staffId: row.staff_id, wageMonth: row.wage_month }, access, row.branch_id);
    return row;
  }

  calculateBatch(payload = {}, access = {}) {
    const rows = payrollRowsForMonth({ tenantId: access.tenantId, branchId: payload.branchId || "", wageMonth: payload.wageMonth || wageMonth() });
    const tx = db.transaction((payrollRows) => payrollRows.map((payroll) => this.calculate({ payrollId: payroll.id }, access)));
    return { count: rows.length, rows: tx(rows) };
  }

  list(query = {}, access = {}) {
    return db.prepare(`
      SELECT * FROM esi_contributions
      WHERE tenant_id = ? AND (? = '' OR branch_id = ?) AND (? = '' OR contribution_period = ?)
      ORDER BY wage_month DESC, created_at DESC LIMIT ?
    `).all(access.tenantId, query.branchId || "", query.branchId || "", query.contributionPeriod || "", query.contributionPeriod || "", Number(query.limit || 100));
  }

  applicabilityCheck(staffId, access = {}) {
    const payroll = db.prepare(`
      SELECT * FROM staff_payroll_components
      WHERE tenantId = ? AND staffId = ?
      ORDER BY periodEnd DESC LIMIT 1
    `).get(access.tenantId, staffId);
    return this.preview({ staffId, payroll: payroll || {} }, access);
  }

  generateReturn(payload = {}, access = {}) {
    const branchId = payload.branchId || access.branchId || "";
    const contributionPeriod = payload.contributionPeriod;
    if (!branchId || !contributionPeriod) throw badRequest("branchId and contributionPeriod are required");
    const rows = db.prepare(`
      SELECT * FROM esi_contributions
      WHERE tenant_id = ? AND branch_id = ? AND contribution_period = ?
      ORDER BY staff_id
    `).all(access.tenantId, branchId, contributionPeriod);
    if (!rows.length) throw badRequest("No ESI contributions found for this period");
    const content = [
      "staff_id,wage_month,esi_wages,employee_esi,employer_esi,total_esi,working_days",
      ...rows.map((row) => [row.staff_id, row.wage_month, row.esi_wages, row.employee_esi, row.employer_esi, row.total_esi, row.working_days].join(","))
    ].join("\n");
    const id = makeId("esi_ret");
    const filePath = writeComplianceFile(`uploads/compliance/esi/ESI_${branchId}_${contributionPeriod}.csv`, content);
    const record = {
      id,
      tenant_id: access.tenantId,
      branch_id: branchId,
      contribution_period: contributionPeriod,
      file_path: filePath,
      total_employees: rows.length,
      total_wages: money(rows.reduce((sum, row) => sum + Number(row.esi_wages || 0), 0)),
      total_contribution: money(rows.reduce((sum, row) => sum + Number(row.total_esi || 0), 0)),
      challan_number: payload.challanNumber || "",
      status: "generated",
      generated_at: now()
    };
    db.prepare(`
      INSERT INTO esi_returns
        (id, tenant_id, branch_id, contribution_period, file_path, total_employees, total_wages, total_contribution, challan_number, status, generated_at)
      VALUES
        (@id, @tenant_id, @branch_id, @contribution_period, @file_path, @total_employees, @total_wages, @total_contribution, @challan_number, @status, @generated_at)
    `).run(record);
    db.prepare("UPDATE esi_contributions SET return_file_id = ? WHERE tenant_id = ? AND branch_id = ? AND contribution_period = ?")
      .run(id, access.tenantId, branchId, contributionPeriod);
    logCompliance({ tenantId: access.tenantId, branchId, module: "esi", action: "return_generated", entityId: id, newValue: record, access });
    emitCompliance("compliance:return_generated", { module: "esi", id, contributionPeriod }, access, branchId);
    return record;
  }

  returns(query = {}, access = {}) {
    return db.prepare("SELECT * FROM esi_returns WHERE tenant_id = ? AND (? = '' OR branch_id = ?) ORDER BY generated_at DESC LIMIT ?")
      .all(access.tenantId, query.branchId || "", query.branchId || "", Number(query.limit || 50));
  }

  downloadReturn(id, access = {}) {
    const row = db.prepare("SELECT * FROM esi_returns WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("ESI return not found");
    return { row, content: readComplianceFile(row.file_path) };
  }

  markPaid(payload = {}, access = {}) {
    const id = payload.returnId;
    if (!id) throw badRequest("returnId is required");
    const result = db.prepare("UPDATE esi_returns SET status = 'paid', challan_number = COALESCE(NULLIF(?, ''), challan_number) WHERE tenant_id = ? AND id = ?")
      .run(payload.challanNumber || "", access.tenantId, id);
    if (!result.changes) throw notFound("ESI return not found");
    db.prepare("UPDATE esi_contributions SET status = 'paid' WHERE tenant_id = ? AND return_file_id = ?").run(access.tenantId, id);
    logCompliance({ tenantId: access.tenantId, module: "esi", action: "mark_paid", entityId: id, newValue: payload, access, severity: "warning" });
    return { paid: true };
  }
}

export const esiService = new EsiService();
