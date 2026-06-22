import { repositories } from "../repositories/repository-registry.js";
import { badRequest, notFound } from "../utils/app-error.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

function daysSince(value) {
  if (!value) return 999;
  const time = new Date(value).getTime();
  if (Number.isNaN(time)) return 999;
  return Math.max(0, Math.round((Date.now() - time) / 86400000));
}

function applyTemplate(template = "", client = {}) {
  return String(template || "")
    .replaceAll("{{name}}", client.name || "there")
    .replaceAll("{{firstName}}", String(client.name || "there").split(" ")[0])
    .replaceAll("{{phone}}", client.phone || "");
}

export class WorkflowEngineService {
  summary(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const queryScope = scope(access, branchId);
    const definitions = repositories.workflowDefinitions.list({ branchId, limit: 100 }, queryScope);
    const runs = repositories.workflowRuns.list({ branchId, limit: 100 }, queryScope);
    const active = definitions.filter((item) => item.status === "active");
    const sent = runs.reduce((sum, run) => sum + Number(run.actionResult?.sent || 0), 0);
    return {
      metrics: {
        workflows: definitions.length,
        active: active.length,
        runs: runs.length,
        messagesSent: sent,
        scheduled: runs.filter((item) => item.status === "scheduled").length
      },
      definitions,
      runs,
      example: {
        trigger: "client-inactive",
        condition: "inactiveDays >= 30",
        action: "send WhatsApp offer"
      }
    };
  }

  createDefinition(payload = {}, access) {
    if (!payload.name) throw badRequest("name is required");
    const branchId = payload.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const definition = repositories.workflowDefinitions.create({
      id: makeId("wf"),
      branchId,
      name: payload.name,
      description: payload.description || "",
      trigger: payload.trigger || { type: "client-inactive", schedule: "manual" },
      conditions: payload.conditions || { inactiveDays: 30 },
      actions: payload.actions || [
        {
          channel: payload.channel || "WhatsApp",
          template: payload.template || "Hi {{name}}, we miss you. Book this week and get a special offer."
        }
      ],
      delayMinutes: Number(payload.delayMinutes || 0),
      status: payload.status || "active"
    }, scope(access, branchId));
    return definition;
  }

  updateDefinition(id, payload = {}, access) {
    const existing = repositories.workflowDefinitions.getById(id, scope(access));
    if (!existing) throw notFound("Workflow not found");
    if (existing.branchId) tenantService.assertBranchAccess(access, existing.branchId);
    return repositories.workflowDefinitions.update(id, payload, scope(access));
  }

  runWorkflow(id, payload = {}, access) {
    const workflow = repositories.workflowDefinitions.getById(id, scope(access));
    if (!workflow) throw notFound("Workflow not found");
    if (workflow.branchId) tenantService.assertBranchAccess(access, workflow.branchId);
    if (workflow.status !== "active" && !payload.force) throw badRequest("Workflow is not active");

    const audience = this.resolveAudience(workflow, payload, access);
    const actionResult = this.executeActions(workflow, audience, access);
    const stamp = now();
    const status = Number(workflow.delayMinutes || 0) > 0 ? "scheduled" : "completed";
    const run = repositories.workflowRuns.create({
      id: makeId("wfrun"),
      branchId: workflow.branchId || "",
      workflowId: workflow.id,
      triggerSource: payload.triggerSource || { type: "manual", userId: access.userId || "" },
      audience,
      actionResult,
      status,
      startedAt: stamp,
      completedAt: status === "completed" ? stamp : ""
    }, scope(access, workflow.branchId || ""));
    repositories.workflowDefinitions.update(workflow.id, { lastRunAt: stamp }, scope(access));
    tenantService.recordUsage({ tenantId: access.tenantId, metric: "workflow:runs", referenceType: "workflow_run", referenceId: run.id });
    return { workflow, run };
  }

  runDue(access) {
    const definitions = repositories.workflowDefinitions.list({ limit: 1000 }, scope(access)).filter((item) => item.status === "active");
    return {
      count: definitions.length,
      results: definitions.map((definition) => this.runWorkflow(definition.id, { triggerSource: { type: "scheduled" } }, access))
    };
  }

  resolveAudience(workflow, payload, access) {
    const branchId = workflow.branchId || payload.branchId || "";
    const clients = repositories.clients.list({ branchId, limit: 10000 }, scope(access, branchId));
    const conditions = workflow.conditions || {};
    const inactiveDays = Number(conditions.inactiveDays || 0);
    const minSpend = Number(conditions.minSpend || 0);
    const tag = String(conditions.tag || "").toLowerCase();
    const triggerType = workflow.trigger?.type || "client-inactive";
    return clients
      .filter((client) => {
        const inactiveMatch = triggerType === "client-inactive" ? daysSince(client.lastVisitAt) >= inactiveDays : true;
        const spendMatch = Number(client.totalSpend || 0) >= minSpend;
        const tagMatch = tag ? (client.tags || []).map((item) => String(item).toLowerCase()).includes(tag) : true;
        return inactiveMatch && spendMatch && tagMatch;
      })
      .map((client) => ({
        clientId: client.id,
        name: client.name,
        phone: client.phone,
        inactiveDays: daysSince(client.lastVisitAt),
        totalSpend: Number(client.totalSpend || 0)
      }));
  }

  executeActions(workflow, audience, access) {
    const actions = workflow.actions?.length ? workflow.actions : [];
    const results = [];
    for (const clientRef of audience) {
      const client = repositories.clients.getById(clientRef.clientId, scope(access));
      for (const action of actions) {
        const channel = action.channel || "WhatsApp";
        const status = Number(workflow.delayMinutes || 0) > 0 ? "scheduled" : channel.toLowerCase() === "whatsapp" ? "queued-whatsapp" : "queued";
        const notification = repositories.notifications.create({
          id: makeId("note"),
          clientId: client.id,
          type: "workflow",
          channel,
          message: applyTemplate(action.template, client),
          status
        }, scope(access));
        results.push({ clientId: client.id, channel, notificationId: notification.id, status });
      }
    }
    return { sent: results.length, skipped: audience.length ? 0 : 1, results };
  }
}

export const workflowEngineService = new WorkflowEngineService();
