import { db } from "../db.js";
import {
  assertBranch,
  branchIdFrom,
  camel,
  emitStaffEvent,
  makeId,
  now,
  number,
  requireManager,
  requireTenant,
  scopedBranchWhere,
  staffAudit,
  toJson
} from "./staff-os-advanced-utils.js";

function daysBetween(start, end) {
  const from = new Date(`${start}T00:00:00Z`).getTime();
  const to = new Date(`${end}T00:00:00Z`).getTime();
  if (!Number.isFinite(from) || !Number.isFinite(to) || to < from) return 1;
  return Math.max(1, Math.round((to - from) / 86400000) + 1);
}

export class StaffManpowerForecastService {
  forecast(query = {}, access) {
    access = requireTenant(access);
    const branchId = query.branchId || query.branch_id || access.requestedBranchId || "";
    assertBranch(access, branchId);
    const periodStart = query.periodStart || query.period_start || now().slice(0, 10);
    const periodEnd = query.periodEnd || query.period_end || periodStart;
    return this.calculate(branchId, periodStart, periodEnd, query, access, false);
  }

  branchComparison(query = {}, access) {
    access = requireTenant(access);
    const branches = query.branchId
      ? [{ id: query.branchId }]
      : db.prepare("SELECT id FROM branches WHERE tenantId = ? ORDER BY name LIMIT 20").all(access.tenantId);
    return branches.map((branch) => this.calculate(branch.id, query.periodStart || now().slice(0, 10), query.periodEnd || query.periodStart || now().slice(0, 10), query, access, false));
  }

  recalculate(payload = {}, access) {
    access = requireTenant(access);
    requireManager(access);
    const branchId = branchIdFrom(payload, access);
    assertBranch(access, branchId);
    const result = this.calculate(branchId, payload.periodStart || payload.period_start || now().slice(0, 10), payload.periodEnd || payload.period_end || now().slice(0, 10), payload, access, true);
    emitStaffEvent("staff:manpower_forecast_updated", access, branchId, result.id);
    if (result.shortageRisks.length) emitStaffEvent("staff:manpower_shortage_risk", access, branchId, result.id);
    if (result.hiringRecommendations.length) emitStaffEvent("staff:hiring_recommendation_created", access, branchId, result.id);
    return result;
  }

  hiringRecommendations(query = {}, access) {
    const forecast = this.forecast(query, access);
    return {
      branchId: forecast.branchId,
      confidenceLevel: forecast.confidenceLevel,
      hiringRecommendations: forecast.hiringRecommendations,
      shortageRisks: forecast.shortageRisks
    };
  }

  calculate(branchId, periodStart, periodEnd, query, access, persist) {
    assertBranch(access, branchId);
    const days = daysBetween(periodStart, periodEnd);
    const activeStaff = number(db.prepare("SELECT COUNT(*) AS count FROM staff_master WHERE tenant_id = ? AND branch_id = ? AND status = 'active'")
      .get(access.tenantId, branchId)?.count, 0);
    const performance = db.prepare("SELECT AVG(completed_services) AS services, AVG(utilization_pct) AS utilization FROM staff_performance_daily WHERE tenant_id = ? AND branch_id = ?")
      .get(access.tenantId, branchId);
    const historicalServices = number(performance?.services, 0);
    const sparse = historicalServices === 0;
    const appointmentCount = this.appointmentCount(access.tenantId, branchId, periodStart, periodEnd);
    const demandUnits = number(query.expectedAppointments || query.expected_appointments, appointmentCount || (sparse ? days * Math.max(activeStaff, 1) * 2 : historicalServices * days));
    const avgServiceMinutes = number(query.avgServiceMinutes || query.avg_service_minutes, 60);
    const noShowRate = number(query.noShowRate || query.no_show_rate, 0.08);
    const requiredStaffHours = Math.max(4, (demandUnits * avgServiceMinutes * (1 - noShowRate)) / 60);
    const capacityHours = activeStaff * days * 8;
    const shortage = requiredStaffHours > capacityHours;
    const overstaffing = capacityHours > requiredStaffHours * 1.5 && activeStaff > 1;
    const requiredBySkill = {
      stylist: Math.ceil(requiredStaffHours * 0.55),
      therapist: Math.ceil(requiredStaffHours * 0.25),
      frontDesk: Math.ceil(requiredStaffHours * 0.1),
      support: Math.ceil(requiredStaffHours * 0.1)
    };
    const shortageRisks = shortage ? [`Need ${Math.ceil((requiredStaffHours - capacityHours) / 8)} more staff-days`] : [];
    const overstaffingRisks = overstaffing ? ["Projected staff capacity is materially above demand"] : [];
    const hiringRecommendations = shortage ? ["Add part-time stylist coverage", "Open emergency replacement pool"] : [];
    const rosterRecommendations = shortage ? ["Prioritize peak-hour shifts", "Restrict low-margin walk-in windows"] : ["Maintain current staffing with on-call backup"];
    const explanation = [
      sparse ? "Sparse historical data fallback used" : "Historical productivity data used",
      `Demand units: ${Math.round(demandUnits)}`,
      `Active staff: ${activeStaff}`
    ];
    const row = {
      id: makeId("mforecast"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      period_start: periodStart,
      period_end: periodEnd,
      required_staff_hours: requiredStaffHours,
      required_staff_by_skill_json: toJson(requiredBySkill),
      shortage_risks_json: toJson(shortageRisks),
      overstaffing_risks_json: toJson(overstaffingRisks),
      hiring_recommendations_json: toJson(hiringRecommendations),
      roster_recommendations_json: toJson(rosterRecommendations),
      confidence_level: sparse ? "low" : "medium",
      explanation_json: toJson(explanation),
      created_by: access.userId || ""
    };
    if (persist) {
      db.transaction(() => {
        db.prepare(`INSERT INTO staff_manpower_forecasts
          (id, tenant_id, branch_id, period_start, period_end, required_staff_hours, required_staff_by_skill_json, shortage_risks_json,
           overstaffing_risks_json, hiring_recommendations_json, roster_recommendations_json, confidence_level, explanation_json, created_by)
          VALUES (@id, @tenant_id, @branch_id, @period_start, @period_end, @required_staff_hours, @required_staff_by_skill_json, @shortage_risks_json,
           @overstaffing_risks_json, @hiring_recommendations_json, @roster_recommendations_json, @confidence_level, @explanation_json, @created_by)`).run(row);
        staffAudit("staff.manpower_forecast_updated", "staff_manpower_forecasts", row.id, access, { after: row, branchId });
      })();
    }
    return {
      id: row.id,
      branchId,
      periodStart,
      periodEnd,
      requiredStaffHours,
      requiredStaffBySkill: requiredBySkill,
      shortageRisks,
      overstaffingRisks,
      hiringRecommendations,
      rosterRecommendations,
      confidenceLevel: row.confidence_level,
      explanations: explanation
    };
  }

  appointmentCount(tenantId, branchId, periodStart, periodEnd) {
    try {
      return number(db.prepare(`SELECT COUNT(*) AS count FROM appointments
        WHERE tenantId = ? AND branchId = ? AND date(startTime) >= date(?) AND date(startTime) <= date(?)`)
        .get(tenantId, branchId, periodStart, periodEnd)?.count, 0);
    } catch {
      return 0;
    }
  }
}

export const staffManpowerForecastService = new StaffManpowerForecastService();
