import { db } from "../db.js";
import { badRequest, forbidden } from "../utils/app-error.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, getScoped, listRows, makeId, now, requireManager, toJson } from "./enterprise-command-utils.js";

const campaignCopy = {
  empty_slot_fill: "A slot opened up at Aura Salon. Reply BOOK to choose a convenient time.",
  inactive_client_recovery: "We miss seeing you at Aura Salon. Reply YES for available slots this week.",
  membership_renewal: "Your membership benefits are ready for renewal. Reply HELP for options.",
  no_show_prevention: "Reminder: your appointment is coming up. Reply C to confirm or R to reschedule.",
  vip_retention: "Your preferred team has a priority slot available. Reply to request a callback."
};

function normalizeType(type = "") {
  return String(type || "empty_slot_fill").replace(/-/g, "_");
}

export const whatsappCampaignPlannerService = {
  createPlan(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (payload.hasOptOut === true || payload.optedOut === true) throw forbidden("Cannot create campaign for opted-out audience");
    const type = normalizeType(payload.campaignType);
    const messageText = payload.messageText || campaignCopy[type] || campaignCopy.empty_slot_fill;
    if (/\b(guaranteed|free money|salary)\b/i.test(messageText)) throw badRequest("Campaign message is not policy-safe");
    const result = db.transaction(() => {
      const plan = {
        id: makeId("wacp"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        campaign_type: type,
        title: payload.title || type.replace(/_/g, " "),
        objective: payload.objective || "Recover revenue with approval-safe WhatsApp outreach",
        status: "draft",
        requires_approval: 1,
        quiet_hours_json: toJson(payload.quietHours || { start: "21:00", end: "09:00" }),
        created_by: access.userId || ""
      };
      db.prepare(`INSERT INTO whatsapp_campaign_plans
        (id, tenant_id, branch_id, campaign_type, title, objective, status, requires_approval, quiet_hours_json, created_by)
        VALUES (@id, @tenant_id, @branch_id, @campaign_type, @title, @objective, @status, @requires_approval, @quiet_hours_json, @created_by)`).run(plan);
      const segment = {
        id: makeId("waseg"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        plan_id: plan.id,
        segment_key: payload.segmentKey || type,
        criteria_json: toJson(payload.criteria || { consentRequired: true, optOutAware: true }),
        audience_count: Number(payload.audienceCount || 0)
      };
      db.prepare(`INSERT INTO whatsapp_campaign_segments
        (id, tenant_id, branch_id, plan_id, segment_key, criteria_json, audience_count)
        VALUES (@id, @tenant_id, @branch_id, @plan_id, @segment_key, @criteria_json, @audience_count)`).run(segment);
      const message = {
        id: makeId("wamsg"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        plan_id: plan.id,
        language: payload.language || "en",
        message_text: messageText,
        policy_safe: 1,
        opt_out_checked: 1,
        consent_checked: 1
      };
      db.prepare(`INSERT INTO whatsapp_campaign_messages
        (id, tenant_id, branch_id, plan_id, language, message_text, policy_safe, opt_out_checked, consent_checked)
        VALUES (@id, @tenant_id, @branch_id, @plan_id, @language, @message_text, @policy_safe, @opt_out_checked, @consent_checked)`).run(message);
      return { plan: camel(plan), segment: camel(segment), message: camel(message) };
    })();
    auditDecision("campaign.plan_created", "whatsapp_campaign_plan", result.plan.id, access, { branchId, details: { type } });
    emitEvent("campaign:plan_created", access, branchId, result.plan.id);
    emitEvent("campaign:approval_required", access, branchId, result.plan.id);
    return result;
  },

  plans(query, access) {
    return listRows("whatsapp_campaign_plans", access, query);
  },

  approve(id, payload, access) {
    requireManager(access);
    const plan = getScoped("whatsapp_campaign_plans", id, access);
    db.transaction(() => {
      db.prepare("UPDATE whatsapp_campaign_plans SET status = 'approved', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, access.tenantId);
      db.prepare(`INSERT INTO whatsapp_campaign_approvals (id, tenant_id, branch_id, plan_id, decision, decided_by, comment)
        VALUES (?, ?, ?, ?, 'approved', ?, ?)`).run(makeId("waappr"), access.tenantId, plan.branch_id, id, access.userId || "", payload.comment || "");
    })();
    auditDecision("campaign.approved", "whatsapp_campaign_plan", id, access, { branchId: plan.branch_id });
    emitEvent("campaign:approved", access, plan.branch_id, id);
    return { id, status: "approved" };
  },

  schedule(id, payload, access) {
    requireManager(access);
    const plan = getScoped("whatsapp_campaign_plans", id, access);
    if (plan.status !== "approved") throw forbidden("Campaign must be approved before scheduling");
    db.prepare("UPDATE whatsapp_campaign_plans SET status = 'scheduled', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, access.tenantId);
    db.prepare(`INSERT INTO whatsapp_campaign_outcomes
      (id, tenant_id, branch_id, plan_id, sent_count, delivered_count, reply_count, booking_count, revenue_attributed)
      VALUES (?, ?, ?, ?, 0, 0, 0, 0, 0)`).run(makeId("waout"), access.tenantId, plan.branch_id, id);
    auditDecision("campaign.scheduled", "whatsapp_campaign_plan", id, access, { branchId: plan.branch_id, details: payload });
    emitEvent("campaign:scheduled", access, plan.branch_id, id, { scheduledFor: payload.scheduledFor || now() });
    return { id, status: "scheduled", scheduledFor: payload.scheduledFor || now() };
  },

  outcomes(query, access) {
    return listRows("whatsapp_campaign_outcomes", access, query);
  }
};
