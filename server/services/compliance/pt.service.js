import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import {
  assertFyOpen,
  defaultStateForBranch,
  emitCompliance,
  fiscalYear,
  logCompliance,
  makeId,
  money,
  now,
  payrollById,
  payrollRowsForMonth,
  salaryParts,
  staffById,
  staffStatutoryProfile,
  wageMonth,
  writeComplianceFile
} from "./compliance-utils.js";

const NO_PT_STATES = new Set(["DL", "UP", "HR", "JK", "J&K", "RJ"]);

function findSlab({ tenantId, stateCode, grossWages, gender = "all", month = wageMonth() }) {
  if (NO_PT_STATES.has(String(stateCode || "").toUpperCase())) return null;
  const rows = db.prepare(`
    SELECT * FROM pt_slab_master
    WHERE tenant_id = ? AND state_code = ?
      AND effective_from <= ?
      AND (effective_to IS NULL OR effective_to = '' OR effective_to >= ?)
      AND slab_min <= ?
      AND (slab_max IS NULL OR slab_max >= ?)
    ORDER BY
      CASE WHEN lower(gender_specific) = lower(?) THEN 0 WHEN gender_specific = 'all' THEN 1 ELSE 2 END,
      effective_from DESC
    LIMIT 1
  `).all(tenantId, stateCode, `${month}-01`, `${month}-01`, grossWages, grossWages, gender || "all");
  return rows.find((row) => row.gender_specific === "all" || String(row.gender_specific).toLowerCase() === String(gender || "all").toLowerCase()) || null;
}

export class PtService {
  preview(payload = {}, access = {}) {
    const payroll = payload.payrollId ? payrollById(payload.payrollId, access) : payload.payroll || {};
    const staffId = payload.staffId || payroll.staffId;
    const staff = staffById(staffId, access);
    const profile = staffStatutoryProfile(staff.id, access);
    const parts = salaryParts({ ...payroll, ...payload });
    const month = payload.wageMonth || wageMonth(payroll.periodEnd || now());
    const fy = payload.fy || fiscalYear(`${month}-01`);
    const branchId = payload.branchId || payroll.branchId || staff.branchId || access.branchId || "";
    const stateCode = String(payload.stateCode || profile.pt_state || defaultStateForBranch(access.tenantId, branchId)).toUpperCase();
    const grossWages = Number(payload.grossWages ?? parts.gross);
    const gender = payload.gender || staff.gender || "all";
    const slab = Number(profile.pt_applicable || 0) === 1 ? findSlab({ tenantId: access.tenantId, stateCode, grossWages, gender, month }) : null;
    let ptAmount = slab ? Number(slab.special_month === month.slice(5, 7) ? slab.special_month_tax ?? slab.monthly_tax : slab.monthly_tax) : 0;
    const fyStart = Number(fy.slice(0, 4));
    const ytd = db.prepare(`
      SELECT COALESCE(SUM(pt_amount), 0) AS total
      FROM pt_deductions
      WHERE tenant_id = ? AND staff_id = ? AND wage_month >= ? AND wage_month <= ? AND wage_month <> ?
    `).get(access.tenantId, staff.id, `${fyStart}-04`, `${fyStart + 1}-03`, month)?.total || 0;
    ptAmount = Math.max(0, Math.min(ptAmount, 2500 - Number(ytd || 0)));
    return {
      staffId: staff.id,
      payrollId: payload.payrollId || payroll.id || "manual",
      branchId,
      wageMonth: month,
      fy,
      stateCode,
      grossWages: money(grossWages),
      ptAmount: money(ptAmount),
      annualCapRemaining: money(2500 - Number(ytd || 0)),
      slabId: slab?.id || "",
      applicable: Boolean(slab)
    };
  }

  calculate(payload = {}, access = {}) {
    const result = this.preview(payload, access);
    assertFyOpen(access.tenantId, result.fy);
    const row = {
      id: makeId("pt"),
      tenant_id: access.tenantId,
      branch_id: result.branchId,
      staff_id: result.staffId,
      payroll_id: result.payrollId,
      wage_month: result.wageMonth,
      state_code: result.stateCode,
      gross_wages: result.grossWages,
      pt_amount: result.ptAmount,
      status: "pending",
      created_at: now()
    };
    db.prepare(`
      INSERT INTO pt_deductions
        (id, tenant_id, branch_id, staff_id, payroll_id, wage_month, state_code, gross_wages, pt_amount, status, created_at)
      VALUES
        (@id, @tenant_id, @branch_id, @staff_id, @payroll_id, @wage_month, @state_code, @gross_wages, @pt_amount, @status, @created_at)
      ON CONFLICT(tenant_id, staff_id, payroll_id, wage_month) DO UPDATE SET
        branch_id = excluded.branch_id, state_code = excluded.state_code, gross_wages = excluded.gross_wages,
        pt_amount = excluded.pt_amount, status = 'pending'
    `).run(row);
    logCompliance({ tenantId: access.tenantId, branchId: row.branch_id, module: "pt", action: "calculate", entityId: row.staff_id, newValue: row, access });
    emitCompliance("compliance:pt_calculated", { staffId: row.staff_id, wageMonth: row.wage_month }, access, row.branch_id);
    return row;
  }

  calculateBatch(payload = {}, access = {}) {
    const rows = payrollRowsForMonth({ tenantId: access.tenantId, branchId: payload.branchId || "", wageMonth: payload.wageMonth || wageMonth() });
    const tx = db.transaction((payrollRows) => payrollRows.map((payroll) => this.calculate({ payrollId: payroll.id }, access)));
    return { count: rows.length, rows: tx(rows) };
  }

  slabs(stateCode, access = {}) {
    return db.prepare("SELECT * FROM pt_slab_master WHERE tenant_id = ? AND state_code = ? ORDER BY slab_min ASC")
      .all(access.tenantId, String(stateCode || "").toUpperCase());
  }

  updateSlab(payload = {}, access = {}) {
    if (!payload.stateCode || payload.slabMin == null || payload.monthlyTax == null || !payload.effectiveFrom) {
      throw badRequest("stateCode, slabMin, monthlyTax and effectiveFrom are required");
    }
    const row = {
      id: makeId("pt_slab"),
      tenant_id: access.tenantId,
      state_code: String(payload.stateCode).toUpperCase(),
      effective_from: payload.effectiveFrom,
      effective_to: payload.effectiveTo || "",
      slab_min: Number(payload.slabMin),
      slab_max: payload.slabMax == null ? null : Number(payload.slabMax),
      monthly_tax: Number(payload.monthlyTax),
      gender_specific: payload.genderSpecific || "all",
      special_month: payload.specialMonth || "",
      special_month_tax: payload.specialMonthTax == null ? null : Number(payload.specialMonthTax),
      created_at: now()
    };
    db.prepare(`
      INSERT INTO pt_slab_master
        (id, tenant_id, state_code, effective_from, effective_to, slab_min, slab_max, monthly_tax, gender_specific, special_month, special_month_tax, created_at)
      VALUES
        (@id, @tenant_id, @state_code, @effective_from, @effective_to, @slab_min, @slab_max, @monthly_tax, @gender_specific, @special_month, @special_month_tax, @created_at)
    `).run(row);
    logCompliance({ tenantId: access.tenantId, module: "pt", action: "rate_update", entityId: row.id, newValue: row, access, severity: "warning" });
    emitCompliance("compliance:rate_updated", { module: "pt", id: row.id }, access);
    return row;
  }

  list(query = {}, access = {}) {
    return db.prepare(`
      SELECT * FROM pt_deductions
      WHERE tenant_id = ? AND (? = '' OR branch_id = ?) AND (? = '' OR wage_month = ?)
      ORDER BY wage_month DESC, created_at DESC LIMIT ?
    `).all(access.tenantId, query.branchId || "", query.branchId || "", query.wageMonth || "", query.wageMonth || "", Number(query.limit || 100));
  }

  generateReturn(payload = {}, access = {}) {
    const branchId = payload.branchId || access.branchId || "";
    const period = payload.returnPeriod || payload.wageMonth || wageMonth();
    const rows = db.prepare(`
      SELECT * FROM pt_deductions
      WHERE tenant_id = ? AND (? = '' OR branch_id = ?) AND wage_month = ?
      ORDER BY state_code, staff_id
    `).all(access.tenantId, branchId, branchId, period);
    if (!rows.length) throw badRequest("No PT deductions found for this period");
    const stateCode = payload.stateCode || rows[0]?.state_code || "";
    const filePath = writeComplianceFile(
      `uploads/compliance/pt/PT_${stateCode}_${period}.csv`,
      ["staff_id,state_code,gross_wages,pt_amount", ...rows.map((row) => [row.staff_id, row.state_code, row.gross_wages, row.pt_amount].join(","))].join("\n")
    );
    const record = {
      id: makeId("pt_ret"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      state_code: stateCode,
      return_period: period,
      return_type: payload.returnType || "monthly",
      file_path: filePath,
      total_employees: rows.length,
      total_pt: money(rows.reduce((sum, row) => sum + Number(row.pt_amount || 0), 0)),
      status: "generated",
      generated_at: now()
    };
    db.prepare(`
      INSERT INTO pt_returns
        (id, tenant_id, branch_id, state_code, return_period, return_type, file_path, total_employees, total_pt, status, generated_at)
      VALUES
        (@id, @tenant_id, @branch_id, @state_code, @return_period, @return_type, @file_path, @total_employees, @total_pt, @status, @generated_at)
    `).run(record);
    logCompliance({ tenantId: access.tenantId, branchId, module: "pt", action: "return_generated", entityId: record.id, newValue: record, access });
    emitCompliance("compliance:return_generated", { module: "pt", id: record.id }, access, branchId);
    return record;
  }

  returns(query = {}, access = {}) {
    return db.prepare("SELECT * FROM pt_returns WHERE tenant_id = ? AND (? = '' OR branch_id = ?) ORDER BY generated_at DESC LIMIT ?")
      .all(access.tenantId, query.branchId || "", query.branchId || "", Number(query.limit || 50));
  }

  getReturn(id, access = {}) {
    const row = db.prepare("SELECT * FROM pt_returns WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("PT return not found");
    return row;
  }
}

export const ptService = new PtService();
