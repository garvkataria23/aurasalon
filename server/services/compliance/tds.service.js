import { db } from "../../db.js";
import { badRequest, conflict, notFound } from "../../utils/app-error.js";
import {
  assertFyOpen,
  emitCompliance,
  fiscalYear,
  logCompliance,
  makeId,
  money,
  monthsRemainingInFy,
  now,
  payrollById,
  payrollRowsForMonth,
  salaryParts,
  staffById,
  staffStatutoryProfile,
  wageMonth,
  writeComplianceFile,
  readComplianceFile
} from "./compliance-utils.js";

function declarationFor(staffId, fy, access) {
  return db.prepare("SELECT * FROM staff_tax_declaration WHERE tenant_id = ? AND staff_id = ? AND fy = ?")
    .get(access.tenantId, staffId, fy) || null;
}

function slabsFor(tenantId, fy, regime) {
  const rows = db.prepare(`
    SELECT * FROM tds_regime_master
    WHERE tenant_id = ? AND fy = ? AND regime_type = ?
    ORDER BY slab_min ASC
  `).all(tenantId, fy, regime);
  if (rows.length) return rows;
  if (regime === "old") {
    return [
      { slab_min: 0, slab_max: 250000, tax_rate: 0, standard_deduction: 50000 },
      { slab_min: 250000, slab_max: 500000, tax_rate: 5, standard_deduction: 50000 },
      { slab_min: 500000, slab_max: 1000000, tax_rate: 20, standard_deduction: 50000 },
      { slab_min: 1000000, slab_max: null, tax_rate: 30, standard_deduction: 50000 }
    ];
  }
  return [
    { slab_min: 0, slab_max: 300000, tax_rate: 0, standard_deduction: 75000 },
    { slab_min: 300000, slab_max: 700000, tax_rate: 5, standard_deduction: 75000 },
    { slab_min: 700000, slab_max: 1000000, tax_rate: 10, standard_deduction: 75000 },
    { slab_min: 1000000, slab_max: 1200000, tax_rate: 15, standard_deduction: 75000 },
    { slab_min: 1200000, slab_max: 1500000, tax_rate: 20, standard_deduction: 75000 },
    { slab_min: 1500000, slab_max: null, tax_rate: 30, standard_deduction: 75000 }
  ];
}

function taxOnSlabs(taxableIncome, slabs) {
  return slabs.reduce((tax, slab) => {
    const min = Number(slab.slab_min || 0);
    const max = slab.slab_max == null ? taxableIncome : Number(slab.slab_max);
    if (taxableIncome <= min) return tax;
    const slice = Math.max(0, Math.min(taxableIncome, max) - min);
    return tax + (slice * Number(slab.tax_rate || 0)) / 100;
  }, 0);
}

function surchargeRate(income, regime) {
  if (income > 50000000) return regime === "new" ? 25 : 37;
  if (income > 20000000) return 25;
  if (income > 10000000) return 15;
  if (income > 5000000) return 10;
  return 0;
}

function oldRegimeDeductions(declaration = {}, parts = {}) {
  const basicAnnual = Number(parts.basic || 0) * 12;
  const hraReceived = Number(declaration.hra_received || 0);
  const rentPaid = Number(declaration.rent_paid || 0);
  const hraExemption = Math.max(0, Math.min(
    hraReceived,
    rentPaid - basicAnnual * 0.1,
    basicAnnual * (Number(declaration.metro_city || 0) ? 0.5 : 0.4)
  ));
  return money(
    50000 +
    Math.min(Number(declaration.sec_80c || 0), 150000) +
    Math.min(Number(declaration.sec_80d_self || 0), 25000) +
    Math.min(Number(declaration.sec_80d_parents || 0), 50000) +
    Math.min(Number(declaration.sec_80ccd_1b || 0), 50000) +
    Math.min(Number(declaration.home_loan_interest || 0), 200000) +
    Number(declaration.sec_80e || 0) +
    Number(declaration.sec_80g || 0) +
    Number(declaration.sec_80tta || 0) +
    hraExemption +
    Number(declaration.lta_claimed || 0)
  );
}

export class TdsService {
  declaration(payload = {}, access = {}) {
    const staff = staffById(payload.staffId, access);
    const fy = payload.fy || fiscalYear();
    const existing = declarationFor(staff.id, fy, access);
    if (existing?.locked) throw conflict("Tax declaration is locked for this FY");
    const row = {
      id: existing?.id || makeId("tds_decl"),
      tenant_id: access.tenantId,
      staff_id: staff.id,
      fy,
      regime: payload.regime || existing?.regime || staffStatutoryProfile(staff.id, access).tax_regime || "new",
      hra_received: Number(payload.hraReceived ?? existing?.hra_received ?? 0),
      rent_paid: Number(payload.rentPaid ?? existing?.rent_paid ?? 0),
      metro_city: Number(payload.metroCity ?? existing?.metro_city ?? 0),
      lta_claimed: Number(payload.ltaClaimed ?? existing?.lta_claimed ?? 0),
      sec_80c: Number(payload.sec80c ?? existing?.sec_80c ?? 0),
      sec_80d_self: Number(payload.sec80dSelf ?? existing?.sec_80d_self ?? 0),
      sec_80d_parents: Number(payload.sec80dParents ?? existing?.sec_80d_parents ?? 0),
      sec_80ccd_1b: Number(payload.sec80ccd1b ?? existing?.sec_80ccd_1b ?? 0),
      sec_80e: Number(payload.sec80e ?? existing?.sec_80e ?? 0),
      sec_80g: Number(payload.sec80g ?? existing?.sec_80g ?? 0),
      sec_80tta: Number(payload.sec80tta ?? existing?.sec_80tta ?? 0),
      home_loan_interest: Number(payload.homeLoanInterest ?? existing?.home_loan_interest ?? 0),
      other_income: Number(payload.otherIncome ?? existing?.other_income ?? 0),
      previous_employer_income: Number(payload.previousEmployerIncome ?? existing?.previous_employer_income ?? 0),
      previous_employer_tds: Number(payload.previousEmployerTds ?? existing?.previous_employer_tds ?? 0),
      proof_submitted: Number(payload.proofSubmitted ?? existing?.proof_submitted ?? 0),
      proof_verified: Number(payload.proofVerified ?? existing?.proof_verified ?? 0),
      locked: Number(existing?.locked || 0),
      created_at: existing?.created_at || now(),
      updated_at: now()
    };
    db.prepare(`
      INSERT INTO staff_tax_declaration
        (id, tenant_id, staff_id, fy, regime, hra_received, rent_paid, metro_city, lta_claimed,
         sec_80c, sec_80d_self, sec_80d_parents, sec_80ccd_1b, sec_80e, sec_80g, sec_80tta,
         home_loan_interest, other_income, previous_employer_income, previous_employer_tds,
         proof_submitted, proof_verified, locked, created_at, updated_at)
      VALUES
        (@id, @tenant_id, @staff_id, @fy, @regime, @hra_received, @rent_paid, @metro_city, @lta_claimed,
         @sec_80c, @sec_80d_self, @sec_80d_parents, @sec_80ccd_1b, @sec_80e, @sec_80g, @sec_80tta,
         @home_loan_interest, @other_income, @previous_employer_income, @previous_employer_tds,
         @proof_submitted, @proof_verified, @locked, @created_at, @updated_at)
      ON CONFLICT(tenant_id, staff_id, fy) DO UPDATE SET
        regime = excluded.regime, hra_received = excluded.hra_received, rent_paid = excluded.rent_paid,
        metro_city = excluded.metro_city, lta_claimed = excluded.lta_claimed, sec_80c = excluded.sec_80c,
        sec_80d_self = excluded.sec_80d_self, sec_80d_parents = excluded.sec_80d_parents,
        sec_80ccd_1b = excluded.sec_80ccd_1b, sec_80e = excluded.sec_80e, sec_80g = excluded.sec_80g,
        sec_80tta = excluded.sec_80tta, home_loan_interest = excluded.home_loan_interest,
        other_income = excluded.other_income, previous_employer_income = excluded.previous_employer_income,
        previous_employer_tds = excluded.previous_employer_tds, proof_submitted = excluded.proof_submitted,
        proof_verified = excluded.proof_verified, updated_at = excluded.updated_at
    `).run(row);
    logCompliance({ tenantId: access.tenantId, branchId: staff.branchId || "", module: "tds", action: "declaration_submitted", entityId: staff.id, newValue: row, access });
    emitCompliance("compliance:declaration_submitted", { staffId: staff.id, fy }, access, staff.branchId || "");
    return row;
  }

  getDeclaration(staffId, fy, access = {}) {
    staffById(staffId, access);
    return declarationFor(staffId, fy, access) || { staff_id: staffId, fy, regime: "new" };
  }

  lockDeclaration(payload = {}, access = {}) {
    const result = db.prepare("UPDATE staff_tax_declaration SET locked = 1, updated_at = ? WHERE tenant_id = ? AND staff_id = ? AND fy = ?")
      .run(now(), access.tenantId, payload.staffId, payload.fy);
    if (!result.changes) throw notFound("Tax declaration not found");
    logCompliance({ tenantId: access.tenantId, module: "tds", action: "declaration_locked", entityId: payload.staffId, newValue: payload, access, severity: "warning" });
    return { locked: true };
  }

  markProof(payload = {}, access = {}) {
    const flag = payload.verified ? "proof_verified" : "proof_submitted";
    const result = db.prepare(`UPDATE staff_tax_declaration SET ${flag} = 1, updated_at = ? WHERE tenant_id = ? AND staff_id = ? AND fy = ?`)
      .run(now(), access.tenantId, payload.staffId, payload.fy);
    if (!result.changes) throw notFound("Tax declaration not found");
    logCompliance({ tenantId: access.tenantId, module: "tds", action: payload.verified ? "proof_verified" : "proof_uploaded", entityId: payload.staffId, newValue: payload, access, severity: payload.verified ? "warning" : "info" });
    if (payload.verified) emitCompliance("compliance:proof_verified", { staffId: payload.staffId, fy: payload.fy }, access);
    return { updated: true };
  }

  computeAnnualTax({ staffId, payroll = {}, payrollId = "", fy = fiscalYear(), regime = "", projectedAnnualIncome = null } = {}, access = {}) {
    const staff = staffById(staffId || payroll.staffId, access);
    const profile = staffStatutoryProfile(staff.id, access);
    const declaration = declarationFor(staff.id, fy, access) || {};
    const selectedRegime = regime || declaration.regime || profile.tax_regime || "new";
    const parts = salaryParts(payroll);
    const annualSalary = Number(projectedAnnualIncome ?? (parts.gross || 0) * 12);
    const grossAnnual = money(annualSalary + Number(declaration.other_income || 0) + Number(declaration.previous_employer_income || 0));
    const deduction = selectedRegime === "old" ? oldRegimeDeductions(declaration, parts) : 75000;
    const taxableIncome = Math.max(0, money(grossAnnual - deduction));
    const slabs = slabsFor(access.tenantId, fy, selectedRegime);
    let baseTax = money(taxOnSlabs(taxableIncome, slabs));
    if (selectedRegime === "new" && taxableIncome <= 700000) baseTax = 0;
    if (selectedRegime === "old" && taxableIncome <= 500000) baseTax = Math.max(0, baseTax - 12500);
    const surchargePct = surchargeRate(taxableIncome, selectedRegime);
    const surcharge = money((baseTax * surchargePct) / 100);
    const cess = money(((baseTax + surcharge) * 4) / 100);
    const projectedAnnualTax = money(baseTax + surcharge + cess);
    const already = Number(db.prepare(`
      SELECT COALESCE(SUM(tds_this_month), 0) AS total
      FROM tds_deductions
      WHERE tenant_id = ? AND staff_id = ? AND fy = ? AND (? = '' OR payroll_id <> ?)
    `).get(access.tenantId, staff.id, fy, payrollId || "", payrollId || "")?.total || 0) + Number(declaration.previous_employer_tds || 0);
    return {
      staffId: staff.id,
      fy,
      regime: selectedRegime,
      grossAnnual,
      deduction,
      taxableIncome,
      baseTax,
      surcharge,
      cess,
      projectedAnnualTax,
      taxAlreadyDeducted: money(already)
    };
  }

  preview(payload = {}, access = {}) {
    const payroll = payload.payrollId ? payrollById(payload.payrollId, access) : payload.payroll || {};
    const staffId = payload.staffId || payroll.staffId;
    const month = payload.wageMonth || wageMonth(payroll.periodEnd || now());
    const fy = payload.fy || fiscalYear(`${month}-01`);
    const tax = this.computeAnnualTax({ staffId, payroll, payrollId: payload.payrollId || payroll.id || "", fy, regime: payload.regime, projectedAnnualIncome: payload.projectedAnnualIncome }, access);
    const remaining = Number(payload.monthsRemaining || monthsRemainingInFy(month));
    const tdsThisMonth = money(Math.max(0, tax.projectedAnnualTax - tax.taxAlreadyDeducted) / remaining);
    const staff = staffById(staffId, access);
    return {
      ...tax,
      payrollId: payload.payrollId || payroll.id || "manual",
      branchId: payload.branchId || payroll.branchId || staff.branchId || access.branchId || "",
      wageMonth: month,
      monthsRemaining: remaining,
      tdsThisMonth
    };
  }

  calculate(payload = {}, access = {}) {
    const result = this.preview(payload, access);
    assertFyOpen(access.tenantId, result.fy);
    const row = {
      id: makeId("tds"),
      tenant_id: access.tenantId,
      branch_id: result.branchId,
      staff_id: result.staffId,
      payroll_id: result.payrollId,
      wage_month: result.wageMonth,
      fy: result.fy,
      projected_annual_income: result.grossAnnual,
      projected_annual_tax: result.projectedAnnualTax,
      tax_already_deducted: result.taxAlreadyDeducted,
      months_remaining: result.monthsRemaining,
      tds_this_month: result.tdsThisMonth,
      regime_used: result.regime,
      status: "pending",
      created_at: now()
    };
    db.prepare(`
      INSERT INTO tds_deductions
        (id, tenant_id, branch_id, staff_id, payroll_id, wage_month, fy, projected_annual_income,
         projected_annual_tax, tax_already_deducted, months_remaining, tds_this_month, regime_used, status, created_at)
      VALUES
        (@id, @tenant_id, @branch_id, @staff_id, @payroll_id, @wage_month, @fy, @projected_annual_income,
         @projected_annual_tax, @tax_already_deducted, @months_remaining, @tds_this_month, @regime_used, @status, @created_at)
      ON CONFLICT(tenant_id, staff_id, payroll_id, wage_month) DO UPDATE SET
        branch_id = excluded.branch_id, fy = excluded.fy, projected_annual_income = excluded.projected_annual_income,
        projected_annual_tax = excluded.projected_annual_tax, tax_already_deducted = excluded.tax_already_deducted,
        months_remaining = excluded.months_remaining, tds_this_month = excluded.tds_this_month,
        regime_used = excluded.regime_used, status = 'pending'
    `).run(row);
    logCompliance({ tenantId: access.tenantId, branchId: row.branch_id, module: "tds", action: "calculate", entityId: row.staff_id, newValue: row, access });
    emitCompliance("compliance:tds_calculated", { staffId: row.staff_id, wageMonth: row.wage_month }, access, row.branch_id);
    return row;
  }

  calculateBatch(payload = {}, access = {}) {
    const rows = payrollRowsForMonth({ tenantId: access.tenantId, branchId: payload.branchId || "", wageMonth: payload.wageMonth || wageMonth() });
    const tx = db.transaction((payrollRows) => payrollRows.map((payroll) => this.calculate({ payrollId: payroll.id, fy: payload.fy }, access)));
    return { count: rows.length, rows: tx(rows) };
  }

  generateForm24q(payload = {}, access = {}) {
    const fy = payload.fy || fiscalYear();
    const quarter = payload.quarter || "Q1";
    const branchId = payload.branchId || access.branchId || "";
    const rows = db.prepare("SELECT * FROM tds_deductions WHERE tenant_id = ? AND fy = ? AND (? = '' OR branch_id = ?) ORDER BY staff_id")
      .all(access.tenantId, fy, branchId, branchId);
    const content = [
      `FH|AuraShine|24Q|${fy}|${quarter}`,
      `BH|${access.tenantId}|${branchId}|${rows.length}`,
      ...rows.map((row) => `DD|${row.staff_id}|${row.wage_month}|${row.projected_annual_income}|${row.tds_this_month}|${row.regime_used}`)
    ].join("\n");
    const id = makeId("form24q");
    const filePath = writeComplianceFile(`uploads/compliance/tds/Form24Q_${branchId || "tenant"}_${fy}_${quarter}.txt`, content);
    const record = {
      id,
      tenant_id: access.tenantId,
      branch_id: branchId,
      fy,
      quarter,
      file_path: filePath,
      total_deductees: new Set(rows.map((row) => row.staff_id)).size,
      total_tds: money(rows.reduce((sum, row) => sum + Number(row.tds_this_month || 0), 0)),
      status: "generated",
      rrr_number: payload.rrrNumber || "",
      generated_at: now()
    };
    db.prepare(`
      INSERT INTO form_24q
        (id, tenant_id, branch_id, fy, quarter, file_path, total_deductees, total_tds, status, rrr_number, generated_at)
      VALUES
        (@id, @tenant_id, @branch_id, @fy, @quarter, @file_path, @total_deductees, @total_tds, @status, @rrr_number, @generated_at)
    `).run(record);
    logCompliance({ tenantId: access.tenantId, branchId, module: "tds", action: "form_24q_generated", entityId: id, newValue: record, access });
    emitCompliance("compliance:return_generated", { module: "tds", id, fy, quarter }, access, branchId);
    return record;
  }

  generateForm16(payload = {}, access = {}) {
    const staff = staffById(payload.staffId, access);
    const fy = payload.fy || fiscalYear();
    const tax = this.computeAnnualTax({ staffId: staff.id, fy, regime: payload.regime }, access);
    const content = [
      "AURASHINE FORM 16",
      `Staff: ${staff.name || staff.id}`,
      `FY: ${fy}`,
      `Total Salary: ${tax.grossAnnual}`,
      `Total TDS: ${tax.projectedAnnualTax}`,
      "This is a system generated Form 16 draft for HR verification."
    ].join("\n");
    const partA = writeComplianceFile(`uploads/compliance/tds/Form16_${staff.id}_${fy}_A.pdf`, content);
    const partB = writeComplianceFile(`uploads/compliance/tds/Form16_${staff.id}_${fy}_B.pdf`, content);
    const row = {
      id: makeId("form16"),
      tenant_id: access.tenantId,
      staff_id: staff.id,
      fy,
      part_a_pdf: partA,
      part_b_pdf: partB,
      total_salary: tax.grossAnnual,
      total_tds: tax.projectedAnnualTax,
      issued_at: now(),
      digital_signature: payload.digitalSignature || ""
    };
    db.prepare(`
      INSERT INTO form_16
        (id, tenant_id, staff_id, fy, part_a_pdf, part_b_pdf, total_salary, total_tds, issued_at, digital_signature)
      VALUES
        (@id, @tenant_id, @staff_id, @fy, @part_a_pdf, @part_b_pdf, @total_salary, @total_tds, @issued_at, @digital_signature)
      ON CONFLICT(tenant_id, staff_id, fy) DO UPDATE SET
        part_a_pdf = excluded.part_a_pdf, part_b_pdf = excluded.part_b_pdf, total_salary = excluded.total_salary,
        total_tds = excluded.total_tds, issued_at = excluded.issued_at, digital_signature = excluded.digital_signature
    `).run(row);
    logCompliance({ tenantId: access.tenantId, branchId: staff.branchId || "", module: "tds", action: "form_16_issued", entityId: staff.id, newValue: row, access, severity: "warning" });
    emitCompliance("compliance:form_16_issued", { staffId: staff.id, fy }, access, staff.branchId || "");
    return row;
  }

  downloadForm16(staffId, fy, access = {}) {
    const row = db.prepare("SELECT * FROM form_16 WHERE tenant_id = ? AND staff_id = ? AND fy = ?").get(access.tenantId, staffId, fy);
    if (!row) throw notFound("Form 16 not found");
    return { row, content: readComplianceFile(row.part_b_pdf || row.part_a_pdf) };
  }

  regimeComparison(staffId, fy, access = {}) {
    const payroll = db.prepare("SELECT * FROM staff_payroll_components WHERE tenantId = ? AND staffId = ? ORDER BY periodEnd DESC LIMIT 1")
      .get(access.tenantId, staffId) || { staffId };
    return {
      staffId,
      fy,
      old: this.computeAnnualTax({ staffId, payroll, fy, regime: "old" }, access),
      new: this.computeAnnualTax({ staffId, payroll, fy, regime: "new" }, access)
    };
  }
}

export const tdsService = new TdsService();
