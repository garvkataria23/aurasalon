import { db } from "../../db.js";
import { badRequest } from "../../utils/app-error.js";
import { fiscalYear, logCompliance, makeId, money, now, salaryParts, writeComplianceFile } from "./compliance-utils.js";

export class BonusService {
  eligibleStaff(fy = fiscalYear(), access = {}) {
    const rows = db.prepare(`
      SELECT s.*, p.basic, p.grossPay, p.periodEnd
      FROM staff s
      LEFT JOIN staff_payroll_components p ON p.tenantId = s.tenantId AND p.staffId = s.id
      WHERE s.tenantId = ?
      GROUP BY s.id
      ORDER BY s.name
    `).all(access.tenantId);
    return rows.map((row) => {
      const parts = salaryParts(row);
      return {
        staffId: row.id,
        name: row.name,
        fy,
        monthlyGross: Number(row.grossPay || parts.gross || 0),
        eligible: Number(row.grossPay || parts.gross || 0) <= 21000
      };
    }).filter((row) => row.eligible);
  }

  calculate(fy = fiscalYear(), payload = {}, access = {}) {
    const rows = payload.staffId ? this.eligibleStaff(fy, access).filter((row) => row.staffId === payload.staffId) : this.eligibleStaff(fy, access);
    if (payload.staffId && !rows.length) throw badRequest("Staff is not eligible for Bonus Act calculation");
    const percentage = Number(payload.bonusPercentage ?? 8.33);
    const tx = db.transaction((eligibleRows) => eligibleRows.map((staff) => {
      const bonusWages = Math.max(7000, Math.min(Number(staff.monthlyGross || 0), 21000)) * 12;
      const bonusAmount = money((bonusWages * percentage) / 100);
      const row = {
        id: makeId("bonus"),
        tenant_id: access.tenantId,
        staff_id: staff.staffId,
        fy,
        bonus_wages: bonusWages,
        working_days: Number(payload.workingDays || 365),
        bonus_percentage: percentage,
        bonus_amount: bonusAmount,
        exgratia_amount: Number(payload.exgratiaAmount || 0),
        total_payable: money(bonusAmount + Number(payload.exgratiaAmount || 0)),
        paid_date: "",
        status: "pending",
        created_at: now()
      };
      db.prepare(`
        INSERT INTO bonus_calculations
          (id, tenant_id, staff_id, fy, bonus_wages, working_days, bonus_percentage, bonus_amount, exgratia_amount, total_payable, paid_date, status, created_at)
        VALUES
          (@id, @tenant_id, @staff_id, @fy, @bonus_wages, @working_days, @bonus_percentage, @bonus_amount, @exgratia_amount, @total_payable, @paid_date, @status, @created_at)
        ON CONFLICT(tenant_id, staff_id, fy) DO UPDATE SET
          bonus_wages = excluded.bonus_wages, working_days = excluded.working_days, bonus_percentage = excluded.bonus_percentage,
          bonus_amount = excluded.bonus_amount, exgratia_amount = excluded.exgratia_amount, total_payable = excluded.total_payable,
          status = 'pending'
      `).run(row);
      return row;
    }));
    const results = tx(rows);
    logCompliance({ tenantId: access.tenantId, module: "bonus", action: "calculate", entityId: fy, newValue: { count: results.length }, access });
    return { count: results.length, rows: results };
  }

  approve(payload = {}, access = {}) {
    const fy = payload.fy || fiscalYear();
    const result = db.prepare("UPDATE bonus_calculations SET status = 'approved' WHERE tenant_id = ? AND fy = ? AND (? = '' OR staff_id = ?)")
      .run(access.tenantId, fy, payload.staffId || "", payload.staffId || "");
    logCompliance({ tenantId: access.tenantId, module: "bonus", action: "approve", entityId: fy, newValue: payload, access, severity: "warning" });
    return { updated: result.changes };
  }

  disburse(payload = {}, access = {}) {
    const fy = payload.fy || fiscalYear();
    const paidDate = payload.paidDate || now().slice(0, 10);
    const result = db.prepare("UPDATE bonus_calculations SET status = 'paid', paid_date = ? WHERE tenant_id = ? AND fy = ? AND status IN ('approved','pending')")
      .run(paidDate, access.tenantId, fy);
    logCompliance({ tenantId: access.tenantId, module: "bonus", action: "disburse", entityId: fy, newValue: payload, access, severity: "warning" });
    return { updated: result.changes, paidDate };
  }

  formC(fy = fiscalYear(), access = {}) {
    const rows = db.prepare("SELECT * FROM bonus_calculations WHERE tenant_id = ? AND fy = ? ORDER BY staff_id").all(access.tenantId, fy);
    const filePath = writeComplianceFile(`uploads/compliance/bonus/FormC_${fy}.csv`, [
      "staff_id,bonus_wages,bonus_percentage,total_payable,status",
      ...rows.map((row) => [row.staff_id, row.bonus_wages, row.bonus_percentage, row.total_payable, row.status].join(","))
    ].join("\n"));
    return { fy, filePath, rows };
  }
}

export const bonusService = new BonusService();
