import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import {
  approvalRequired,
  assertBranch,
  auditDecision,
  branchFrom,
  camel,
  emitEvent,
  getScoped,
  makeId,
  now,
  number,
  parseJson,
  requireManager,
  requireTenant,
  riskFromText,
  scopedWhere,
  toJson
} from "../enterprise-command-utils.js";

const defaultAgents = [
  ["ai-receptionist", "AI Receptionist", "front_desk", "Answers booking, reschedule and FAQ work with approval-safe handoff."],
  ["ai-lead-manager", "AI Lead Manager", "growth", "Scores and follows up leads without auto-contacting clients."],
  ["ai-revenue-recovery", "AI Revenue Recovery Agent", "revenue", "Finds unpaid invoices, empty slots and rebooking gaps."],
  ["ai-staff-coach", "AI Staff Coach", "staff", "Creates manager-reviewed coaching insights."],
  ["ai-inventory-analyst", "AI Inventory Analyst", "inventory", "Flags stockout, expiry and waste risk."],
  ["ai-payroll-auditor", "AI Payroll Auditor", "payroll", "Checks payroll and salary anomalies without changing salary."],
  ["ai-compliance-officer", "AI Compliance Officer", "compliance", "Highlights statutory and audit risk."],
  ["ai-marketing-strategist", "AI Marketing Strategist", "marketing", "Drafts campaigns with consent and approval rules."],
  ["ai-branch-manager", "AI Branch Manager", "operations", "Summarizes branch risk and daily action priorities."],
  ["ai-owner-copilot", "AI Owner Copilot", "owner", "Turns owner goals into approval-safe action plans."]
];

const providerCatalog = [
  { providerKey: "openai", providerName: "OpenAI", envKey: "OPENAI_API_KEY", defaultModel: "gpt-4.1-mini", costPer1kTokensInr: 0.5 },
  { providerKey: "anthropic", providerName: "Anthropic Claude", envKey: "ANTHROPIC_API_KEY", defaultModel: "claude-3-5-sonnet", costPer1kTokensInr: 0.8 },
  { providerKey: "gemini", providerName: "Google Gemini", envKey: "GEMINI_API_KEY", defaultModel: "gemini-1.5-pro", costPer1kTokensInr: 0.45 },
  { providerKey: "local", providerName: "Local Rules", envKey: "", defaultModel: "local-rules-v1", costPer1kTokensInr: 0 },
  { providerKey: "local_rules", providerName: "Local Rules", envKey: "", defaultModel: "local-rules-v1", costPer1kTokensInr: 0 },
  { providerKey: "not_configured", providerName: "Not configured", envKey: "", defaultModel: "", costPer1kTokensInr: 0 }
];

const marketplaceTemplates = [
  {
    templateKey: "inactive-client-recovery",
    agentKey: "ai-inactive-client-recovery",
    agentName: "AI Inactive Client Recovery",
    agentType: "marketing",
    description: "Finds clients inactive for 90 days and drafts WhatsApp recovery campaigns for approval.",
    riskLevel: "medium",
    defaultTaskType: "inactive_client_recovery"
  },
  {
    templateKey: "negative-review-monitor",
    agentKey: "ai-negative-review-monitor",
    agentName: "AI Negative Review Monitor",
    agentType: "reputation",
    description: "Detects negative review clusters and escalates owner-safe recovery playbooks.",
    riskLevel: "high",
    defaultTaskType: "negative_review_monitor"
  },
  {
    templateKey: "inventory-reorder-copilot",
    agentKey: "ai-inventory-reorder-copilot",
    agentName: "AI Inventory Reorder Copilot",
    agentType: "inventory",
    description: "Reviews low-stock items and prepares purchase suggestions without auto-ordering.",
    riskLevel: "medium",
    defaultTaskType: "low_stock_check"
  },
  {
    templateKey: "staff-performance-risk",
    agentKey: "ai-staff-performance-risk",
    agentName: "AI Staff Performance Risk",
    agentType: "staff",
    description: "Flags sales, service and feedback drops for manager coaching review.",
    riskLevel: "medium",
    defaultTaskType: "staff_performance_risk"
  }
];

const agentPatchFields = {
  agentName: "agent_name",
  agent_name: "agent_name",
  agentType: "agent_type",
  agent_type: "agent_type",
  description: "description",
  status: "status",
  riskLevel: "risk_level",
  risk_level: "risk_level",
  approvalStatus: "approval_status",
  approval_status: "approval_status",
  providerKey: "provider_key",
  provider_key: "provider_key",
  autonomyLevel: "autonomy_level",
  autonomy_level: "autonomy_level",
  config: "config_json",
  config_json: "config_json"
};

const settingsPatchFields = {
  autonomyLevel: "autonomy_level",
  autonomy_level: "autonomy_level",
  approvalRequired: "approval_required",
  approval_required: "approval_required",
  riskThreshold: "risk_threshold",
  risk_threshold: "risk_threshold",
  providerKey: "provider_key",
  provider_key: "provider_key",
  modelKey: "model_key",
  model_key: "model_key",
  modulePermissions: "module_permissions_json",
  module_permissions_json: "module_permissions_json",
  branchPermissions: "branch_permissions_json",
  branch_permissions_json: "branch_permissions_json",
  promptVersion: "prompt_version",
  prompt_version: "prompt_version",
  status: "status"
};

const schedulePatchFields = {
  scheduleName: "schedule_name",
  schedule_name: "schedule_name",
  scheduleType: "schedule_type",
  schedule_type: "schedule_type",
  cronExpression: "cron_expression",
  cron_expression: "cron_expression",
  timezone: "timezone",
  nextRunAt: "next_run_at",
  next_run_at: "next_run_at",
  lastRunAt: "last_run_at",
  last_run_at: "last_run_at",
  status: "status",
  riskLevel: "risk_level",
  risk_level: "risk_level",
  approvalStatus: "approval_status",
  approval_status: "approval_status"
};

const taskPatchFields = {
  taskType: "task_type",
  task_type: "task_type",
  taskName: "task_name",
  task_name: "task_name",
  description: "description",
  input: "input_json",
  input_json: "input_json",
  output: "output_json",
  output_json: "output_json",
  status: "status",
  priority: "priority",
  assignedTo: "assigned_to",
  assigned_to: "assigned_to",
  dueAt: "due_at",
  due_at: "due_at",
  completedAt: "completed_at",
  completed_at: "completed_at",
  riskLevel: "risk_level",
  risk_level: "risk_level",
  approvalStatus: "approval_status",
  approval_status: "approval_status"
};

const playbookPatchFields = {
  playbookKey: "playbook_key",
  playbook_key: "playbook_key",
  playbookName: "playbook_name",
  playbook_name: "playbook_name",
  triggerType: "trigger_type",
  trigger_type: "trigger_type",
  condition: "condition_json",
  condition_json: "condition_json",
  action: "action_json",
  action_json: "action_json",
  escalation: "escalation_json",
  escalation_json: "escalation_json",
  status: "status",
  riskLevel: "risk_level",
  risk_level: "risk_level",
  approvalStatus: "approval_status",
  approval_status: "approval_status",
  version: "version"
};

const providerPatchFields = {
  providerName: "provider_name",
  provider_name: "provider_name",
  modelKey: "model_key",
  model_key: "model_key",
  status: "status",
  apiKeyRef: "api_key_ref",
  api_key_ref: "api_key_ref",
  endpointUrl: "endpoint_url",
  endpoint_url: "endpoint_url",
  config: "config_json",
  config_json: "config_json",
  riskLevel: "risk_level",
  risk_level: "risk_level",
  approvalStatus: "approval_status",
  approval_status: "approval_status"
};

const riskLevels = new Set(["low", "medium", "high", "critical"]);
const autonomyLevels = new Set([
  "suggest_only",
  "draft_only",
  "approval_required",
  "auto_execute_low_risk",
  "full_auto_disabled",
  "full_auto_enabled"
]);
const riskRank = { low: 1, medium: 2, high: 3, critical: 4 };
const scheduleTypes = new Set(["manual", "daily", "weekly", "monthly"]);

function normalizeRiskLevel(value, fallback = "low") {
  const normalized = String(value || fallback).toLowerCase();
  return riskLevels.has(normalized) ? normalized : fallback;
}

function normalizeAutonomyLevel(value, fallback = "approval_required") {
  const normalized = String(value || fallback).toLowerCase();
  return autonomyLevels.has(normalized) ? normalized : fallback;
}

function normalizeScheduleType(value, fallback = "manual") {
  const normalized = String(value || fallback).toLowerCase();
  return scheduleTypes.has(normalized) ? normalized : fallback;
}

function slugify(value, fallback = "playbook") {
  const slug = String(value || fallback)
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
  return slug || fallback;
}

function clampScore(value, fallback = 0) {
  const numeric = Number(value);
  if (!Number.isFinite(numeric)) return fallback;
  return Math.max(0, Math.min(100, numeric));
}

function confidenceFromRisk(riskLevel) {
  return { critical: 0.6, high: 0.74, medium: 0.84, low: 0.92 }[normalizeRiskLevel(riskLevel)] ?? 0.84;
}

function safetyScoreFromRisk(riskLevel) {
  return { critical: 35, high: 58, medium: 78, low: 94 }[normalizeRiskLevel(riskLevel)] ?? 78;
}

function explicitApprovalRequired(settings = {}) {
  return Number(settings?.approval_required ?? 1) === 1;
}

function canBypassApproval(riskLevel, autonomyLevel, settings = {}) {
  const normalizedRisk = normalizeRiskLevel(riskLevel);
  const normalizedAutonomy = normalizeAutonomyLevel(autonomyLevel || settings?.autonomy_level);
  if (normalizedRisk === "critical") return false;
  if (approvalRequired(normalizedRisk)) return false;
  if (explicitApprovalRequired(settings)) return false;
  return normalizedAutonomy === "auto_execute_low_risk" && normalizedRisk === "low";
}

function approvalGateReason(riskLevel, autonomyLevel, settings = {}) {
  const normalizedRisk = normalizeRiskLevel(riskLevel);
  const normalizedAutonomy = normalizeAutonomyLevel(autonomyLevel || settings?.autonomy_level);
  if (normalizedRisk === "critical") return "Critical actions never auto-execute.";
  if (approvalRequired(normalizedRisk)) return "High-risk actions require human approval.";
  if (explicitApprovalRequired(settings)) return "Human approval is enabled for this agent.";
  if (normalizedAutonomy === "suggest_only") return "Agent is limited to suggestions only.";
  if (normalizedAutonomy === "draft_only") return "Agent is limited to drafts only.";
  if (normalizedAutonomy === "approval_required") return "Agent autonomy requires approval.";
  if (normalizedAutonomy === "full_auto_disabled") return "Full automation is disabled.";
  return "Low-risk auto execution is allowed by settings.";
}

function enforceAutonomyPolicy(autonomyLevel, payload = {}, access = {}) {
  const normalized = normalizeAutonomyLevel(autonomyLevel);
  if (normalized !== "full_auto_enabled") return normalized;
  const role = String(access.role || "").toLowerCase();
  const explicitOwnerEnable = Boolean(payload.ownerExplicitEnable || payload.owner_explicit_enable || payload.fullAutoOwnerConfirmed);
  if (role !== "owner" || !explicitOwnerEnable) {
    throw badRequest("Full auto can only be enabled by Owner with explicit confirmation");
  }
  return normalized;
}

function agentSafetyProjection(agent, access) {
  const agentId = agent.id;
  const row = db.prepare(`
    SELECT
      COALESCE(AVG(NULLIF(safety_score, 0)), 0) avg_safety,
      COALESCE(AVG(NULLIF(confidence, 0)), 0) avg_confidence,
      SUM(CASE WHEN risk_level IN ('high', 'critical') THEN 1 ELSE 0 END) high_risk_runs,
      SUM(CASE WHEN status IN ('failed', 'not_configured') THEN 1 ELSE 0 END) failed_runs
    FROM ai_agent_runs
    WHERE tenant_id = @tenant_id AND agent_id = @agent_id
  `).get({ tenant_id: access.tenantId, agent_id: agentId }) || {};
  const pendingApprovals = number(db.prepare(`
    SELECT COUNT(*) count FROM ai_agent_approval_queue
    WHERE tenant_id = @tenant_id AND agent_id = @agent_id AND approval_status = 'pending'
  `).get({ tenant_id: access.tenantId, agent_id: agentId })?.count);
  const openAlerts = number(db.prepare(`
    SELECT COUNT(*) count FROM ai_agent_alerts
    WHERE tenant_id = @tenant_id AND agent_id = @agent_id AND status = 'open'
  `).get({ tenant_id: access.tenantId, agent_id: agentId })?.count);
  const fallbackSafety = safetyScoreFromRisk(agent.risk_level || agent.riskLevel || "low");
  const avgSafety = Number(row.avg_safety || 0);
  const penalty = pendingApprovals * 3 + openAlerts * 5 + number(row.failed_runs) * 6 + number(row.high_risk_runs) * 4;
  return {
    safetyScore: Math.round(clampScore((avgSafety || fallbackSafety) - penalty, fallbackSafety)),
    confidenceScore: Number(row.avg_confidence || 0),
    pendingApprovals,
    openAlerts,
    failedRuns: number(row.failed_runs),
    highRiskRuns: number(row.high_risk_runs)
  };
}

function decorateAgent(agent, access) {
  return { ...agent, ...agentSafetyProjection(agent, access) };
}

function ensureDefaultAgents(access) {
  requireTenant(access);
  const insert = db.prepare(`INSERT OR IGNORE INTO ai_agents
    (id, tenant_id, branch_id, agent_key, agent_name, agent_type, description, status, risk_level, approval_status, provider_key, autonomy_level, config_json)
    VALUES (@id, @tenant_id, '', @agent_key, @agent_name, @agent_type, @description, 'active', 'low', 'approved', 'local_rules', 'approval_required', '{}')`);
  const upgradeDefaultProvider = db.prepare(`UPDATE ai_agents
    SET provider_key = 'local_rules'
    WHERE tenant_id = @tenant_id
      AND agent_key = @agent_key
      AND (provider_key IS NULL OR provider_key = '' OR provider_key = 'not_configured')`);
  const tx = db.transaction(() => {
    for (const [agent_key, agent_name, agent_type, description] of defaultAgents) {
      insert.run({ id: makeId("agent"), tenant_id: access.tenantId, agent_key, agent_name, agent_type, description });
      upgradeDefaultProvider.run({ tenant_id: access.tenantId, agent_key });
    }
  });
  tx();
}

function ensureDefaultSettings(access) {
  ensureDefaultAgents(access);
  const agents = scopedList("ai_agents", access, {}, { orderBy: "agent_name ASC", limit: 500 });
  const insert = db.prepare(`INSERT OR IGNORE INTO ai_agent_settings
    (id, tenant_id, branch_id, agent_id, autonomy_level, approval_required, risk_threshold, provider_key, model_key, module_permissions_json, branch_permissions_json, prompt_version, status, risk_level, approval_status)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, 'approval_required', 1, 'medium', @provider_key, '', '[]', '[]', 1, 'active', 'low', 'approved')`);
  const tx = db.transaction(() => {
    for (const agent of agents) {
      insert.run({
        id: makeId("agset"),
        tenant_id: access.tenantId,
        branch_id: agent.branchId || "",
        agent_id: agent.id,
        provider_key: agent.providerKey || "not_configured"
      });
    }
  });
  tx();
}

function scopedParams(access, query = {}) {
  requireTenant(access);
  const params = { tenant_id: access.tenantId };
  const branchId = query.branchId || query.branch_id || "";
  if (branchId) {
    assertBranch(access, branchId);
    params.branch_id = branchId;
  }
  return params;
}

function limitFrom(query = {}, fallback = 100) {
  return Math.min(Math.max(number(query.limit, fallback), 1), 250);
}

function scopedList(table, access, query = {}, { orderBy = "created_at DESC", limit = 100, filters = [] } = {}) {
  const params = scopedParams(access, query);
  const where = [scopedWhere(access, params)];
  for (const filter of filters) filter(where, params);
  return db.prepare(`SELECT * FROM ${table} WHERE ${where.join(" AND ")} ORDER BY ${orderBy} LIMIT @limit`)
    .all({ ...params, limit: limitFrom(query, limit) })
    .map(camel);
}

function scopedCount(table, access, query = {}, filterSql = "", extraParams = {}) {
  const params = scopedParams(access, query);
  const where = [scopedWhere(access, params)];
  if (filterSql) where.push(filterSql);
  return number(db.prepare(`SELECT COUNT(*) count FROM ${table} WHERE ${where.join(" AND ")}`).get({ ...params, ...extraParams })?.count);
}

function scopedSum(table, column, access, query = {}, filterSql = "", extraParams = {}) {
  const params = scopedParams(access, query);
  const where = [scopedWhere(access, params)];
  if (filterSql) where.push(filterSql);
  return number(db.prepare(`SELECT COALESCE(SUM(${column}), 0) total FROM ${table} WHERE ${where.join(" AND ")}`).get({ ...params, ...extraParams })?.total);
}

function tableExists(table) {
  return Boolean(db.prepare("SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?").get(table));
}

function getAgentRow(id, access) {
  return getScoped("ai_agents", id, access);
}

function getSettingsForAgent(agent, access) {
  const params = {
    tenant_id: access.tenantId,
    agent_id: agent.id,
    branch_id: agent.branch_id || ""
  };
  return db.prepare(`SELECT * FROM ai_agent_settings
    WHERE tenant_id = @tenant_id AND agent_id = @agent_id AND branch_id = @branch_id
    LIMIT 1`).get(params);
}

function selectedProvider(agent, settings, payload = {}) {
  const requestedProvider = payload.providerKey || payload.provider_key;
  if (requestedProvider) return requestedProvider;
  const settingsProvider = settings?.provider_key || "";
  if (settingsProvider && settingsProvider !== "not_configured") return settingsProvider;
  return agent.provider_key || settingsProvider || "not_configured";
}

function providerCatalogItem(providerKey) {
  return providerCatalog.find((provider) => provider.providerKey === providerKey)
    || providerCatalog.find((provider) => provider.providerKey === "not_configured");
}

function providerStatus(providerKey, access = {}, branchId = "") {
  const catalog = providerCatalogItem(providerKey);
  const scopeBranchId = branchId || access.branchId || "";
  const saved = access.tenantId && tableExists("ai_agent_provider_configs")
    ? db.prepare(`SELECT * FROM ai_agent_provider_configs
        WHERE tenant_id = @tenant_id AND provider_key = @provider_key
          AND (branch_id = @branch_id OR branch_id = '')
        ORDER BY CASE WHEN branch_id = @branch_id THEN 0 ELSE 1 END
        LIMIT 1`).get({
        tenant_id: access.tenantId,
        branch_id: scopeBranchId,
        provider_key: catalog.providerKey
      })
    : null;
  const localConfigured = ["local", "local_rules"].includes(catalog.providerKey);
  const envConfigured = Boolean(catalog.envKey && process.env[catalog.envKey]);
  const savedConfigured = saved?.status === "configured" && Boolean(saved?.api_key_ref);
  const configured = catalog.providerKey !== "not_configured" && (localConfigured || envConfigured || savedConfigured);
  return {
    ...catalog,
    branchId: saved?.branch_id || scopeBranchId,
    modelKey: saved?.model_key || catalog.defaultModel || "",
    apiKeyRef: saved?.api_key_ref || catalog.envKey || "",
    endpointUrl: saved?.endpoint_url || "",
    config: parseJson(saved?.config_json, {}),
    status: configured ? "configured" : "not_configured",
    configured
  };
}

function providerAvailable(providerKey, access = {}, branchId = "") {
  return providerStatus(providerKey, access, branchId).configured;
}

function estimateUsage(input, output, providerKey, modelKey = "") {
  const promptTokens = Math.max(1, Math.ceil(JSON.stringify(input || {}).length / 4));
  const completionTokens = Math.max(1, Math.ceil(JSON.stringify(output || {}).length / 4));
  const totalTokens = promptTokens + completionTokens;
  const provider = providerCatalogItem(providerKey);
  return {
    providerKey,
    modelKey,
    promptTokens,
    completionTokens,
    totalTokens,
    estimatedCost: Number(((totalTokens / 1000) * number(provider.costPer1kTokensInr, 0)).toFixed(4)),
    currency: "INR"
  };
}

function recordCost(agent, run, usage, access, branchId) {
  const row = {
    id: makeId("agcost"),
    tenant_id: access.tenantId,
    branch_id: branchId,
    agent_id: agent.id,
    run_id: run.id,
    provider_key: usage.providerKey,
    model_key: usage.modelKey || "",
    cost_date: now().slice(0, 10),
    prompt_tokens: usage.promptTokens,
    completion_tokens: usage.completionTokens,
    total_tokens: usage.totalTokens,
    estimated_cost: usage.estimatedCost,
    currency: usage.currency || "INR",
    status: "recorded",
    risk_level: run.risk_level || "low",
    approval_status: run.approval_status || "not_required"
  };
  db.prepare(`INSERT INTO ai_agent_costs
    (id, tenant_id, branch_id, agent_id, run_id, provider_key, model_key, cost_date, prompt_tokens, completion_tokens, total_tokens, estimated_cost, currency, status, risk_level, approval_status)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @provider_key, @model_key, @cost_date, @prompt_tokens, @completion_tokens, @total_tokens, @estimated_cost, @currency, @status, @risk_level, @approval_status)`).run(row);
  return row;
}

function auditAi(action, targetType, targetId, access, options = {}) {
  const row = {
    id: makeId("agaudit"),
    tenant_id: access.tenantId,
    branch_id: options.branchId || access.branchId || "",
    agent_id: options.agentId || "",
    run_id: options.runId || "",
    queue_id: options.queueId || "",
    action,
    target_type: targetType,
    target_id: targetId,
    actor_id: access.userId || "",
    actor_role: access.role || "",
    before_json: toJson(options.before || {}),
    after_json: toJson(options.after || {}),
    details_json: toJson(options.details || {}),
    risk_level: options.riskLevel || "low",
    approval_status: options.approvalStatus || "not_required"
  };
  db.prepare(`INSERT INTO ai_agent_audit_logs
    (id, tenant_id, branch_id, agent_id, run_id, queue_id, action, target_type, target_id, actor_id, actor_role, before_json, after_json, details_json, risk_level, approval_status)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @queue_id, @action, @target_type, @target_id, @actor_id, @actor_role, @before_json, @after_json, @details_json, @risk_level, @approval_status)`).run(row);
  auditDecision(action, targetType, targetId, access, {
    branchId: row.branch_id,
    details: { agentId: row.agent_id, runId: row.run_id, queueId: row.queue_id, ...options.details }
  });
  return camel(row);
}

function normalizeJsonField(field, value) {
  if (field.endsWith("_json")) return toJson(value ?? {});
  return value;
}

function buildPatch(payload, fields) {
  const updates = {};
  for (const [inputKey, column] of Object.entries(fields)) {
    if (Object.prototype.hasOwnProperty.call(payload, inputKey)) {
      updates[column] = normalizeJsonField(column, payload[inputKey]);
    }
  }
  return updates;
}

function runUpdate(table, id, access, updates) {
  if (!Object.keys(updates).length) throw badRequest("No supported fields provided");
  const setSql = Object.keys(updates).map((column) => `${column} = @${column}`).join(", ");
  const payload = { ...updates, id, tenant_id: access.tenantId, updated_at: now() };
  db.prepare(`UPDATE ${table} SET ${setSql}, updated_at = @updated_at WHERE id = @id AND tenant_id = @tenant_id`).run(payload);
  return getScoped(table, id, access);
}

function buildDecision(agent, payload, branchId, settings = {}) {
  const taskText = `${payload.taskType || ""} ${payload.command || ""} ${payload.prompt || ""} ${payload.requestedAction || ""}`;
  const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level || riskFromText(taskText || agent.agent_type));
  const autonomyLevel = normalizeAutonomyLevel(payload.autonomyLevel || payload.autonomy_level || settings?.autonomy_level);
  const confidence = clampScore(payload.confidence ?? confidenceFromRisk(riskLevel), confidenceFromRisk(riskLevel));
  const safetyScore = clampScore(payload.safetyScore ?? payload.safety_score ?? safetyScoreFromRisk(riskLevel), safetyScoreFromRisk(riskLevel));
  const requiresApproval = !canBypassApproval(riskLevel, autonomyLevel, settings);
  const gateReason = approvalGateReason(riskLevel, autonomyLevel, settings);
  return {
    branchId,
    decisionType: payload.taskType || payload.task_type || "agent_recommendation",
    summary: payload.summary || `${agent.agent_name} prepared an approval-safe operational recommendation.`,
    reasons: [
      `Agent ${agent.agent_name} evaluated tenant-scoped operational context.`,
      gateReason
    ],
    risks: requiresApproval ? ["Do not execute until a manager approves this action"] : ["Low operational risk"],
    recommendedActions: [
      {
        key: payload.taskType || payload.task_type || "review",
        label: payload.requestedAction || "Review recommendation and approve only if operationally safe",
        riskLevel,
        requiresApproval: Boolean(requiresApproval),
        autonomyLevel,
        approvalGateReason: gateReason
      }
    ],
    confidence,
    riskLevel,
    safetyScore,
    requiresApproval,
    autonomyLevel,
    approvalGateReason: gateReason
  };
}

function createProviderAlert(agent, run, providerKey, access, branchId) {
  const row = {
    id: makeId("agalert"),
    tenant_id: access.tenantId,
    branch_id: branchId,
    agent_id: agent.id,
    run_id: run.id,
    alert_type: "provider_not_configured",
    title: "AI provider not configured",
    message: `${agent.agent_name} could not run because provider ${providerKey || "not_configured"} is unavailable.`,
    severity: "medium",
    risk_level: "medium",
    approval_status: "not_required",
    status: "open",
    metadata_json: toJson({ providerKey })
  };
  db.prepare(`INSERT INTO ai_agent_alerts
    (id, tenant_id, branch_id, agent_id, run_id, alert_type, title, message, severity, risk_level, approval_status, status, metadata_json)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @alert_type, @title, @message, @severity, @risk_level, @approval_status, @status, @metadata_json)`).run(row);
  return row;
}

function createRiskAlert(agent, run, decision, access, branchId) {
  const riskLevel = normalizeRiskLevel(decision.riskLevel || decision.risk_level, "medium");
  if (riskRank[riskLevel] < riskRank.high) return null;
  const isCritical = riskLevel === "critical";
  const row = {
    id: makeId("agalert"),
    tenant_id: access.tenantId,
    branch_id: branchId,
    agent_id: agent.id,
    run_id: run.id,
    alert_type: isCritical ? "critical_action_blocked" : "high_risk_approval_required",
    title: isCritical ? "Critical AI action blocked" : "High-risk AI action needs approval",
    message: isCritical
      ? `${agent.agent_name} produced a critical recommendation. It has been blocked from auto-execution and queued for human review.`
      : `${agent.agent_name} produced a high-risk recommendation and queued it for human approval.`,
    severity: riskLevel,
    risk_level: riskLevel,
    approval_status: "pending",
    status: "open",
    metadata_json: toJson({
      confidence: decision.confidence,
      safetyScore: decision.safetyScore || decision.safety_score,
      approvalGateReason: decision.approvalGateReason
    })
  };
  db.prepare(`INSERT INTO ai_agent_alerts
    (id, tenant_id, branch_id, agent_id, run_id, alert_type, title, message, severity, risk_level, approval_status, status, metadata_json)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @alert_type, @title, @message, @severity, @risk_level, @approval_status, @status, @metadata_json)`).run(row);
  return row;
}

function createQueueItem(decision, run, agent, payload, access, branchId) {
  const row = {
    id: makeId("agqueue"),
    tenant_id: access.tenantId,
    branch_id: branchId,
    agent_id: agent.id,
    run_id: run.id,
    decision_id: decision.id,
    approval_type: "decision",
    title: payload.title || decision.summary,
    summary: decision.summary,
    proposed_action_json: decision.recommended_actions_json,
    before_payload_json: toJson(payload.before || {}),
    after_payload_json: toJson(payload.after || parseJson(decision.recommended_actions_json, [])),
    risk_level: decision.risk_level,
    confidence: decision.confidence,
    safety_score: decision.safety_score,
    approval_status: "pending",
    status: "pending",
    requested_by: access.userId || "",
    assigned_to: payload.assignedTo || payload.assigned_to || "",
    due_at: payload.dueAt || payload.due_at || ""
  };
  db.prepare(`INSERT INTO ai_agent_approval_queue
    (id, tenant_id, branch_id, agent_id, run_id, decision_id, approval_type, title, summary, proposed_action_json, before_payload_json, after_payload_json, risk_level, confidence, safety_score, approval_status, status, requested_by, assigned_to, due_at)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @decision_id, @approval_type, @title, @summary, @proposed_action_json, @before_payload_json, @after_payload_json, @risk_level, @confidence, @safety_score, @approval_status, @status, @requested_by, @assigned_to, @due_at)`).run(row);
  db.prepare("UPDATE ai_agent_decisions SET approval_queue_id = @queue_id WHERE id = @decision_id AND tenant_id = @tenant_id")
    .run({ queue_id: row.id, decision_id: decision.id, tenant_id: access.tenantId });
  return row;
}

function nextRunFor(scheduleType, startAt = new Date()) {
  const date = new Date(startAt);
  const type = normalizeScheduleType(scheduleType);
  if (type === "daily") date.setDate(date.getDate() + 1);
  if (type === "weekly") date.setDate(date.getDate() + 7);
  if (type === "monthly") date.setMonth(date.getMonth() + 1);
  return type === "manual" ? "" : date.toISOString();
}

function scheduleFilters(query = {}) {
  return [
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    },
    (where, params) => {
      const status = query.status || "";
      if (status) {
        where.push("status = @status");
        params.status = status;
      }
    },
    (where, params) => {
      const scheduleType = query.scheduleType || query.schedule_type || "";
      if (scheduleType) {
        where.push("schedule_type = @schedule_type");
        params.schedule_type = normalizeScheduleType(scheduleType);
      }
    }
  ];
}

function taskFilters(query = {}) {
  return [
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    },
    (where, params) => {
      const status = query.status || "";
      if (status) {
        where.push("status = @status");
        params.status = status;
      }
    },
    (where, params) => {
      const taskType = query.taskType || query.task_type || "";
      if (taskType) {
        where.push("task_type = @task_type");
        params.task_type = taskType;
      }
    },
    (where, params) => {
      const riskLevel = query.riskLevel || query.risk_level || "";
      if (riskLevel) {
        where.push("risk_level = @risk_level");
        params.risk_level = normalizeRiskLevel(riskLevel, "medium");
      }
    }
  ];
}

function playbookFilters(query = {}) {
  return [
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    },
    (where, params) => {
      const status = query.status || "";
      if (status) {
        where.push("status = @status");
        params.status = status;
      }
    },
    (where, params) => {
      const triggerType = query.triggerType || query.trigger_type || "";
      if (triggerType) {
        where.push("trigger_type = @trigger_type");
        params.trigger_type = triggerType;
      }
    }
  ];
}

function createAutomationTask(agent, payload, access, options = {}) {
  const branchId = branchFrom(payload, access) || options.branchId || agent.branch_id || "";
  assertBranch(access, branchId);
  const taskType = payload.taskType || payload.task_type || options.taskType || "agent_task";
  const taskName = payload.taskName || payload.task_name || payload.title || options.taskName || taskType.replace(/_/g, " ");
  const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level || options.riskLevel || riskFromText(`${taskType} ${taskName}`), "medium");
  const row = {
    id: makeId("agtask"),
    tenant_id: access.tenantId,
    branch_id: branchId,
    agent_id: agent.id,
    schedule_id: payload.scheduleId || payload.schedule_id || options.scheduleId || "",
    playbook_id: payload.playbookId || payload.playbook_id || options.playbookId || "",
    task_type: taskType,
    task_name: taskName,
    description: payload.description || options.description || "",
    input_json: toJson(payload.input || payload.input_json || payload.context || {}),
    output_json: toJson(payload.output || payload.output_json || {}),
    status: payload.status || "queued",
    priority: payload.priority || (approvalRequired(riskLevel) ? "high" : "normal"),
    assigned_to: payload.assignedTo || payload.assigned_to || "",
    due_at: payload.dueAt || payload.due_at || "",
    completed_at: payload.completedAt || payload.completed_at || "",
    risk_level: riskLevel,
    approval_status: approvalRequired(riskLevel) ? "pending" : "not_required",
    created_by: access.userId || ""
  };
  db.prepare(`INSERT INTO ai_agent_tasks
    (id, tenant_id, branch_id, agent_id, schedule_id, playbook_id, task_type, task_name, description, input_json, output_json, status, priority, assigned_to, due_at, completed_at, risk_level, approval_status, created_by)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @schedule_id, @playbook_id, @task_type, @task_name, @description, @input_json, @output_json, @status, @priority, @assigned_to, @due_at, @completed_at, @risk_level, @approval_status, @created_by)`).run(row);
  return row;
}

function createAutomationApproval(agent, payload, access, options = {}) {
  const branchId = branchFrom(payload, access) || options.branchId || agent.branch_id || "";
  assertBranch(access, branchId);
  const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level || options.riskLevel || "medium", "medium");
  const row = {
    id: makeId("agqueue"),
    tenant_id: access.tenantId,
    branch_id: branchId,
    agent_id: agent.id,
    run_id: options.runId || "",
    decision_id: options.decisionId || "",
    approval_type: payload.approvalType || payload.approval_type || "playbook",
    title: payload.title || options.title || "AI playbook approval required",
    summary: payload.summary || options.summary || "A playbook condition matched and requires manager review.",
    proposed_action_json: toJson(payload.proposedAction || payload.proposed_action || options.proposedAction || {}),
    before_payload_json: toJson(payload.before || options.before || {}),
    after_payload_json: toJson(payload.after || options.after || {}),
    risk_level: riskLevel,
    confidence: clampScore(payload.confidence ?? options.confidence ?? confidenceFromRisk(riskLevel), confidenceFromRisk(riskLevel)),
    safety_score: clampScore(payload.safetyScore ?? payload.safety_score ?? options.safetyScore ?? safetyScoreFromRisk(riskLevel), safetyScoreFromRisk(riskLevel)),
    approval_status: "pending",
    status: "pending",
    requested_by: access.userId || "",
    assigned_to: payload.assignedTo || payload.assigned_to || options.assignedTo || "",
    due_at: payload.dueAt || payload.due_at || options.dueAt || ""
  };
  db.prepare(`INSERT INTO ai_agent_approval_queue
    (id, tenant_id, branch_id, agent_id, run_id, decision_id, approval_type, title, summary, proposed_action_json, before_payload_json, after_payload_json, risk_level, confidence, safety_score, approval_status, status, requested_by, assigned_to, due_at)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @decision_id, @approval_type, @title, @summary, @proposed_action_json, @before_payload_json, @after_payload_json, @risk_level, @confidence, @safety_score, @approval_status, @status, @requested_by, @assigned_to, @due_at)`).run(row);
  return row;
}

function createAutomationAlert(agent, payload, access, options = {}) {
  const branchId = branchFrom(payload, access) || options.branchId || agent.branch_id || "";
  assertBranch(access, branchId);
  const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level || options.riskLevel || "medium", "medium");
  const row = {
    id: makeId("agalert"),
    tenant_id: access.tenantId,
    branch_id: branchId,
    agent_id: agent.id,
    run_id: options.runId || "",
    alert_type: payload.alertType || payload.alert_type || options.alertType || "playbook_matched",
    title: payload.title || options.title || "AI playbook matched",
    message: payload.message || options.message || "A playbook condition matched and needs attention.",
    severity: payload.severity || options.severity || riskLevel,
    risk_level: riskLevel,
    approval_status: approvalRequired(riskLevel) ? "pending" : "not_required",
    status: "open",
    metadata_json: toJson(payload.metadata || options.metadata || {})
  };
  db.prepare(`INSERT INTO ai_agent_alerts
    (id, tenant_id, branch_id, agent_id, run_id, alert_type, title, message, severity, risk_level, approval_status, status, metadata_json)
    VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @alert_type, @title, @message, @severity, @risk_level, @approval_status, @status, @metadata_json)`).run(row);
  return row;
}

function collectAutomationFacts(playbook, payload, access) {
  const facts = { ...(payload.facts || {}) };
  const branchId = branchFrom(payload, access) || playbook.branch_id || "";
  if (!Object.prototype.hasOwnProperty.call(facts, "negative_reviews_7d") && tableExists("reviews_v2")) {
    const params = { tenant_id: access.tenantId, since: new Date(Date.now() - 7 * 86400000).toISOString() };
    const where = ["tenant_id = @tenant_id", "COALESCE(reviewed_at, imported_at, created_at) >= @since", "(rating <= 2 OR sentiment IN ('negative', 'very_negative'))"];
    if (branchId) {
      params.branch_id = branchId;
      where.push("branch_id = @branch_id");
    }
    facts.negative_reviews_7d = number(db.prepare(`SELECT COUNT(*) count FROM reviews_v2 WHERE ${where.join(" AND ")}`).get(params)?.count);
  }
  if (!Object.prototype.hasOwnProperty.call(facts, "open_tasks") && tableExists("ai_agent_tasks")) {
    const params = { tenant_id: access.tenantId, agent_id: playbook.agent_id };
    facts.open_tasks = number(db.prepare("SELECT COUNT(*) count FROM ai_agent_tasks WHERE tenant_id = @tenant_id AND agent_id = @agent_id AND status NOT IN ('completed', 'cancelled')").get(params)?.count);
  }
  return facts;
}

function compareValues(left, operator, right) {
  if (operator === ">") return Number(left) > Number(right);
  if (operator === ">=") return Number(left) >= Number(right);
  if (operator === "<") return Number(left) < Number(right);
  if (operator === "<=") return Number(left) <= Number(right);
  if (operator === "!=" || operator === "not_equals") return String(left) !== String(right);
  if (operator === "includes") return String(left || "").toLowerCase().includes(String(right || "").toLowerCase());
  return String(left) === String(right);
}

function evaluateCondition(condition, facts) {
  if (!condition || !Object.keys(condition).length) return { matched: true, checks: [] };
  if (Array.isArray(condition.all)) {
    const checks = condition.all.map((item) => evaluateCondition(item, facts));
    return { matched: checks.every((check) => check.matched), checks };
  }
  if (Array.isArray(condition.any)) {
    const checks = condition.any.map((item) => evaluateCondition(item, facts));
    return { matched: checks.some((check) => check.matched), checks };
  }
  const metric = condition.metric || condition.fact || condition.key;
  const operator = condition.operator || condition.op || ">=";
  const expected = condition.value ?? condition.threshold ?? true;
  const actual = facts[metric];
  return {
    matched: compareValues(actual, operator, expected),
    checks: [{ metric, operator, expected, actual }]
  };
}

function playbookOutcome(playbook, agent, payload, facts, access) {
  const branchId = branchFrom(payload, access) || playbook.branch_id || "";
  const action = parseJson(playbook.action_json, {});
  const escalation = parseJson(playbook.escalation_json, {});
  const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level || action.riskLevel || action.risk_level || playbook.risk_level, "medium");
  const actionType = action.type || action.actionType || action.action_type || (approvalRequired(riskLevel) ? "approval" : "task");
  const base = {
    branchId,
    riskLevel,
    title: action.title || playbook.playbook_name,
    summary: action.summary || `Playbook matched: ${playbook.playbook_name}`,
    message: action.message || `Playbook matched: ${playbook.playbook_name}`,
    metadata: { facts, escalation },
    proposedAction: action,
    after: { facts, action, escalation }
  };
  const created = {};
  if (actionType === "alert" || escalation.alertOwner || escalation.alert_owner) {
    created.alert = createAutomationAlert(agent, { ...base, alertType: action.alertType || "playbook_matched" }, access, base);
  }
  if (actionType === "approval" || approvalRequired(riskLevel)) {
    created.approval = createAutomationApproval(agent, { ...base, approvalType: "playbook" }, access, base);
  }
  if (actionType === "task" || !created.approval) {
    created.task = createAutomationTask(agent, {
      branchId,
      playbookId: playbook.id,
      taskType: action.taskType || action.task_type || "playbook_task",
      taskName: action.taskName || action.task_name || playbook.playbook_name,
      description: base.summary,
      riskLevel,
      priority: approvalRequired(riskLevel) ? "high" : "normal",
      input: { facts, action, escalation }
    }, access, { branchId, playbookId: playbook.id, riskLevel });
  }
  return created;
}

function queueFilters(query = {}) {
  return [
    (where, params) => {
      const status = query.status || "";
      if (status) {
        where.push("status = @status");
        params.status = status;
      }
    },
    (where, params) => {
      const approvalStatus = query.approvalStatus || query.approval_status || "";
      if (approvalStatus) {
        where.push("approval_status = @approval_status");
        params.approval_status = approvalStatus;
      }
    },
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    }
  ];
}

function alertFilters(query = {}) {
  return [
    (where, params) => {
      const status = query.status || "";
      if (status) {
        where.push("status = @status");
        params.status = status;
      }
    },
    (where, params) => {
      const severity = query.severity || "";
      if (severity) {
        where.push("severity = @severity");
        params.severity = severity;
      }
    }
  ];
}

function auditLogFilters(query = {}) {
  return [
    (where, params) => {
      const action = query.action || "";
      if (action) {
        where.push("action = @action");
        params.action = action;
      }
    },
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    },
    (where, params) => {
      const runId = query.runId || query.run_id || "";
      if (runId) {
        where.push("run_id = @run_id");
        params.run_id = runId;
      }
    },
    (where, params) => {
      const targetType = query.targetType || query.target_type || "";
      if (targetType) {
        where.push("target_type = @target_type");
        params.target_type = targetType;
      }
    },
    (where, params) => {
      const targetId = query.targetId || query.target_id || "";
      if (targetId) {
        where.push("target_id = @target_id");
        params.target_id = targetId;
      }
    },
    (where, params) => {
      const riskLevel = query.riskLevel || query.risk_level || "";
      if (riskLevel) {
        where.push("risk_level = @risk_level");
        params.risk_level = normalizeRiskLevel(riskLevel, "medium");
      }
    },
    (where, params) => {
      const approvalStatus = query.approvalStatus || query.approval_status || "";
      if (approvalStatus) {
        where.push("approval_status = @approval_status");
        params.approval_status = approvalStatus;
      }
    }
  ];
}

function promptVersionFilters(query = {}) {
  return [
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    },
    (where, params) => {
      const status = query.status || "";
      if (status) {
        where.push("status = @status");
        params.status = status;
      }
    },
    (where, params) => {
      const providerKey = query.providerKey || query.provider_key || "";
      if (providerKey) {
        where.push("provider_key = @provider_key");
        params.provider_key = providerKey;
      }
    }
  ];
}

function costFilters(query = {}) {
  return [
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    },
    (where, params) => {
      const providerKey = query.providerKey || query.provider_key || "";
      if (providerKey) {
        where.push("provider_key = @provider_key");
        params.provider_key = providerKey;
      }
    },
    (where, params) => {
      const dateFrom = query.dateFrom || query.date_from || "";
      if (dateFrom) {
        where.push("cost_date >= @date_from");
        params.date_from = dateFrom;
      }
    },
    (where, params) => {
      const dateTo = query.dateTo || query.date_to || "";
      if (dateTo) {
        where.push("cost_date <= @date_to");
        params.date_to = dateTo;
      }
    }
  ];
}

function kpiImpactFilters(query = {}) {
  return [
    (where, params) => {
      const agentId = query.agentId || query.agent_id || "";
      if (agentId) {
        where.push("agent_id = @agent_id");
        params.agent_id = agentId;
      }
    },
    (where, params) => {
      const kpiKey = query.kpiKey || query.kpi_key || "";
      if (kpiKey) {
        where.push("kpi_key = @kpi_key");
        params.kpi_key = kpiKey;
      }
    },
    (where, params) => {
      const status = query.status || "";
      if (status) {
        where.push("status = @status");
        params.status = status;
      }
    }
  ];
}

export const aiWorkforceService = {
  dashboard(query, access) {
    ensureDefaultSettings(access);
    const todayDate = now().slice(0, 10);
    return {
      totals: {
        agents: scopedCount("ai_agents", access, query),
        activeAgents: scopedCount("ai_agents", access, query, "status = 'active'"),
        pendingApprovals: scopedCount("ai_agent_approval_queue", access, query, "approval_status = 'pending'"),
        highRiskActions: scopedCount("ai_agent_approval_queue", access, query, "risk_level IN ('high', 'critical') AND approval_status = 'pending'"),
        failedRuns: scopedCount("ai_agent_runs", access, query, "status IN ('failed', 'not_configured')"),
        openAlerts: scopedCount("ai_agent_alerts", access, query, "status = 'open'"),
        aiCostToday: scopedSum("ai_agent_costs", "estimated_cost", access, query, "cost_date = @cost_date", { cost_date: todayDate }),
        aiCostMonth: scopedSum("ai_agent_costs", "estimated_cost", access, query, "cost_date LIKE @cost_month", { cost_month: `${todayDate.slice(0, 7)}%` }),
        estimatedKpiImpact: scopedSum("ai_agent_kpi_impact", "estimated_revenue_impact", access, query),
        providerConfigs: scopedCount("ai_agent_provider_configs", access, query),
        promptVersions: scopedCount("ai_agent_prompt_versions", access, query),
        activeSchedules: tableExists("ai_agent_schedules") ? scopedCount("ai_agent_schedules", access, query, "status = 'active'") : 0,
        openTasks: tableExists("ai_agent_tasks") ? scopedCount("ai_agent_tasks", access, query, "status NOT IN ('completed', 'cancelled')") : 0,
        activePlaybooks: tableExists("ai_agent_playbooks") ? scopedCount("ai_agent_playbooks", access, query, "status = 'active'") : 0
      },
      agents: this.listAgents({ ...query, limit: query.limit || 50 }, access),
      queue: this.queue({ ...query, approvalStatus: "pending", limit: 10 }, access),
      alerts: this.alerts({ ...query, status: "open", limit: 10 }, access),
      recentRuns: this.runs({ ...query, limit: 10 }, access)
    };
  },

  listAgents(query, access) {
    ensureDefaultSettings(access);
    return scopedList("ai_agents", access, query, {
      orderBy: "agent_name ASC",
      limit: 100,
      filters: [
        (where, params) => {
          if (query.status) {
            where.push("status = @status");
            params.status = query.status;
          }
        }
      ]
    }).map((agent) => decorateAgent(agent, access));
  },

  getAgent(id, access) {
    const agent = getAgentRow(id, access);
    const settings = getSettingsForAgent(agent, access);
    return {
      ...decorateAgent(camel(agent), access),
      settings: settings ? camel(settings) : null,
      recentRuns: scopedList("ai_agent_runs", access, { agentId: id, limit: 10 }, {
        filters: [(where, params) => {
          where.push("agent_id = @agent_id");
          params.agent_id = id;
        }]
      }),
      pendingQueue: scopedList("ai_agent_approval_queue", access, { agentId: id, approvalStatus: "pending", limit: 10 }, { filters: queueFilters({ agentId: id, approvalStatus: "pending" }) }),
      openAlerts: scopedList("ai_agent_alerts", access, { agentId: id, status: "open", limit: 10 }, {
        filters: [
          ...alertFilters({ status: "open" }),
          (where, params) => {
            where.push("agent_id = @agent_id");
            params.agent_id = id;
          }
        ]
      })
    };
  },

  createAgent(payload, access) {
    requireManager(access);
    const agentKey = payload.agentKey || payload.agent_key;
    const agentName = payload.agentName || payload.agent_name;
    if (!agentKey || !agentName) throw badRequest("agentKey and agentName are required");
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const row = {
      id: makeId("agent"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      agent_key: agentKey,
      agent_name: agentName,
      agent_type: payload.agentType || payload.agent_type || "custom",
      description: payload.description || "",
      status: payload.status || "active",
      risk_level: payload.riskLevel || payload.risk_level || "low",
      approval_status: "approved",
      provider_key: payload.providerKey || payload.provider_key || "not_configured",
      autonomy_level: payload.autonomyLevel || payload.autonomy_level || "approval_required",
      config_json: toJson(payload.config || {})
    };
    try {
      db.prepare(`INSERT INTO ai_agents
        (id, tenant_id, branch_id, agent_key, agent_name, agent_type, description, status, risk_level, approval_status, provider_key, autonomy_level, config_json)
        VALUES (@id, @tenant_id, @branch_id, @agent_key, @agent_name, @agent_type, @description, @status, @risk_level, @approval_status, @provider_key, @autonomy_level, @config_json)`).run(row);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") throw badRequest("Agent key already exists for this tenant");
      throw error;
    }
    ensureDefaultSettings(access);
    auditAi("ai.agent_created", "ai_agent", row.id, access, { branchId, agentId: row.id, after: row, details: { agentKey } });
    emitEvent("ai:agent_created", access, branchId, row.id);
    return camel(row);
  },

  updateAgent(id, payload, access) {
    requireManager(access);
    const before = getAgentRow(id, access);
    const updates = buildPatch(payload, agentPatchFields);
    if (payload.branchId || payload.branch_id) {
      const branchId = branchFrom(payload, access);
      assertBranch(access, branchId);
      updates.branch_id = branchId;
    }
    const after = runUpdate("ai_agents", id, access, updates);
    auditAi("ai.agent_updated", "ai_agent", id, access, {
      branchId: after.branch_id || before.branch_id || "",
      agentId: id,
      before,
      after,
      details: { fields: Object.keys(updates) }
    });
    emitEvent("ai:agent_updated", access, after.branch_id || "", id);
    return camel(after);
  },

  setAgentStatus(id, status, access) {
    requireManager(access);
    const before = getAgentRow(id, access);
    const normalizedStatus = status === "active" ? "active" : "disabled";
    const after = runUpdate("ai_agents", id, access, { status: normalizedStatus });
    auditAi(`ai.agent_${normalizedStatus === "active" ? "enabled" : "disabled"}`, "ai_agent", id, access, {
      branchId: after.branch_id || before.branch_id || "",
      agentId: id,
      before,
      after,
      details: { beforeStatus: before.status, afterStatus: normalizedStatus }
    });
    emitEvent(`ai:agent_${normalizedStatus === "active" ? "enabled" : "disabled"}`, access, after.branch_id || "", id);
    return camel(after);
  },

  runAgent(id, payload, access) {
    requireManager(access);
    const agent = getAgentRow(id, access);
    if (agent.status === "disabled" || agent.status === "inactive") throw badRequest("Disabled AI agents cannot be run");
    const settings = getSettingsForAgent(agent, access);
    const branchId = branchFrom(payload, access) || agent.branch_id || settings?.branch_id || "";
    assertBranch(access, branchId);
    const providerKey = selectedProvider(agent, settings, payload);
    const provider = providerStatus(providerKey, access, branchId);
    const modelKey = payload.modelKey || payload.model_key || settings?.model_key || provider.modelKey || "";
    const promptVersion = number(payload.promptVersion || payload.prompt_version || settings?.prompt_version, 1);
    const simulationMode = Boolean(payload.simulationMode || payload.simulation_mode || payload.simulation || payload.dryRun || payload.dry_run);
    const startedAt = now();

    if (!providerAvailable(providerKey, access, branchId)) {
      if (simulationMode) {
        return {
          simulation: true,
          status: "not_configured",
          provider,
          message: "AI provider adapter is not configured. Simulation did not mutate production data.",
          mutations: 0
        };
      }
      const run = {
        id: makeId("agrun"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        agent_id: id,
        task_id: "",
        run_type: payload.runType || payload.run_type || "manual",
        provider_key: providerKey,
        model_key: modelKey,
        prompt_version: promptVersion,
        status: "not_configured",
        risk_level: "medium",
        approval_status: "not_required",
        input_json: toJson(payload),
        output_json: toJson({ status: "not_configured", providerKey, message: "AI provider adapter is not configured. No AI execution was performed." }),
        confidence: 0,
        safety_score: 0,
        safety_classification: "provider_not_configured",
        approval_required: 0,
        started_at: startedAt,
        completed_at: now()
      };
      const alert = db.transaction(() => {
        db.prepare(`INSERT INTO ai_agent_runs
          (id, tenant_id, branch_id, agent_id, task_id, run_type, provider_key, model_key, prompt_version, status, risk_level, approval_status, input_json, output_json, confidence, safety_score, safety_classification, approval_required, started_at, completed_at)
          VALUES (@id, @tenant_id, @branch_id, @agent_id, @task_id, @run_type, @provider_key, @model_key, @prompt_version, @status, @risk_level, @approval_status, @input_json, @output_json, @confidence, @safety_score, @safety_classification, @approval_required, @started_at, @completed_at)`).run(run);
        return createProviderAlert(agent, run, providerKey, access, branchId);
      })();
      auditAi("ai.run_not_configured", "ai_agent_run", run.id, access, {
        branchId,
        agentId: id,
        runId: run.id,
        after: run,
        riskLevel: "medium",
        details: { providerKey }
      });
      auditAi("ai.alert_created", "ai_agent_alert", alert.id, access, {
        branchId,
        agentId: id,
        runId: run.id,
        after: alert,
        riskLevel: "medium",
        details: { providerKey }
      });
      emitEvent("ai:provider_not_configured", access, branchId, run.id, { providerKey });
      return { status: "not_configured", message: "AI provider adapter is not configured. No AI execution was performed.", run: camel(run), alert: camel(alert) };
    }

    const decision = buildDecision(agent, payload, branchId, settings);
    const usage = estimateUsage(payload, decision, providerKey, modelKey);
    if (simulationMode) {
      return {
        simulation: true,
        status: decision.requiresApproval ? "pending_approval" : "completed",
        provider,
        decision,
        estimatedUsage: usage,
        mutations: 0,
        message: "Simulation completed without writing tasks, runs, approvals, alerts, costs or KPI records."
      };
    }
    const result = db.transaction(() => {
      const task = {
        id: makeId("agtask"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        agent_id: id,
        task_type: decision.decisionType,
        input_json: toJson(payload),
        status: "completed",
        risk_level: decision.riskLevel
      };
      db.prepare(`INSERT INTO ai_agent_tasks
        (id, tenant_id, branch_id, agent_id, task_type, input_json, status, risk_level)
        VALUES (@id, @tenant_id, @branch_id, @agent_id, @task_type, @input_json, @status, @risk_level)`).run(task);
      const run = {
        id: makeId("agrun"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        agent_id: id,
        task_id: task.id,
        run_type: payload.runType || payload.run_type || "manual",
        provider_key: providerKey,
        model_key: modelKey,
        prompt_version: promptVersion,
        status: decision.requiresApproval ? "pending_approval" : "completed",
        risk_level: decision.riskLevel,
        approval_status: decision.requiresApproval ? "pending" : "not_required",
        input_json: toJson(payload),
        output_json: toJson(decision),
        confidence: decision.confidence,
        safety_score: decision.safetyScore,
        safety_classification: decision.riskLevel,
        approval_required: decision.requiresApproval ? 1 : 0,
        prompt_tokens: usage.promptTokens,
        completion_tokens: usage.completionTokens,
        total_tokens: usage.totalTokens,
        estimated_cost: usage.estimatedCost,
        duration_ms: Math.max(1, Date.now() - new Date(startedAt).getTime()),
        started_at: startedAt,
        completed_at: now()
      };
      db.prepare(`INSERT INTO ai_agent_runs
        (id, tenant_id, branch_id, agent_id, task_id, run_type, provider_key, model_key, prompt_version, status, risk_level, approval_status, input_json, output_json, confidence, safety_score, safety_classification, approval_required, prompt_tokens, completion_tokens, total_tokens, estimated_cost, duration_ms, started_at, completed_at)
        VALUES (@id, @tenant_id, @branch_id, @agent_id, @task_id, @run_type, @provider_key, @model_key, @prompt_version, @status, @risk_level, @approval_status, @input_json, @output_json, @confidence, @safety_score, @safety_classification, @approval_required, @prompt_tokens, @completion_tokens, @total_tokens, @estimated_cost, @duration_ms, @started_at, @completed_at)`).run(run);
      const cost = recordCost(agent, run, usage, access, branchId);
      const steps = [
        ["validate_scope", "Validate tenant and branch scope", "completed"],
        ["prepare_decision", "Prepare approval-safe recommendation", "completed"]
      ].map(([step_key, step_name, status], index) => ({
        id: makeId("agstep"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        run_id: run.id,
        agent_id: id,
        step_key,
        step_name,
        step_order: index + 1,
        status,
        risk_level: decision.riskLevel,
        approval_status: decision.requiresApproval ? "pending" : "not_required",
        input_json: index === 0 ? toJson(payload) : "{}",
        output_json: index === 1 ? toJson(decision) : "{}",
        started_at: startedAt,
        completed_at: now()
      }));
      const insertStep = db.prepare(`INSERT INTO ai_agent_run_steps
        (id, tenant_id, branch_id, run_id, agent_id, step_key, step_name, step_order, status, risk_level, approval_status, input_json, output_json, started_at, completed_at)
        VALUES (@id, @tenant_id, @branch_id, @run_id, @agent_id, @step_key, @step_name, @step_order, @status, @risk_level, @approval_status, @input_json, @output_json, @started_at, @completed_at)`);
      for (const step of steps) insertStep.run(step);
      const decisionRow = {
        id: makeId("agdec"),
        tenant_id: access.tenantId,
        branch_id: branchId,
        agent_id: id,
        run_id: run.id,
        decision_type: decision.decisionType,
        summary: decision.summary,
        reasons_json: toJson(decision.reasons),
        risks_json: toJson(decision.risks),
        recommended_actions_json: toJson(decision.recommendedActions),
        confidence: decision.confidence,
        risk_level: decision.riskLevel,
        approval_required: decision.requiresApproval ? 1 : 0,
        approval_status: decision.requiresApproval ? "pending" : "not_required",
        status: decision.requiresApproval ? "pending_approval" : "recommended",
        safety_score: decision.safetyScore
      };
      db.prepare(`INSERT INTO ai_agent_decisions
        (id, tenant_id, branch_id, agent_id, run_id, decision_type, summary, reasons_json, risks_json, recommended_actions_json, confidence, risk_level, approval_required, approval_status, status, safety_score)
        VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @decision_type, @summary, @reasons_json, @risks_json, @recommended_actions_json, @confidence, @risk_level, @approval_required, @approval_status, @status, @safety_score)`).run(decisionRow);
      const queue = decision.requiresApproval ? createQueueItem(decisionRow, run, agent, payload, access, branchId) : null;
      const alert = createRiskAlert(agent, run, decision, access, branchId);
      return { task, run, steps, decision: decisionRow, queue, alert, cost };
    })();

    auditAi("ai.task_created", "ai_agent_task", result.task.id, access, { branchId, agentId: id, runId: result.run.id, after: result.task, riskLevel: decision.riskLevel });
    auditAi("ai.run_completed", "ai_agent_run", result.run.id, access, { branchId, agentId: id, runId: result.run.id, after: result.run, riskLevel: decision.riskLevel, approvalStatus: result.run.approval_status });
    auditAi("ai.cost_recorded", "ai_agent_cost", result.cost.id, access, { branchId, agentId: id, runId: result.run.id, after: result.cost, riskLevel: decision.riskLevel, approvalStatus: result.run.approval_status });
    auditAi("ai.decision_created", "ai_agent_decision", result.decision.id, access, { branchId, agentId: id, runId: result.run.id, after: result.decision, riskLevel: decision.riskLevel, approvalStatus: result.run.approval_status });
    if (result.queue) {
      auditAi("ai.approval_queued", "ai_agent_approval_queue", result.queue.id, access, { branchId, agentId: id, runId: result.run.id, queueId: result.queue.id, after: result.queue, riskLevel: decision.riskLevel, approvalStatus: "pending" });
    }
    if (result.alert) {
      auditAi("ai.safety_alert_created", "ai_agent_alert", result.alert.id, access, { branchId, agentId: id, runId: result.run.id, after: result.alert, riskLevel: decision.riskLevel, approvalStatus: result.alert.approval_status });
    }
    emitEvent("ai:agent_run_completed", access, branchId, result.run.id);
    if (result.queue) emitEvent("ai:approval_required", access, branchId, result.queue.id, { riskLevel: decision.riskLevel });
    if (decision.riskLevel === "critical") emitEvent("ai:critical_action_blocked", access, branchId, result.run.id);
    return {
      task: camel(result.task),
      run: camel(result.run),
      steps: result.steps.map(camel),
      decision: camel(result.decision),
      queue: result.queue ? camel(result.queue) : null,
      alert: result.alert ? camel(result.alert) : null,
      cost: camel(result.cost)
    };
  },

  schedules(query, access) {
    ensureDefaultSettings(access);
    return scopedList("ai_agent_schedules", access, query, { filters: scheduleFilters(query), limit: 100 });
  },

  createSchedule(payload, access) {
    requireManager(access);
    const agent = getAgentRow(payload.agentId || payload.agent_id, access);
    const branchId = branchFrom(payload, access) || agent.branch_id || "";
    assertBranch(access, branchId);
    const scheduleType = normalizeScheduleType(payload.scheduleType || payload.schedule_type || "daily");
    const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level || "low", "low");
    const row = {
      id: makeId("agsch"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      agent_id: agent.id,
      schedule_name: payload.scheduleName || payload.schedule_name || `${agent.agent_name} ${scheduleType} run`,
      schedule_type: scheduleType,
      cron_expression: payload.cronExpression || payload.cron_expression || "",
      timezone: payload.timezone || "Asia/Kolkata",
      next_run_at: payload.nextRunAt || payload.next_run_at || nextRunFor(scheduleType),
      last_run_at: payload.lastRunAt || payload.last_run_at || "",
      status: payload.status || "active",
      risk_level: riskLevel,
      approval_status: approvalRequired(riskLevel) ? "pending" : "approved",
      created_by: access.userId || ""
    };
    db.prepare(`INSERT INTO ai_agent_schedules
      (id, tenant_id, branch_id, agent_id, schedule_name, schedule_type, cron_expression, timezone, next_run_at, last_run_at, status, risk_level, approval_status, created_by)
      VALUES (@id, @tenant_id, @branch_id, @agent_id, @schedule_name, @schedule_type, @cron_expression, @timezone, @next_run_at, @last_run_at, @status, @risk_level, @approval_status, @created_by)`).run(row);
    auditAi("ai.schedule_created", "ai_agent_schedule", row.id, access, {
      branchId,
      agentId: agent.id,
      after: row,
      riskLevel,
      approvalStatus: row.approval_status
    });
    emitEvent("ai:schedule_created", access, branchId, row.id);
    return camel(row);
  },

  updateSchedule(id, payload, access) {
    requireManager(access);
    const before = getScoped("ai_agent_schedules", id, access);
    const updates = buildPatch(payload, schedulePatchFields);
    if (updates.schedule_type) updates.schedule_type = normalizeScheduleType(updates.schedule_type);
    if (updates.risk_level) {
      updates.risk_level = normalizeRiskLevel(updates.risk_level, "low");
      updates.approval_status = approvalRequired(updates.risk_level) ? "pending" : "approved";
    }
    const after = runUpdate("ai_agent_schedules", id, access, updates);
    auditAi("ai.schedule_updated", "ai_agent_schedule", id, access, {
      branchId: after.branch_id || "",
      agentId: after.agent_id || "",
      before,
      after,
      details: { fields: Object.keys(updates) },
      riskLevel: after.risk_level || "low",
      approvalStatus: after.approval_status || "approved"
    });
    emitEvent("ai:schedule_updated", access, after.branch_id || "", id);
    return camel(after);
  },

  runSchedule(id, payload, access) {
    requireManager(access);
    const before = getScoped("ai_agent_schedules", id, access);
    if (before.status !== "active") throw badRequest("Only active schedules can be run");
    const agent = getAgentRow(before.agent_id, access);
    const branchId = branchFrom(payload, access) || before.branch_id || "";
    assertBranch(access, branchId);
    const run = aiWorkforceService.runAgent(before.agent_id, {
      ...payload,
      branchId,
      runType: "scheduled",
      taskType: payload.taskType || payload.task_type || `scheduled_${before.schedule_type}`,
      title: payload.title || before.schedule_name,
      summary: payload.summary || `${before.schedule_name} scheduled run prepared for approval-safe execution.`,
      riskLevel: payload.riskLevel || payload.risk_level || before.risk_level,
      scheduleId: id
    }, access);
    const stamp = now();
    db.prepare(`UPDATE ai_agent_schedules
      SET last_run_at = @last_run_at, next_run_at = @next_run_at, updated_at = @updated_at
      WHERE id = @id AND tenant_id = @tenant_id`)
      .run({ id, tenant_id: access.tenantId, last_run_at: stamp, next_run_at: nextRunFor(before.schedule_type, stamp), updated_at: stamp });
    const after = getScoped("ai_agent_schedules", id, access);
    auditAi("ai.schedule_run", "ai_agent_schedule", id, access, {
      branchId,
      agentId: agent.id,
      runId: run.run?.id || "",
      before,
      after,
      details: { scheduleType: before.schedule_type },
      riskLevel: after.risk_level || "low",
      approvalStatus: run.run?.approvalStatus || run.run?.approval_status || "not_required"
    });
    emitEvent("ai:schedule_run", access, branchId, id);
    return { schedule: camel(after), run };
  },

  tasks(query, access) {
    return scopedList("ai_agent_tasks", access, query, { filters: taskFilters(query), limit: 150 });
  },

  getTask(id, access) {
    return camel(getScoped("ai_agent_tasks", id, access));
  },

  createTask(payload, access) {
    requireManager(access);
    const agent = getAgentRow(payload.agentId || payload.agent_id, access);
    const row = createAutomationTask(agent, payload, access);
    auditAi("ai.task_created", "ai_agent_task", row.id, access, {
      branchId: row.branch_id,
      agentId: row.agent_id,
      after: row,
      riskLevel: row.risk_level,
      approvalStatus: row.approval_status
    });
    emitEvent("ai:task_created", access, row.branch_id, row.id);
    return camel(row);
  },

  updateTask(id, payload, access) {
    requireManager(access);
    const before = getScoped("ai_agent_tasks", id, access);
    const updates = buildPatch(payload, taskPatchFields);
    if (updates.risk_level) {
      updates.risk_level = normalizeRiskLevel(updates.risk_level, "medium");
      updates.approval_status = approvalRequired(updates.risk_level) ? "pending" : "not_required";
    }
    const after = runUpdate("ai_agent_tasks", id, access, updates);
    auditAi("ai.task_updated", "ai_agent_task", id, access, {
      branchId: after.branch_id || "",
      agentId: after.agent_id || "",
      before,
      after,
      details: { fields: Object.keys(updates) },
      riskLevel: after.risk_level || "medium",
      approvalStatus: after.approval_status || "not_required"
    });
    emitEvent("ai:task_updated", access, after.branch_id || "", id);
    return camel(after);
  },

  completeTask(id, payload, access) {
    requireManager(access);
    return aiWorkforceService.updateTask(id, {
      status: "completed",
      completedAt: now(),
      output: payload.output || payload.output_json || payload.result || {}
    }, access);
  },

  playbooks(query, access) {
    ensureDefaultSettings(access);
    return scopedList("ai_agent_playbooks", access, query, { filters: playbookFilters(query), limit: 100 });
  },

  createPlaybook(payload, access) {
    requireManager(access);
    const agent = getAgentRow(payload.agentId || payload.agent_id, access);
    const branchId = branchFrom(payload, access) || agent.branch_id || "";
    assertBranch(access, branchId);
    const riskLevel = normalizeRiskLevel(payload.riskLevel || payload.risk_level || "medium", "medium");
    const playbookName = payload.playbookName || payload.playbook_name || payload.name || "AI Automation Playbook";
    const row = {
      id: makeId("agplay"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      agent_id: agent.id,
      playbook_key: payload.playbookKey || payload.playbook_key || slugify(playbookName),
      playbook_name: playbookName,
      trigger_type: payload.triggerType || payload.trigger_type || "condition",
      condition_json: toJson(payload.condition || payload.condition_json || {}),
      action_json: toJson(payload.action || payload.action_json || {}),
      escalation_json: toJson(payload.escalation || payload.escalation_json || {}),
      status: payload.status || "active",
      risk_level: riskLevel,
      approval_status: approvalRequired(riskLevel) ? "pending" : "approved",
      version: number(payload.version, 1),
      created_by: access.userId || ""
    };
    db.prepare(`INSERT INTO ai_agent_playbooks
      (id, tenant_id, branch_id, agent_id, playbook_key, playbook_name, trigger_type, condition_json, action_json, escalation_json, status, risk_level, approval_status, version, created_by)
      VALUES (@id, @tenant_id, @branch_id, @agent_id, @playbook_key, @playbook_name, @trigger_type, @condition_json, @action_json, @escalation_json, @status, @risk_level, @approval_status, @version, @created_by)`).run(row);
    auditAi("ai.playbook_created", "ai_agent_playbook", row.id, access, {
      branchId,
      agentId: agent.id,
      after: row,
      riskLevel,
      approvalStatus: row.approval_status
    });
    emitEvent("ai:playbook_created", access, branchId, row.id);
    return camel(row);
  },

  updatePlaybook(id, payload, access) {
    requireManager(access);
    const before = getScoped("ai_agent_playbooks", id, access);
    const updates = buildPatch(payload, playbookPatchFields);
    if (updates.playbook_key) updates.playbook_key = slugify(updates.playbook_key);
    if (updates.risk_level) {
      updates.risk_level = normalizeRiskLevel(updates.risk_level, "medium");
      updates.approval_status = approvalRequired(updates.risk_level) ? "pending" : "approved";
    }
    const after = runUpdate("ai_agent_playbooks", id, access, updates);
    auditAi("ai.playbook_updated", "ai_agent_playbook", id, access, {
      branchId: after.branch_id || "",
      agentId: after.agent_id || "",
      before,
      after,
      details: { fields: Object.keys(updates) },
      riskLevel: after.risk_level || "medium",
      approvalStatus: after.approval_status || "pending"
    });
    emitEvent("ai:playbook_updated", access, after.branch_id || "", id);
    return camel(after);
  },

  evaluatePlaybook(id, payload, access) {
    requireManager(access);
    const playbook = getScoped("ai_agent_playbooks", id, access);
    if (playbook.status !== "active" && !payload.dryRun && !payload.dry_run) {
      throw badRequest("Only active playbooks can be evaluated");
    }
    const agent = getAgentRow(playbook.agent_id, access);
    const facts = collectAutomationFacts(playbook, payload, access);
    const evaluation = evaluateCondition(parseJson(playbook.condition_json, {}), facts);
    const dryRun = Boolean(payload.dryRun || payload.dry_run);
    const created = evaluation.matched && !dryRun ? playbookOutcome(playbook, agent, payload, facts, access) : {};
    if (created.task) {
      auditAi("ai.playbook_task_created", "ai_agent_task", created.task.id, access, {
        branchId: created.task.branch_id,
        agentId: agent.id,
        after: created.task,
        details: { playbookId: id, facts },
        riskLevel: created.task.risk_level,
        approvalStatus: created.task.approval_status
      });
    }
    if (created.approval) {
      auditAi("ai.playbook_approval_created", "ai_agent_approval_queue", created.approval.id, access, {
        branchId: created.approval.branch_id,
        agentId: agent.id,
        queueId: created.approval.id,
        after: created.approval,
        details: { playbookId: id, facts },
        riskLevel: created.approval.risk_level,
        approvalStatus: created.approval.approval_status
      });
      emitEvent("ai:approval_required", access, created.approval.branch_id, created.approval.id, { playbookId: id });
    }
    if (created.alert) {
      auditAi("ai.playbook_alert_created", "ai_agent_alert", created.alert.id, access, {
        branchId: created.alert.branch_id,
        agentId: agent.id,
        after: created.alert,
        details: { playbookId: id, facts },
        riskLevel: created.alert.risk_level,
        approvalStatus: created.alert.approval_status
      });
      emitEvent("ai:playbook_alert", access, created.alert.branch_id, created.alert.id, { playbookId: id });
    }
    auditAi("ai.playbook_evaluated", "ai_agent_playbook", id, access, {
      branchId: playbook.branch_id || "",
      agentId: agent.id,
      before: playbook,
      after: { matched: evaluation.matched, dryRun, created },
      details: { facts, checks: evaluation.checks },
      riskLevel: playbook.risk_level || "medium",
      approvalStatus: playbook.approval_status || "pending"
    });
    emitEvent("ai:playbook_evaluated", access, playbook.branch_id || "", id, { matched: evaluation.matched });
    return {
      playbook: camel(playbook),
      matched: evaluation.matched,
      dryRun,
      facts,
      checks: evaluation.checks,
      task: created.task ? camel(created.task) : null,
      approval: created.approval ? camel(created.approval) : null,
      alert: created.alert ? camel(created.alert) : null
    };
  },

  runs(query, access) {
    return scopedList("ai_agent_runs", access, query, {
      filters: [
        (where, params) => {
          const agentId = query.agentId || query.agent_id || "";
          if (agentId) {
            where.push("agent_id = @agent_id");
            params.agent_id = agentId;
          }
        },
        (where, params) => {
          if (query.status) {
            where.push("status = @status");
            params.status = query.status;
          }
        }
      ]
    });
  },

  getRun(id, access) {
    const run = getScoped("ai_agent_runs", id, access);
    const steps = db.prepare("SELECT * FROM ai_agent_run_steps WHERE tenant_id = ? AND run_id = ? ORDER BY step_order ASC")
      .all(access.tenantId, id)
      .map(camel);
    const queue = db.prepare("SELECT * FROM ai_agent_approval_queue WHERE tenant_id = ? AND run_id = ? ORDER BY created_at DESC")
      .all(access.tenantId, id)
      .map(camel);
    return { ...camel(run), steps, queue };
  },

  queue(query, access) {
    return scopedList("ai_agent_approval_queue", access, query, { filters: queueFilters(query), limit: 100 });
  },

  getQueueItem(id, access) {
    return camel(getScoped("ai_agent_approval_queue", id, access));
  },

  decideQueueItem(id, decisionStatus, payload, access) {
    requireManager(access);
    const before = getScoped("ai_agent_approval_queue", id, access);
    if (before.approval_status !== "pending") {
      throw badRequest("Queue item is already decided");
    }
    const status = decisionStatus === "approved" ? "approved" : "rejected";
    const decidedAt = now();
    const decisionNotes = payload.notes || payload.decisionNotes || payload.decision_notes || "";
    const afterPayload = {
      id,
      tenant_id: access.tenantId,
      approval_status: status,
      status,
      decided_by: access.userId || "",
      decided_at: decidedAt,
      decision_notes: decisionNotes,
      updated_at: decidedAt
    };
    db.prepare(`UPDATE ai_agent_approval_queue
      SET approval_status = @approval_status, status = @status, decided_by = @decided_by, decided_at = @decided_at, decision_notes = @decision_notes, updated_at = @updated_at
      WHERE id = @id AND tenant_id = @tenant_id`).run(afterPayload);
    if (before.decision_id) {
      db.prepare("UPDATE ai_agent_decisions SET status = @status, approval_status = @approval_status, updated_at = @updated_at WHERE id = @id AND tenant_id = @tenant_id")
        .run({ status, approval_status: status, updated_at: decidedAt, id: before.decision_id, tenant_id: access.tenantId });
    }
    if (before.run_id) {
      db.prepare("UPDATE ai_agent_runs SET approval_status = @approval_status, status = @run_status, updated_at = @updated_at WHERE id = @id AND tenant_id = @tenant_id")
        .run({ approval_status: status, run_status: status, updated_at: decidedAt, id: before.run_id, tenant_id: access.tenantId });
    }
    const after = getScoped("ai_agent_approval_queue", id, access);
    const actorKey = status === "approved" ? "approvedBy" : "rejectedBy";
    auditAi(`ai.queue_${status}`, "ai_agent_approval_queue", id, access, {
      branchId: after.branch_id || "",
      agentId: after.agent_id || "",
      runId: after.run_id || "",
      queueId: id,
      before,
      after,
      details: {
        [actorKey]: access.userId || "",
        decisionNotes,
        beforePayload: parseJson(before.before_payload_json, {}),
        afterPayload: parseJson(after.after_payload_json, {})
      },
      riskLevel: after.risk_level || "medium",
      approvalStatus: status
    });
    emitEvent(`ai:approval_${status}`, access, after.branch_id || "", id);
    return camel(after);
  },

  editQueueItem(id, payload, access) {
    requireManager(access);
    const before = getScoped("ai_agent_approval_queue", id, access);
    if (before.approval_status !== "pending") {
      throw badRequest("Only pending queue items can be edited");
    }
    const editedPayload = payload.editedPayload || payload.edited_payload || {};
    const proposedAction = payload.proposedAction ?? payload.proposed_action ?? editedPayload.proposedAction ?? editedPayload.proposed_action;
    const afterPayload = payload.afterPayload ?? payload.after_payload ?? editedPayload.afterPayload ?? editedPayload.after_payload ?? (Object.keys(editedPayload).length ? editedPayload : null);
    const title = payload.title ?? editedPayload.title ?? before.title;
    const summary = payload.summary ?? editedPayload.summary ?? before.summary;
    const changedFields = [];
    if (title !== before.title) changedFields.push("title");
    if (summary !== before.summary) changedFields.push("summary");
    if (proposedAction) changedFields.push("proposedAction");
    if (afterPayload) changedFields.push("afterPayload");
    const updates = {
      title,
      summary,
      proposed_action_json: proposedAction ? toJson(proposedAction) : before.proposed_action_json,
      after_payload_json: afterPayload ? toJson(afterPayload) : before.after_payload_json,
      decision_notes: payload.notes || payload.decisionNotes || before.decision_notes || "",
      approval_status: "pending",
      status: "pending",
      updated_at: now(),
      id,
      tenant_id: access.tenantId
    };
    db.prepare(`UPDATE ai_agent_approval_queue
      SET title = @title, summary = @summary, proposed_action_json = @proposed_action_json, after_payload_json = @after_payload_json,
          decision_notes = @decision_notes, approval_status = @approval_status, status = @status, updated_at = @updated_at
      WHERE id = @id AND tenant_id = @tenant_id`).run(updates);
    const after = getScoped("ai_agent_approval_queue", id, access);
    auditAi("ai.queue_edited", "ai_agent_approval_queue", id, access, {
      branchId: after.branch_id || "",
      agentId: after.agent_id || "",
      runId: after.run_id || "",
      queueId: id,
      before,
      after,
      details: {
        editedBy: access.userId || "",
        changedFields,
        beforePayload: parseJson(before.before_payload_json, {}),
        previousAfterPayload: parseJson(before.after_payload_json, {}),
        afterPayload: parseJson(after.after_payload_json, {})
      },
      riskLevel: after.risk_level || "medium",
      approvalStatus: "pending"
    });
    emitEvent("ai:approval_edited", access, after.branch_id || "", id);
    return camel(after);
  },

  alerts(query, access) {
    return scopedList("ai_agent_alerts", access, query, { filters: alertFilters(query), limit: 100 });
  },

  updateAlertStatus(id, action, payload, access) {
    requireManager(access);
    const before = getScoped("ai_agent_alerts", id, access);
    const isResolve = action === "resolve";
    const updates = {
      id,
      tenant_id: access.tenantId,
      status: isResolve ? "resolved" : "acknowledged",
      acknowledged_by: before.acknowledged_by || access.userId || "",
      acknowledged_at: before.acknowledged_at || now(),
      resolved_by: isResolve ? access.userId || "" : before.resolved_by || "",
      resolved_at: isResolve ? now() : before.resolved_at || "",
      metadata_json: payload.metadata ? toJson(payload.metadata) : before.metadata_json,
      updated_at: now()
    };
    db.prepare(`UPDATE ai_agent_alerts
      SET status = @status, acknowledged_by = @acknowledged_by, acknowledged_at = @acknowledged_at,
          resolved_by = @resolved_by, resolved_at = @resolved_at, metadata_json = @metadata_json, updated_at = @updated_at
      WHERE id = @id AND tenant_id = @tenant_id`).run(updates);
    const after = getScoped("ai_agent_alerts", id, access);
    auditAi(`ai.alert_${updates.status}`, "ai_agent_alert", id, access, {
      branchId: after.branch_id || "",
      agentId: after.agent_id || "",
      runId: after.run_id || "",
      before,
      after,
      riskLevel: after.risk_level || "medium"
    });
    emitEvent(`ai:alert_${updates.status}`, access, after.branch_id || "", id);
    return camel(after);
  },

  settings(query, access) {
    ensureDefaultSettings(access);
    return scopedList("ai_agent_settings", access, query, {
      orderBy: "created_at DESC",
      limit: 100,
      filters: [
        (where, params) => {
          const agentId = query.agentId || query.agent_id || "";
          if (agentId) {
            where.push("agent_id = @agent_id");
            params.agent_id = agentId;
          }
        }
      ]
    });
  },

  updateSettings(agentId, payload, access) {
    requireManager(access);
    const agent = getAgentRow(agentId, access);
    const branchId = branchFrom(payload, access) || agent.branch_id || "";
    assertBranch(access, branchId);
    const before = getSettingsForAgent({ ...agent, branch_id: branchId }, access);
    const updates = buildPatch(payload, settingsPatchFields);
    const requestedAutonomy = updates.autonomy_level ?? payload.autonomyLevel ?? payload.autonomy_level ?? before?.autonomy_level ?? "approval_required";
    updates.autonomy_level = enforceAutonomyPolicy(requestedAutonomy, payload, access);
    updates.risk_threshold = normalizeRiskLevel(updates.risk_threshold ?? before?.risk_threshold ?? "medium", "medium");
    const requestedApproval = Number(updates.approval_required ?? payload.approvalRequired ?? payload.approval_required ?? before?.approval_required ?? 1);
    const allowsLowRiskAuto = updates.autonomy_level === "auto_execute_low_risk" && requestedApproval === 0;
    updates.approval_required = allowsLowRiskAuto ? 0 : 1;
    const row = {
      id: before?.id || makeId("agset"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      agent_id: agentId,
      autonomy_level: updates.autonomy_level,
      approval_required: updates.approval_required,
      risk_threshold: updates.risk_threshold,
      provider_key: updates.provider_key ?? before?.provider_key ?? "not_configured",
      model_key: updates.model_key ?? before?.model_key ?? "",
      module_permissions_json: updates.module_permissions_json ?? before?.module_permissions_json ?? "[]",
      branch_permissions_json: updates.branch_permissions_json ?? before?.branch_permissions_json ?? "[]",
      prompt_version: updates.prompt_version ?? before?.prompt_version ?? 1,
      status: updates.status ?? before?.status ?? "active",
      risk_level: before?.risk_level || "low",
      approval_status: before?.approval_status || "approved",
      updated_at: now()
    };
    db.prepare(`INSERT INTO ai_agent_settings
      (id, tenant_id, branch_id, agent_id, autonomy_level, approval_required, risk_threshold, provider_key, model_key, module_permissions_json, branch_permissions_json, prompt_version, status, risk_level, approval_status, updated_at)
      VALUES (@id, @tenant_id, @branch_id, @agent_id, @autonomy_level, @approval_required, @risk_threshold, @provider_key, @model_key, @module_permissions_json, @branch_permissions_json, @prompt_version, @status, @risk_level, @approval_status, @updated_at)
      ON CONFLICT(tenant_id, agent_id, branch_id) DO UPDATE SET
        autonomy_level = excluded.autonomy_level,
        approval_required = excluded.approval_required,
        risk_threshold = excluded.risk_threshold,
        provider_key = excluded.provider_key,
        model_key = excluded.model_key,
        module_permissions_json = excluded.module_permissions_json,
        branch_permissions_json = excluded.branch_permissions_json,
        prompt_version = excluded.prompt_version,
        status = excluded.status,
        updated_at = excluded.updated_at`).run(row);
    db.prepare("UPDATE ai_agents SET provider_key = @provider_key, autonomy_level = @autonomy_level, updated_at = @updated_at WHERE id = @id AND tenant_id = @tenant_id")
      .run({ provider_key: row.provider_key, autonomy_level: row.autonomy_level, updated_at: row.updated_at, id: agentId, tenant_id: access.tenantId });
    const after = getSettingsForAgent({ ...agent, branch_id: branchId }, access);
    auditAi("ai.settings_updated", "ai_agent_settings", after.id, access, {
      branchId,
      agentId,
      before: before || {},
      after,
      details: {
        fields: Object.keys(updates),
        autonomyLevel: row.autonomy_level,
        approvalRequired: row.approval_required,
        riskThreshold: row.risk_threshold,
        providerKey: row.provider_key
      },
      riskLevel: row.risk_threshold,
      approvalStatus: row.approval_required ? "approval_required" : "low_risk_auto_allowed"
    });
    emitEvent("ai:settings_updated", access, branchId, agentId);
    return camel(after);
  },

  marketplace(query, access) {
    ensureDefaultSettings(access);
    const installed = new Set(scopedList("ai_agents", access, {}, { orderBy: "agent_key ASC", limit: 500 }).map((agent) => agent.agentKey));
    const q = String(query.q || query.search || "").toLowerCase();
    return marketplaceTemplates
      .filter((template) => !q || `${template.agentName} ${template.agentType} ${template.description}`.toLowerCase().includes(q))
      .map((template) => ({
        ...template,
        installed: installed.has(template.agentKey),
        providerOptions: providerCatalog.map(({ providerKey, providerName }) => ({ providerKey, providerName })),
        defaultAutonomyLevel: "approval_required"
      }));
  },

  installMarketplaceAgent(templateKey, payload, access) {
    requireManager(access);
    const template = marketplaceTemplates.find((item) => item.templateKey === templateKey || item.agentKey === templateKey);
    if (!template) throw notFound("Marketplace template not found");
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const existing = db.prepare(`SELECT * FROM ai_agents
      WHERE tenant_id = @tenant_id AND agent_key = @agent_key LIMIT 1`)
      .get({ tenant_id: access.tenantId, agent_key: template.agentKey });
    if (existing) return { installed: true, agent: camel(existing), template };
    const agent = this.createAgent({
      branchId,
      agentKey: template.agentKey,
      agentName: payload.agentName || payload.agent_name || template.agentName,
      agentType: template.agentType,
      description: payload.description || template.description,
      riskLevel: payload.riskLevel || payload.risk_level || "medium",
      providerKey: payload.providerKey || payload.provider_key || "not_configured",
      autonomyLevel: "approval_required",
      config: {
        marketplaceTemplate: template.templateKey,
        defaultTaskType: template.defaultTaskType,
        modules: template.modules,
        ...(payload.config || {})
      }
    }, access);
    auditAi("ai.marketplace_agent_installed", "ai_agent", agent.id, access, {
      branchId,
      agentId: agent.id,
      after: agent,
      riskLevel: "medium",
      approvalStatus: "approved",
      details: { templateKey: template.templateKey }
    });
    return { installed: true, agent, template };
  },

  createCustomAgent(payload, access) {
    const agent = this.createAgent({
      ...payload,
      agentType: payload.agentType || payload.agent_type || "custom",
      autonomyLevel: payload.autonomyLevel || payload.autonomy_level || "approval_required",
      config: {
        ...(payload.config || {}),
        builder: {
          goals: payload.goals || [],
          modules: payload.modules || [],
          guardrails: payload.guardrails || [],
          tools: payload.tools || [],
          simulationFirst: payload.simulationFirst ?? true
        }
      }
    }, access);
    auditAi("ai.custom_agent_built", "ai_agent", agent.id, access, {
      branchId: agent.branchId || "",
      agentId: agent.id,
      after: agent,
      riskLevel: agent.riskLevel || "medium",
      approvalStatus: "approved"
    });
    return agent;
  },

  providers(query, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    assertBranch(access, branchId);
    return providerCatalog.map((provider) => providerStatus(provider.providerKey, access, branchId));
  },

  saveProviderConfig(providerKey, payload, access) {
    requireManager(access);
    if (payload.apiKey || payload.api_key || payload.secretKey || payload.secret_key) {
      throw badRequest("Provider secrets must stay in environment or vault. Send apiKeyRef only.");
    }
    const catalog = providerCatalogItem(providerKey);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const apiKeyRef = payload.apiKeyRef || payload.api_key_ref || catalog.envKey || "";
    const hasCredential = ["local", "local_rules"].includes(catalog.providerKey) || Boolean(apiKeyRef && (process.env[apiKeyRef] || apiKeyRef !== catalog.envKey));
    const row = {
      id: makeId("agprov"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      provider_key: catalog.providerKey,
      provider_name: payload.providerName || payload.provider_name || catalog.providerName,
      model_key: payload.modelKey || payload.model_key || catalog.defaultModel || "",
      status: hasCredential ? (payload.status || "configured") : "not_configured",
      api_key_ref: apiKeyRef,
      endpoint_url: payload.endpointUrl || payload.endpoint_url || "",
      config_json: toJson(payload.config || payload.config_json || {}),
      risk_level: normalizeRiskLevel(payload.riskLevel || payload.risk_level || "medium", "medium"),
      approval_status: "approved",
      created_by: access.userId || "",
      updated_at: now()
    };
    const before = db.prepare(`SELECT * FROM ai_agent_provider_configs
      WHERE tenant_id = @tenant_id AND branch_id = @branch_id AND provider_key = @provider_key`)
      .get({ tenant_id: row.tenant_id, branch_id: row.branch_id, provider_key: row.provider_key });
    db.prepare(`INSERT INTO ai_agent_provider_configs
      (id, tenant_id, branch_id, provider_key, provider_name, model_key, status, api_key_ref, endpoint_url, config_json, risk_level, approval_status, created_by, updated_at)
      VALUES (@id, @tenant_id, @branch_id, @provider_key, @provider_name, @model_key, @status, @api_key_ref, @endpoint_url, @config_json, @risk_level, @approval_status, @created_by, @updated_at)
      ON CONFLICT(tenant_id, branch_id, provider_key) DO UPDATE SET
        provider_name = excluded.provider_name,
        model_key = excluded.model_key,
        status = excluded.status,
        api_key_ref = excluded.api_key_ref,
        endpoint_url = excluded.endpoint_url,
        config_json = excluded.config_json,
        risk_level = excluded.risk_level,
        approval_status = excluded.approval_status,
        updated_at = excluded.updated_at`).run(row);
    const after = providerStatus(catalog.providerKey, access, branchId);
    auditAi("ai.provider_configured", "ai_agent_provider_config", catalog.providerKey, access, {
      branchId,
      before: before || {},
      after,
      riskLevel: row.risk_level,
      approvalStatus: row.approval_status,
      details: { providerKey: catalog.providerKey, storedSecret: false }
    });
    emitEvent("ai:provider_configured", access, branchId, catalog.providerKey, { status: after.status });
    return after;
  },

  switchAgentProvider(agentId, payload, access) {
    requireManager(access);
    const agent = getAgentRow(agentId, access);
    const branchId = branchFrom(payload, access) || agent.branch_id || "";
    assertBranch(access, branchId);
    const providerKey = payload.providerKey || payload.provider_key || "not_configured";
    const provider = providerStatus(providerKey, access, branchId);
    const settings = this.updateSettings(agentId, {
      ...payload,
      branchId,
      providerKey,
      modelKey: payload.modelKey || payload.model_key || provider.modelKey || ""
    }, access);
    auditAi("ai.agent_provider_switched", "ai_agent", agentId, access, {
      branchId,
      agentId,
      before: { providerKey: agent.provider_key },
      after: { providerKey, modelKey: provider.modelKey, status: provider.status },
      riskLevel: "medium",
      approvalStatus: "approved"
    });
    return { agentId, provider, settings };
  },

  promptVersions(query, access) {
    requireTenant(access);
    return scopedList("ai_agent_prompt_versions", access, query, { filters: promptVersionFilters(query), limit: 200 });
  },

  createPromptVersion(agentId, payload, access) {
    requireManager(access);
    const agent = getAgentRow(agentId, access);
    const branchId = branchFrom(payload, access) || agent.branch_id || "";
    assertBranch(access, branchId);
    const latest = db.prepare(`SELECT COALESCE(MAX(version), 0) latest FROM ai_agent_prompt_versions
      WHERE tenant_id = @tenant_id AND agent_id = @agent_id`)
      .get({ tenant_id: access.tenantId, agent_id: agentId });
    const version = number(payload.version, number(latest?.latest, 0) + 1);
    const providerKey = payload.providerKey || payload.provider_key || agent.provider_key || "not_configured";
    const row = {
      id: makeId("agprompt"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      agent_id: agentId,
      prompt_key: payload.promptKey || payload.prompt_key || `${agent.agent_key}-v${version}`,
      version,
      system_prompt: payload.systemPrompt || payload.system_prompt || "",
      user_prompt: payload.userPrompt || payload.user_prompt || "",
      guardrails_json: toJson(payload.guardrails || payload.guardrails_json || []),
      provider_key: providerKey,
      model_key: payload.modelKey || payload.model_key || providerStatus(providerKey, access, branchId).modelKey || "",
      status: payload.activate ? "active" : (payload.status || "draft"),
      risk_level: normalizeRiskLevel(payload.riskLevel || payload.risk_level || "medium", "medium"),
      approval_status: payload.approvalStatus || payload.approval_status || "pending",
      approved_by: "",
      approved_at: "",
      created_by: access.userId || "",
      updated_at: now()
    };
    try {
      db.prepare(`INSERT INTO ai_agent_prompt_versions
        (id, tenant_id, branch_id, agent_id, prompt_key, version, system_prompt, user_prompt, guardrails_json, provider_key, model_key, status, risk_level, approval_status, approved_by, approved_at, created_by, updated_at)
        VALUES (@id, @tenant_id, @branch_id, @agent_id, @prompt_key, @version, @system_prompt, @user_prompt, @guardrails_json, @provider_key, @model_key, @status, @risk_level, @approval_status, @approved_by, @approved_at, @created_by, @updated_at)`).run(row);
    } catch (error) {
      if (error.code === "SQLITE_CONSTRAINT_UNIQUE") throw badRequest("Prompt version already exists for this agent");
      throw error;
    }
    if (payload.activate) {
      db.prepare("UPDATE ai_agent_prompt_versions SET status = 'archived', updated_at = @updated_at WHERE tenant_id = @tenant_id AND agent_id = @agent_id AND id <> @id")
        .run({ updated_at: now(), tenant_id: access.tenantId, agent_id: agentId, id: row.id });
      this.updateSettings(agentId, { branchId, promptVersion: row.version, providerKey: row.provider_key, modelKey: row.model_key }, access);
    }
    auditAi("ai.prompt_version_created", "ai_agent_prompt_version", row.id, access, {
      branchId,
      agentId,
      after: row,
      riskLevel: row.risk_level,
      approvalStatus: row.approval_status,
      details: { version: row.version, activated: Boolean(payload.activate) }
    });
    return camel(row);
  },

  activatePromptVersion(agentId, versionId, payload, access) {
    requireManager(access);
    const agent = getAgentRow(agentId, access);
    const before = getScoped("ai_agent_prompt_versions", versionId, access);
    if (before.agent_id !== agentId) throw badRequest("Prompt version does not belong to this agent");
    const branchId = branchFrom(payload, access) || before.branch_id || agent.branch_id || "";
    assertBranch(access, branchId);
    db.transaction(() => {
      db.prepare("UPDATE ai_agent_prompt_versions SET status = 'archived', updated_at = @updated_at WHERE tenant_id = @tenant_id AND agent_id = @agent_id AND id <> @id")
        .run({ updated_at: now(), tenant_id: access.tenantId, agent_id: agentId, id: versionId });
      db.prepare(`UPDATE ai_agent_prompt_versions
        SET status = 'active', approval_status = 'approved', approved_by = @approved_by, approved_at = @approved_at, updated_at = @updated_at
        WHERE tenant_id = @tenant_id AND id = @id`)
        .run({ approved_by: access.userId || "", approved_at: now(), updated_at: now(), tenant_id: access.tenantId, id: versionId });
    })();
    const after = getScoped("ai_agent_prompt_versions", versionId, access);
    this.updateSettings(agentId, { branchId, promptVersion: after.version, providerKey: after.provider_key, modelKey: after.model_key }, access);
    auditAi("ai.prompt_version_activated", "ai_agent_prompt_version", versionId, access, {
      branchId,
      agentId,
      before,
      after,
      riskLevel: after.risk_level,
      approvalStatus: "approved",
      details: { version: after.version }
    });
    emitEvent("ai:prompt_version_activated", access, branchId, versionId);
    return camel(after);
  },

  simulateAgent(agentId, payload, access) {
    return this.runAgent(agentId, { ...payload, simulationMode: true }, access);
  },

  costs(query, access) {
    requireTenant(access);
    const rows = scopedList("ai_agent_costs", access, query, { filters: costFilters(query), limit: 250 });
    const todayDate = now().slice(0, 10);
    const monthPrefix = todayDate.slice(0, 7);
    const branchId = query.branchId || query.branch_id || "";
    const branchClause = branchId ? " AND branch_id = @branch_id" : "";
    const params = { tenant_id: access.tenantId, today: todayDate, month: `${monthPrefix}%`, branch_id: branchId };
    const summary = db.prepare(`SELECT
        COALESCE(SUM(CASE WHEN cost_date = @today THEN estimated_cost ELSE 0 END), 0) today_cost,
        COALESCE(SUM(CASE WHEN cost_date LIKE @month THEN estimated_cost ELSE 0 END), 0) month_cost,
        COALESCE(SUM(estimated_cost), 0) total_cost,
        COALESCE(SUM(total_tokens), 0) total_tokens
      FROM ai_agent_costs WHERE tenant_id = @tenant_id${branchClause}`).get(params);
    const byAgent = db.prepare(`SELECT agent_id, provider_key, COALESCE(SUM(estimated_cost), 0) estimated_cost, COALESCE(SUM(total_tokens), 0) total_tokens
      FROM ai_agent_costs WHERE tenant_id = @tenant_id${branchClause}
      GROUP BY agent_id, provider_key ORDER BY estimated_cost DESC LIMIT 50`).all(params).map(camel);
    return {
      summary: camel(summary || {}),
      byAgent,
      rows
    };
  },

  kpiImpact(query, access) {
    requireTenant(access);
    return scopedList("ai_agent_kpi_impact", access, query, { filters: kpiImpactFilters(query), limit: 250 });
  },

  recordKpiImpact(payload, access) {
    requireManager(access);
    const agent = payload.agentId || payload.agent_id ? getAgentRow(payload.agentId || payload.agent_id, access) : null;
    const branchId = branchFrom(payload, access) || agent?.branch_id || "";
    assertBranch(access, branchId);
    const row = {
      id: makeId("agkpi"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      agent_id: agent?.id || payload.agentId || payload.agent_id || "",
      run_id: payload.runId || payload.run_id || "",
      impact_date: payload.impactDate || payload.impact_date || now().slice(0, 10),
      kpi_key: payload.kpiKey || payload.kpi_key || "staff_productivity",
      kpi_label: payload.kpiLabel || payload.kpi_label || "Staff productivity impact",
      baseline_value: number(payload.baselineValue || payload.baseline_value, 0),
      impact_value: number(payload.impactValue || payload.impact_value, 0),
      estimated_revenue_impact: number(payload.estimatedRevenueImpact || payload.estimated_revenue_impact, 0),
      confidence: number(payload.confidence, 0.7),
      status: payload.status || "estimated",
      risk_level: normalizeRiskLevel(payload.riskLevel || payload.risk_level || "low", "low"),
      approval_status: approvalRequired(payload.riskLevel || payload.risk_level || "low") ? "pending" : "not_required",
      evidence_json: toJson(payload.evidence || payload.evidence_json || {})
    };
    db.prepare(`INSERT INTO ai_agent_kpi_impact
      (id, tenant_id, branch_id, agent_id, run_id, impact_date, kpi_key, kpi_label, baseline_value, impact_value, estimated_revenue_impact, confidence, status, risk_level, approval_status, evidence_json)
      VALUES (@id, @tenant_id, @branch_id, @agent_id, @run_id, @impact_date, @kpi_key, @kpi_label, @baseline_value, @impact_value, @estimated_revenue_impact, @confidence, @status, @risk_level, @approval_status, @evidence_json)`).run(row);
    auditAi("ai.kpi_impact_recorded", "ai_agent_kpi_impact", row.id, access, {
      branchId,
      agentId: row.agent_id,
      runId: row.run_id,
      after: row,
      riskLevel: row.risk_level,
      approvalStatus: row.approval_status
    });
    emitEvent("ai:kpi_impact_recorded", access, branchId, row.id);
    return camel(row);
  },

  auditLogs(query, access) {
    requireManager(access);
    return scopedList("ai_agent_audit_logs", access, query, { filters: auditLogFilters(query), limit: 200 });
  },

  getAuditLog(id, access) {
    requireManager(access);
    return camel(getScoped("ai_agent_audit_logs", id, access));
  },

  decisions(query, access) {
    return scopedList("ai_agent_decisions", access, query, {
      filters: [
        (where, params) => {
          const agentId = query.agentId || query.agent_id || "";
          if (agentId) {
            where.push("agent_id = @agent_id");
            params.agent_id = agentId;
          }
        }
      ]
    });
  },

  feedback(payload, access) {
    requireTenant(access);
    const branchId = branchFrom(payload, access);
    assertBranch(access, branchId);
    const row = {
      id: makeId("agfb"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      decision_id: payload.decisionId || payload.decision_id || "",
      run_id: payload.runId || payload.run_id || "",
      rating: Number(payload.rating || 0),
      feedback_text: payload.feedbackText || payload.feedback_text || payload.feedback || "",
      created_by: access.userId || ""
    };
    db.prepare(`INSERT INTO ai_agent_feedback
      (id, tenant_id, branch_id, decision_id, run_id, rating, feedback_text, created_by)
      VALUES (@id, @tenant_id, @branch_id, @decision_id, @run_id, @rating, @feedback_text, @created_by)`).run(row);
    auditAi("ai.feedback_created", "ai_agent_feedback", row.id, access, { branchId, after: row, details: { rating: row.rating } });
    return camel(row);
  },

  defaultAgentKeyFromRun(run) {
    return parseJson(run.output_json, {}).decisionType || "agent_recommendation";
  }
};
