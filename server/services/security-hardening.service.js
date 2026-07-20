import { db } from "../db.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, getScoped, listRows, makeId, number, requireManager, requireTenant, toJson } from "./enterprise-command-utils.js";

export const securityHardeningService = {
  findings(query, access) {
    return listRows("security_review_queue", access, query);
  },

  scan(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const result = db.transaction(() => {
      const session = {
        id: makeId("susssn"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        user_id: payload.userId || access.userId || "",
        signal_type: payload.signalType || "sensitive_data_access",
        severity: payload.severity || "high",
        evidence_json: toJson({ salaryAccessAlert: true, impossibleTravelPlaceholder: true }),
        status: "open"
      };
      db.prepare(`INSERT INTO suspicious_sessions
        (id, tenant_id, branch_id, user_id, signal_type, severity, evidence_json, status)
        VALUES (@id, @tenant_id, @branch_id, @user_id, @signal_type, @severity, @evidence_json, @status)`).run(session);
      const dataFindingId = makeId("datafind");
      db.prepare(`INSERT INTO data_access_findings
        (id, tenant_id, branch_id, entity_type, severity, evidence_json, status)
        VALUES (?, ?, ?, 'salary', ?, ?, 'open')`).run(dataFindingId, access.tenantId, branchId, session.severity, session.evidence_json);
      const queue = {
        id: makeId("secrev"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        finding_type: "suspicious_session",
        finding_id: session.id,
        priority: session.severity,
        status: "open"
      };
      db.prepare(`INSERT INTO security_review_queue
        (id, tenant_id, branch_id, finding_type, finding_id, priority, status)
        VALUES (@id, @tenant_id, @branch_id, @finding_type, @finding_id, @priority, @status)`).run(queue);
      return { session: camel(session), review: camel(queue), dataFindingId };
    })();
    auditDecision("security.hardening_scan_completed", "security_review_queue", result.review.id, access, { branchId, details: result });
    emitEvent("security:suspicious_session", access, branchId, result.session.id);
    emitEvent("security:data_access_alert", access, branchId, result.dataFindingId);
    return result;
  },

  resolve(id, payload, access) {
    requireManager(access);
    const review = getScoped("security_review_queue", id, access);
    db.prepare("UPDATE security_review_queue SET status = 'resolved', resolved_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, access.tenantId);
    auditDecision("security.finding_resolved", "security_review_queue", id, access, { branchId: review.branch_id, details: payload });
    emitEvent("security:finding_resolved", access, review.branch_id, id);
    return { id, status: "resolved" };
  },

  summary(query, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    assertBranch(access, branchId);
    const row = db.prepare("SELECT COUNT(*) openFindings FROM security_review_queue WHERE tenant_id = ? AND (? = '' OR branch_id = ?) AND status = 'open'").get(access.tenantId, branchId, branchId);
    return { branchId, openFindings: number(row?.openFindings) };
  }
};
