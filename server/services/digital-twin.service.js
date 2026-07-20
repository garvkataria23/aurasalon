import { db } from "../db.js";
import { assertBranch, auditDecision, branchFrom, camel, emitEvent, listRows, makeId, number, requireManager, requireTenant, toJson } from "./enterprise-command-utils.js";

function simulateScenario(scenario, payload) {
  const demand = number(payload.forecastedDemand, 24);
  const staffCount = Math.max(1, number(payload.staffCount, 4));
  const priceShift = scenario.includes("price") ? 1.1 : 1;
  const absencePenalty = scenario.includes("absent") || scenario.includes("reduced") ? 0.82 : 1;
  const campaignLift = scenario.includes("campaign") ? 1.18 : 1;
  const projectedRevenue = Math.round(demand * 900 * priceShift * absencePenalty * campaignLift);
  const projectedUtilization = Math.min(100, Math.round((demand / (staffCount * 8)) * 100));
  const projectedWaitTime = Math.max(0, Math.round((projectedUtilization - 75) * 1.8));
  return {
    scenario,
    projectedRevenue,
    projectedUtilization,
    projectedWaitTime,
    projectedStaffCost: staffCount * 1800,
    projectedInventoryRisk: scenario.includes("stockout") ? "high" : projectedUtilization > 90 ? "medium" : "low",
    risks: projectedUtilization > 90 ? ["Coverage risk during peak demand"] : ["No critical risk detected"],
    recommendations: projectedUtilization > 90 ? ["Create draft roster with one additional skilled staff member"] : ["Maintain current staffing and monitor conversion"],
    confidence: payload.historicalDataSparse ? 0.64 : 0.82
  };
}

export const digitalTwinService = {
  simulate(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const scenario = payload.scenario || "what if weekend demand spikes";
    const output = simulateScenario(scenario, payload);
    const row = {
      id: makeId("twin"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      scenario,
      input_json: toJson(payload),
      output_json: toJson(output),
      confidence: output.confidence
    };
    db.prepare(`INSERT INTO digital_twin_simulations
      (id, tenant_id, branch_id, scenario, input_json, output_json, confidence)
      VALUES (@id, @tenant_id, @branch_id, @scenario, @input_json, @output_json, @confidence)`).run(row);
    for (const recommendation of output.recommendations) {
      db.prepare(`INSERT INTO digital_twin_recommendations
        (id, tenant_id, branch_id, simulation_id, recommendation_type, recommendation_text, risk_level)
        VALUES (?, ?, ?, ?, ?, ?, ?)`).run(makeId("twinrec"), access.tenantId, branchId, row.id, "scenario_action", recommendation, output.projectedInventoryRisk);
    }
    auditDecision("twin.simulation_completed", "digital_twin_simulation", row.id, access, { branchId, details: output });
    emitEvent("twin:simulation_started", access, branchId, row.id);
    emitEvent("twin:simulation_completed", access, branchId, row.id, { confidence: output.confidence });
    if (output.risks.length) emitEvent("twin:risk_detected", access, branchId, row.id);
    return { ...camel(row), output };
  },

  snapshots(query, access) {
    return listRows("digital_twin_snapshots", access, query);
  },

  createSnapshot(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const row = {
      id: makeId("twinsnap"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      snapshot_date: payload.snapshotDate || new Date().toISOString().slice(0, 10),
      metrics_json: toJson(payload.metrics || { bookings: 0, revenue: 0, utilization: 0 })
    };
    db.prepare(`INSERT INTO digital_twin_snapshots (id, tenant_id, branch_id, snapshot_date, metrics_json)
      VALUES (@id, @tenant_id, @branch_id, @snapshot_date, @metrics_json)`).run(row);
    return camel(row);
  },

  recommendations(query, access) {
    return listRows("digital_twin_recommendations", access, query);
  }
};
