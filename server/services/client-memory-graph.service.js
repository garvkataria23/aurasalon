import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, makeId, requireManager, requireTenant, toJson } from "./enterprise-command-utils.js";

function graphRows(clientId, access) {
  const nodes = db.prepare("SELECT * FROM client_memory_nodes WHERE tenant_id = ? AND client_id = ? ORDER BY created_at DESC").all(access.tenantId, clientId).map(camel);
  const edges = db.prepare("SELECT * FROM client_memory_edges WHERE tenant_id = ? AND client_id = ? ORDER BY created_at DESC").all(access.tenantId, clientId).map(camel);
  const preferences = db.prepare("SELECT * FROM client_preferences WHERE tenant_id = ? AND client_id = ? ORDER BY updated_at DESC").all(access.tenantId, clientId).map(camel);
  const risks = db.prepare("SELECT * FROM client_risk_signals WHERE tenant_id = ? AND client_id = ? ORDER BY created_at DESC").all(access.tenantId, clientId).map(camel);
  const nextBestActions = db.prepare("SELECT * FROM client_next_best_actions WHERE tenant_id = ? AND client_id = ? ORDER BY created_at DESC").all(access.tenantId, clientId).map(camel);
  return { clientId, nodes, edges, preferences, risks, nextBestActions };
}

export const clientMemoryGraphService = {
  get(clientId, access) {
    requireTenant(access);
    if (!clientId) throw badRequest("clientId is required");
    return graphRows(clientId, access);
  },

  rebuild(clientId, payload, access) {
    requireManager(access);
    if (!clientId) throw badRequest("clientId is required");
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const result = db.transaction(() => {
      const preferenceNode = {
        id: makeId("cmn"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        client_id: clientId,
        node_type: "preference",
        node_key: "preferred_service",
        value_json: toJson({ value: payload.favoriteService || "Hair spa" }),
        confidence: 0.82
      };
      const risk = {
        id: makeId("crisk"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        client_id: clientId,
        signal_type: payload.riskSignal || "visit_gap",
        severity: "medium",
        evidence_json: toJson({ sparseDataSafe: true, lastVisitDays: payload.lastVisitDays || 45 })
      };
      const action = {
        id: makeId("cnba"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        client_id: clientId,
        action_type: "retention_followup",
        action_text: "Create approval-safe personalized follow-up draft",
        confidence: 0.8,
        status: "recommended"
      };
      db.prepare(`INSERT INTO client_memory_nodes
        (id, tenant_id, branch_id, client_id, node_type, node_key, value_json, confidence)
        VALUES (@id, @tenant_id, @branch_id, @client_id, @node_type, @node_key, @value_json, @confidence)`).run(preferenceNode);
      db.prepare(`INSERT INTO client_preferences
        (id, tenant_id, branch_id, client_id, preference_key, preference_value, confidence)
        VALUES (?, ?, ?, ?, 'preferred_service', ?, 0.82)`).run(makeId("cpref"), access.tenantId, branchId, clientId, payload.favoriteService || "Hair spa");
      db.prepare(`INSERT INTO client_risk_signals
        (id, tenant_id, branch_id, client_id, signal_type, severity, evidence_json)
        VALUES (@id, @tenant_id, @branch_id, @client_id, @signal_type, @severity, @evidence_json)`).run(risk);
      db.prepare(`INSERT INTO client_next_best_actions
        (id, tenant_id, branch_id, client_id, action_type, action_text, confidence, status)
        VALUES (@id, @tenant_id, @branch_id, @client_id, @action_type, @action_text, @confidence, @status)`).run(action);
      db.prepare(`INSERT INTO client_lifetime_events
        (id, tenant_id, branch_id, client_id, event_type, event_json)
        VALUES (?, ?, ?, ?, 'memory_rebuilt', ?)`).run(makeId("clevt"), access.tenantId, branchId, clientId, toJson({ nodes: 1, risks: 1, actions: 1 }));
      return { node: camel(preferenceNode), risk: camel(risk), nextBestAction: camel(action) };
    })();
    auditDecision("client.memory_rebuilt", "client_memory", clientId, access, { branchId, details: result });
    emitEvent("client:memory_updated", access, branchId, clientId);
    emitEvent("client:risk_signal_created", access, branchId, result.risk.id);
    emitEvent("client:next_best_action_created", access, branchId, result.nextBestAction.id);
    return { clientId, ...result };
  },

  nextBestActions(clientId, access) {
    requireTenant(access);
    return db.prepare("SELECT * FROM client_next_best_actions WHERE tenant_id = ? AND client_id = ? ORDER BY created_at DESC").all(access.tenantId, clientId).map(camel);
  },

  feedback(clientId, payload, access) {
    requireManager(access);
    db.prepare("UPDATE client_next_best_actions SET status = ? WHERE tenant_id = ? AND client_id = ? AND id = ?").run(payload.status || "feedback_received", access.tenantId, clientId, payload.actionId || "");
    auditDecision("client.memory_feedback", "client_memory", clientId, access, { details: payload });
    return { clientId, status: "feedback_received" };
  }
};
