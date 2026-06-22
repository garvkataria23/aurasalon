import { randomUUID } from "node:crypto";
import { db } from "../../db.js";
import { forbidden } from "../../utils/app-error.js";

const now = () => new Date().toISOString();
const makeId = (prefix) => `${prefix}_${randomUUID().slice(0, 10)}`;

const DEFAULT_TASKS = [
  "review.reply",
  "marketing.caption",
  "analytics.summary",
  "customer360.health_score",
  "customer360.churn_risk",
  "customer360.next_best_action",
  "customer360.upsell_recommendation",
  "customer360.rebooking_recommendation",
  "calendar.smart_slot_score",
  "calendar.no_show_risk",
  "calendar.conflict_doctor",
  "calendar.revenue_gap_filler",
  "calendar.staff_load_signal",
  "calendar.delay_prediction",
  "calendar.booking_quality_score",
  "pos.smart_upsell",
  "pos.membership_suggestion",
  "pos.discount_guard",
  "pos.payment_recovery",
  "pos.cart_profitability",
  "inventory.reorder_prediction",
  "inventory.expiry_waste_risk",
  "inventory.service_stock_readiness",
  "inventory.low_stock_reason",
  "inventory.purchase_plan",
  "whatsapp.intent_detection",
  "whatsapp.reply_generation",
  "whatsapp.followup_draft",
  "whatsapp.rebooking_draft",
  "whatsapp.payment_reminder_draft",
  "whatsapp.agent_triage",
  "dashboard.executive_summary",
  "dashboard.risk_briefing",
  "dashboard.revenue_actions",
  "dashboard.owner_daily_brief",
  "knowledge.search_summary",
  "automation.suggestion",
  "prediction.client_churn",
  "prediction.no_show",
  "prediction.demand_forecast",
  "prediction.inventory_stockout",
  "prediction.revenue_leakage"
];

function toBool(value, fallback = true) {
  if (value === undefined || value === null || value === "") return fallback;
  return value === true || value === 1 || value === "1" || value === "true";
}

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function normalizeSettings(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    dailyCallLimit: Number(row.dailyCallLimit ?? 10000),
    dailyCostLimitUsd: Number(row.dailyCostLimitUsd ?? 5),
    providerMode: row.providerMode || process.env.AI_PROVIDER || "local",
    fallbackMode: row.fallbackMode || "local-business-rules",
    enabled: Boolean(Number(row.enabled ?? 1)),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function normalizeOverride(row) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    taskKey: row.taskKey,
    enabled: Boolean(Number(row.enabled ?? 1)),
    allowedRoles: parseJson(row.allowedRoles, []),
    blockedRoles: parseJson(row.blockedRoles, []),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

export class AiGovernanceService {
  ensureSettings(tenantId) {
    const found = db.prepare("SELECT * FROM ai_tenant_settings WHERE tenantId = ?").get(tenantId);
    if (found) return normalizeSettings(found);
    const stamp = now();
    const row = {
      id: makeId("ai_set"),
      tenantId,
      dailyCallLimit: Number(process.env.AI_DAILY_CALL_LIMIT || 10000),
      dailyCostLimitUsd: Number(process.env.AI_DAILY_COST_LIMIT_USD || 5),
      providerMode: process.env.AI_PROVIDER || "local",
      fallbackMode: "local-business-rules",
      enabled: 1,
      createdAt: stamp,
      updatedAt: stamp
    };
    db.prepare(`
      INSERT INTO ai_tenant_settings
        (id, tenantId, dailyCallLimit, dailyCostLimitUsd, providerMode, fallbackMode, enabled, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @dailyCallLimit, @dailyCostLimitUsd, @providerMode, @fallbackMode, @enabled, @createdAt, @updatedAt)
    `).run(row);
    return normalizeSettings(row);
  }

  usage(tenantId) {
    const today = now().slice(0, 10);
    const row = db.prepare(`
      SELECT COUNT(*) AS calls, COALESCE(SUM(cost_usd), 0) AS costUsd
      FROM ai_cost_ledger
      WHERE tenantId = ? AND substr(created_at, 1, 10) = ?
    `).get(tenantId, today);
    return {
      callsToday: Number(row?.calls || 0),
      costTodayUsd: Number(row?.costUsd || 0)
    };
  }

  settings(access) {
    const settings = this.ensureSettings(access.tenantId);
    const usage = this.usage(access.tenantId);
    return {
      ...settings,
      usage: {
        ...usage,
        callsRemaining: Math.max(0, settings.dailyCallLimit - usage.callsToday),
        costRemainingUsd: Math.max(0, settings.dailyCostLimitUsd - usage.costTodayUsd)
      }
    };
  }

  updateSettings(payload = {}, access) {
    const current = this.ensureSettings(access.tenantId);
    const stamp = now();
    const data = {
      ...current,
      dailyCallLimit: Math.max(0, Number(payload.dailyCallLimit ?? current.dailyCallLimit)),
      dailyCostLimitUsd: Math.max(0, Number(payload.dailyCostLimitUsd ?? current.dailyCostLimitUsd)),
      providerMode: payload.providerMode || current.providerMode,
      fallbackMode: payload.fallbackMode || current.fallbackMode,
      enabled: toBool(payload.enabled, current.enabled) ? 1 : 0,
      updatedAt: stamp
    };
    db.prepare(`
      UPDATE ai_tenant_settings
      SET dailyCallLimit = @dailyCallLimit,
          dailyCostLimitUsd = @dailyCostLimitUsd,
          providerMode = @providerMode,
          fallbackMode = @fallbackMode,
          enabled = @enabled,
          updatedAt = @updatedAt
      WHERE tenantId = @tenantId
    `).run(data);
    return this.settings(access);
  }

  taskOverride(taskKey, tenantId) {
    const row = db.prepare("SELECT * FROM ai_task_overrides WHERE tenantId = ? AND taskKey = ?").get(tenantId, taskKey);
    return row ? normalizeOverride(row) : null;
  }

  listTaskOverrides(_query = {}, access) {
    const rows = db.prepare("SELECT * FROM ai_task_overrides WHERE tenantId = ? ORDER BY taskKey").all(access.tenantId);
    const byTask = new Map(rows.map((row) => [row.taskKey, normalizeOverride(row)]));
    return {
      tasks: DEFAULT_TASKS.map((taskKey) => byTask.get(taskKey) || {
        id: "",
        tenantId: access.tenantId,
        taskKey,
        enabled: true,
        allowedRoles: [],
        blockedRoles: [],
        createdAt: "",
        updatedAt: ""
      })
    };
  }

  updateTaskOverride(taskKey, payload = {}, access) {
    const existing = this.taskOverride(taskKey, access.tenantId);
    const stamp = now();
    const data = {
      id: existing?.id || makeId("ai_task"),
      tenantId: access.tenantId,
      taskKey,
      enabled: toBool(payload.enabled, existing?.enabled ?? true) ? 1 : 0,
      allowedRoles: JSON.stringify(Array.isArray(payload.allowedRoles) ? payload.allowedRoles : existing?.allowedRoles || []),
      blockedRoles: JSON.stringify(Array.isArray(payload.blockedRoles) ? payload.blockedRoles : existing?.blockedRoles || []),
      createdAt: existing?.createdAt || stamp,
      updatedAt: stamp
    };
    db.prepare(`
      INSERT INTO ai_task_overrides
        (id, tenantId, taskKey, enabled, allowedRoles, blockedRoles, createdAt, updatedAt)
      VALUES
        (@id, @tenantId, @taskKey, @enabled, @allowedRoles, @blockedRoles, @createdAt, @updatedAt)
      ON CONFLICT(tenantId, taskKey) DO UPDATE SET
        enabled = excluded.enabled,
        allowedRoles = excluded.allowedRoles,
        blockedRoles = excluded.blockedRoles,
        updatedAt = excluded.updatedAt
    `).run(data);
    return { task: this.taskOverride(taskKey, access.tenantId) };
  }

  logDenial({ tenantId, branchId = "", taskKey, role = "", reason, details = {} }) {
    if (!tenantId || !taskKey || !reason) return null;
    const row = {
      id: makeId("ai_denial"),
      tenantId,
      branchId,
      taskKey,
      role,
      reason,
      details: JSON.stringify(details || {}),
      createdAt: now()
    };
    db.prepare(`
      INSERT INTO ai_policy_denials
        (id, tenantId, branchId, taskKey, role, reason, details, createdAt)
      VALUES
        (@id, @tenantId, @branchId, @taskKey, @role, @reason, @details, @createdAt)
    `).run(row);
    return row;
  }

  listDenials(query = {}, access) {
    const limit = Math.min(Number(query.limit) || 50, 200);
    const rows = db.prepare(`
      SELECT *
      FROM ai_policy_denials
      WHERE tenantId = ?
      ORDER BY createdAt DESC
      LIMIT ?
    `).all(access.tenantId, limit);
    return {
      denials: rows.map((row) => ({ ...row, details: parseJson(row.details, {}) }))
    };
  }

  denialsToday(tenantId) {
    const today = now().slice(0, 10);
    return Number(db.prepare(`
      SELECT COUNT(*) AS count
      FROM ai_policy_denials
      WHERE tenantId = ? AND substr(createdAt, 1, 10) = ?
    `).get(tenantId, today)?.count || 0);
  }

  assertTaskOverride({ taskKey, tenantId, branchId = "", role = "" }) {
    const settings = this.ensureSettings(tenantId);
    if (!settings.enabled) {
      this.logDenial({ tenantId, branchId, taskKey, role, reason: "AI is disabled for this tenant" });
      throw forbidden("AI is disabled for this tenant");
    }
    const override = this.taskOverride(taskKey, tenantId);
    if (!override) return true;
    if (!override.enabled) {
      this.logDenial({ tenantId, branchId, taskKey, role, reason: "AI task is disabled" });
      throw forbidden("AI task is disabled");
    }
    if (override.blockedRoles.includes(role)) {
      this.logDenial({ tenantId, branchId, taskKey, role, reason: "AI role override denied access" });
      throw forbidden("AI role override denied access");
    }
    if (override.allowedRoles.length && !override.allowedRoles.includes(role)) {
      this.logDenial({ tenantId, branchId, taskKey, role, reason: "AI role override requires another role" });
      throw forbidden("AI role override requires another role");
    }
    return true;
  }

  enforceUsageLimit({ tenantId, branchId = "", taskKey, role = "" }) {
    const settings = this.ensureSettings(tenantId);
    const usage = this.usage(tenantId);
    if (settings.dailyCallLimit >= 0 && usage.callsToday >= settings.dailyCallLimit) {
      this.logDenial({ tenantId, branchId, taskKey, role, reason: "AI daily call limit exceeded", details: usage });
      throw forbidden("AI daily call limit exceeded");
    }
    if (settings.dailyCostLimitUsd >= 0 && usage.costTodayUsd >= settings.dailyCostLimitUsd) {
      this.logDenial({ tenantId, branchId, taskKey, role, reason: "AI daily cost limit exceeded", details: usage });
      throw forbidden("AI daily cost limit exceeded");
    }
    return true;
  }
}

export const aiGovernanceService = new AiGovernanceService();
