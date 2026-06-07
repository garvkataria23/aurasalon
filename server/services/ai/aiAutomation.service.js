import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { tenantService } from "../tenant.service.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
const allowedTypes = new Set([
  "rebooking_reminder",
  "birthday_campaign",
  "inactive_client_winback",
  "low_stock_reorder",
  "pending_payment_reminder",
  "no_show_followup"
]);

function parseJson(value, fallback) {
  if (Array.isArray(value) || (value && typeof value === "object")) return value;
  if (!value || typeof value !== "string") return fallback;
  try {
    return JSON.parse(value);
  } catch {
    return fallback;
  }
}

function rowToRule(row) {
  return row ? { ...row, conditions: parseJson(row.conditions, {}), actions: parseJson(row.actions, []) } : null;
}

function rowToSuggestion(row) {
  return row ? { ...row, payload: parseJson(row.payload, {}) } : null;
}

function branchClause(branchId, alias = "") {
  const prefix = alias ? `${alias}.` : "";
  return branchId ? `AND (${prefix}branchId = ? OR ${prefix}branchId = '')` : "";
}

function daysSince(value) {
  if (!value) return 999;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return 999;
  return Math.max(0, Math.floor((Date.now() - date.getTime()) / 86400000));
}

function suggestionFor({ tenantId, branchId, ruleId, runId, type, targetType, targetId, title, message, payload }) {
  const stamp = now();
  return {
    id: makeId("ai_sug"),
    tenantId,
    branchId: branchId || "",
    ruleId: ruleId || "",
    runId,
    type,
    targetType,
    targetId,
    title,
    message,
    payload,
    status: "draft",
    createdAt: stamp,
    updatedAt: stamp
  };
}

export class AiAutomationService {
  listRules(query = {}, access) {
    const branchId = String(query.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    return db.prepare(`
      SELECT * FROM ai_automation_rules
      WHERE tenantId = ? ${branchClause(branchId)}
      ORDER BY createdAt DESC
    `).all(...params).map(rowToRule);
  }

  createRule(payload = {}, access) {
    const type = String(payload.type || "");
    const name = String(payload.name || "").trim() || type.replace(/_/g, " ");
    if (!allowedTypes.has(type)) throw badRequest("Unsupported AI automation rule type");
    const branchId = String(payload.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const stamp = now();
    const rule = {
      id: makeId("ai_rule"),
      tenantId: access.tenantId,
      branchId,
      type,
      name,
      status: String(payload.status || "active"),
      conditions: payload.conditions && typeof payload.conditions === "object" ? payload.conditions : {},
      actions: Array.isArray(payload.actions) ? payload.actions : ["create_suggestion"],
      lastRunAt: "",
      createdAt: stamp,
      updatedAt: stamp
    };
    db.prepare(`
      INSERT INTO ai_automation_rules
        (id, tenantId, branchId, type, name, status, conditions, actions, lastRunAt, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @branchId, @type, @name, @status, @conditions, @actions, @lastRunAt, @createdAt, @updatedAt)
    `).run({ ...rule, conditions: JSON.stringify(rule.conditions), actions: JSON.stringify(rule.actions) });
    return rule;
  }

  updateRule(id, payload = {}, access) {
    const existing = db.prepare("SELECT * FROM ai_automation_rules WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!existing) throw notFound("AI automation rule not found");
    if (existing.branchId) tenantService.assertBranchAccess(access, existing.branchId);
    const updated = {
      ...rowToRule(existing),
      name: payload.name ?? existing.name,
      status: payload.status ?? existing.status,
      conditions: payload.conditions && typeof payload.conditions === "object" ? payload.conditions : parseJson(existing.conditions, {}),
      actions: Array.isArray(payload.actions) ? payload.actions : parseJson(existing.actions, []),
      updatedAt: now()
    };
    db.prepare(`
      UPDATE ai_automation_rules
      SET name = ?, status = ?, conditions = ?, actions = ?, updatedAt = ?
      WHERE id = ? AND tenantId = ?
    `).run(updated.name, updated.status, JSON.stringify(updated.conditions), JSON.stringify(updated.actions), updated.updatedAt, id, access.tenantId);
    return updated;
  }

  buildSuggestions(type, access, branchId, runId, ruleId = "") {
    const tenantId = access.tenantId;
    if (type === "low_stock_reorder") {
      const params = branchId ? [tenantId, branchId] : [tenantId];
      return db.prepare(`
        SELECT * FROM products
        WHERE tenantId = ? ${branchClause(branchId)}
          AND status = 'active'
          AND stock <= lowStockThreshold
        ORDER BY stock ASC LIMIT 20
      `).all(...params).map((product) => suggestionFor({
        tenantId,
        branchId: product.branchId || branchId,
        ruleId,
        runId,
        type,
        targetType: "product",
        targetId: product.id,
        title: `Reorder ${product.name}`,
        message: `${product.name} has ${product.stock} left against threshold ${product.lowStockThreshold}. Create purchase entry before stockout.`,
        payload: { productId: product.id, suggestedQuantity: Math.max(5, Number(product.lowStockThreshold || 5) * 2), stock: product.stock }
      }));
    }
    if (type === "pending_payment_reminder") {
      const params = branchId ? [tenantId, branchId] : [tenantId];
      return db.prepare(`
        SELECT * FROM invoices
        WHERE tenantId = ? ${branchClause(branchId)}
          AND status != 'paid'
          AND balance > 0
        ORDER BY balance DESC LIMIT 20
      `).all(...params).map((invoice) => suggestionFor({
        tenantId,
        branchId: invoice.branchId || branchId,
        ruleId,
        runId,
        type,
        targetType: "invoice",
        targetId: invoice.id,
        title: `Payment reminder ${invoice.invoiceNumber || invoice.id}`,
        message: `Invoice balance INR ${Math.round(Number(invoice.balance || 0))} is pending. Draft a polite payment reminder.`,
        payload: { invoiceId: invoice.id, clientId: invoice.clientId, balance: invoice.balance }
      }));
    }
    if (type === "birthday_campaign") {
      const month = new Date().getMonth() + 1;
      const rows = db.prepare("SELECT * FROM clients WHERE tenantId = ?").all(tenantId);
      return rows.filter((client) => {
        const date = new Date(client.birthday || "");
        return !Number.isNaN(date.getTime()) && date.getMonth() + 1 === month;
      }).slice(0, 20).map((client) => suggestionFor({
        tenantId,
        branchId: client.branchId || branchId,
        ruleId,
        runId,
        type,
        targetType: "client",
        targetId: client.id,
        title: `Birthday wish for ${client.name}`,
        message: `Send a birthday greeting and optional salon offer to ${client.name}.`,
        payload: { clientId: client.id, phone: client.phone }
      }));
    }
    const clientRows = db.prepare("SELECT * FROM clients WHERE tenantId = ?").all(tenantId);
    if (type === "inactive_client_winback" || type === "rebooking_reminder") {
      const threshold = type === "inactive_client_winback" ? 60 : 30;
      return clientRows.filter((client) => Number(client.visitCount || 0) > 0 && daysSince(client.lastVisitAt || client.updatedAt) >= threshold)
        .slice(0, 20)
        .map((client) => suggestionFor({
          tenantId,
          branchId: client.branchId || branchId,
          ruleId,
          runId,
          type,
          targetType: "client",
          targetId: client.id,
          title: type === "inactive_client_winback" ? `Win back ${client.name}` : `Rebook ${client.name}`,
          message: `${client.name} has not visited for ${daysSince(client.lastVisitAt || client.updatedAt)} days. Draft a personal follow-up.`,
          payload: { clientId: client.id, lastVisitAt: client.lastVisitAt, totalSpend: client.totalSpend }
        }));
    }
    if (type === "no_show_followup") {
      const params = branchId ? [tenantId, branchId] : [tenantId];
      return db.prepare(`
        SELECT * FROM appointments
        WHERE tenantId = ? ${branchClause(branchId)}
          AND status = 'no-show'
        ORDER BY startAt DESC LIMIT 20
      `).all(...params).map((appointment) => suggestionFor({
        tenantId,
        branchId: appointment.branchId || branchId,
        ruleId,
        runId,
        type,
        targetType: "appointment",
        targetId: appointment.id,
        title: "No-show follow-up",
        message: "Send a polite follow-up, confirm reason and offer a safer rebooking slot.",
        payload: { appointmentId: appointment.id, clientId: appointment.clientId, startAt: appointment.startAt }
      }));
    }
    return [];
  }

  run(payload = {}, access) {
    const branchId = String(payload.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const rule = payload.ruleId
      ? db.prepare("SELECT * FROM ai_automation_rules WHERE id = ? AND tenantId = ?").get(payload.ruleId, access.tenantId)
      : null;
    if (payload.ruleId && !rule) throw notFound("AI automation rule not found");
    const type = String(rule?.type || payload.type || "");
    if (!allowedTypes.has(type)) throw badRequest("AI automation run type is required");
    const stamp = now();
    const run = {
      id: makeId("ai_run"),
      tenantId: access.tenantId,
      branchId: branchId || rule?.branchId || "",
      ruleId: rule?.id || "",
      type,
      status: "completed",
      summary: {},
      suggestionsCreated: 0,
      createdAt: stamp,
      updatedAt: stamp
    };
    const suggestions = this.buildSuggestions(type, access, run.branchId, run.id, run.ruleId);
    run.summary = {
      type,
      checkedAt: stamp,
      suggestionsCreated: suggestions.length,
      executionMode: "suggestions_only",
      autoSend: false
    };
    run.suggestionsCreated = suggestions.length;
    db.transaction(() => {
      db.prepare(`
        INSERT INTO ai_automation_runs
          (id, tenantId, branchId, ruleId, type, status, summary, suggestionsCreated, createdAt, updatedAt)
        VALUES
          (@id, @tenantId, @branchId, @ruleId, @type, @status, @summary, @suggestionsCreated, @createdAt, @updatedAt)
      `).run({ ...run, summary: JSON.stringify(run.summary) });
      const insert = db.prepare(`
        INSERT INTO ai_automation_suggestions
          (id, tenantId, branchId, ruleId, runId, type, targetType, targetId, title, message, payload, status, createdAt, updatedAt)
        VALUES
          (@id, @tenantId, @branchId, @ruleId, @runId, @type, @targetType, @targetId, @title, @message, @payload, @status, @createdAt, @updatedAt)
      `);
      suggestions.forEach((suggestion) => insert.run({ ...suggestion, payload: JSON.stringify(suggestion.payload) }));
      if (rule?.id) {
        db.prepare("UPDATE ai_automation_rules SET lastRunAt = ?, updatedAt = ? WHERE id = ? AND tenantId = ?")
          .run(stamp, stamp, rule.id, access.tenantId);
      }
      db.prepare(`
        INSERT INTO ai_interactions
          (id, tenantId, branchId, type, prompt, input, context, output, actions, model, status, confidence, createdAt, updatedAt)
        VALUES
          (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      `).run(
        makeId("ai"),
        access.tenantId,
        run.branchId,
        "ai-automation-run",
        type,
        JSON.stringify({ type, ruleId: run.ruleId }),
        JSON.stringify({ branchId: run.branchId }),
        JSON.stringify(run.summary),
        JSON.stringify(["review-suggestions"]),
        "local-business-rules",
        "completed",
        0.82,
        stamp,
        stamp
      );
    })();
    return { run, suggestions, autoSend: false };
  }

  listSuggestions(query = {}, access) {
    const status = String(query.status || "all");
    const branchId = String(query.branchId || access.branchId || "");
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const params = branchId ? [access.tenantId, branchId] : [access.tenantId];
    let sql = `SELECT * FROM ai_automation_suggestions WHERE tenantId = ? ${branchClause(branchId)}`;
    if (status !== "all") {
      sql += " AND status = ?";
      params.push(status);
    }
    sql += " ORDER BY createdAt DESC LIMIT ?";
    params.push(Math.min(Number(query.limit) || 100, 300));
    return db.prepare(sql).all(...params).map(rowToSuggestion);
  }

  updateSuggestion(id, payload = {}, access) {
    const row = db.prepare("SELECT * FROM ai_automation_suggestions WHERE id = ? AND tenantId = ?").get(id, access.tenantId);
    if (!row) throw notFound("AI automation suggestion not found");
    if (row.branchId) tenantService.assertBranchAccess(access, row.branchId);
    const status = String(payload.status || "approved");
    const stamp = now();
    db.prepare("UPDATE ai_automation_suggestions SET status = ?, updatedAt = ? WHERE id = ? AND tenantId = ?")
      .run(status, stamp, id, access.tenantId);
    return rowToSuggestion(db.prepare("SELECT * FROM ai_automation_suggestions WHERE id = ? AND tenantId = ?").get(id, access.tenantId));
  }
}

export const aiAutomationService = new AiAutomationService();
