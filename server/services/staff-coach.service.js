import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, getScoped, listRows, makeId, now, requireManager, toJson } from "./enterprise-command-utils.js";

export const staffCoachService = {
  insights(query, access) {
    requireManager(access, "Only managers can view staff coaching insights");
    return listRows("staff_coaching_insights", access, query);
  },

  staffInsights(staffId, query, access) {
    requireManager(access, "Only managers can view staff coaching insights");
    return db.prepare("SELECT * FROM staff_coaching_insights WHERE tenant_id = ? AND staff_id = ? ORDER BY created_at DESC LIMIT 50").all(access.tenantId, staffId).map(camel);
  },

  createGoal(payload, access) {
    requireManager(access);
    if (!payload.staffId) throw badRequest("staffId is required");
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const result = db.transaction(() => {
      const goal = {
        id: makeId("coachgoal"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        staff_id: payload.staffId,
        goal_type: payload.goalType || "rebooking",
        target_value: Number(payload.targetValue || 0),
        current_value: Number(payload.currentValue || 0),
        status: "active",
        due_date: payload.dueDate || ""
      };
      db.prepare(`INSERT INTO staff_coaching_goals
        (id, tenant_id, branch_id, staff_id, goal_type, target_value, current_value, status, due_date)
        VALUES (@id, @tenant_id, @branch_id, @staff_id, @goal_type, @target_value, @current_value, @status, @due_date)`).run(goal);
      const insight = {
        id: makeId("coachins"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        staff_id: payload.staffId,
        insight_type: "goal_created",
        severity: "medium",
        insight_text: payload.insightText || "Coach staff toward measurable service quality and rebooking improvement.",
        evidence_json: toJson({ goalType: goal.goal_type }),
        manager_only: 1,
        status: "open"
      };
      db.prepare(`INSERT INTO staff_coaching_insights
        (id, tenant_id, branch_id, staff_id, insight_type, severity, insight_text, evidence_json, manager_only, status)
        VALUES (@id, @tenant_id, @branch_id, @staff_id, @insight_type, @severity, @insight_text, @evidence_json, @manager_only, @status)`).run(insight);
      const action = {
        id: makeId("coachact"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        goal_id: goal.id,
        staff_id: payload.staffId,
        action_text: payload.actionText || "Review last 10 appointments and identify rebooking opportunities",
        status: "open"
      };
      db.prepare(`INSERT INTO staff_coaching_actions
        (id, tenant_id, branch_id, goal_id, staff_id, action_text, status)
        VALUES (@id, @tenant_id, @branch_id, @goal_id, @staff_id, @action_text, @status)`).run(action);
      return { goal: camel(goal), insight: camel(insight), action: camel(action) };
    })();
    auditDecision("staff.coach_goal_created", "staff_coaching_goal", result.goal.id, access, { branchId, details: result });
    emitEvent("staff:coach_goal_created", access, branchId, result.goal.id);
    emitEvent("staff:coach_insight_created", access, branchId, result.insight.id);
    return result;
  },

  completeAction(id, payload, access) {
    requireManager(access);
    const action = getScoped("staff_coaching_actions", id, access);
    db.prepare("UPDATE staff_coaching_actions SET status = 'completed', completed_at = ? WHERE id = ? AND tenant_id = ?").run(now(), id, access.tenantId);
    auditDecision("staff.coach_action_completed", "staff_coaching_action", id, access, { branchId: action.branch_id, details: payload });
    emitEvent("staff:coach_action_completed", access, action.branch_id, id);
    return { id, status: "completed" };
  }
};
