import { db } from "../db.js";
import { approvalRequired, assertBranch, auditDecision, branchFrom, camel, emitEvent, listRows, makeId, now, number, requireManager, requireTenant, toJson } from "./enterprise-command-utils.js";

const leakCatalog = [
  ["unpaid_invoices", "high", 7500, "Queue payment reminder draft"],
  ["empty_slots", "medium", 4200, "Create empty-slot WhatsApp campaign draft"],
  ["low_rebooking_rate", "medium", 3500, "Ask front desk to offer rebooking before checkout"],
  ["stockout_lost_sales", "medium", 2800, "Approve replenishment recommendation"]
];

export const revenueLeakService = {
  list(query, access) {
    return listRows("revenue_leak_findings", access, query);
  },

  scan(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const selected = payload.leakTypes?.length ? leakCatalog.filter(([type]) => payload.leakTypes.includes(type)) : leakCatalog;
    const result = db.transaction(() => {
      const run = {
        id: makeId("revrun"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        status: "completed",
        summary_json: "{}",
        completed_at: now()
      };
      db.prepare(`INSERT INTO revenue_recovery_runs (id, tenant_id, branch_id, status, summary_json, completed_at)
        VALUES (@id, @tenant_id, @branch_id, @status, @summary_json, @completed_at)`).run(run);
      const findings = selected.map(([leakType, severity, baseLoss, action], index) => {
        const riskApproval = approvalRequired(severity === "high" ? "high" : "medium");
        const row = {
          id: makeId("revleak"),
          tenant_id: access.tenantId,
          branch_id: branchId,
          leak_type: leakType,
          severity,
          estimated_revenue_loss: number(payload.estimatedRevenueLoss, baseLoss + index * 800),
          recommended_action: action,
          confidence: severity === "high" ? 0.9 : 0.82,
          evidence_json: toJson({ source: "rule_based_scan", sparseDataSafe: true, branchId }),
          requires_approval: riskApproval,
          status: "open"
        };
        db.prepare(`INSERT INTO revenue_leak_findings
          (id, tenant_id, branch_id, leak_type, severity, estimated_revenue_loss, recommended_action, confidence, evidence_json, requires_approval, status)
          VALUES (@id, @tenant_id, @branch_id, @leak_type, @severity, @estimated_revenue_loss, @recommended_action, @confidence, @evidence_json, @requires_approval, @status)`).run(row);
        emitEvent("revenue:leak_detected", access, branchId, row.id, { leakType, severity });
        return camel(row);
      });
      db.prepare("UPDATE revenue_recovery_runs SET summary_json = ? WHERE id = ? AND tenant_id = ?").run(toJson({ findings: findings.length, estimatedLoss: findings.reduce((sum, item) => sum + item.estimatedRevenueLoss, 0) }), run.id, access.tenantId);
      return { run: camel(run), findings };
    })();
    auditDecision("revenue.leak_scan_completed", "revenue_recovery_run", result.run.id, access, { branchId, details: { findings: result.findings.length } });
    return result;
  },

  approveAction(id, payload, access) {
    requireManager(access);
    const finding = db.prepare("SELECT * FROM revenue_leak_findings WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!finding) return null;
    assertBranch(access, finding.branch_id);
    const action = {
      id: makeId("revact"),
      tenant_id: access.tenantId,
      branch_id: finding.branch_id,
      finding_id: id,
      action_type: payload.actionType || finding.recommended_action || "recovery_action",
      status: "approved",
      approved_by: access.userId || "",
      approved_at: now(),
      details_json: toJson(payload)
    };
    db.transaction(() => {
      db.prepare(`INSERT INTO revenue_leak_actions
        (id, tenant_id, branch_id, finding_id, action_type, status, approved_by, approved_at, details_json)
        VALUES (@id, @tenant_id, @branch_id, @finding_id, @action_type, @status, @approved_by, @approved_at, @details_json)`).run(action);
      db.prepare("UPDATE revenue_leak_findings SET status = 'action_approved', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, access.tenantId);
    })();
    auditDecision("revenue.leak_action_approved", "revenue_leak_finding", id, access, { branchId: finding.branch_id, details: action });
    emitEvent("revenue:leak_action_approved", access, finding.branch_id, id);
    return camel(action);
  },

  dismiss(id, payload, access) {
    requireManager(access);
    const finding = db.prepare("SELECT * FROM revenue_leak_findings WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!finding) return null;
    assertBranch(access, finding.branch_id);
    db.prepare("UPDATE revenue_leak_findings SET status = 'dismissed', updated_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, access.tenantId);
    auditDecision("revenue.leak_dismissed", "revenue_leak_finding", id, access, { branchId: finding.branch_id, details: payload });
    return { id, status: "dismissed" };
  },

  summary(query, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId };
    const branchSql = branchId ? " AND branch_id = @branch_id" : "";
    const row = db.prepare(`SELECT COUNT(*) findings, COALESCE(SUM(estimated_revenue_loss), 0) estimatedLoss FROM revenue_leak_findings WHERE tenant_id = @tenant_id${branchSql} AND status != 'dismissed'`).get(params);
    return { findings: number(row?.findings), estimatedLoss: number(row?.estimatedLoss), branchId };
  }
};
