import { db } from "../../db.js";
import { fiscalYear, money, now } from "./compliance-utils.js";

const CALENDAR = [
  { key: "pf_challan", label: "PF challan", dueRule: "15th of next month", module: "pf" },
  { key: "esi_challan", label: "ESI challan", dueRule: "15th of next month", module: "esi" },
  { key: "pt_mh", label: "PT Maharashtra", dueRule: "30th of next month", module: "pt" },
  { key: "pt_ka", label: "PT Karnataka", dueRule: "20th of next month", module: "pt" },
  { key: "tds_payment", label: "TDS payment", dueRule: "7th of next month", module: "tds" },
  { key: "tds_q1", label: "24Q Q1", dueRule: "Jul 31", module: "tds" },
  { key: "tds_q2", label: "24Q Q2", dueRule: "Oct 31", module: "tds" },
  { key: "tds_q3", label: "24Q Q3", dueRule: "Jan 31", module: "tds" },
  { key: "tds_q4", label: "24Q Q4", dueRule: "May 31", module: "tds" },
  { key: "form_16", label: "Form 16", dueRule: "Jun 15", module: "tds" },
  { key: "bonus", label: "Bonus payment", dueRule: "Nov 30", module: "bonus" },
  { key: "lwf_jun", label: "LWF June", dueRule: "Jun 30", module: "lwf" },
  { key: "lwf_dec", label: "LWF December", dueRule: "Dec 31", module: "lwf" }
];

function countPending(table, tenantId) {
  try {
    return db.prepare(`SELECT COUNT(*) AS count FROM ${table} WHERE tenant_id = ? AND status = 'pending'`).get(tenantId)?.count || 0;
  } catch {
    return 0;
  }
}

function sumColumn(table, column, tenantId, where = "1=1") {
  try {
    return Number(db.prepare(`SELECT COALESCE(SUM(${column}), 0) AS total FROM ${table} WHERE tenant_id = ? AND ${where}`).get(tenantId)?.total || 0);
  } catch {
    return 0;
  }
}

export class ComplianceDashboardService {
  dashboard(access = {}) {
    const tenantId = access.tenantId;
    const fy = fiscalYear();
    const modules = {
      pf: {
        pending: countPending("pf_contributions", tenantId),
        totalEmployee: money(sumColumn("pf_contributions", "total_employee", tenantId, `fy = '${fy}'`)),
        totalEmployer: money(sumColumn("pf_contributions", "total_employer", tenantId, `fy = '${fy}'`))
      },
      esi: {
        pending: countPending("esi_contributions", tenantId),
        total: money(sumColumn("esi_contributions", "total_esi", tenantId, `fy = '${fy}'`))
      },
      pt: {
        pending: countPending("pt_deductions", tenantId),
        total: money(sumColumn("pt_deductions", "pt_amount", tenantId))
      },
      tds: {
        pending: countPending("tds_deductions", tenantId),
        total: money(sumColumn("tds_deductions", "tds_this_month", tenantId, `fy = '${fy}'`))
      },
      bonus: {
        pending: countPending("bonus_calculations", tenantId),
        total: money(sumColumn("bonus_calculations", "total_payable", tenantId, `fy = '${fy}'`))
      },
      lwf: {
        pending: countPending("lwf_contributions", tenantId),
        total: money(sumColumn("lwf_contributions", "total_amount", tenantId))
      }
    };
    const pendingTotal = Object.values(modules).reduce((sum, item) => sum + Number(item.pending || 0), 0);
    return {
      ok: true,
      fy,
      asOf: now(),
      modules,
      complianceScore: Math.max(0, 100 - pendingTotal * 3),
      upcomingDeadlines: this.upcomingDeadlines()
    };
  }

  upcomingDeadlines() {
    return CALENDAR.map((item) => ({ ...item, status: "scheduled" }));
  }

  pendingActions(access = {}) {
    const data = this.dashboard(access);
    return Object.entries(data.modules)
      .filter(([, value]) => Number(value.pending || 0) > 0)
      .map(([module, value]) => ({ module, pending: value.pending }));
  }

  fySummary(fy = fiscalYear(), access = {}) {
    return {
      fy,
      pf: money(sumColumn("pf_contributions", "total_employee + total_employer", access.tenantId, `fy = '${fy}'`)),
      esi: money(sumColumn("esi_contributions", "total_esi", access.tenantId, `fy = '${fy}'`)),
      tds: money(sumColumn("tds_deductions", "tds_this_month", access.tenantId, `fy = '${fy}'`)),
      bonus: money(sumColumn("bonus_calculations", "total_payable", access.tenantId, `fy = '${fy}'`))
    };
  }

  complianceScore(access = {}) {
    return { score: this.dashboard(access).complianceScore, computedAt: now() };
  }

  report(module, query = {}, access = {}) {
    const fy = query.fy || fiscalYear();
    if (module === "pf-monthly") return db.prepare("SELECT * FROM pf_contributions WHERE tenant_id = ? AND (? = '' OR wage_month = ?)").all(access.tenantId, query.wageMonth || "", query.wageMonth || "");
    if (module === "esi-half-yearly") return db.prepare("SELECT * FROM esi_contributions WHERE tenant_id = ? AND (? = '' OR contribution_period = ?)").all(access.tenantId, query.contributionPeriod || "", query.contributionPeriod || "");
    if (module === "pt-monthly") return db.prepare("SELECT * FROM pt_deductions WHERE tenant_id = ? AND (? = '' OR wage_month = ?)").all(access.tenantId, query.wageMonth || "", query.wageMonth || "");
    if (module === "tds-quarterly") return db.prepare("SELECT * FROM tds_deductions WHERE tenant_id = ? AND fy = ?").all(access.tenantId, fy);
    if (module === "audit-trail") return db.prepare("SELECT * FROM compliance_audit_events WHERE tenant_id = ? ORDER BY created_at DESC LIMIT ?").all(access.tenantId, Number(query.limit || 200));
    return {
      fy,
      dashboard: this.dashboard(access),
      pf: db.prepare("SELECT * FROM pf_contributions WHERE tenant_id = ? AND fy = ?").all(access.tenantId, fy),
      esi: db.prepare("SELECT * FROM esi_contributions WHERE tenant_id = ? AND fy = ?").all(access.tenantId, fy),
      tds: db.prepare("SELECT * FROM tds_deductions WHERE tenant_id = ? AND fy = ?").all(access.tenantId, fy)
    };
  }
}

export const complianceDashboardService = new ComplianceDashboardService();
