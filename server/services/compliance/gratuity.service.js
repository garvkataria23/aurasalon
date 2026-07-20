import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { fiscalYear, latestPayrollForStaff, logCompliance, makeId, money, now, salaryParts, staffById } from "./compliance-utils.js";

function yearsBetween(start, end) {
  if (!start) return 0;
  const from = new Date(start);
  const to = new Date(end || now());
  const months = Math.max(0, (to.getUTCFullYear() - from.getUTCFullYear()) * 12 + to.getUTCMonth() - from.getUTCMonth());
  const years = Math.floor(months / 12);
  return months % 12 >= 6 ? years + 1 : years;
}

export class GratuityService {
  calculate(staffId, payload = {}, access = {}) {
    const staff = staffById(staffId, access);
    const payroll = payload.payroll || latestPayrollForStaff(staffId, access) || {};
    const parts = salaryParts({ ...payroll, basic: payload.basic ?? payroll.basic });
    const exitDate = payload.exitDate || now();
    const years = Number(payload.yearsOfService ?? yearsBetween(staff.joiningDate, exitDate));
    const basicDa = Number(payload.lastDrawnBasicDa ?? Number(parts.basic || 0) + Number(parts.da || 0));
    const calculated = money((basicDa * 15 * years) / 26);
    const exempt = money(Math.min(calculated, 2000000, Number(payload.actualPaid ?? calculated)));
    const result = {
      staffId,
      exitDate,
      yearsOfService: years,
      lastDrawnBasicDa: money(basicDa),
      gratuityCalculated: calculated,
      gratuityExempt: exempt,
      gratuityTaxable: money(Math.max(0, Number(payload.actualPaid ?? calculated) - exempt)),
      eligible: years >= 5 || Boolean(payload.deathOrDisability)
    };
    logCompliance({ tenantId: access.tenantId, branchId: staff.branchId || "", module: "gratuity", action: "calculate", entityId: staffId, newValue: result, access });
    return result;
  }

  provisionMonthly(payload = {}, access = {}) {
    const fy = payload.fy || fiscalYear();
    const staffRows = payload.staffId
      ? [staffById(payload.staffId, access)]
      : db.prepare("SELECT * FROM staff WHERE tenantId = ? AND (? = '' OR branchId = ?)").all(access.tenantId, payload.branchId || "", payload.branchId || "");
    const rows = staffRows.map((staff) => {
      const calc = this.calculate(staff.id, { exitDate: payload.asOfDate || now() }, access);
      const provisioned = calc.eligible ? money(calc.gratuityCalculated / 12) : 0;
      const row = {
        id: makeId("grat_prov"),
        tenant_id: access.tenantId,
        staff_id: staff.id,
        fy,
        years_of_service: calc.yearsOfService,
        last_drawn_basic: calc.lastDrawnBasicDa,
        last_drawn_da: 0,
        gratuity_eligible_amount: calc.gratuityCalculated,
        provisioned_amount: provisioned,
        cumulative_provision: provisioned,
        status: "provisioned",
        created_at: now()
      };
      db.prepare(`
        INSERT INTO gratuity_provisions
          (id, tenant_id, staff_id, fy, years_of_service, last_drawn_basic, last_drawn_da, gratuity_eligible_amount, provisioned_amount, cumulative_provision, status, created_at)
        VALUES
          (@id, @tenant_id, @staff_id, @fy, @years_of_service, @last_drawn_basic, @last_drawn_da, @gratuity_eligible_amount, @provisioned_amount, @cumulative_provision, @status, @created_at)
      `).run(row);
      return row;
    });
    logCompliance({ tenantId: access.tenantId, branchId: payload.branchId || "", module: "gratuity", action: "provision_monthly", entityId: fy, newValue: { count: rows.length }, access });
    return { count: rows.length, rows };
  }

  provisions(query = {}, access = {}) {
    return db.prepare("SELECT * FROM gratuity_provisions WHERE tenant_id = ? AND (? = '' OR fy = ?) ORDER BY created_at DESC LIMIT ?")
      .all(access.tenantId, query.fy || "", query.fy || "", Number(query.limit || 100));
  }

  payout(payload = {}, access = {}) {
    if (!payload.staffId) throw badRequest("staffId is required");
    const calc = this.calculate(payload.staffId, payload, access);
    const row = {
      id: makeId("grat_pay"),
      tenant_id: access.tenantId,
      staff_id: payload.staffId,
      exit_date: calc.exitDate,
      years_of_service: calc.yearsOfService,
      last_drawn_basic_da: calc.lastDrawnBasicDa,
      gratuity_calculated: calc.gratuityCalculated,
      gratuity_exempt: calc.gratuityExempt,
      gratuity_taxable: calc.gratuityTaxable,
      payout_status: payload.payoutStatus || "pending",
      paid_on: payload.paidOn || "",
      fnf_id: payload.fnfId || ""
    };
    db.prepare(`
      INSERT INTO gratuity_payouts
        (id, tenant_id, staff_id, exit_date, years_of_service, last_drawn_basic_da, gratuity_calculated, gratuity_exempt, gratuity_taxable, payout_status, paid_on, fnf_id)
      VALUES
        (@id, @tenant_id, @staff_id, @exit_date, @years_of_service, @last_drawn_basic_da, @gratuity_calculated, @gratuity_exempt, @gratuity_taxable, @payout_status, @paid_on, @fnf_id)
    `).run(row);
    logCompliance({ tenantId: access.tenantId, module: "gratuity", action: "payout", entityId: row.id, newValue: row, access, severity: "warning" });
    return row;
  }

  eligibleStaff(query = {}, access = {}) {
    const rows = db.prepare("SELECT * FROM staff WHERE tenantId = ? AND (? = '' OR branchId = ?)").all(access.tenantId, query.branchId || "", query.branchId || "");
    return rows.map((staff) => ({ staffId: staff.id, name: staff.name, yearsOfService: yearsBetween(staff.joiningDate, now()) }))
      .filter((row) => row.yearsOfService >= 5);
  }

  payoutById(id, access = {}) {
    const row = db.prepare("SELECT * FROM gratuity_payouts WHERE tenant_id = ? AND id = ?").get(access.tenantId, id);
    if (!row) throw notFound("Gratuity payout not found");
    return row;
  }
}

export const gratuityService = new GratuityService();
