import { db } from "../db.js";
import { badRequest, conflict, notFound } from "../utils/app-error.js";
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

export class StaffRosterOptimizerService {
  optimize(payload = {}, access) {
    access = requireTenant(access);
    requireManager(access);
    const branchId = branchIdFrom(payload, access);
    assertBranch(access, branchId);
    const periodStart = payload.periodStart || payload.period_start || now().slice(0, 10);
    const periodEnd = payload.periodEnd || payload.period_end || periodStart;
    const demandHours = number(payload.forecastedDemandHours || payload.forecasted_demand_hours, 40);
    const staff = db.prepare("SELECT * FROM staff_master WHERE tenant_id = ? AND branch_id = ? AND status = 'active' ORDER BY full_name")
      .all(access.tenantId, branchId);
    const gaps = [];
    if (!staff.length) gaps.push("No active staff available in branch");
    const hoursPerStaff = staff.length ? Math.min(8, Math.ceil(demandHours / staff.length)) : 0;
    const roster = staff.map((item, index) => ({
      staffId: item.id,
      staffName: item.full_name,
      branchId,
      date: periodStart,
      startTime: index % 2 === 0 ? "10:00" : "12:00",
      endTime: index % 2 === 0 ? `${10 + hoursPerStaff}:00` : `${12 + hoursPerStaff}:00`,
      hours: hoursPerStaff,
      status: "draft"
    }));
    const coverageScore = staff.length ? Math.min(100, (staff.length * hoursPerStaff / Math.max(demandHours, 1)) * 100) : 0;
    const costScore = Math.max(0, 100 - Math.max(0, staff.length * hoursPerStaff - demandHours) * 2);
    const utilizationScore = roster.length ? Math.min(100, demandHours / Math.max(roster.reduce((sum, row) => sum + row.hours, 0), 1) * 100) : 0;
    const overtimeRisks = roster.filter((row) => row.hours > 8).map((row) => ({ staffId: row.staffId, risk: "daily hours above limit" }));
    const recommendations = gaps.length ? ["Add temporary staff or reduce online slots"] : ["Review draft roster before publishing"];
    const row = {
      id: makeId("roster"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      period_start: periodStart,
      period_end: periodEnd,
      roster_json: toJson(roster),
      coverage_score: coverageScore,
      cost_score: costScore,
      utilization_score: utilizationScore,
      gaps_json: toJson(gaps),
      overtime_risks_json: toJson(overtimeRisks),
      recommendations_json: toJson(recommendations),
      created_by: access.userId || ""
    };
    db.transaction(() => {
      db.prepare(`INSERT INTO staff_roster_drafts
        (id, tenant_id, branch_id, period_start, period_end, roster_json, coverage_score, cost_score, utilization_score, gaps_json, overtime_risks_json, recommendations_json, created_by)
        VALUES (@id, @tenant_id, @branch_id, @period_start, @period_end, @roster_json, @coverage_score, @cost_score, @utilization_score, @gaps_json, @overtime_risks_json, @recommendations_json, @created_by)`).run(row);
      staffAudit("staff.roster_optimized", "staff_roster_drafts", row.id, access, { after: row, branchId });
    })();
    emitStaffEvent("staff:roster_optimized", access, branchId, row.id);
    emitStaffEvent("staff:roster_draft_created", access, branchId, row.id);
    return this.formatDraft(row);
  }

  applyDraft(id, access) {
    access = requireTenant(access);
    requireManager(access);
    const draft = db.prepare("SELECT * FROM staff_roster_drafts WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!draft) throw notFound("Roster draft not found");
    assertBranch(access, draft.branch_id);
    if (draft.status !== "draft") throw conflict("Roster draft is not publishable");
    const roster = JSON.parse(draft.roster_json || "[]");
    db.transaction(() => {
      for (const row of roster) {
        db.prepare(`INSERT INTO staff_schedules (id, tenant_id, branch_id, staff_id, schedule_date, start_time, end_time, shift_type, status, created_by)
          VALUES (?, ?, ?, ?, ?, ?, ?, 'optimized', 'scheduled', ?)`).run(
          makeId("sched"), access.tenantId, draft.branch_id, row.staffId, row.date, row.startTime, row.endTime, access.userId || ""
        );
      }
      db.prepare("UPDATE staff_roster_drafts SET status = 'published', updated_at = ? WHERE id = ? AND tenant_id = ?").run(now(), id, access.tenantId);
      staffAudit("staff.roster_published", "staff_roster_drafts", id, access, { before: draft, branchId: draft.branch_id });
    })();
    emitStaffEvent("staff:roster_published", access, draft.branch_id, id);
    return this.getDraft(id, access);
  }

  gaps(query = {}, access) {
    const coverage = this.coverage(query, access);
    if (coverage.coverageScore < 80) emitStaffEvent("staff:roster_gap_detected", access, coverage.branchId, "coverage");
    return { branchId: coverage.branchId, gaps: coverage.coverageScore < 80 ? ["Coverage below 80%"] : [], coverageScore: coverage.coverageScore };
  }

  coverage(query = {}, access) {
    access = requireTenant(access);
    const branchId = query.branchId || query.branch_id || access.requestedBranchId || "";
    assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId };
    const scheduled = db.prepare("SELECT COUNT(*) AS shifts FROM staff_schedules WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND status != 'cancelled'").get(params)?.shifts || 0;
    const activeStaff = db.prepare("SELECT COUNT(*) AS staff FROM staff_master WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND status = 'active'").get(params)?.staff || 0;
    const coverageScore = activeStaff ? Math.min(100, (scheduled / activeStaff) * 100) : 0;
    return { branchId, scheduledShifts: scheduled, activeStaff, coverageScore };
  }

  getDraft(id, access) {
    const draft = db.prepare("SELECT * FROM staff_roster_drafts WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!draft) throw notFound("Roster draft not found");
    return this.formatDraft(draft);
  }

  formatDraft(row) {
    return {
      id: row.id,
      branchId: row.branch_id,
      periodStart: row.period_start,
      periodEnd: row.period_end,
      roster: JSON.parse(row.roster_json || "[]"),
      coverageScore: row.coverage_score,
      costScore: row.cost_score,
      utilizationScore: row.utilization_score,
      gaps: JSON.parse(row.gaps_json || "[]"),
      overtimeRisks: JSON.parse(row.overtime_risks_json || "[]"),
      recommendations: JSON.parse(row.recommendations_json || "[]"),
      status: row.status || "draft"
    };
  }
}

export const staffRosterOptimizerService = new StaffRosterOptimizerService();
