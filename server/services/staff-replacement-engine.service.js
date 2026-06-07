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

export class StaffReplacementEngineService {
  recommend(payload = {}, access) {
    access = requireTenant(access);
    const branchId = branchIdFrom(payload, access);
    assertBranch(access, branchId);
    const absentStaffId = payload.absentStaffId || payload.absent_staff_id || "";
    const serviceId = payload.serviceId || payload.service_id || "";
    const isVip = Boolean(payload.vip || payload.vipClient || payload.vip_client);
    const candidates = db.prepare(`SELECT * FROM staff_master
      WHERE tenant_id = ? AND branch_id = ? AND status = 'active' AND id != ?
      ORDER BY full_name`).all(access.tenantId, branchId, absentStaffId);
    const rankedOptions = candidates.map((staff) => this.scoreCandidate(staff, { serviceId, isVip, date: payload.date || now().slice(0, 10) }, access))
      .sort((a, b) => b.score - a.score);
    const best = rankedOptions[0] || null;
    const confidence = best ? Math.min(0.95, best.score / 100) : 0;
    const risks = [];
    if (!best) risks.push("No available active staff in branch");
    if (isVip) risks.push("VIP client requires manager approval");
    if (confidence < 0.6) risks.push("Low confidence recommendation");
    const row = {
      id: makeId("replace"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      absent_staff_id: absentStaffId,
      appointment_id: payload.appointmentId || payload.appointment_id || "",
      service_id: serviceId,
      client_id: payload.clientId || payload.client_id || "",
      recommended_staff_id: best?.staffId || "",
      confidence,
      requires_manager_approval: isVip || confidence < 0.75 ? 1 : 0,
      ranked_options_json: toJson(rankedOptions),
      reasons_json: toJson(best?.reasons || ["No recommendation"]),
      risks_json: toJson(risks),
      created_by: access.userId || ""
    };
    db.transaction(() => {
      db.prepare(`INSERT INTO staff_replacement_recommendations
        (id, tenant_id, branch_id, absent_staff_id, appointment_id, service_id, client_id, recommended_staff_id, confidence,
         requires_manager_approval, ranked_options_json, reasons_json, risks_json, created_by)
        VALUES (@id, @tenant_id, @branch_id, @absent_staff_id, @appointment_id, @service_id, @client_id, @recommended_staff_id, @confidence,
         @requires_manager_approval, @ranked_options_json, @reasons_json, @risks_json, @created_by)`).run(row);
      staffAudit("staff.replacement_recommended", "staff_replacement_recommendations", row.id, access, { after: row, branchId });
    })();
    emitStaffEvent("staff:replacement_recommended", access, branchId, row.id);
    return {
      id: row.id,
      recommendedStaffId: row.recommended_staff_id,
      rankedOptions,
      confidence,
      reasons: best?.reasons || [],
      risks,
      requiresManagerApproval: Boolean(row.requires_manager_approval)
    };
  }

  approve(id, payload = {}, access) {
    return this.decide(id, "approved", payload, access);
  }

  reject(id, payload = {}, access) {
    return this.decide(id, "rejected", payload, access);
  }

  history(query = {}, access) {
    access = requireTenant(access);
    const params = {
      tenant_id: access.tenantId,
      branch_id: query.branchId || query.branch_id || access.requestedBranchId || "",
      limit: Math.min(Number(query.limit || 100), 500)
    };
    const where = scopedBranchWhere(access, params);
    return db.prepare(`SELECT * FROM staff_replacement_recommendations WHERE ${where} ORDER BY created_at DESC LIMIT @limit`).all(params).map(camel);
  }

  decide(id, status, payload, access) {
    access = requireTenant(access);
    requireManager(access);
    const row = db.prepare("SELECT * FROM staff_replacement_recommendations WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Replacement recommendation not found");
    assertBranch(access, row.branch_id);
    if (!["recommended", "pending"].includes(row.status)) throw conflict("Replacement recommendation already decided");
    const field = status === "approved" ? "approved_by" : "rejected_by";
    db.transaction(() => {
      db.prepare(`UPDATE staff_replacement_recommendations SET status = ?, ${field} = ?, decision_reason = ?, updated_at = ? WHERE id = ? AND tenant_id = ?`)
        .run(status, access.userId || "", payload.reason || "", now(), id, access.tenantId);
      staffAudit(`staff.replacement_${status}`, "staff_replacement_recommendations", id, access, { before: row, after: payload, branchId: row.branch_id });
    })();
    emitStaffEvent(status === "approved" ? "staff:replacement_approved" : "staff:replacement_rejected", access, row.branch_id, id);
    return camel(db.prepare("SELECT * FROM staff_replacement_recommendations WHERE id = ? AND tenant_id = ?").get(id, access.tenantId));
  }

  scoreCandidate(staff, context, access) {
    const reasons = [];
    let score = 40;
    const schedule = db.prepare(`SELECT id FROM staff_schedules WHERE tenant_id = ? AND staff_id = ? AND branch_id = ? AND schedule_date = ? AND status != 'cancelled'`)
      .get(access.tenantId, staff.id, staff.branch_id, context.date);
    if (schedule) {
      score += 20;
      reasons.push("Rostered in branch");
    } else {
      reasons.push("No rostered shift; manager review needed");
    }
    const leave = db.prepare(`SELECT id FROM staff_leaves WHERE tenant_id = ? AND staff_id = ? AND status = 'approved' AND start_date <= ? AND end_date >= ?`)
      .get(access.tenantId, staff.id, context.date, context.date);
    if (leave) {
      score -= 50;
      reasons.push("Approved leave conflict");
    }
    if (context.serviceId) {
      const skill = db.prepare(`SELECT id FROM staff_service_eligibility WHERE tenant_id = ? AND staff_id = ? AND service_id = ? AND allowed = 1`).get(access.tenantId, staff.id, context.serviceId);
      if (skill) {
        score += 20;
        reasons.push("Service skill match");
      } else {
        reasons.push("Skill eligibility not confirmed");
      }
    }
    const perf = db.prepare(`SELECT AVG(productivity_score) AS score, AVG(avg_rating) AS rating FROM staff_performance_daily WHERE tenant_id = ? AND staff_id = ?`)
      .get(access.tenantId, staff.id);
    score += Math.min(20, number(perf?.score, 50) / 5);
    if (number(perf?.rating, 5) >= 4.5) reasons.push("Strong review quality");
    return {
      staffId: staff.id,
      staffName: staff.full_name,
      score: Math.max(0, Math.min(100, Math.round(score))),
      reasons
    };
  }
}

export const staffReplacementEngineService = new StaffReplacementEngineService();
