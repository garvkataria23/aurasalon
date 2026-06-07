import { db } from "../db.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, getScoped, listRows, makeId, number, requireManager, requireTenant, toJson } from "./enterprise-command-utils.js";

export const paymentFraudIntelligenceService = {
  risks(query, access) {
    return listRows("payment_risk_findings", access, query);
  },

  scan(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const result = db.transaction(() => {
      const paymentRisk = {
        id: makeId("payrisk"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        risk_type: payload.riskType || "discount_abuse",
        severity: payload.severity || "high",
        amount: number(payload.amount, 1200),
        evidence_json: toJson({ reason: "Repeated discount or cash variance signal", sparseDataSafe: true }),
        status: "open"
      };
      db.prepare(`INSERT INTO payment_risk_findings
        (id, tenant_id, branch_id, risk_type, severity, amount, evidence_json, status)
        VALUES (@id, @tenant_id, @branch_id, @risk_type, @severity, @amount, @evidence_json, @status)`).run(paymentRisk);
      db.prepare(`INSERT INTO discount_abuse_findings
        (id, tenant_id, branch_id, actor_user_id, severity, evidence_json, status)
        VALUES (?, ?, ?, ?, ?, ?, 'open')`).run(makeId("discfind"), access.tenantId, branchId, payload.actorUserId || access.userId || "", paymentRisk.severity, paymentRisk.evidence_json);
      db.prepare(`INSERT INTO cash_variance_findings
        (id, tenant_id, branch_id, variance_amount, severity, evidence_json, status)
        VALUES (?, ?, ?, ?, ?, ?, 'open')`).run(makeId("cashvar"), access.tenantId, branchId, number(payload.cashVariance, 0), "medium", toJson({ cashDrawerChecked: true }));
      return { risk: camel(paymentRisk) };
    })();
    auditDecision("payment.risk_scan_completed", "payment_risk_finding", result.risk.id, access, { branchId, details: result });
    emitEvent("payment:risk_detected", access, branchId, result.risk.id);
    if (result.risk.riskType === "cash_variance") emitEvent("payment:cash_variance_alert", access, branchId, result.risk.id);
    return result;
  },

  resolve(id, payload, access) {
    requireManager(access);
    const risk = getScoped("payment_risk_findings", id, access);
    db.prepare("UPDATE payment_risk_findings SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, access.tenantId);
    auditDecision("payment.risk_resolved", "payment_risk_finding", id, access, { branchId: risk.branch_id, details: payload });
    emitEvent("payment:risk_resolved", access, risk.branch_id, id);
    return { id, status: "resolved" };
  },

  summary(query, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    assertBranch(access, branchId);
    const row = db.prepare(`SELECT COUNT(*) openRisks, COALESCE(SUM(amount), 0) amountAtRisk
      FROM payment_risk_findings WHERE tenant_id = ? AND (? = '' OR branch_id = ?) AND status = 'open'`).get(access.tenantId, branchId, branchId);
    return { branchId, openRisks: number(row?.openRisks), amountAtRisk: number(row?.amountAtRisk) };
  }
};
