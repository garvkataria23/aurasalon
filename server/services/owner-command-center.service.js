import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { approvalRequired, assertBranch, auditDecision, branchFrom, camel, emitEvent, getScoped, listRows, makeId, requireManager, requireTenant, riskFromText, toJson } from "./enterprise-command-utils.js";

function intentFor(commandText) {
  const text = commandText.toLowerCase();
  if (text.includes("no-show")) return "reduce_no_shows";
  if (text.includes("empty") || text.includes("slot")) return "fill_empty_slots";
  if (text.includes("invoice") || text.includes("payment")) return "recover_unpaid_invoices";
  if (text.includes("inventory") || text.includes("waste")) return "reduce_inventory_waste";
  if (text.includes("payroll")) return "prepare_payroll_audit";
  if (text.includes("hiring") || text.includes("staff")) return "recommend_hiring_plan";
  if (text.includes("risk")) return "find_branch_risk";
  if (text.includes("campaign") || text.includes("whatsapp")) return "launch_whatsapp_campaign";
  return "increase_revenue";
}

function actionsFor(intent) {
  const catalog = {
    reduce_no_shows: [["send_confirmation_sequence", "Create no-show prevention WhatsApp draft", "medium"], ["review_deposit_policy", "Review deposit policy impact", "high"]],
    fill_empty_slots: [["empty_slot_campaign", "Draft empty-slot campaign for approval", "medium"], ["staff_roster_check", "Check staff availability before publishing", "low"]],
    recover_unpaid_invoices: [["payment_reminder", "Queue payment reminder draft", "high"]],
    reduce_inventory_waste: [["stock_rotation", "Create stock rotation task", "medium"]],
    prepare_payroll_audit: [["payroll_audit", "Prepare payroll statutory audit summary", "high"]],
    recommend_hiring_plan: [["manpower_forecast", "Generate manpower forecast", "medium"]],
    find_branch_risk: [["branch_risk_scan", "Scan branch operational risk", "medium"]],
    launch_whatsapp_campaign: [["campaign_plan", "Create WhatsApp campaign plan", "medium"]],
    increase_revenue: [["revenue_leak_scan", "Run revenue leak scan", "medium"], ["campaign_plan", "Draft recovery campaign", "medium"]]
  };
  return catalog[intent] || catalog.increase_revenue;
}

export const ownerCommandCenterService = {
  createCommand(payload, access) {
    requireManager(access);
    if (!payload.commandText && !payload.command) throw badRequest("commandText is required");
    const commandText = payload.commandText || payload.command;
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const intent = intentFor(commandText);
    const result = db.transaction(() => {
      const command = {
        id: makeId("cmd"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        command_text: commandText,
        status: "planned",
        created_by: access.userId || ""
      };
      db.prepare(`INSERT INTO owner_commands (id, tenant_id, branch_id, command_text, status, created_by)
        VALUES (@id, @tenant_id, @branch_id, @command_text, @status, @created_by)`).run(command);
      const intentRow = {
        id: makeId("cmdint"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        command_id: command.id,
        intent_key: intent,
        confidence: 0.84,
        entities_json: toJson({ branchId })
      };
      db.prepare(`INSERT INTO owner_command_intents
        (id, tenant_id, branch_id, command_id, intent_key, confidence, entities_json)
        VALUES (@id, @tenant_id, @branch_id, @command_id, @intent_key, @confidence, @entities_json)`).run(intentRow);
      const rawActions = actionsFor(intent);
      const planRisk = rawActions.some((item) => item[2] === "high") ? "high" : riskFromText(commandText);
      const plan = {
        id: makeId("cmdplan"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        command_id: command.id,
        plan_json: toJson({ intent, actions: rawActions.map(([key, label, risk]) => ({ key, label, risk })) }),
        risk_level: planRisk,
        status: approvalRequired(planRisk) ? "pending_approval" : "ready"
      };
      db.prepare(`INSERT INTO owner_command_plans
        (id, tenant_id, branch_id, command_id, plan_json, risk_level, status)
        VALUES (@id, @tenant_id, @branch_id, @command_id, @plan_json, @risk_level, @status)`).run(plan);
      const actions = rawActions.map(([key, label, risk]) => {
        const row = {
          id: makeId("cmdact"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          plan_id: plan.id,
          action_key: key,
          action_label: label,
          risk_level: risk,
          requires_approval: approvalRequired(risk),
          status: approvalRequired(risk) ? "pending_approval" : "ready"
        };
        db.prepare(`INSERT INTO owner_command_actions
          (id, tenant_id, branch_id, plan_id, action_key, action_label, risk_level, requires_approval, status)
          VALUES (@id, @tenant_id, @branch_id, @plan_id, @action_key, @action_label, @risk_level, @requires_approval, @status)`).run(row);
        return camel(row);
      });
      return { command: camel(command), intent: camel(intentRow), plan: camel(plan), actions };
    })();
    auditDecision("command.plan_created", "owner_command", result.command.id, access, { branchId, details: result.plan });
    emitEvent("command:received", access, branchId, result.command.id);
    emitEvent("command:plan_created", access, branchId, result.plan.id);
    return result;
  },

  commands(query, access) {
    return listRows("owner_commands", access, query);
  },

  plan(id, access) {
    requireTenant(access);
    const plan = getScoped("owner_command_plans", id, access);
    const actions = db.prepare("SELECT * FROM owner_command_actions WHERE plan_id = ? AND tenant_id = ? ORDER BY created_at ASC").all(id, access.tenantId).map(camel);
    return { ...camel(plan), actions };
  },

  decideAction(id, decision, payload, access) {
    requireManager(access);
    const action = getScoped("owner_command_actions", id, access);
    const status = decision === "approve" ? "approved" : "rejected";
    db.transaction(() => {
      db.prepare("UPDATE owner_command_actions SET status = ?, updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(status, id, access.tenantId);
      db.prepare(`INSERT INTO owner_command_approvals
        (id, tenant_id, branch_id, action_id, decision, comment, decided_by)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(makeId("cmdappr"), access.tenantId, action.branch_id, id, status, payload.comment || "", access.userId || "");
    })();
    auditDecision(`command.action_${status}`, "owner_command_action", id, access, { branchId: action.branch_id, details: payload });
    emitEvent(status === "approved" ? "command:action_approved" : "command:action_rejected", access, action.branch_id, id);
    return { id, status };
  }
};
