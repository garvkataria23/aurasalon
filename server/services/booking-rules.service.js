import { db } from "../db.js";

function parseJson(value, fallback = {}) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function minutesUntil(dateValue) {
  return Math.floor((new Date(dateValue).getTime() - Date.now()) / 60000);
}

function rowsFor(tenantId, branchId = "") {
  return db.prepare(
    `SELECT * FROM booking_rules
     WHERE tenantId = ?
       AND isActive = 1
       AND (branchId = '' OR branchId = ?)
     ORDER BY priority ASC, createdAt ASC`
  ).all(tenantId, branchId);
}

export const bookingRulesService = {
  evaluateRules(context = {}) {
    const violations = [];
    const requiredActions = [];
    const rules = rowsFor(context.tenantId, context.branchId);
    const startAt = context.startAt || context.slot?.startAt || context.slot?.startTime;

    for (const rule of rules) {
      const config = parseJson(rule.ruleConfig);
      if (rule.ruleType === "same_day_booking_cutoff" && startAt) {
        const sameDay = new Date(startAt).toISOString().slice(0, 10) === new Date().toISOString().slice(0, 10);
        const cutoff = config.cutoffTime || "18:00";
        if (sameDay && new Date().toTimeString().slice(0, 5) > cutoff) {
          violations.push({ ruleId: rule.id, ruleType: rule.ruleType, message: `Same-day booking cutoff crossed at ${cutoff}` });
        }
      }
      if (rule.ruleType === "minimum_advance_booking" && startAt) {
        const minMinutes = Number(config.minutes || config.minMinutes || 0);
        if (minMinutes && minutesUntil(startAt) < minMinutes) {
          violations.push({ ruleId: rule.id, ruleType: rule.ruleType, message: `Booking requires ${minMinutes} minutes advance notice` });
        }
      }
      if (rule.ruleType === "maximum_advance_booking" && startAt) {
        const maxDays = Number(config.days || config.maxDays || 0);
        if (maxDays && minutesUntil(startAt) > maxDays * 24 * 60) {
          violations.push({ ruleId: rule.id, ruleType: rule.ruleType, message: `Booking cannot be more than ${maxDays} days ahead` });
        }
      }
      if (rule.ruleType === "deposit_required") {
        const deposit = this.isDepositRequired({ ...context, rules: [rule] });
        if (deposit.required) requiredActions.push({ type: "deposit", ...deposit });
      }
    }

    return { allowed: violations.length === 0, violations, requiredActions };
  },

  isDepositRequired(context = {}) {
    const rules = context.rules || rowsFor(context.tenantId, context.branchId).filter((rule) => rule.ruleType === "deposit_required");
    const totalAmount = Number(context.totalAmount || 0);
    const isFirstTime = Boolean(context.isFirstTime);
    const tier = context.customerTier || "bronze";
    const noShowCount = Number(context.noShowCount || 0);

    for (const rule of rules) {
      const config = parseJson(rule.ruleConfig);
      if (config.exemptTiers?.includes?.(tier)) return { required: false, amount: 0, currency: "INR", reason: "tier_exempt", ruleId: rule.id };
      if (noShowCount >= Number(config.fullPrepayNoShowCount || 99)) {
        return { required: true, amount: totalAmount, currency: "INR", reason: "no_show_history", ruleId: rule.id };
      }
      if (isFirstTime && Number(config.newClientAmount || 0) > 0) {
        return { required: true, amount: Number(config.newClientAmount), currency: "INR", reason: "new_client_deposit", ruleId: rule.id };
      }
      if (totalAmount >= Number(config.highValueThreshold || Infinity)) {
        const pct = Number(config.highValuePct || config.percent || 25);
        return { required: true, amount: Math.round((totalAmount * pct) / 100), currency: "INR", reason: "high_value_service_deposit", ruleId: rule.id };
      }
      if (Number(config.defaultPct || 0) > 0) {
        return { required: true, amount: Math.round((totalAmount * Number(config.defaultPct)) / 100), currency: "INR", reason: "default_deposit_rule", ruleId: rule.id };
      }
    }
    return { required: false, amount: 0, currency: "INR", reason: "not_required" };
  },

  getCancellationPolicy(tenantId, branchId = "") {
    const rule = rowsFor(tenantId, branchId).find((item) => item.ruleType === "cancellation_policy");
    return parseJson(rule?.ruleConfig, { freeCancellationHours: 24, noRefundHours: 2 });
  },

  getReschedulePolicy(tenantId, branchId = "") {
    const rule = rowsFor(tenantId, branchId).find((item) => item.ruleType === "reschedule_policy");
    return parseJson(rule?.ruleConfig, { maxReschedules: 2, minAdvanceHours: 2, maxWindowDays: 30 });
  }
};
