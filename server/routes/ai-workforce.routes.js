import { Router } from "express";
import { aiWorkforceService } from "../services/ai-workforce/ai-workforce.service.js";
import { route } from "./staff-os-route-utils.js";

export const aiWorkforceRouter = Router();

aiWorkforceRouter.get("/ai-workforce/dashboard", route((req, res) => res.json(aiWorkforceService.dashboard(req.query, req.access))));

aiWorkforceRouter.get("/ai-workforce/agents", route((req, res) => res.json(aiWorkforceService.listAgents(req.query, req.access))));
aiWorkforceRouter.get("/ai-workforce/agents/:id", route((req, res) => res.json(aiWorkforceService.getAgent(req.params.id, req.access))));
aiWorkforceRouter.post("/ai-workforce/agents", route((req, res) => res.status(201).json(aiWorkforceService.createAgent(req.body, req.access))));
aiWorkforceRouter.patch("/ai-workforce/agents/:id", route((req, res) => res.json(aiWorkforceService.updateAgent(req.params.id, req.body, req.access))));
aiWorkforceRouter.post("/ai-workforce/agents/:id/enable", route((req, res) => res.json(aiWorkforceService.setAgentStatus(req.params.id, "active", req.access))));
aiWorkforceRouter.post("/ai-workforce/agents/:id/disable", route((req, res) => res.json(aiWorkforceService.setAgentStatus(req.params.id, "disabled", req.access))));
aiWorkforceRouter.post("/ai-workforce/agents/:id/run", route((req, res) => res.status(201).json(aiWorkforceService.runAgent(req.params.id, req.body, req.access))));
aiWorkforceRouter.post("/ai-workforce/agents/:id/simulate", route((req, res) => res.json(aiWorkforceService.simulateAgent(req.params.id, req.body || {}, req.access))));
aiWorkforceRouter.post("/ai-workforce/agents/:id/provider", route((req, res) => res.json(aiWorkforceService.switchAgentProvider(req.params.id, req.body || {}, req.access))));
aiWorkforceRouter.post("/ai-workforce/agent-builder/agents", route((req, res) => res.status(201).json(aiWorkforceService.createCustomAgent(req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/marketplace", route((req, res) => res.json(aiWorkforceService.marketplace(req.query, req.access))));
aiWorkforceRouter.post("/ai-workforce/marketplace/:templateKey/install", route((req, res) => res.status(201).json(aiWorkforceService.installMarketplaceAgent(req.params.templateKey, req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/providers", route((req, res) => res.json(aiWorkforceService.providers(req.query, req.access))));
aiWorkforceRouter.patch("/ai-workforce/providers/:providerKey", route((req, res) => res.json(aiWorkforceService.saveProviderConfig(req.params.providerKey, req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/prompt-versions", route((req, res) => res.json(aiWorkforceService.promptVersions(req.query, req.access))));
aiWorkforceRouter.post("/ai-workforce/agents/:id/prompt-versions", route((req, res) => res.status(201).json(aiWorkforceService.createPromptVersion(req.params.id, req.body || {}, req.access))));
aiWorkforceRouter.post("/ai-workforce/agents/:id/prompt-versions/:versionId/activate", route((req, res) => res.json(aiWorkforceService.activatePromptVersion(req.params.id, req.params.versionId, req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/queue", route((req, res) => res.json(aiWorkforceService.queue(req.query, req.access))));
aiWorkforceRouter.get("/ai-workforce/queue/:id", route((req, res) => res.json(aiWorkforceService.getQueueItem(req.params.id, req.access))));
aiWorkforceRouter.post("/ai-workforce/queue/:id/approve", route((req, res) => res.json(aiWorkforceService.decideQueueItem(req.params.id, "approved", req.body, req.access))));
aiWorkforceRouter.post("/ai-workforce/queue/:id/reject", route((req, res) => res.json(aiWorkforceService.decideQueueItem(req.params.id, "rejected", req.body, req.access))));
aiWorkforceRouter.post("/ai-workforce/queue/:id/edit", route((req, res) => res.json(aiWorkforceService.editQueueItem(req.params.id, req.body, req.access))));

aiWorkforceRouter.get("/ai-workforce/runs", route((req, res) => res.json(aiWorkforceService.runs(req.query, req.access))));
aiWorkforceRouter.get("/ai-workforce/runs/:id", route((req, res) => res.json(aiWorkforceService.getRun(req.params.id, req.access))));

aiWorkforceRouter.get("/ai-workforce/alerts", route((req, res) => res.json(aiWorkforceService.alerts(req.query, req.access))));
aiWorkforceRouter.post("/ai-workforce/alerts/:id/acknowledge", route((req, res) => res.json(aiWorkforceService.updateAlertStatus(req.params.id, "acknowledge", req.body, req.access))));
aiWorkforceRouter.post("/ai-workforce/alerts/:id/resolve", route((req, res) => res.json(aiWorkforceService.updateAlertStatus(req.params.id, "resolve", req.body, req.access))));

aiWorkforceRouter.get("/ai-workforce/settings", route((req, res) => res.json(aiWorkforceService.settings(req.query, req.access))));
aiWorkforceRouter.patch("/ai-workforce/settings/:agentId", route((req, res) => res.json(aiWorkforceService.updateSettings(req.params.agentId, req.body, req.access))));

aiWorkforceRouter.get("/ai-workforce/schedules", route((req, res) => res.json(aiWorkforceService.schedules(req.query, req.access))));
aiWorkforceRouter.post("/ai-workforce/schedules", route((req, res) => res.status(201).json(aiWorkforceService.createSchedule(req.body || {}, req.access))));
aiWorkforceRouter.patch("/ai-workforce/schedules/:id", route((req, res) => res.json(aiWorkforceService.updateSchedule(req.params.id, req.body || {}, req.access))));
aiWorkforceRouter.post("/ai-workforce/schedules/:id/run", route((req, res) => res.status(201).json(aiWorkforceService.runSchedule(req.params.id, req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/tasks", route((req, res) => res.json(aiWorkforceService.tasks(req.query, req.access))));
aiWorkforceRouter.get("/ai-workforce/tasks/:id", route((req, res) => res.json(aiWorkforceService.getTask(req.params.id, req.access))));
aiWorkforceRouter.post("/ai-workforce/tasks", route((req, res) => res.status(201).json(aiWorkforceService.createTask(req.body || {}, req.access))));
aiWorkforceRouter.patch("/ai-workforce/tasks/:id", route((req, res) => res.json(aiWorkforceService.updateTask(req.params.id, req.body || {}, req.access))));
aiWorkforceRouter.post("/ai-workforce/tasks/:id/complete", route((req, res) => res.json(aiWorkforceService.completeTask(req.params.id, req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/playbooks", route((req, res) => res.json(aiWorkforceService.playbooks(req.query, req.access))));
aiWorkforceRouter.post("/ai-workforce/playbooks", route((req, res) => res.status(201).json(aiWorkforceService.createPlaybook(req.body || {}, req.access))));
aiWorkforceRouter.patch("/ai-workforce/playbooks/:id", route((req, res) => res.json(aiWorkforceService.updatePlaybook(req.params.id, req.body || {}, req.access))));
aiWorkforceRouter.post("/ai-workforce/playbooks/:id/evaluate", route((req, res) => res.status(201).json(aiWorkforceService.evaluatePlaybook(req.params.id, req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/costs", route((req, res) => res.json(aiWorkforceService.costs(req.query, req.access))));
aiWorkforceRouter.get("/ai-workforce/kpi-impact", route((req, res) => res.json(aiWorkforceService.kpiImpact(req.query, req.access))));
aiWorkforceRouter.post("/ai-workforce/kpi-impact", route((req, res) => res.status(201).json(aiWorkforceService.recordKpiImpact(req.body || {}, req.access))));

aiWorkforceRouter.get("/ai-workforce/audit-logs", route((req, res) => res.json(aiWorkforceService.auditLogs(req.query, req.access))));
aiWorkforceRouter.get("/ai-workforce/audit-logs/:id", route((req, res) => res.json(aiWorkforceService.getAuditLog(req.params.id, req.access))));

aiWorkforceRouter.get("/ai-workforce/decisions", route((req, res) => res.json(aiWorkforceService.decisions(req.query, req.access))));
aiWorkforceRouter.post("/ai-workforce/feedback", route((req, res) => res.status(201).json(aiWorkforceService.feedback(req.body, req.access))));
