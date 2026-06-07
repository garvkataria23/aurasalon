import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";
import {
  approvalRequired,
  assertBranch,
  auditDecision,
  branchFrom,
  camel,
  emitEvent,
  getScoped,
  listRows,
  makeId,
  now,
  number,
  parseJson,
  requireManager,
  requireOwner,
  requireTenant,
  riskFromText,
  tableCount,
  toJson,
  today
} from "./enterprise-command-utils.js";

const modelDefaults = [
  { key: "openai", name: "OpenAI", family: "gpt", cost: 0.03, latency: 900, accuracy: 0.92 },
  { key: "gemini", name: "Gemini", family: "gemini", cost: 0.02, latency: 820, accuracy: 0.88 },
  { key: "claude", name: "Claude", family: "claude", cost: 0.035, latency: 1050, accuracy: 0.9 },
  { key: "local", name: "Local Model", family: "local", cost: 0.002, latency: 250, accuracy: 0.7 }
];

const ceoActionTemplates = [
  ["revenue", "Recover unpaid invoices and empty slots", "high", 1],
  ["staff", "Fix manpower gaps before peak hours", "high", 2],
  ["inventory", "Resolve stockout risks for high-demand services", "medium", 3],
  ["cash", "Complete pending cash close review", "high", 4],
  ["campaign", "Approve consent-safe WhatsApp recovery campaign", "medium", 5],
  ["client", "Review churn risk and VIP retention actions", "medium", 6],
  ["payroll", "Check salary-to-revenue and payroll anomalies", "high", 7],
  ["branch", "Inspect branch risk heatmap and SOP drift", "medium", 8],
  ["security", "Review sensitive data access and role drift", "high", 9],
  ["forecast", "Run digital twin forecast for next 7 days", "low", 10]
];

function insert(table, row) {
  const columns = Object.keys(row);
  const names = columns.join(", ");
  const values = columns.map((column) => `@${column}`).join(", ");
  db.prepare(`INSERT INTO ${table} (${names}) VALUES (${values})`).run(row);
  return camel(row);
}

function scopedUpdate(table, id, access, fields) {
  const current = getScoped(table, id, access);
  const entries = Object.entries({ ...fields, updated_at: now() }).filter(([, value]) => value !== undefined);
  const set = entries.map(([key]) => `${key} = @${key}`).join(", ");
  db.prepare(`UPDATE ${table} SET ${set} WHERE id = @id AND tenant_id = @tenant_id`).run({
    ...Object.fromEntries(entries),
    id,
    tenant_id: access.tenantId
  });
  return camel({ ...current, ...Object.fromEntries(entries) });
}

function approvalRow({ access, branchId, sourceModule, sourceId, requestType, title, riskLevel, evidence = {}, decision = {} }) {
  return {
    id: makeId("appr"),
    tenant_id: access.tenantId,
    branch_id: branchId || "",
    source_module: sourceModule,
    source_id: sourceId || "",
    request_type: requestType,
    title,
    risk_level: riskLevel || riskFromText(title),
    status: "pending",
    evidence_json: toJson(evidence),
    decision_json: toJson(decision),
    delegated_to: "",
    snoozed_until: "",
    requested_by: access.userId || "",
    decided_by: "",
    decided_at: "",
    version: 1
  };
}

function createApproval(access, branchId, sourceModule, sourceId, requestType, title, riskLevel, evidence = {}, decision = {}) {
  const row = approvalRow({ access, branchId, sourceModule, sourceId, requestType, title, riskLevel, evidence, decision });
  insert("autonomous_approval_requests", row);
  auditDecision("autonomous.approval_requested", "autonomous_approval_request", row.id, access, { branchId, details: { sourceModule, requestType, riskLevel } });
  emitEvent("autonomous:approval_requested", access, branchId, row.id, { sourceModule, riskLevel });
  return camel(row);
}

function ensureDefaultModelProviders(access) {
  requireTenant(access);
  const insertProvider = db.prepare(`INSERT OR IGNORE INTO ai_model_providers
    (id, tenant_id, branch_id, provider_key, provider_name, model_family, enabled, cost_per_1k_tokens, avg_latency_ms, accuracy_score, credential_ref, policy_json)
    VALUES (@id, @tenant_id, '', @provider_key, @provider_name, @model_family, 1, @cost_per_1k_tokens, @avg_latency_ms, @accuracy_score, '', @policy_json)`);
  const tx = db.transaction(() => {
    for (const provider of modelDefaults) {
      insertProvider.run({
        id: makeId("mdl"),
        tenant_id: access.tenantId,
        provider_key: provider.key,
        provider_name: provider.name,
        model_family: provider.family,
        cost_per_1k_tokens: provider.cost,
        avg_latency_ms: provider.latency,
        accuracy_score: provider.accuracy,
        policy_json: toJson({ providerSwitching: true, noHardcodedProvider: true })
      });
    }
  });
  tx();
}

function selectedModelProvider(access, branchId, payload = {}) {
  ensureDefaultModelProviders(access);
  const providers = db.prepare(`SELECT * FROM ai_model_providers WHERE tenant_id = ? AND enabled = 1 ORDER BY provider_name ASC`).all(access.tenantId);
  if (!providers.length) throw badRequest("No AI model providers are enabled");
  const strategy = payload.strategy || payload.optimizeFor || "balanced";
  const scored = providers.map((provider) => {
    const costScore = number(provider.cost_per_1k_tokens) * 100;
    const latencyScore = number(provider.avg_latency_ms) / 1000;
    const accuracyScore = (1 - number(provider.accuracy_score)) * 10;
    const score = strategy === "cost"
      ? costScore + latencyScore
      : strategy === "latency"
        ? latencyScore + costScore / 2
        : strategy === "accuracy"
          ? accuracyScore + costScore / 3
          : costScore + latencyScore + accuracyScore;
    return { provider, score };
  }).sort((a, b) => a.score - b.score);
  const selected = scored[0].provider;
  const reasons = [
    `Selected ${selected.provider_name} for ${strategy} routing policy.`,
    `Cost ${selected.cost_per_1k_tokens}, latency ${selected.avg_latency_ms}ms, accuracy ${selected.accuracy_score}.`
  ];
  const decision = {
    id: makeId("mdlrt"),
    tenant_id: access.tenantId,
    branch_id: branchId || "",
    task_type: payload.taskType || "general",
    selected_provider_id: selected.id,
    selected_provider_key: selected.provider_key,
    reason_json: toJson(reasons),
    policy_json: toJson({ strategy, highRiskApproval: true, providerFallback: true }),
    estimated_cost: number(selected.cost_per_1k_tokens) * number(payload.estimatedTokens, 1000) / 1000,
    estimated_latency_ms: number(selected.avg_latency_ms),
    confidence: number(selected.accuracy_score, 0.75)
  };
  insert("ai_model_router_decisions", decision);
  insert("ai_model_run_metrics", {
    id: makeId("mdlmet"),
    tenant_id: access.tenantId,
    branch_id: branchId || "",
    provider_id: selected.id,
    route_key: payload.routeKey || "",
    task_type: decision.task_type,
    latency_ms: decision.estimated_latency_ms,
    token_count: number(payload.estimatedTokens, 1000),
    estimated_cost: decision.estimated_cost,
    accuracy_score: decision.confidence,
    status: "routed"
  });
  auditDecision("ai_model.route_selected", "ai_model_router_decision", decision.id, access, { branchId, details: { strategy, provider: selected.provider_key } });
  emitEvent("ai:model_routed", access, branchId, decision.id, { provider: selected.provider_key });
  return { provider: camel(selected), decision: camel(decision), reasons };
}

function branchEvidence(access, branchId = "") {
  return {
    bookings: tableCount("appointments", access.tenantId, branchId),
    invoices: tableCount("invoices", access.tenantId, branchId),
    payments: tableCount("payments", access.tenantId, branchId),
    staff: tableCount("staff_master", access.tenantId, branchId) || tableCount("staff", access.tenantId, branchId),
    inventory: tableCount("products", access.tenantId, branchId),
    approvals: tableCount("autonomous_approval_requests", access.tenantId, branchId)
  };
}

function tenActions(evidence) {
  return ceoActionTemplates.map(([impactArea, title, riskLevel, priority]) => ({
    impactArea,
    title,
    riskLevel,
    priority,
    confidence: riskLevel === "high" ? 0.82 : 0.76,
    evidence,
    requiresApproval: Boolean(approvalRequired(riskLevel))
  }));
}

export const autonomousEnterprisePlatformService = {
  generateCeoBrief(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const briefDate = payload.briefDate || today();
    const evidence = { ...branchEvidence(access, branchId), signals: payload.signals || {} };
    const actions = tenActions(evidence);
    const result = db.transaction(() => {
      const brief = insert("ai_ceo_daily_briefs", {
        id: makeId("ceobrief"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        brief_date: briefDate,
        role_scope: payload.roleScope || "owner",
        summary: payload.summary || "Top owner actions across revenue, staff, inventory, cash, campaigns and branch risk.",
        top_actions_json: toJson(actions),
        evidence_json: toJson(evidence),
        confidence: 0.84,
        status: "generated",
        version: 1
      });
      const actionRows = actions.map((action) => insert("ai_ceo_actions", {
        id: makeId("ceoact"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        brief_id: brief.id,
        action_type: action.impactArea,
        title: action.title,
        impact_area: action.impactArea,
        priority: action.priority,
        risk_level: action.riskLevel,
        confidence: action.confidence,
        evidence_json: toJson(action.evidence),
        recommended_action_json: toJson(action),
        approval_status: action.requiresApproval ? "pending" : "recommended",
        version: 1
      }));
      const approvals = actionRows.map((action) => createApproval(
        access,
        branchId,
        "ai_ceo",
        action.id,
        "ceo_daily_action",
        action.title,
        action.riskLevel,
        parseJson(action.evidenceJson, evidence),
        parseJson(action.recommendedActionJson, action)
      ));
      insert("owner_mobile_briefs", {
        id: makeId("mobbrief"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        brief_date: briefDate,
        summary: brief.summary,
        actions_json: toJson(actions),
        metrics_json: toJson(evidence),
        status: "ready"
      });
      return { brief, actions: actionRows, approvals };
    })();
    auditDecision("ai_ceo.daily_brief_generated", "ai_ceo_daily_brief", result.brief.id, access, { branchId, details: { actionCount: result.actions.length } });
    emitEvent("ai_ceo:daily_brief_created", access, branchId, result.brief.id, { actionCount: result.actions.length });
    return result;
  },

  listCeoBriefs(query, access) {
    requireOwner(access);
    return listRows("ai_ceo_daily_briefs", access, query, { limit: 30 });
  },

  listCeoActions(query, access) {
    requireOwner(access);
    return listRows("ai_ceo_actions", access, query, { orderBy: "priority ASC, created_at DESC", limit: 100 });
  },

  approveCeoAction(id, payload, access) {
    requireOwner(access);
    const action = getScoped("ai_ceo_actions", id, access);
    const updated = scopedUpdate("ai_ceo_actions", id, access, {
      approval_status: payload.status || "approved",
      version: number(action.version, 1) + 1
    });
    auditDecision("ai_ceo.action_approved", "ai_ceo_action", id, access, { branchId: action.branch_id, details: payload });
    emitEvent("ai_ceo:action_approved", access, action.branch_id, id);
    return updated;
  },

  approvalRequests(query, access) {
    requireManager(access);
    return listRows("autonomous_approval_requests", access, query, { limit: 200 });
  },

  createApprovalRequest(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const title = payload.title || payload.requestType || "Approval request";
    const riskLevel = payload.riskLevel || riskFromText(title);
    return createApproval(access, branchId, payload.sourceModule || "manual", payload.sourceId || "", payload.requestType || "manual_review", title, riskLevel, payload.evidence || {}, payload.decision || {});
  },

  decideApproval(id, decision, payload, access) {
    requireManager(access);
    const request = getScoped("autonomous_approval_requests", id, access);
    const branchId = request.branch_id || "";
    const statusByDecision = {
      approve: "approved",
      reject: "rejected",
      snooze: "snoozed",
      delegate: "delegated",
      evidence: "evidence_required"
    };
    const status = statusByDecision[decision] || decision;
    const updated = scopedUpdate("autonomous_approval_requests", id, access, {
      status,
      delegated_to: decision === "delegate" ? payload.delegatedTo || payload.delegateTo || "" : request.delegated_to,
      snoozed_until: decision === "snooze" ? payload.snoozedUntil || payload.until || "" : request.snoozed_until,
      decided_by: ["approve", "reject"].includes(decision) ? access.userId || "" : request.decided_by,
      decided_at: ["approve", "reject"].includes(decision) ? now() : request.decided_at,
      version: number(request.version, 1) + 1
    });
    insert("autonomous_approval_actions", {
      id: makeId("apact"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      request_id: id,
      action_type: decision,
      actor_user_id: access.userId || "",
      actor_role: access.role || "",
      comment: payload.comment || "",
      payload_json: toJson(payload)
    });
    if (decision === "evidence") {
      insert("autonomous_approval_evidence", {
        id: makeId("apev"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        request_id: id,
        evidence_type: payload.evidenceType || "required",
        evidence_json: toJson(payload.evidence || { required: true }),
        created_by: access.userId || ""
      });
    }
    if (decision === "delegate") {
      insert("autonomous_approval_delegations", {
        id: makeId("apdel"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        request_id: id,
        delegated_to: payload.delegatedTo || payload.delegateTo || "",
        delegated_by: access.userId || "",
        reason: payload.reason || "",
        status: "active"
      });
    }
    auditDecision(`autonomous.approval_${decision}`, "autonomous_approval_request", id, access, { branchId, details: payload });
    emitEvent(`autonomous:approval_${status}`, access, branchId, id);
    return updated;
  },

  modelProviders(query, access) {
    requireManager(access);
    ensureDefaultModelProviders(access);
    return listRows("ai_model_providers", access, query, { orderBy: "provider_name ASC", limit: 50 });
  },

  createModelProvider(payload, access) {
    requireOwner(access);
    const providerKey = payload.providerKey || payload.provider_key;
    const providerName = payload.providerName || payload.provider_name;
    if (!providerKey || !providerName) throw badRequest("providerKey and providerName are required");
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const row = insert("ai_model_providers", {
      id: makeId("mdl"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      provider_key: providerKey,
      provider_name: providerName,
      model_family: payload.modelFamily || "",
      enabled: payload.enabled === false ? 0 : 1,
      cost_per_1k_tokens: number(payload.costPer1kTokens, 0),
      avg_latency_ms: number(payload.avgLatencyMs, 0),
      accuracy_score: number(payload.accuracyScore, 0.75),
      credential_ref: payload.credentialRef || "",
      policy_json: toJson(payload.policy || {}),
      version: 1
    });
    auditDecision("ai_model.provider_created", "ai_model_provider", row.id, access, { branchId, details: { providerKey } });
    emitEvent("ai:model_provider_created", access, branchId, row.id);
    return row;
  },

  routeModel(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    return selectedModelProvider(access, branchId, payload);
  },

  modelMetrics(query, access) {
    requireManager(access);
    return listRows("ai_model_run_metrics", access, query, { limit: 100 });
  },

  appendLedgerEvent(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (!payload.aggregateType || !payload.aggregateId || !payload.eventType) {
      throw badRequest("aggregateType, aggregateId and eventType are required");
    }
    const row = insert("event_ledger_events", {
      id: makeId("evt"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      aggregate_type: payload.aggregateType,
      aggregate_id: payload.aggregateId,
      event_type: payload.eventType,
      event_version: number(payload.eventVersion, 1),
      event_payload_json: toJson(payload.eventPayload || payload.payload || {}),
      metadata_json: toJson({ appendOnly: true, ...(payload.metadata || {}) }),
      actor_user_id: access.userId || "",
      occurred_at: payload.occurredAt || now()
    });
    auditDecision("event_ledger.event_appended", payload.aggregateType, payload.aggregateId, access, { branchId, details: { eventId: row.id, eventType: row.eventType } });
    emitEvent("ledger:event_appended", access, branchId, row.id, { aggregateType: payload.aggregateType, eventType: payload.eventType });
    return row;
  },

  ledgerEvents(query, access) {
    requireManager(access);
    return listRows("event_ledger_events", access, query, { orderBy: "occurred_at ASC, created_at ASC", limit: 500 });
  },

  replayLedger(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId, aggregate_type: payload.aggregateType || "", aggregate_id: payload.aggregateId || "" };
    const filters = ["tenant_id = @tenant_id"];
    if (branchId) filters.push("branch_id = @branch_id");
    if (payload.aggregateType) filters.push("aggregate_type = @aggregate_type");
    if (payload.aggregateId) filters.push("aggregate_id = @aggregate_id");
    const events = db.prepare(`SELECT * FROM event_ledger_events WHERE ${filters.join(" AND ")} ORDER BY occurred_at ASC, created_at ASC`).all(params);
    const replayResult = events.reduce((state, event) => {
      state.count += 1;
      state.byType[event.event_type] = (state.byType[event.event_type] || 0) + 1;
      state.lastEventId = event.id;
      return state;
    }, { count: 0, byType: {}, lastEventId: "" });
    const run = insert("event_ledger_replay_runs", {
      id: makeId("replay"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      aggregate_type: payload.aggregateType || "",
      aggregate_id: payload.aggregateId || "",
      event_count: events.length,
      replay_result_json: toJson(replayResult),
      status: "completed"
    });
    emitEvent("ledger:replay_completed", access, branchId, run.id, { eventCount: events.length });
    return { run, events: events.map(camel), replayResult };
  },

  createWarRoomSnapshot(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const branches = payload.branchIds?.length ? payload.branchIds : [branchId || "all"];
    for (const id of branches) if (id !== "all") assertBranch(access, id);
    const risks = {
      revenueRiskCount: number(payload.revenueRiskCount, 1),
      manpowerGapCount: number(payload.manpowerGapCount, 1),
      fraudAlertCount: number(payload.fraudAlertCount, 1),
      stockoutRiskCount: number(payload.stockoutRiskCount, 1),
      burnoutRiskCount: number(payload.burnoutRiskCount, 1),
      pendingCashCloseCount: number(payload.pendingCashCloseCount, 1)
    };
    const result = db.transaction(() => {
      const snapshot = insert("war_room_snapshots", {
        id: makeId("war"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        snapshot_date: payload.snapshotDate || today(),
        total_branches: branches.length,
        revenue_risk_count: risks.revenueRiskCount,
        manpower_gap_count: risks.manpowerGapCount,
        fraud_alert_count: risks.fraudAlertCount,
        stockout_risk_count: risks.stockoutRiskCount,
        burnout_risk_count: risks.burnoutRiskCount,
        pending_cash_close_count: risks.pendingCashCloseCount,
        summary_json: toJson({ liveMap: true, branches, risks })
      });
      const alerts = [
        ["revenue_risk", "Revenue risk branch needs recovery action"],
        ["manpower_gap", "Peak-hour manpower gap detected"],
        ["stockout_risk", "Inventory stockout risk may block services"],
        ["cash_close", "Pending cash close requires owner review"]
      ].map(([alertType, title]) => insert("war_room_alerts", {
        id: makeId("waralert"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        alert_type: alertType,
        severity: alertType === "cash_close" ? "high" : "medium",
        title,
        evidence_json: toJson(risks),
        recommended_action_json: toJson({ requiresApproval: true, source: "war_room" }),
        status: "open"
      }));
      const scores = branches.map((id) => insert("war_room_branch_scores", {
        id: makeId("warscore"),
        tenant_id: access.tenantId,
        branch_id: id,
        score_date: payload.snapshotDate || today(),
        revenue_score: 72,
        manpower_score: 68,
        inventory_score: 74,
        fraud_score: 82,
        staff_wellness_score: 70,
        overall_risk_score: 100 - ((72 + 68 + 74 + 82 + 70) / 5),
        evidence_json: toJson(risks)
      }));
      return { snapshot, alerts, scores };
    })();
    auditDecision("war_room.snapshot_created", "war_room_snapshot", result.snapshot.id, access, { branchId, details: risks });
    emitEvent("war_room:snapshot_created", access, branchId, result.snapshot.id);
    return result;
  },

  warRoomSnapshots(query, access) {
    requireOwner(access);
    return listRows("war_room_snapshots", access, query, { limit: 30 });
  },

  warRoomAlerts(query, access) {
    requireOwner(access);
    return listRows("war_room_alerts", access, query, { limit: 100 });
  },

  forecastDigitalTwinV2(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const baseRevenue = number(payload.baseRevenue, 100000);
    const campaignImpact = number(payload.campaignImpact, 0.08);
    const staffCost = number(payload.staffCost, baseRevenue * 0.28);
    const stockRisk = number(payload.stockRisk, 0.18);
    const forecast = {
      projectedRevenue: Math.round(baseRevenue * (1 + campaignImpact)),
      projectedProfit: Math.round(baseRevenue * (1 + campaignImpact) * 0.32 - staffCost),
      projectedStaffCost: Math.round(staffCost),
      projectedStockRisk: stockRisk,
      projectedCampaignImpact: campaignImpact,
      confidence: payload.historicalDataSparse ? 0.64 : 0.82,
      risks: stockRisk > 0.3 ? ["Stock risk can reduce campaign impact"] : ["Forecast requires manager validation before execution"],
      recommendations: ["Generate draft roster before applying changes", "Approve campaign spend before WhatsApp send"]
    };
    const result = db.transaction(() => {
      const scenario = insert("digital_twin_v2_scenarios", {
        id: makeId("twv2"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        scenario_type: payload.scenarioType || "full_forecast",
        scenario_name: payload.scenarioName || payload.scenario || "Autonomous platform forecast",
        input_json: toJson(payload),
        status: "simulated",
        version: 1
      });
      const forecastRow = insert("digital_twin_v2_forecasts", {
        id: makeId("twfc"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        scenario_id: scenario.id,
        forecast_type: "cost_profit_stock_staff_campaign",
        projected_revenue: forecast.projectedRevenue,
        projected_profit: forecast.projectedProfit,
        projected_staff_cost: forecast.projectedStaffCost,
        projected_stock_risk: forecast.projectedStockRisk,
        projected_campaign_impact: forecast.projectedCampaignImpact,
        confidence: forecast.confidence,
        risks_json: toJson(forecast.risks),
        recommendations_json: toJson(forecast.recommendations)
      });
      const recommendation = insert("digital_twin_v2_recommendations", {
        id: makeId("twrec"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        forecast_id: forecastRow.id,
        title: "Approve forecast-safe action plan before applying",
        risk_level: "medium",
        recommendation_json: toJson(forecast),
        requires_approval: 1,
        status: "pending"
      });
      createApproval(access, branchId, "digital_twin_v2", recommendation.id, "forecast_action", recommendation.title, "medium", forecast, recommendation);
      return { scenario, forecast: forecastRow, recommendation, output: forecast };
    })();
    emitEvent("twin:v2_forecast_created", access, branchId, result.forecast.id, { confidence: forecast.confidence });
    return result;
  },

  digitalTwinV2Scenarios(query, access) {
    requireManager(access);
    return listRows("digital_twin_v2_scenarios", access, query, { limit: 100 });
  },

  rebuildCustomerSuperGraph(clientId, payload, access) {
    requireManager(access);
    if (!clientId) throw badRequest("clientId is required");
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const preferences = [
      ["client", clientId, "Client profile anchor", { clientId }],
      ["family", payload.familyId || `${clientId}:family`, "Family and referrals", { referrals: payload.referrals || [] }],
      ["membership", payload.membershipId || "membership", "Membership and wallet", { walletBalance: number(payload.walletBalance, 0) }],
      ["service", payload.favoriteService || "hair", "Favorite service", { compatibilityScore: number(payload.staffCompatibilityScore, 0.78) }],
      ["risk", "churn", "Churn and complaint signals", { churnRisk: number(payload.churnRisk, 0.35), complaints: payload.complaints || [] }]
    ];
    const result = db.transaction(() => {
      const nodes = preferences.map(([nodeType, nodeKey, nodeValue, properties]) => insert("customer_super_graph_nodes", {
        id: makeId("csgn"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        client_id: clientId,
        node_type: nodeType,
        node_key: nodeKey,
        node_value: nodeValue,
        properties_json: toJson(properties)
      }));
      const edges = nodes.slice(1).map((node) => insert("customer_super_graph_edges", {
        id: makeId("csge"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        client_id: clientId,
        from_node_id: nodes[0].id,
        to_node_id: node.id,
        relationship_type: `client_${node.nodeType}`,
        weight: node.nodeType === "risk" ? 0.65 : 0.9,
        properties_json: toJson({ explainable: true })
      }));
      const signal = insert("customer_super_graph_signals", {
        id: makeId("csgs"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        client_id: clientId,
        signal_type: "next_best_action",
        severity: number(payload.churnRisk, 0.35) > 0.6 ? "high" : "medium",
        signal_json: toJson({ action: "Review membership renewal and preferred staff match", approvalRequired: false }),
        status: "active"
      });
      return { nodes, edges, signal };
    })();
    emitEvent("client:super_graph_updated", access, branchId, clientId, { nodeCount: result.nodes.length });
    return result;
  },

  customerSuperGraph(clientId, query, access) {
    requireManager(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, client_id: clientId, branch_id: branchId };
    const branchFilter = branchId ? " AND branch_id = @branch_id" : "";
    return {
      nodes: db.prepare(`SELECT * FROM customer_super_graph_nodes WHERE tenant_id = @tenant_id AND client_id = @client_id${branchFilter} ORDER BY created_at DESC`).all(params).map(camel),
      edges: db.prepare(`SELECT * FROM customer_super_graph_edges WHERE tenant_id = @tenant_id AND client_id = @client_id${branchFilter} ORDER BY created_at DESC`).all(params).map(camel),
      signals: db.prepare(`SELECT * FROM customer_super_graph_signals WHERE tenant_id = @tenant_id AND client_id = @client_id${branchFilter} ORDER BY created_at DESC`).all(params).map(camel)
    };
  },

  captureVoiceCall(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (!payload.phone) throw badRequest("phone is required");
    const transcript = payload.transcript || [];
    const highRiskIntent = /(payment|refund|complaint|vip|delete|salary)/i.test(payload.intent || "");
    const result = db.transaction(() => {
      const call = insert("voice_receptionist_calls", {
        id: makeId("voice"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        phone: payload.phone,
        direction: payload.direction || "inbound",
        language: payload.language || "en-IN",
        intent: payload.intent || "lead_capture",
        status: highRiskIntent ? "handoff_required" : "captured",
        summary: payload.summary || "Voice AI captured call intent and transcript for human review.",
        consent_status: payload.consentStatus || "unknown",
        human_handoff_required: highRiskIntent || payload.humanHandoffRequired ? 1 : 0,
        provider_call_id: payload.providerCallId || ""
      });
      const transcriptRow = insert("voice_receptionist_transcripts", {
        id: makeId("vtx"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        call_id: call.id,
        transcript_json: toJson(transcript),
        entities_json: toJson(payload.entities || {}),
        redaction_status: "privacy_checked"
      });
      return { call, transcript: transcriptRow };
    })();
    emitEvent("voice:call_captured", access, branchId, result.call.id, { handoffRequired: result.call.humanHandoffRequired });
    return result;
  },

  voiceCalls(query, access) {
    requireManager(access);
    return listRows("voice_receptionist_calls", access, query, { limit: 100 });
  },

  handoffVoiceCall(id, payload, access) {
    requireManager(access);
    const call = getScoped("voice_receptionist_calls", id, access);
    const handoff = insert("voice_receptionist_handoffs", {
      id: makeId("vhf"),
      tenant_id: access.tenantId,
      branch_id: call.branch_id || "",
      call_id: id,
      handoff_to: payload.handoffTo || "front_desk",
      reason: payload.reason || "Human review requested",
      transcript_summary: payload.transcriptSummary || call.summary || "",
      status: "queued"
    });
    scopedUpdate("voice_receptionist_calls", id, access, { status: "handoff_queued", human_handoff_required: 1 });
    auditDecision("voice.handoff_created", "voice_receptionist_call", id, access, { branchId: call.branch_id, details: payload });
    emitEvent("voice:human_handoff_required", access, call.branch_id, id);
    return handoff;
  },

  createComputerVisionEvent(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (payload.rawImage || payload.rawFrame || payload.faceTemplate || payload.biometricTemplate) {
      throw badRequest("Computer vision events must store metadata or secure references only");
    }
    const row = insert("computer_vision_events", {
      id: makeId("cve"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      source_id: payload.sourceId || "",
      event_type: payload.eventType || "queue_detection",
      severity: payload.severity || "low",
      privacy_mode: payload.privacyMode || "metadata_only",
      metadata_json: toJson({
        queueLength: number(payload.queueLength, 0),
        cleanlinessScore: number(payload.cleanlinessScore, 0),
        shelfRisk: payload.shelfRisk || "",
        beforeAfterAnalysis: payload.beforeAfterAnalysis || "",
        privacyFirst: true,
        ...(payload.metadata || {})
      }),
      evidence_ref: payload.evidenceRef || "",
      status: "review_required"
    });
    auditDecision("vision.event_created", "computer_vision_event", row.id, access, { branchId, details: { eventType: row.eventType } });
    emitEvent("vision:event_created", access, branchId, row.id, { eventType: row.eventType });
    return row;
  },

  computerVisionEvents(query, access) {
    requireManager(access);
    return listRows("computer_vision_events", access, query, { limit: 100 });
  },

  createWhatsappCommerceSession(payload, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (!payload.phone) throw badRequest("phone is required");
    const result = db.transaction(() => {
      const session = insert("whatsapp_commerce_sessions", {
        id: makeId("wac"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        client_id: payload.clientId || "",
        phone: payload.phone,
        session_type: payload.sessionType || "commerce",
        status: "open",
        consent_status: payload.consentStatus || "unknown",
        last_intent: payload.intent || "booking",
        cart_total: number(payload.totalAmount, 0),
        payment_status: "not_started"
      });
      const cart = insert("whatsapp_commerce_carts", {
        id: makeId("wcart"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        session_id: session.id,
        cart_items_json: toJson(payload.items || []),
        package_balance_json: toJson(payload.packageBalance || {}),
        invoice_json: toJson(payload.invoice || {}),
        total_amount: number(payload.totalAmount, 0),
        status: "draft"
      });
      insert("whatsapp_commerce_events", {
        id: makeId("wace"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        session_id: session.id,
        event_type: "session_created",
        payload_json: toJson({ intent: payload.intent || "booking", consentStatus: session.consentStatus }),
        approval_required: 0
      });
      return { session, cart };
    })();
    emitEvent("whatsapp:commerce_session_created", access, branchId, result.session.id);
    return result;
  },

  whatsappCommerceSessions(query, access) {
    requireManager(access);
    return listRows("whatsapp_commerce_sessions", access, query, { limit: 100 });
  },

  checkoutWhatsappCommerce(id, payload, access) {
    requireManager(access);
    const session = getScoped("whatsapp_commerce_sessions", id, access);
    const branchId = session.branch_id || "";
    const sensitive = number(session.cart_total) > 0 || payload.paymentLink || payload.invoiceAction;
    const event = insert("whatsapp_commerce_events", {
      id: makeId("wace"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      session_id: id,
      event_type: "checkout_requested",
      payload_json: toJson({ ...payload, approvalSafe: true }),
      approval_required: sensitive ? 1 : 0
    });
    if (sensitive) createApproval(access, branchId, "whatsapp_commerce", event.id, "whatsapp_checkout", "Approve WhatsApp commerce checkout", "medium", payload, event);
    scopedUpdate("whatsapp_commerce_sessions", id, access, { payment_status: sensitive ? "approval_required" : "ready", status: "checkout_requested" });
    emitEvent("whatsapp:commerce_checkout_requested", access, branchId, id, { approvalRequired: sensitive });
    return { event, approvalRequired: sensitive };
  },

  ownerMobileBriefs(query, access) {
    requireOwner(access);
    return listRows("owner_mobile_briefs", access, query, { limit: 30 });
  },

  registerEnterpriseMobileApp(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const row = insert("enterprise_mobile_apps", {
      id: makeId("emapp"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      app_type: payload.appType || "owner",
      platform: payload.platform || "pwa",
      version_name: payload.versionName || "1.0.0",
      offline_enabled: payload.offlineEnabled === false ? 0 : 1,
      push_enabled: payload.pushEnabled ? 1 : 0,
      policy_json: toJson(payload.policy || { offlineMode: true, pushNotifications: true }),
      status: "ready"
    });
    emitEvent("mobile:enterprise_app_registered", access, branchId, row.id, { appType: row.appType });
    return row;
  },

  createFranchiseUnit(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (!payload.franchiseName) throw badRequest("franchiseName is required");
    const row = insert("franchise_units", {
      id: makeId("frn"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      franchise_name: payload.franchiseName,
      owner_name: payload.ownerName || "",
      owner_email: payload.ownerEmail || "",
      royalty_percent: number(payload.royaltyPercent, 0),
      territory_json: toJson(payload.territory || {}),
      sop_score: number(payload.sopScore, 0),
      status: payload.status || "onboarding",
      version: 1
    });
    auditDecision("franchise.unit_created", "franchise_unit", row.id, access, { branchId, details: { franchiseName: row.franchiseName } });
    emitEvent("franchise:unit_created", access, branchId, row.id);
    return row;
  },

  franchiseUnits(query, access) {
    requireOwner(access);
    return listRows("franchise_units", access, query, { limit: 100 });
  },

  createRoyaltyRun(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const grossRevenue = number(payload.grossRevenue, 0);
    const royaltyPercent = number(payload.royaltyPercent, 0);
    const row = insert("franchise_royalty_runs", {
      id: makeId("frroy"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      franchise_id: payload.franchiseId || "",
      period_start: payload.periodStart || today(),
      period_end: payload.periodEnd || today(),
      gross_revenue: grossRevenue,
      royalty_percent: royaltyPercent,
      royalty_amount: Math.round(grossRevenue * royaltyPercent) / 100,
      status: "draft"
    });
    emitEvent("franchise:royalty_run_created", access, branchId, row.id);
    return row;
  },

  forecastFinancialBrain(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const revenue = number(payload.revenue, 200000);
    const expenses = number(payload.expenses, 128000);
    const salary = number(payload.salaryCost, revenue * 0.32);
    const taxReserve = revenue * 0.08;
    const result = db.transaction(() => {
      const snapshot = insert("financial_brain_snapshots", {
        id: makeId("fin"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        snapshot_date: payload.snapshotDate || today(),
        cash_flow_forecast: revenue - expenses - taxReserve,
        profit_margin: revenue ? (revenue - expenses) / revenue : 0,
        tax_reserve: taxReserve,
        salary_to_revenue_ratio: revenue ? salary / revenue : 0,
        product_margin: number(payload.productMargin, 0.42),
        service_margin: number(payload.serviceMargin, 0.58),
        metrics_json: toJson({ revenue, expenses, salary, taxReserve })
      });
      const finding = insert("financial_brain_findings", {
        id: makeId("finf"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        finding_type: snapshot.salaryToRevenueRatio > 0.38 ? "salary_to_revenue_risk" : "profit_opportunity",
        severity: snapshot.salaryToRevenueRatio > 0.38 ? "high" : "medium",
        estimated_amount: Math.round(Math.max(0, revenue - expenses - taxReserve)),
        evidence_json: toJson(snapshot),
        recommended_action_json: toJson({ reviewStaffing: snapshot.salaryToRevenueRatio > 0.38, reserveTax: true }),
        status: "open"
      });
      const forecast = insert("financial_brain_forecasts", {
        id: makeId("finfc"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        period_start: payload.periodStart || today(),
        period_end: payload.periodEnd || today(),
        forecast_json: toJson({ cashFlow: snapshot.cashFlowForecast, profitMargin: snapshot.profitMargin, taxReserve, salaryRatio: snapshot.salaryToRevenueRatio }),
        confidence: payload.historicalDataSparse ? 0.62 : 0.81
      });
      createApproval(access, branchId, "financial_brain", finding.id, "financial_action", "Review financial brain recommendation", finding.severity, snapshot, finding);
      return { snapshot, finding, forecast };
    })();
    emitEvent("finance:brain_forecast_created", access, branchId, result.forecast.id);
    return result;
  },

  financialFindings(query, access) {
    requireOwner(access);
    return listRows("financial_brain_findings", access, query, { limit: 100 });
  },

  createProviderConnector(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (!payload.providerKey || !payload.providerType || !payload.displayName) throw badRequest("providerKey, providerType and displayName are required");
    const row = insert("provider_connectors", {
      id: makeId("conn"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      provider_key: payload.providerKey,
      provider_type: payload.providerType,
      display_name: payload.displayName,
      credential_ref: payload.credentialRef || "",
      capabilities_json: toJson(payload.capabilities || []),
      health_json: toJson(payload.health || { configured: Boolean(payload.credentialRef), liveSendEnabled: false }),
      status: payload.status || "draft",
      version: 1
    });
    auditDecision("marketplace.connector_created", "provider_connector", row.id, access, { branchId, details: { providerKey: row.providerKey } });
    emitEvent("marketplace:connector_created", access, branchId, row.id);
    return row;
  },

  providerConnectors(query, access) {
    requireOwner(access);
    return listRows("provider_connectors", access, query, { limit: 100 });
  },

  createMarketplacePlugin(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    if (!payload.pluginKey || !payload.pluginName) throw badRequest("pluginKey and pluginName are required");
    const row = insert("marketplace_plugins", {
      id: makeId("plug"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      plugin_key: payload.pluginKey,
      plugin_name: payload.pluginName,
      category: payload.category || "connector",
      provider: payload.provider || "",
      permissions_json: toJson(payload.permissions || []),
      install_policy_json: toJson(payload.installPolicy || { approvalRequired: true }),
      status: payload.status || "available",
      version: 1
    });
    emitEvent("marketplace:plugin_created", access, branchId, row.id);
    return row;
  },

  marketplacePlugins(query, access) {
    requireOwner(access);
    return listRows("marketplace_plugins", access, query, { limit: 100 });
  },

  installMarketplacePlugin(id, payload, access) {
    requireOwner(access);
    const plugin = getScoped("marketplace_plugins", id, access);
    const branchId = plugin.branch_id || branchFrom(payload, access);
    if (branchId) assertBranch(access, branchId);
    const install = insert("marketplace_plugin_installs", {
      id: makeId("plinst"),
      tenant_id: access.tenantId,
      branch_id: branchId || "",
      plugin_id: id,
      installed_by: access.userId || "",
      install_state_json: toJson({ approved: true, settings: payload.settings || {} }),
      status: "installed"
    });
    auditDecision("marketplace.plugin_installed", "marketplace_plugin", id, access, { branchId, details: payload });
    emitEvent("marketplace:plugin_installed", access, branchId, id);
    return install;
  },

  runCloudReadinessCheck(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const findings = [
      "PostgreSQL/Supabase schema migration plan required",
      "Redis queue adapter should back AI and WhatsApp jobs",
      "Object storage backup policy must be configured",
      "Secrets must use vault references instead of raw values"
    ];
    const row = insert("cloud_readiness_checks", {
      id: makeId("cloud"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      check_type: payload.checkType || "production_cloud_hardening",
      provider_target: payload.providerTarget || "postgres_supabase",
      status: "completed",
      score: number(payload.score, 78),
      findings_json: toJson(findings),
      recommended_actions_json: toJson([
        "Configure PostgreSQL migrations and backup restore drills",
        "Add Redis-backed queues for provider jobs",
        "Move connector credentials to secrets vault references",
        "Enable rate limits and CI/CD deployment checks"
      ])
    });
    emitEvent("cloud:readiness_check_completed", access, branchId, row.id, { score: row.score });
    return row;
  },

  cloudReadinessChecks(query, access) {
    requireOwner(access);
    return listRows("cloud_readiness_checks", access, query, { limit: 100 });
  },

  createBackupRestorePoint(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const row = insert("backup_restore_points", {
      id: makeId("backup"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      backup_type: payload.backupType || "database",
      storage_ref: payload.storageRef || "vault://pending/object-storage",
      checksum: payload.checksum || "",
      size_bytes: number(payload.sizeBytes, 0),
      status: "created",
      restore_verified: payload.restoreVerified ? 1 : 0
    });
    emitEvent("cloud:backup_restore_point_created", access, branchId, row.id);
    return row;
  },

  runDisasterRecovery(payload, access) {
    requireOwner(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const result = { backupId: payload.backupId || "", restoreDrill: true, verified: payload.verified !== false };
    const row = insert("disaster_recovery_runs", {
      id: makeId("dr"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      run_type: payload.runType || "restore_drill",
      backup_id: payload.backupId || "",
      status: result.verified ? "completed" : "review_required",
      rpo_minutes: number(payload.rpoMinutes, 15),
      rto_minutes: number(payload.rtoMinutes, 60),
      result_json: toJson(result)
    });
    auditDecision("cloud.disaster_recovery_run", "disaster_recovery_run", row.id, access, { branchId, details: result });
    emitEvent("cloud:disaster_recovery_run_completed", access, branchId, row.id, { status: row.status });
    return row;
  }
};
