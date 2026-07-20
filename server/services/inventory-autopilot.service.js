import { db } from "../db.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, getScoped, listRows, makeId, requireManager, toJson } from "./enterprise-command-utils.js";

export const inventoryAutopilotService = {
  risks(query, access) {
    return listRows("inventory_risk_findings", access, query);
  },

  scan(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const result = db.transaction(() => {
      const risk = {
        id: makeId("invrisk"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        product_id: payload.productId || "",
        risk_type: payload.riskType || "stockout_risk",
        severity: payload.severity || "high",
        evidence_json: toJson({ threshold: payload.threshold || 5, sparseDataSafe: true }),
        status: "open"
      };
      db.prepare(`INSERT INTO inventory_risk_findings
        (id, tenant_id, branch_id, product_id, risk_type, severity, evidence_json, status)
        VALUES (@id, @tenant_id, @branch_id, @product_id, @risk_type, @severity, @evidence_json, @status)`).run(risk);
      const recommendation = {
        id: makeId("invrec"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        product_id: payload.productId || "",
        recommendation_text: payload.recommendationText || "Approve replenishment purchase before service readiness is affected",
        quantity: Number(payload.quantity || 10),
        estimated_cost: Number(payload.estimatedCost || 2500),
        status: "pending_approval"
      };
      db.prepare(`INSERT INTO inventory_purchase_recommendations
        (id, tenant_id, branch_id, product_id, recommendation_text, quantity, estimated_cost, status)
        VALUES (@id, @tenant_id, @branch_id, @product_id, @recommendation_text, @quantity, @estimated_cost, @status)`).run(recommendation);
      db.prepare(`INSERT INTO inventory_waste_predictions
        (id, tenant_id, branch_id, product_id, waste_risk, evidence_json)
        VALUES (?, ?, ?, ?, ?, ?)`).run(makeId("invwaste"), access.tenantId, branchId, payload.productId || "", Number(payload.wasteRisk || 0.18), toJson({ expiryWatch: true }));
      return { risk: camel(risk), recommendation: camel(recommendation) };
    })();
    auditDecision("inventory.autopilot_scan_completed", "inventory_risk_finding", result.risk.id, access, { branchId, details: result });
    emitEvent("inventory:risk_detected", access, branchId, result.risk.id);
    emitEvent("inventory:purchase_recommended", access, branchId, result.recommendation.id);
    return result;
  },

  recommendations(query, access) {
    return listRows("inventory_purchase_recommendations", access, query);
  },

  approve(id, payload, access) {
    requireManager(access);
    const recommendation = getScoped("inventory_purchase_recommendations", id, access);
    db.prepare("UPDATE inventory_purchase_recommendations SET status = 'approved', approved_at = CURRENT_TIMESTAMP WHERE id = ? AND tenant_id = ?").run(id, access.tenantId);
    auditDecision("inventory.purchase_recommendation_approved", "inventory_purchase_recommendation", id, access, { branchId: recommendation.branch_id, details: payload });
    emitEvent("inventory:recommendation_approved", access, recommendation.branch_id, id);
    return { id, status: "approved" };
  }
};
