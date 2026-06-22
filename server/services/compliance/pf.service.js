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
  readComplianceFile,
  salaryParts,
  staffById,
  staffStatutoryProfile,
  toDelimited,
  wageMonth,
  writeComplianceFile
} from "./compliance-utils.js";

function latestRate(tenantId, date = now()) {
  let row = db.prepare(`
    SELECT * FROM pf_rate_master
    WHERE tenant_id = ? AND effective_from <= ? AND (effective_to IS NULL OR effective_to = '' OR effective_to >= ?)
    ORDER BY effective_from DESC LIMIT 1
  `).get(tenantId, date.slice(0, 10), date.slice(0, 10));
  if (!row) {
    row = {
      id: makeId("pf_rate"),
      tenant_id: tenantId,
      effective_from: "2026-04-01",
      effective_to: "",
      employee_pf_pct: 12,
      employer_pf_pct: 3.67,
      employer_eps_pct: 8.33,
      edli_pct: 0.5,
      pf_admin_charges_pct: 0.5,
      edli_admin_charges_pct: 0,
      wage_ceiling: 15000,
      eps_ceiling: 15000,
      created_at: now()
    };
    db.prepare(`
      INSERT INTO pf_rate_master
        (id, tenant_id, effective_from, effective_to, employee_pf_pct, employer_pf_pct, employer_eps_pct, edli_pct,
         pf_admin_charges_pct, edli_admin_charges_pct, wage_ceiling, eps_ceiling, created_at)
      VALUES
        (@id, @tenant_id, @effective_from, @effective_to, @employee_pf_pct, @employer_pf_pct, @employer_eps_pct, @edli_pct,
         @pf_admin_charges_pct, @edli_admin_charges_pct, @wage_ceiling, @eps_ceiling, @created_at)
    `).run(row);
  }
  return row;
}

export class PfService {
  preview(payload = {}, access = {}) {
    const payroll = payload.payrollId ? payrollById(payload.payrollId, access) : payload.payroll || {};
    const staffId = payload.staffId || payroll.staffId;
    const staff = staffById(staffId, access);
    const profile = staffStatutoryProfile(staff.id, access);
    const rate = latestRate(access.tenantId, payload.wageMonth || payroll.periodEnd || now());
    const parts = salaryParts({ ...payroll, ...payload });
    const month = payload.wageMonth || wageMonth(payroll.periodEnd || now());
    const fy = payload.fy || fiscalYear(`${month}-01`);
    const pfWagesRaw = Number(payload.pfWages ?? (parts.basic + parts.da + parts.retaining));
    const internationalWorker = Number(profile.international_worker || payload.internationalWorker || 0) === 1;
    const pfWages = internationalWorker ? pfWagesRaw : Math.min(pfWagesRaw, Number(rate.wage_ceiling || 15000));
    const epsEligible = !profile.excluded_employee && !payload.ageAbove58;
    const epsWages = epsEligible ? (internationalWorker ? pfWagesRaw : Math.min(pfWagesRaw, Number(rate.eps_ceiling || 15000))) : 0;
    const edliWages = internationalWorker ? pfWagesRaw : Math.min(pfWagesRaw, Number(rate.wage_ceiling || 15000));
    const employeePf = money((pfWages * Number(rate.employee_pf_pct || 12)) / 100);
    const employerEps = money((epsWages * Number(rate.employer_eps_pct || 8.33)) / 100);
    const employerPf = money((pfWages * 12) / 100 - employerEps);
    const vpfAmount = money((pfWages * Number(profile.vpf_percentage || payload.vpfPercentage || 0)) / 100);
    const edliContribution = money((edliWages * Number(rate.edli_pct || 0.5)) / 100);
    const pfAdmin = Math.max(pfWages > 0 ? 75 : 500, money((pfWages * Number(rate.pf_admin_charges_pct || 0.5)) / 100));
    const edliAdmin = money((edliWages * Number(rate.edli_admin_charges_pct || 0)) / 100);
    return {
      staffId: staff.id,
      payrollId: payload.payrollId || payroll.id || "manual",
      branchId: payload.branchId || payroll.branchId || staff.branchId || access.branchId || "",
      wageMonth: month,
      fy,
      pfWages: money(pfWages),
      epsWages: money(epsWages),
      edliWages: money(edliWages),
      employeePf,
      employerPf: money(employerPf),
      employerEps,
      vpfAmount,
      edliContribution,
      pfAdminCharges: money(pfAdmin),
      edliAdminCharges: edliAdmin,
      totalEmployee: money(employeePf + vpfAmount),
      totalEmployer: money(employerPf + employerEps + edliContribution + pfAdmin + edliAdmin),
      ncpDays: Number(payload.ncpDays || 0),
      epsEligible: Boolean(epsEligible),
      rateId: rate.id
    };
  }

  calculate(payload = {}, access = {}) {
    const result = this.preview(payload, access);
    assertFyOpen(access.tenantId, result.fy);
    const row = {
      id: makeId("pf"),
      tenant_id: access.tenantId,
      branch_id: result.branchId,
      staff_id: result.staffId,
      payroll_id: result.payrollId,
      wage_month: result.wageMonth,
      fy: result.fy,
      pf_wages: result.pfWages,
      eps_wages: result.epsWages,
      edli_wages: result.edliWages,
      employee_pf: result.employeePf,
      employer_pf: result.employerPf,
      employer_eps: result.employerEps,
      vpf_amount: result.vpfAmount,
      edli_contribution: result.edliContribution,
      pf_admin_charges: result.pfAdminCharges,
      edli_admin_charges: result.edliAdminCharges,
      total_employee: result.totalEmployee,
      total_employer: result.totalEmployer,
      ncp_days: result.ncpDays,
      status: "pending",
      ecr_file_id: "",
      trrn: "",
      created_at: now()
    };
    db.prepare(`
      INSERT INTO pf_contributions
        (id, tenant_id, branch_id, staff_id, payroll_id, wage_month, fy, pf_wages, eps_wages, edli_wages,
         employee_pf, employer_pf, employer_eps, vpf_amount, edli_contribution, pf_admin_charges,
         edli_admin_charges, total_employee, total_employer, ncp_days, status, ecr_file_id, trrn, created_at)
      VALUES
        (@id, @tenant_id, @branch_id, @staff_id, @payroll_id, @wage_month, @fy, @pf_wages, @eps_wages, @edli_wages,
         @employee_pf, @employer_pf, @employer_eps, @vpf_amount, @edli_contribution, @pf_admin_charges,
         @edli_admin_charges, @total_employee, @total_employer, @ncp_days, @status, @ecr_file_id, @trrn, @created_at)
      ON CONFLICT(tenant_id, staff_id, payroll_id, wage_month) DO UPDATE SET
        branch_id = excluded.branch_id, fy = excluded.fy, pf_wages = excluded.pf_wages,
        eps_wages = excluded.eps_wages, edli_wages = excluded.edli_wages, employee_pf = excluded.employee_pf,
        employer_pf = excluded.employer_pf, employer_eps = excluded.employer_eps, vpf_amount = excluded.vpf_amount,
        edli_contribution = excluded.edli_contribution, pf_admin_charges = excluded.pf_admin_charges,
        edli_admin_charges = excluded.edli_admin_charges, total_employee = excluded.total_employee,
        total_employer = excluded.total_employer, ncp_days = excluded.ncp_days, status = 'pending'
    `).run(row);
    logCompliance({ tenantId: access.tenantId, branchId: row.branch_id, module: "pf", action: "calculate", entityId: row.staff_id, newValue: row, access });
    emitCompliance("compliance:pf_calculated", { staffId: row.staff_id, wageMonth: row.wage_month }, access, row.branch_id);
    return row;
  }

  calculateBatch(payload = {}, access = {}) {
    const payrollRows = db.prepare(`
      SELECT * FROM staff_payroll_components
      WHERE tenantId = ? AND (? = '' OR branchId = ?) AND periodEnd LIKE ?
    `).all(access.tenantId, payload.branchId || "", payload.branchId || "", `${payload.wageMonth || wageMonth()}%`);
    const tx = db.transaction((rows) => rows.map((payroll) => this.calculate({ payrollId: payroll.id }, access)));
    return { count: payrollRows.length, rows: tx(payrollRows) };
  }

  list(query = {}, access = {}) {
    return db.prepare(`
      SELECT * FROM pf_contributions
      WHERE tenant_id = ? AND (? = '' OR branch_id = ?) AND (? = '' OR wage_month = ?)
      ORDER BY wage_month DESC, created_at DESC
      LIMIT ?
    `).all(access.tenantId, query.branchId || "", query.branchId || "", query.wageMonth || "", query.wageMonth || "", Number(query.limit || 100));
  }

  byStaff(staffId, access = {}) {
    staffById(staffId, access);
    return db.prepare("SELECT * FROM pf_contributions WHERE tenant_id = ? AND staff_id = ? ORDER BY wage_month DESC").all(access.tenantId, staffId);
  }

  generateEcr(payload = {}, access = {}) {
    const branchId = payload.branchId || access.branchId || "";
    const month = payload.wageMonth || wageMonth();
    const rows = db.prepare("SELECT * FROM pf_contributions WHERE tenant_id = ? AND branch_id = ? AND wage_month = ? ORDER BY staff_id").all(access.tenantId, branchId, month);
    if (!rows.length) throw badRequest("No PF contributions found for this branch and month");
    const establishment = db.prepare("SELECT * FROM statutory_establishment WHERE tenant_id = ? AND branch_id = ?").get(access.tenantId, branchId);
    const staffRows = new Map(db.prepare("SELECT id, name FROM staff WHERE tenantId = ?").all(access.tenantId).map((row) => [row.id, row]));
    const content = toDelimited(rows.map((row) => ({
      UAN: staffStatutoryProfile(row.staff_id, { ...access, branchId }).uan || "NA",
      MemberName: staffRows.get(row.staff_id)?.name || row.staff_id,
      GrossWages: row.pf_wages,
      EPFWages: row.pf_wages,
      EPSWages: row.eps_wages,
      EDLIWages: row.edli_wages,
      EPFContrib: row.employee_pf,
      EPSContrib: row.employer_eps,
      EPFEmployerContrib: row.employer_pf,
      NCP_Days: row.ncp_days,
      RefundOfAdvances: 0
    })), ["UAN", "MemberName", "GrossWages", "EPFWages", "EPSWages", "EDLIWages", "EPFContrib", "EPSContrib", "EPFEmployerContrib", "NCP_Days", "RefundOfAdvances"]);
    const id = makeId("pf_ecr");
    const establishmentCode = establishment?.pf_establishment_code || "EST";
    const filePath = writeComplianceFile(`uploads/compliance/pf/ecr/ECR_${establishmentCode}_${month}.txt`, content);
    const totals = rows.reduce((sum, row) => ({
      pfWages: sum.pfWages + Number(row.pf_wages || 0),
      employee: sum.employee + Number(row.total_employee || 0),
      employer: sum.employer + Number(row.employer_pf || 0),
      eps: sum.eps + Number(row.employer_eps || 0),
      edli: sum.edli + Number(row.edli_contribution || 0),
      admin: sum.admin + Number(row.pf_admin_charges || 0) + Number(row.edli_admin_charges || 0)
    }), { pfWages: 0, employee: 0, employer: 0, eps: 0, edli: 0, admin: 0 });
    const record = {
      id,
      tenant_id: access.tenantId,
      branch_id: branchId,
      wage_month: month,
      file_path: filePath,
      total_employees: rows.length,
      total_pf_wages: money(totals.pfWages),
      total_employee_share: money(totals.employee),
      total_employer_share: money(totals.employer),
      total_eps_share: money(totals.eps),
      total_edli: money(totals.edli),
      total_admin_charges: money(totals.admin),
      total_challan_amount: money(totals.employee + totals.employer + totals.eps + totals.edli + totals.admin),
      trrn: payload.trrn || "",
      challan_status: "generated",
      generated_by: access.userId || access.role || "",
      generated_at: now()
    };
    db.prepare(`
      INSERT INTO pf_ecr_files
        (id, tenant_id, branch_id, wage_month, file_path, total_employees, total_pf_wages, total_employee_share,
         total_employer_share, total_eps_share, total_edli, total_admin_charges, total_challan_amount, trrn,
         challan_status, generated_by, generated_at)
      VALUES
        (@id, @tenant_id, @branch_id, @wage_month, @file_path, @total_employees, @total_pf_wages, @total_employee_share,
         @total_employer_share, @total_eps_share, @total_edli, @total_admin_charges, @total_challan_amount, @trrn,
         @challan_status, @generated_by, @generated_at)
    `).run(record);
    db.prepare("UPDATE pf_contributions SET ecr_file_id = ? WHERE tenant_id = ? AND branch_id = ? AND wage_month = ?").run(id, access.tenantId, branchId, month);
    logCompliance({ tenantId: access.tenantId, branchId, module: "pf", action: "ecr_generated", entityId: id, newValue: record, access });
    emitCompliance("compliance:ecr_generated", { id, wageMonth: month }, access, branchId);
    return record;
  }

  ecrFiles(query = {}, access = {}) {
    return db.prepare("SELECT * FROM pf_ecr_files WHERE tenant_id = ? AND (? = '' OR branch_id = ?) ORDER BY generated_at DESC LIMIT ?")
      .all(access.tenantId, query.branchId || "", query.branchId || "", Number(query.limit || 50));
  }

  downloadEcr(id, access = {}) {
    const row = db.prepare("SELECT * FROM pf_ecr_files WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("PF ECR file not found");
    return { row, content: readComplianceFile(row.file_path) };
  }

  markPaid(payload = {}, access = {}) {
    if (!payload.trrn) throw badRequest("trrn is required");
    const result = db.prepare("UPDATE pf_ecr_files SET challan_status = 'paid', trrn = ? WHERE tenant_id = ? AND id = ?").run(payload.trrn, access.tenantId, payload.ecrFileId);
    if (!result.changes) throw notFound("PF ECR file not found");
    db.prepare("UPDATE pf_contributions SET status = 'paid', trrn = ? WHERE tenant_id = ? AND ecr_file_id = ?").run(payload.trrn, access.tenantId, payload.ecrFileId);
    logCompliance({ tenantId: access.tenantId, module: "pf", action: "mark_paid", entityId: payload.ecrFileId, newValue: payload, access, severity: "warning" });
    return { paid: true, trrn: payload.trrn };
  }

  challan(trrn, access = {}) {
    const row = db.prepare("SELECT * FROM pf_ecr_files WHERE tenant_id = ? AND trrn = ?").get(access.tenantId, trrn);
    if (!row) throw notFound("PF challan not found");
    return row;
  }

  annualReturn(fy, access = {}) {
    const rows = db.prepare("SELECT * FROM pf_contributions WHERE tenant_id = ? AND fy = ?").all(access.tenantId, fy);
    return {
      fy,
      employees: new Set(rows.map((row) => row.staff_id)).size,
      totalPfWages: money(rows.reduce((sum, row) => sum + Number(row.pf_wages || 0), 0)),
      totalEmployee: money(rows.reduce((sum, row) => sum + Number(row.total_employee || 0), 0)),
      totalEmployer: money(rows.reduce((sum, row) => sum + Number(row.total_employer || 0), 0)),
      rows
    };
  }

  rateUpdate(payload = {}, access = {}) {
    if (!payload.effectiveFrom) throw badRequest("effectiveFrom is required");
    const row = {
      id: makeId("pf_rate"),
      tenant_id: access.tenantId,
      effective_from: payload.effectiveFrom,
      effective_to: payload.effectiveTo || "",
      employee_pf_pct: Number(payload.employeePfPct ?? 12),
      employer_pf_pct: Number(payload.employerPfPct ?? 3.67),
      employer_eps_pct: Number(payload.employerEpsPct ?? 8.33),
      edli_pct: Number(payload.edliPct ?? 0.5),
      pf_admin_charges_pct: Number(payload.pfAdminChargesPct ?? 0.5),
      edli_admin_charges_pct: Number(payload.edliAdminChargesPct ?? 0),
      wage_ceiling: Number(payload.wageCeiling ?? 15000),
      eps_ceiling: Number(payload.epsCeiling ?? 15000),
      created_at: now()
    };
    db.prepare(`
      INSERT INTO pf_rate_master
        (id, tenant_id, effective_from, effective_to, employee_pf_pct, employer_pf_pct, employer_eps_pct, edli_pct,
         pf_admin_charges_pct, edli_admin_charges_pct, wage_ceiling, eps_ceiling, created_at)
      VALUES
        (@id, @tenant_id, @effective_from, @effective_to, @employee_pf_pct, @employer_pf_pct, @employer_eps_pct, @edli_pct,
         @pf_admin_charges_pct, @edli_admin_charges_pct, @wage_ceiling, @eps_ceiling, @created_at)
    `).run(row);
    logCompliance({ tenantId: access.tenantId, module: "pf", action: "rate_update", entityId: row.id, newValue: row, access, severity: "warning" });
    emitCompliance("compliance:rate_updated", { module: "pf", id: row.id }, access);
    return row;
  }
}

export const pfService = new PfService();
