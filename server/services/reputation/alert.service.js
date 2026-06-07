import { db } from "../../db.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import {
  assertBranch,
  auditDecision,
  branchFrom,
  emitEvent,
  makeId,
  now,
  parseJson,
  requireManager,
  requireTenant
} from "../enterprise-command-utils.js";

const VIRAL_RISK_PATTERN = /\b(viral|share|shared|warn others|warning everyone|social media|instagram|facebook|police|legal|consumer court)\b/i;
const NEGATIVE_SENTIMENTS = new Set(["very_negative", "negative"]);

export const reputationAlertService = {
  alerts(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId || "", limit: limit(query.limit, 50) };
    const filters = ["tenant_id = @tenant_id"];
    if (branchId) filters.push("branch_id = @branch_id");
    if (query.status === "open") filters.push("(acknowledged = 0 OR acknowledged IS NULL) AND (resolved_at IS NULL OR resolved_at = '')");
    if (query.status === "acknowledged") filters.push("acknowledged = 1 AND (resolved_at IS NULL OR resolved_at = '')");
    if (query.status === "resolved") filters.push("resolved_at IS NOT NULL AND resolved_at <> ''");
    if (query.severity) {
      filters.push("severity = @severity");
      params.severity = query.severity;
    }
    return db.prepare(
      `SELECT * FROM negative_review_alerts
       WHERE ${filters.join(" AND ")}
       ORDER BY created_at DESC
       LIMIT @limit`
    ).all(params).map(mapAlert);
  },

  acknowledgeAlert(id, payload = {}, access) {
    requireManager(access);
    const alert = this.alert(id, access);
    const stamp = now();
    db.prepare(
      `UPDATE negative_review_alerts
       SET acknowledged = 1,
           acknowledged_by = @acknowledged_by,
           acknowledged_at = @acknowledged_at,
           updated_at = @updated_at
       WHERE id = @id AND tenant_id = @tenant_id`
    ).run({
      acknowledged_by: payload.acknowledgedBy || access.userId || "",
      acknowledged_at: stamp,
      updated_at: stamp,
      id,
      tenant_id: access.tenantId
    });
    auditDecision("reputation.alert_acknowledged", "negative_review_alerts", id, access, { branchId: alert.branchId, details: payload });
    emitEvent("alert:acknowledged", access, alert.branchId, id, { reviewId: alert.reviewId });
    return this.alert(id, access);
  },

  resolveAlert(id, payload = {}, access) {
    requireManager(access);
    const alert = this.alert(id, access);
    const stamp = now();
    db.prepare(
      `UPDATE negative_review_alerts
       SET acknowledged = 1,
           acknowledged_by = COALESCE(NULLIF(acknowledged_by, ''), @resolved_by),
           acknowledged_at = COALESCE(NULLIF(acknowledged_at, ''), @resolved_at),
           resolution_action = @resolution_action,
           resolved_at = @resolved_at,
           resolved_by = @resolved_by,
           recovery_offer_sent = @recovery_offer_sent,
           recovery_offer_type = @recovery_offer_type,
           recovery_outcome = @recovery_outcome,
           updated_at = @updated_at
       WHERE id = @id AND tenant_id = @tenant_id`
    ).run({
      resolution_action: payload.resolutionAction || payload.resolution_action || "resolved",
      resolved_at: stamp,
      resolved_by: payload.resolvedBy || access.userId || "",
      recovery_offer_sent: payload.recoveryOfferSent || payload.recovery_offer_sent ? 1 : 0,
      recovery_offer_type: payload.recoveryOfferType || payload.recovery_offer_type || "",
      recovery_outcome: payload.recoveryOutcome || payload.recovery_outcome || "",
      updated_at: stamp,
      id,
      tenant_id: access.tenantId
    });
    auditDecision("reputation.alert_resolved", "negative_review_alerts", id, access, { branchId: alert.branchId, details: payload });
    emitEvent("alert:resolved", access, alert.branchId, id, { reviewId: alert.reviewId });
    return this.alert(id, access);
  },

  evaluateReview(review = {}, context = {}, access) {
    requireTenant(access);
    if (!review.id) throw badRequest("review.id is required");
    const branchId = review.branchId || review.branch_id || "";
    if (branchId) assertBranch(access, branchId);
    const triggers = this.triggersForReview(review, access);
    const alerts = triggers.map((trigger) => this.createAlertForTrigger(review, trigger, context, access)).filter(Boolean);
    if (alerts.length) emitEvent("reputation:score_updated", access, branchId, review.id, { source: context.source || "review_alert" });
    return { reviewId: review.id, alerts, triggers };
  },

  triggersForReview(review = {}, access) {
    const text = String(review.reviewText || review.review_text || review.title || "").trim();
    const sentiment = String(review.sentiment || "").toLowerCase();
    const rating = Number(review.rating || 0);
    const photos = Array.isArray(review.photos) ? review.photos : parseJson(review.photos_json, []);
    const topics = Array.isArray(review.topics) ? review.topics : parseJson(review.topics_json, []);
    const triggers = [];

    if (rating > 0 && rating <= 2) {
      triggers.push({ key: "negative_review", severity: "critical", event: "alert:negative_review", reason: "Rating is 2 stars or below" });
    }
    if (NEGATIVE_SENTIMENTS.has(sentiment)) {
      triggers.push({ key: "negative_sentiment", severity: "high", event: "alert:negative_review", reason: "Negative sentiment detected" });
    }
    if (VIRAL_RISK_PATTERN.test(text)) {
      triggers.push({ key: "viral_risk", severity: "critical", event: "alert:viral_risk", reason: "Viral-risk language detected" });
      triggers.push({ key: "viral_risk_detected", severity: "critical", event: "review:viral_risk_detected", reason: "Review includes viral-risk wording" });
    }
    if (photos.length && (rating <= 2 || NEGATIVE_SENTIMENTS.has(sentiment))) {
      triggers.push({ key: "negative_photo", severity: "critical", event: "alert:viral_risk", reason: "Negative review includes media" });
    }
    if (review.primaryStaffId || review.primary_staff_id) {
      const staffSignal = this.staffConcernSignal(review, access);
      if (staffSignal.triggered) triggers.push(staffSignal.trigger);
    }
    const patternSignal = this.negativePatternSignal(review, access);
    if (patternSignal.triggered) triggers.push(patternSignal.trigger);
    const topicSignal = this.topicPatternSignal(review, topics, access);
    if (topicSignal.triggered) triggers.push(topicSignal.trigger);

    return dedupeTriggers(triggers);
  },

  createAlertForTrigger(review = {}, trigger = {}, context = {}, access) {
    const branchId = review.branchId || review.branch_id || "";
    const existing = db.prepare(
      `SELECT * FROM negative_review_alerts
       WHERE tenant_id = ? AND review_id = ? AND severity = ? AND resolution_action = ?
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, review.id, trigger.severity, trigger.key);
    if (existing) return mapAlert(existing);

    const row = {
      id: makeId("ralert"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      review_id: review.id,
      severity: trigger.severity || "high",
      alert_sent_to: context.alertSentTo || "manager",
      alert_channel: context.alertChannel || "in_app",
      alert_sent_at: now(),
      acknowledged: 0,
      resolution_action: trigger.key,
      recovery_offer_sent: 0,
      created_at: now(),
      updated_at: now()
    };
    db.prepare(
      `INSERT INTO negative_review_alerts
       (id, tenant_id, branch_id, review_id, severity, alert_sent_to, alert_channel, alert_sent_at, acknowledged, resolution_action, recovery_offer_sent, created_at, updated_at)
       VALUES (@id, @tenant_id, @branch_id, @review_id, @severity, @alert_sent_to, @alert_channel, @alert_sent_at, @acknowledged, @resolution_action, @recovery_offer_sent, @created_at, @updated_at)`
    ).run(row);
    auditDecision("reputation.alert_created", "negative_review_alerts", row.id, access, {
      branchId,
      details: { reviewId: review.id, trigger: trigger.key, reason: trigger.reason, source: context.source || "" }
    });
    emitEvent(trigger.event || "alert:negative_review", access, branchId, row.id, { reviewId: review.id, trigger: trigger.key, reason: trigger.reason });
    return mapAlert(row);
  },

  alert(id, access) {
    requireTenant(access);
    const row = db.prepare("SELECT * FROM negative_review_alerts WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Reputation alert not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return mapAlert(row);
  },

  staffConcernSignal(review = {}, access) {
    const staffId = review.primaryStaffId || review.primary_staff_id || "";
    const branchId = review.branchId || review.branch_id || "";
    const count = Number(db.prepare(
      `SELECT COUNT(*) AS count
       FROM reviews_v2
       WHERE tenant_id = @tenant_id
         AND branch_id = @branch_id
         AND primary_staff_id = @staff_id
         AND (rating <= 2 OR LOWER(COALESCE(sentiment, '')) LIKE '%negative%')
         AND COALESCE(reviewed_at, imported_at, updated_at) >= @cutoff`
    ).get({ tenant_id: access.tenantId, branch_id: branchId, staff_id: staffId, cutoff: daysAgo(30) })?.count || 0);
    return {
      triggered: count >= 2,
      trigger: { key: "staff_concern", severity: "high", event: "alert:staff_concern", reason: "Same staff appears in 2+ negative reviews in 30 days" }
    };
  },

  negativePatternSignal(review = {}, access) {
    const branchId = review.branchId || review.branch_id || "";
    const count = Number(db.prepare(
      `SELECT COUNT(*) AS count
       FROM reviews_v2
       WHERE tenant_id = @tenant_id
         AND branch_id = @branch_id
         AND (rating <= 2 OR LOWER(COALESCE(sentiment, '')) LIKE '%negative%')
         AND COALESCE(reviewed_at, imported_at, updated_at) >= @cutoff`
    ).get({ tenant_id: access.tenantId, branch_id: branchId, cutoff: daysAgo(7) })?.count || 0);
    return {
      triggered: count >= 3,
      trigger: { key: "negative_pattern", severity: "critical", event: "alert:pattern_detected", reason: "3+ negative reviews in 7 days" }
    };
  },

  topicPatternSignal(review = {}, topics = [], access) {
    const branchId = review.branchId || review.branch_id || "";
    const normalizedTopics = topics.map((topic) => String(topic).toLowerCase()).filter(Boolean);
    if (!normalizedTopics.length) return { triggered: false };
    const rows = db.prepare(
      `SELECT topics_json
       FROM reviews_v2
       WHERE tenant_id = @tenant_id
         AND branch_id = @branch_id
         AND id <> @review_id
         AND (rating <= 3 OR LOWER(COALESCE(sentiment, '')) LIKE '%negative%')
         AND COALESCE(reviewed_at, imported_at, updated_at) >= @cutoff
       LIMIT 100`
    ).all({ tenant_id: access.tenantId, branch_id: branchId, review_id: review.id, cutoff: daysAgo(30) });
    const repeated = normalizedTopics.find((topic) => rows.filter((row) => parseJson(row.topics_json, []).map((value) => String(value).toLowerCase()).includes(topic)).length >= 2);
    return {
      triggered: Boolean(repeated),
      trigger: { key: "complaint_topic_repeated", severity: "high", event: "alert:pattern_detected", reason: repeated ? `Repeated complaint topic: ${repeated}` : "" }
    };
  }
};

function mapAlert(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    reviewId: row.review_id,
    severity: row.severity || "normal",
    alertSentTo: row.alert_sent_to || "",
    alertChannel: row.alert_channel || "",
    alertSentAt: row.alert_sent_at || "",
    acknowledged: Boolean(row.acknowledged),
    acknowledgedBy: row.acknowledged_by || "",
    acknowledgedAt: row.acknowledged_at || "",
    resolutionAction: row.resolution_action || "",
    resolvedAt: row.resolved_at || "",
    resolvedBy: row.resolved_by || "",
    recoveryOfferSent: Boolean(row.recovery_offer_sent),
    recoveryOfferType: row.recovery_offer_type || "",
    recoveryOutcome: row.recovery_outcome || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function dedupeTriggers(triggers = []) {
  const seen = new Set();
  return triggers.filter((trigger) => {
    const key = `${trigger.key}:${trigger.severity}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

function daysAgo(days) {
  return new Date(Date.now() - Number(days || 0) * 24 * 60 * 60 * 1000).toISOString();
}

function limit(value, fallback) {
  return Math.max(1, Math.min(Number(value || fallback), 500));
}
