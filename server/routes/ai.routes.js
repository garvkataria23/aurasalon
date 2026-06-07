import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { db } from "../db.js";
import { forbidden } from "../utils/app-error.js";
import { aiAssistantLlmService } from "../services/ai-assistant-llm.service.js";
import { knowledgeBaseService } from "../services/ai/knowledgeBase.service.js";
import { whatsappAgentService } from "../services/ai/whatsappAgent.service.js";
import { aiAutomationService } from "../services/ai/aiAutomation.service.js";
import { predictiveIntelligenceService } from "../services/ai/predictiveIntelligence.service.js";
import { aiGovernanceService } from "../services/ai/aiGovernance.service.js";

export const aiRouter = Router();

const adminRoles = new Set(["owner", "admin", "superAdmin", "manager"]);

function requireAiAdmin(access) {
  if (!adminRoles.has(access?.role)) throw forbidden("AI administration requires owner or manager access");
}

function today() {
  return new Date().toISOString().slice(0, 10);
}

function observability(access) {
  requireAiAdmin(access);
  const date = today();
  const rows = db.prepare(`
    SELECT task_key AS taskKey,
           provider,
           COUNT(*) AS calls,
           SUM(CASE WHEN cached = 1 THEN 1 ELSE 0 END) AS cachedCalls,
           COALESCE(SUM(cost_usd), 0) AS costUsd,
           AVG(latency_ms) AS averageLatencyMs,
           SUM(CASE WHEN provider = 'local' THEN 1 ELSE 0 END) AS fallbackCalls
    FROM ai_cost_ledger
    WHERE tenantId = ? AND substr(created_at, 1, 10) = ?
    GROUP BY task_key, provider
    ORDER BY calls DESC
  `).all(access.tenantId, date);
  const callsToday = rows.reduce((sum, row) => sum + Number(row.calls || 0), 0);
  const cachedCallsToday = rows.reduce((sum, row) => sum + Number(row.cachedCalls || 0), 0);
  const fallbackCallsToday = rows.reduce((sum, row) => sum + Number(row.fallbackCalls || 0), 0);
  const costTodayUsd = rows.reduce((sum, row) => sum + Number(row.costUsd || 0), 0);
  const latencyCount = rows.filter((row) => Number.isFinite(Number(row.averageLatencyMs))).length || 1;
  const averageLatencyMs = Math.round(rows.reduce((sum, row) => sum + Number(row.averageLatencyMs || 0), 0) / latencyCount);
  const knowledgeDocumentCount = Number(db.prepare("SELECT COUNT(*) AS count FROM ai_knowledge_documents WHERE tenantId = ?").get(access.tenantId)?.count || 0);
  const automationSuggestionsCount = Number(db.prepare("SELECT COUNT(*) AS count FROM ai_automation_suggestions WHERE tenantId = ?").get(access.tenantId)?.count || 0);
  const recentInteractions = db.prepare(`
    SELECT id, type, model, status, confidence, createdAt
    FROM ai_interactions
    WHERE tenantId = ?
    ORDER BY createdAt DESC
    LIMIT 10
  `).all(access.tenantId);
  return {
    costTodayUsd,
    callsToday,
    cachedCallsToday,
    cacheHitRate: callsToday ? Math.round((cachedCallsToday / callsToday) * 10000) / 100 : 0,
    averageLatencyMs,
    fallbackCallsToday,
    providerStatus: {
      mode: process.env.AI_PROVIDER || "local",
      openaiConfigured: Boolean(process.env.OPENAI_API_KEY)
    },
    knowledgeDocumentCount,
    automationSuggestionsCount,
    policyDenialsToday: aiGovernanceService.denialsToday(access.tenantId),
    recentInteractions,
    recentDenials: aiGovernanceService.listDenials({ limit: 10 }, access).denials,
    byTask: rows
  };
}

aiRouter.get(
  "/ai/history",
  requirePermission("read", () => "ai"),
  asyncHandler((req, res) => {
    res.json(aiAssistantLlmService.history(req.query, req.access));
  })
);

aiRouter.get(
  "/ai/observability",
  asyncHandler((req, res) => {
    res.json(observability(req.access));
  })
);

aiRouter.post(
  "/ai/cache/clear",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    const taskKey = String(req.body?.taskKey || "");
    const result = taskKey
      ? db.prepare("DELETE FROM ai_response_cache WHERE tenantId = ? AND task_key = ?").run(req.access.tenantId, taskKey)
      : db.prepare("DELETE FROM ai_response_cache WHERE tenantId = ?").run(req.access.tenantId);
    res.json({ cleared: result.changes || 0 });
  })
);

aiRouter.post(
  "/ai/knowledge/documents",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.status(201).json(knowledgeBaseService.createDocument(req.body, req.access));
  })
);

aiRouter.get(
  "/ai/knowledge/documents",
  asyncHandler((req, res) => {
    res.json(knowledgeBaseService.listDocuments(req.query, req.access));
  })
);

aiRouter.delete(
  "/ai/knowledge/documents/:id",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(knowledgeBaseService.deleteDocument(req.params.id, req.access));
  })
);

aiRouter.post(
  "/ai/knowledge/search",
  asyncHandler((req, res) => {
    res.json(knowledgeBaseService.search(req.body, req.access));
  })
);

aiRouter.post(
  "/ai/whatsapp-agent/draft",
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAgentService.draft(req.body, req.access));
  })
);

aiRouter.get(
  "/ai/whatsapp-agent/drafts",
  asyncHandler((req, res) => {
    res.json({ drafts: whatsappAgentService.list(req.query, req.access) });
  })
);

aiRouter.post(
  "/ai/whatsapp-agent/drafts/:id/approve",
  asyncHandler((req, res) => {
    res.json(whatsappAgentService.approve(req.params.id, req.body, req.access));
  })
);

aiRouter.post(
  "/ai/whatsapp-agent/drafts/:id/copy",
  asyncHandler((req, res) => {
    res.json(whatsappAgentService.copy(req.params.id, req.body, req.access));
  })
);

aiRouter.post(
  "/ai/whatsapp-agent/drafts/:id/handoff",
  asyncHandler((req, res) => {
    res.json(whatsappAgentService.handoff(req.params.id, req.body, req.access));
  })
);

aiRouter.post(
  "/ai/whatsapp-agent/drafts/:id/mark-sent-manually",
  asyncHandler((req, res) => {
    res.json(whatsappAgentService.markSentManually(req.params.id, req.body, req.access));
  })
);

aiRouter.get(
  "/ai/automation/rules",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json({ rules: aiAutomationService.listRules(req.query, req.access) });
  })
);

aiRouter.post(
  "/ai/automation/rules",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.status(201).json(aiAutomationService.createRule(req.body, req.access));
  })
);

aiRouter.patch(
  "/ai/automation/rules/:id",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiAutomationService.updateRule(req.params.id, req.body, req.access));
  })
);

aiRouter.post(
  "/ai/automation/run",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.status(201).json(aiAutomationService.run(req.body, req.access));
  })
);

aiRouter.get(
  "/ai/automation/suggestions",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiAutomationService.listSuggestions(req.query, req.access));
  })
);

aiRouter.patch(
  "/ai/automation/suggestions/:id",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiAutomationService.updateSuggestion(req.params.id, req.body, req.access));
  })
);

aiRouter.get(
  "/ai/predictions/:scope",
  asyncHandler((req, res) => {
    const methods = {
      clients: "clientPredictions",
      appointments: "appointmentPredictions",
      demand: "demandPredictions",
      inventory: "inventoryPredictions",
      revenue: "revenuePredictions"
    };
    const method = methods[req.params.scope];
    if (!method) throw forbidden("Unknown prediction scope");
    res.json(predictiveIntelligenceService[method](req.query, req.access));
  })
);

aiRouter.get(
  "/ai/governance/settings",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiGovernanceService.settings(req.access));
  })
);

aiRouter.patch(
  "/ai/governance/settings",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiGovernanceService.updateSettings(req.body, req.access));
  })
);

aiRouter.get(
  "/ai/governance/task-overrides",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiGovernanceService.listTaskOverrides(req.query, req.access));
  })
);

aiRouter.patch(
  "/ai/governance/task-overrides/:taskKey",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiGovernanceService.updateTaskOverride(req.params.taskKey, req.body, req.access));
  })
);

aiRouter.get(
  "/ai/governance/denials",
  asyncHandler((req, res) => {
    requireAiAdmin(req.access);
    res.json(aiGovernanceService.listDenials(req.query, req.access));
  })
);

aiRouter.post(
  "/ai/:type",
  asyncHandler(async (req, res) => {
    res.status(201).json(await aiAssistantLlmService.run(req.params.type, req.body, req.access));
  })
);
