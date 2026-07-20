import crypto from "node:crypto";
import { db } from "../db.js";
import { tenantService } from "./tenant.service.js";
import { ensureProfitActionQueueSchema } from "./profit-action-queue-schema.service.js";
import { ensureProfitGovernanceSchema } from "./profit-governance-schema.service.js";

const DEFAULT_RULES = [
  {
    ruleType: "margin_safe_discount",
    title: "Margin-safe discount approval",
    description: "Discount ke baad minimum net margin protect karta hai.",
    minMarginBps: 1500,
    maxDiscountBps: 2000,
    maxImpactPaise: 100000,
    approvalRequired: 1,
    autoExecuteAllowed: 0,
    auditRequired: 1,
    severity: "high"
  },
  {
    ruleType: "negative_margin_block",
    title: "Negative margin prevention",
    description: "Invoice/service net loss me ja raha ho to block karta hai.",
    minMarginBps: 0,
    maxDiscountBps: 10000,
    maxImpactPaise: 0,
    approvalRequired: 1,
    autoExecuteAllowed: 0,
    auditRequired: 1,
    severity: "critical"
  },
  {
    ruleType: "profit_action_governance",
    title: "Profit action approval policy",
    description: "High-impact price, membership, recipe aur discount actions owner approval ke through chalate hain.",
    minMarginBps: 1200,
    maxDiscountBps: 1800,
    maxImpactPaise: 200000,
    approvalRequired: 1,
    autoExecuteAllowed: 0,
    auditRequired: 1,
    severity: "medium"
  }
];

const ACTION_RULE_TYPES = new Set([
  "pricing_recommendation",
  "discount_abuse",
  "high_wastage",
  "membership_liability_risk",
  "low_margin_service",
  "high_expense"
]);

function id(prefix = "pg") {
  return `${prefix}_${crypto.randomUUID().slice(0, 10)}`;
}

function nowIso() {
  return new Date().toISOString();
}

function json(value = {}) {
  return JSON.stringify(value || {});
}

function parseJson(value = "{}") {
  try {
    return JSON.parse(value || "{}");
  } catch {
    return {};
  }
}

function intValue(value, fallback = 0) {
  const number = Number(value);
  return Number.isFinite(number) ? Math.round(number) : fallback;
}

function boolInt(value, fallback = false) {
  if (value === undefined || value === null || value === "") return fallback ? 1 : 0;
  return value === true || value === 1 || value === "1" || value === "true" ? 1 : 0;
}

function marginBps(amountPaise, basePaise) {
  if (!basePaise) return 0;
  return Math.round((Number(amountPaise || 0) / Number(basePaise || 1)) * 10000);
}

function scope(access = {}, source = {}) {
  const branchId = String(source.branchId ?? access.branchId ?? "").trim();
  if (branchId) tenantService.assertBranchAccess(access, branchId);
  return {
    tenantId: String(access.tenantId || "default"),
    branchId
  };
}

function ruleRow(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    ruleType: row.ruleType,
    title: row.title,
    description: row.description,
    enabled: Number(row.enabled || 0) === 1,
    minMarginBps: Number(row.minMarginBps || 0),
    maxDiscountBps: Number(row.maxDiscountBps || 0),
    maxImpactPaise: Number(row.maxImpactPaise || 0),
    approvalRequired: Number(row.approvalRequired || 0) === 1,
    autoExecuteAllowed: Number(row.autoExecuteAllowed || 0) === 1,
    auditRequired: Number(row.auditRequired || 0) === 1,
    severity: row.severity || "medium",
    payload: parseJson(row.payloadJson),
    createdAt: row.createdAt,
    updatedAt: row.updatedAt
  };
}

function auditRow(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenantId,
    branchId: row.branchId,
    ruleId: row.ruleId,
    sourceType: row.sourceType,
    sourceId: row.sourceId,
    decision: row.decision,
    status: row.status,
    marginBps: Number(row.marginBps || 0),
    discountBps: Number(row.discountBps || 0),
    impactPaise: Number(row.impactPaise || 0),
    message: row.message,
    payload: parseJson(row.payloadJson),
    createdAt: row.createdAt
  };
}

export class ProfitGovernanceService {
  ensureDefaultRules(access = {}) {
    ensureProfitGovernanceSchema();
    const scoped = scope(access);
    for (const rule of DEFAULT_RULES) {
      const row = {
        id: id("pgr"),
        ...scoped,
        ...rule,
        enabled: 1,
        payloadJson: json({ systemDefault: true }),
        createdAt: nowIso(),
        updatedAt: nowIso()
      };
      db.prepare(`
        INSERT INTO profit_governance_rules (
          id, tenantId, branchId, ruleType, title, description, enabled, minMarginBps,
          maxDiscountBps, maxImpactPaise, approvalRequired, autoExecuteAllowed,
          auditRequired, severity, payloadJson, createdAt, updatedAt
        ) VALUES (
          @id, @tenantId, @branchId, @ruleType, @title, @description, @enabled, @minMarginBps,
          @maxDiscountBps, @maxImpactPaise, @approvalRequired, @autoExecuteAllowed,
          @auditRequired, @severity, @payloadJson, @createdAt, @updatedAt
        )
        ON CONFLICT(tenantId, branchId, ruleType) DO NOTHING
      `).run(row);
    }
  }

  listRules(query = {}, access = {}) {
    this.ensureDefaultRules({ ...access, branchId: query.branchId ?? access.branchId });
    const scoped = scope(access, query);
    const rows = db.prepare(`
      SELECT *
      FROM profit_governance_rules
      WHERE tenantId = @tenantId
        AND (@branchId = '' OR branchId = @branchId)
      ORDER BY enabled DESC, CASE severity WHEN 'critical' THEN 0 WHEN 'high' THEN 1 WHEN 'medium' THEN 2 ELSE 3 END, updatedAt DESC
    `).all(scoped);
    return rows.map(ruleRow);
  }

  upsertRule(payload = {}, access = {}) {
    ensureProfitGovernanceSchema();
    const scoped = scope(access, payload);
    const row = {
      id: payload.id || id("pgr"),
      ...scoped,
      ruleType: String(payload.ruleType || "margin_safe_discount"),
      title: String(payload.title || "Profit governance rule"),
      description: String(payload.description || ""),
      enabled: boolInt(payload.enabled, true),
      minMarginBps: intValue(payload.minMarginBps, 0),
      maxDiscountBps: intValue(payload.maxDiscountBps, 0),
      maxImpactPaise: intValue(payload.maxImpactPaise, 0),
      approvalRequired: boolInt(payload.approvalRequired, true),
      autoExecuteAllowed: boolInt(payload.autoExecuteAllowed, false),
      auditRequired: boolInt(payload.auditRequired, true),
      severity: String(payload.severity || "medium"),
      payloadJson: json(payload.payload || {}),
      createdAt: nowIso(),
      updatedAt: nowIso()
    };
    db.prepare(`
      INSERT INTO profit_governance_rules (
        id, tenantId, branchId, ruleType, title, description, enabled, minMarginBps,
        maxDiscountBps, maxImpactPaise, approvalRequired, autoExecuteAllowed,
        auditRequired, severity, payloadJson, createdAt, updatedAt
      ) VALUES (
        @id, @tenantId, @branchId, @ruleType, @title, @description, @enabled, @minMarginBps,
        @maxDiscountBps, @maxImpactPaise, @approvalRequired, @autoExecuteAllowed,
        @auditRequired, @severity, @payloadJson, @createdAt, @updatedAt
      )
      ON CONFLICT(tenantId, branchId, ruleType) DO UPDATE SET
        title = excluded.title,
        description = excluded.description,
        enabled = excluded.enabled,
        minMarginBps = excluded.minMarginBps,
        maxDiscountBps = excluded.maxDiscountBps,
        maxImpactPaise = excluded.maxImpactPaise,
        approvalRequired = excluded.approvalRequired,
        autoExecuteAllowed = excluded.autoExecuteAllowed,
        auditRequired = excluded.auditRequired,
        severity = excluded.severity,
        payloadJson = excluded.payloadJson,
        updatedAt = excluded.updatedAt
    `).run(row);
    const saved = db.prepare(`
      SELECT * FROM profit_governance_rules
      WHERE tenantId = @tenantId AND branchId = @branchId AND ruleType = @ruleType
    `).get(row);
    return ruleRow(saved);
  }

  evaluateDiscount(payload = {}, access = {}) {
    const scoped = scope(access, payload);
    const rules = this.listRules(scoped, access).filter((rule) => rule.enabled);
    const guardRule = rules.find((rule) => rule.ruleType === "margin_safe_discount") || rules[0] || {};
    const negativeRule = rules.find((rule) => rule.ruleType === "negative_margin_block") || guardRule;
    const grossAmountPaise = intValue(payload.grossAmountPaise, 0);
    const discountPaise = intValue(payload.discountPaise, 0);
    const productCostPaise = intValue(payload.productCostPaise, 0);
    const staffCostPaise = intValue(payload.staffCostPaise, 0);
    const membershipRedemptionPaise = intValue(payload.membershipRedemptionPaise, 0);
    const netAmountPaise = Math.max(0, grossAmountPaise - discountPaise);
    const estimatedProfitPaise = netAmountPaise - productCostPaise - staffCostPaise - membershipRedemptionPaise;
    const margin = marginBps(estimatedProfitPaise, grossAmountPaise);
    const discount = marginBps(discountPaise, grossAmountPaise);
    const impactPaise = Math.max(discountPaise, estimatedProfitPaise < 0 ? Math.abs(estimatedProfitPaise) : 0);
    const triggered = [];
    if (estimatedProfitPaise < 0) triggered.push({ rule: negativeRule, reason: "negative_margin" });
    if (guardRule.minMarginBps && margin < guardRule.minMarginBps) triggered.push({ rule: guardRule, reason: "margin_below_floor" });
    if (guardRule.maxDiscountBps && discount > guardRule.maxDiscountBps) triggered.push({ rule: guardRule, reason: "discount_above_limit" });
    if (guardRule.maxImpactPaise && impactPaise > guardRule.maxImpactPaise) triggered.push({ rule: guardRule, reason: "impact_above_limit" });
    const first = triggered[0] || { rule: guardRule, reason: "within_policy" };
    const blocked = estimatedProfitPaise < 0;
    const requiresApproval = !blocked && triggered.some((item) => item.rule?.approvalRequired);
    const allowed = !blocked && !requiresApproval;
    const riskLevel = blocked ? "critical" : requiresApproval ? (first.rule?.severity || "high") : "low";
    const message = blocked
      ? "Discount ke baad estimated profit negative hai; invoice block ya owner override required."
      : requiresApproval
        ? "Margin-safe policy approval required hai before discount apply."
        : "Discount margin-safe policy ke andar hai.";
    const decision = {
      ...scoped,
      ruleId: first.rule?.id || "",
      sourceType: String(payload.sourceType || "margin_safe_discount"),
      sourceId: String(payload.sourceId || payload.invoiceId || payload.serviceId || id("discount")),
      decision: blocked ? "blocked" : requiresApproval ? "approval_required" : "allowed",
      status: blocked ? "blocked" : requiresApproval ? "pending_approval" : "allowed",
      marginBps: margin,
      discountBps: discount,
      impactPaise,
      message,
      payload: {
        ...payload,
        grossAmountPaise,
        discountPaise,
        productCostPaise,
        staffCostPaise,
        membershipRedemptionPaise,
        estimatedProfitPaise,
        triggered: triggered.map((item) => item.reason)
      }
    };
    const auditRequired = triggered.some((item) => item.rule?.auditRequired) || Boolean(guardRule.auditRequired);
    const auditId = auditRequired ? this.auditDecision(decision, access).id : "";
    if (requiresApproval || blocked) this.ensureApprovalAction({ ...decision, auditId, title: "Review margin-safe discount approval" }, access);
    return {
      allowed,
      requiresApproval,
      blocked,
      marginBps: margin,
      discountBps: discount,
      estimatedProfitPaise,
      riskLevel,
      ruleTriggered: first.rule ? { id: first.rule.id, ruleType: first.rule.ruleType, title: first.rule.title, reason: first.reason } : null,
      message,
      recommendedAction: blocked ? "Discount reduce karein, price adjust karein, ya owner override approval lein." : requiresApproval ? "Owner approval task action queue me review karein." : "Discount apply kar sakte hain.",
      auditId
    };
  }

  evaluateAction(payload = {}, access = {}) {
    const scoped = scope(access, payload);
    const action = this.actionRow(payload, scoped);
    const rules = this.listRules(scoped, access).filter((rule) => rule.enabled);
    const rule = rules.find((item) => item.ruleType === "profit_action_governance") || rules[0] || {};
    const impactPaise = intValue(action.impactPaise, 0);
    const sensitiveType = ACTION_RULE_TYPES.has(String(action.type || action.sourceType || ""));
    const approvalRequired = Boolean(rule.approvalRequired && (sensitiveType || impactPaise > Number(rule.maxImpactPaise || 0)));
    const autoExecuteAllowed = Boolean(rule.autoExecuteAllowed && !approvalRequired);
    const auditRequired = Boolean(rule.auditRequired);
    const riskLevel = approvalRequired ? (rule.severity || "medium") : "low";
    const decision = {
      ...scoped,
      ruleId: rule.id || "",
      sourceType: "profit_action",
      sourceId: action.id || payload.actionId || payload.sourceId || id("action"),
      decision: approvalRequired ? "approval_required" : autoExecuteAllowed ? "auto_execute_allowed" : "allowed",
      status: approvalRequired ? "pending_approval" : "allowed",
      marginBps: intValue(payload.marginBps, 0),
      discountBps: intValue(payload.discountBps, 0),
      impactPaise,
      message: approvalRequired ? "Profit action owner approval ke bina execute nahi hoga." : "Profit action governance policy ke andar hai.",
      payload: { ...payload, action }
    };
    if (auditRequired) this.auditDecision(decision, access);
    if (approvalRequired) this.ensureApprovalAction({ ...decision, title: `Approve ${action.title || action.type || "profit action"}` }, access);
    return {
      actionId: action.id || payload.actionId || "",
      governanceDecision: decision.decision,
      approvalRequired,
      autoExecuteAllowed,
      auditRequired,
      riskLevel,
      reason: decision.message,
      nextStep: approvalRequired ? "Owner approval queue review karein." : autoExecuteAllowed ? "Low-risk action auto-execute kar sakte hain." : "Manual execution allowed hai."
    };
  }

  auditDecision(decision = {}, access = {}) {
    ensureProfitGovernanceSchema();
    const scoped = scope(access, decision);
    const row = {
      id: id("pga"),
      ...scoped,
      ruleId: String(decision.ruleId || ""),
      sourceType: String(decision.sourceType || ""),
      sourceId: String(decision.sourceId || ""),
      decision: String(decision.decision || "allowed"),
      status: String(decision.status || "logged"),
      marginBps: intValue(decision.marginBps, 0),
      discountBps: intValue(decision.discountBps, 0),
      impactPaise: intValue(decision.impactPaise, 0),
      message: String(decision.message || ""),
      payloadJson: json(decision.payload || {}),
      createdAt: nowIso()
    };
    db.prepare(`
      INSERT INTO profit_governance_audit (
        id, tenantId, branchId, ruleId, sourceType, sourceId, decision, status,
        marginBps, discountBps, impactPaise, message, payloadJson, createdAt
      ) VALUES (
        @id, @tenantId, @branchId, @ruleId, @sourceType, @sourceId, @decision, @status,
        @marginBps, @discountBps, @impactPaise, @message, @payloadJson, @createdAt
      )
    `).run(row);
    return auditRow(row);
  }

  governanceSummary(query = {}, access = {}) {
    const scoped = scope(access, query);
    const rules = this.listRules(query, access);
    const today = nowIso().slice(0, 10);
    const params = { ...scoped, today: `${today}T00:00:00` };
    const counts = db.prepare(`
      SELECT
        SUM(CASE WHEN decision = 'approval_required' THEN 1 ELSE 0 END) AS approvalsRequired,
        SUM(CASE WHEN decision = 'blocked' AND createdAt >= @today THEN 1 ELSE 0 END) AS blockedToday,
        COUNT(*) AS auditCount
      FROM profit_governance_audit
      WHERE tenantId = @tenantId
        AND (@branchId = '' OR branchId = @branchId)
    `).get(params) || {};
    const recent = db.prepare(`
      SELECT *
      FROM profit_governance_audit
      WHERE tenantId = @tenantId
        AND (@branchId = '' OR branchId = @branchId)
      ORDER BY createdAt DESC
      LIMIT 8
    `).all(scoped).map(auditRow);
    const topRisks = db.prepare(`
      SELECT sourceType, sourceId, decision, message, MAX(impactPaise) AS impactPaise
      FROM profit_governance_audit
      WHERE tenantId = @tenantId
        AND (@branchId = '' OR branchId = @branchId)
        AND decision IN ('blocked','approval_required')
      GROUP BY sourceType, sourceId, decision, message
      ORDER BY impactPaise DESC
      LIMIT 5
    `).all(scoped);
    const defaultRule = rules.find((rule) => rule.ruleType === "margin_safe_discount") || {};
    return {
      rulesActive: rules.filter((rule) => rule.enabled).length,
      approvalsRequired: Number(counts.approvalsRequired || 0),
      blockedToday: Number(counts.blockedToday || 0),
      auditCount: Number(counts.auditCount || 0),
      topGovernanceRisks: topRisks.map((row) => ({ ...row, impactPaise: Number(row.impactPaise || 0) })),
      marginSafeDiscountDefaults: {
        minMarginBps: Number(defaultRule.minMarginBps || 0),
        maxDiscountBps: Number(defaultRule.maxDiscountBps || 0),
        maxImpactPaise: Number(defaultRule.maxImpactPaise || 0),
        approvalRequired: Boolean(defaultRule.approvalRequired),
        auditRequired: Boolean(defaultRule.auditRequired)
      },
      recentDecisions: recent
    };
  }

  actionRow(payload = {}, scoped = {}) {
    if (payload.actionId) {
      const row = db.prepare(`
        SELECT * FROM profit_action_queue
        WHERE id = @actionId
          AND tenantId = @tenantId
          AND (@branchId = '' OR branchId = @branchId)
        LIMIT 1
      `).get({ actionId: payload.actionId, ...scoped });
      if (row) return row;
    }
    return {
      id: payload.actionId || payload.sourceId || "",
      type: payload.type || payload.sourceType || "manual_profit_action",
      sourceType: payload.sourceType || payload.type || "manual_profit_action",
      title: payload.title || "Profit action",
      impactPaise: payload.impactPaise || 0
    };
  }

  ensureApprovalAction(decision = {}, access = {}) {
    ensureProfitActionQueueSchema();
    const scoped = scope(access, decision);
    const sourceType = `governance_${decision.sourceType || "decision"}`;
    const sourceId = decision.sourceId || decision.auditId || id("approval");
    const existing = db.prepare(`
      SELECT id FROM profit_action_queue
      WHERE tenantId = @tenantId
        AND branchId = @branchId
        AND sourceType = @sourceType
        AND sourceId = @sourceId
        AND status NOT IN ('completed','dismissed')
      LIMIT 1
    `).get({ ...scoped, sourceType, sourceId });
    if (existing) return existing.id;
    const row = {
      id: id("pqa"),
      ...scoped,
      type: "profit_governance_approval",
      title: decision.title || "Review profit governance approval",
      message: decision.message || "Owner approval required by profit governance policy.",
      impactPaise: intValue(decision.impactPaise, 0),
      priority: decision.decision === "blocked" ? "high" : "medium",
      status: "pending",
      sourceType,
      sourceId,
      payloadJson: json(decision),
      createdAt: nowIso(),
      updatedAt: nowIso(),
      approvedAt: "",
      completedAt: ""
    };
    db.prepare(`
      INSERT INTO profit_action_queue (
        id, tenantId, branchId, type, title, message, impactPaise, priority, status,
        sourceType, sourceId, payloadJson, createdAt, updatedAt, approvedAt, completedAt
      ) VALUES (
        @id, @tenantId, @branchId, @type, @title, @message, @impactPaise, @priority, @status,
        @sourceType, @sourceId, @payloadJson, @createdAt, @updatedAt, @approvedAt, @completedAt
      )
    `).run(row);
    return row.id;
  }
}

export const profitGovernanceService = new ProfitGovernanceService();
