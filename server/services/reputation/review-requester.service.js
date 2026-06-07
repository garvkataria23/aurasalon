import { db } from "../../db.js";
import { repositories } from "../../repositories/repository-registry.js";
import { badRequest, notFound } from "../../utils/app-error.js";
import { whatsappAutomationService } from "../whatsapp-automation.service.js";
import {
  assertBranch,
  auditDecision,
  branchFrom,
  emitEvent,
  makeId,
  now,
  parseJson,
  requireManager,
  requireTenant,
  toJson
} from "../enterprise-command-utils.js";
import { reputationAlertService } from "./alert.service.js";

const DEFAULT_TEMPLATE = "Hi {{customer_name}}, aaj {{branch_name}} me service kaisi rahi? Quick feedback do: {{feedback_link}}";
const COMPLETED_STATUSES = new Set(["completed", "done", "closed", "paid"]);
const BLOCKED_STATUSES = new Set(["cancelled", "canceled", "no-show", "complaint", "disputed", "refunded"]);

export const reviewRequesterService = {
  campaigns(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId || "", limit: limit(query.limit, 100) };
    const filters = ["tenant_id = @tenant_id"];
    if (branchId) filters.push("branch_id = @branch_id");
    if (query.isActive !== undefined) {
      filters.push("is_active = @is_active");
      params.is_active = boolInt(query.isActive);
    }
    return db.prepare(
      `SELECT * FROM review_request_campaigns
       WHERE ${filters.join(" AND ")}
       ORDER BY is_active DESC, created_at DESC
       LIMIT @limit`
    ).all(params).map(mapCampaign);
  },

  createCampaign(payload = {}, access) {
    requireManager(access);
    const branchId = branchFrom(payload, access);
    if (!branchId) throw badRequest("branchId is required for a review request campaign");
    assertBranch(access, branchId);
    const row = {
      id: payload.id || makeId("rrcamp"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      campaign_name: payload.campaignName || payload.campaign_name || "Post-appointment review request",
      trigger_type: payload.triggerType || payload.trigger_type || "appointment_completed",
      trigger_delay_hours: Number(payload.triggerDelayHours ?? payload.trigger_delay_hours ?? 2),
      channel: normalizeChannel(payload.channel || "auto"),
      message_template: payload.messageTemplate || payload.message_template || DEFAULT_TEMPLATE,
      target_platforms: toJson(payload.targetPlatforms || payload.target_platforms || ["google", "justdial"]),
      smart_routing: payload.smartRouting === false || payload.smart_routing === 0 ? 0 : 1,
      max_attempts: Math.max(1, Math.min(Number(payload.maxAttempts || payload.max_attempts || 2), 5)),
      incentive_json: toJson(payload.incentive || payload.incentive_json || {}),
      timing_rules_json: toJson(payload.timingRules || payload.timing_rules_json || {}),
      is_active: payload.isActive === false || payload.is_active === 0 ? 0 : 1,
      created_at: now(),
      updated_at: now()
    };
    db.prepare(
      `INSERT INTO review_request_campaigns
       (id, tenant_id, branch_id, campaign_name, trigger_type, trigger_delay_hours, channel, message_template, target_platforms, smart_routing, max_attempts, incentive_json, timing_rules_json, is_active, created_at, updated_at)
       VALUES (@id, @tenant_id, @branch_id, @campaign_name, @trigger_type, @trigger_delay_hours, @channel, @message_template, @target_platforms, @smart_routing, @max_attempts, @incentive_json, @timing_rules_json, @is_active, @created_at, @updated_at)`
    ).run(row);
    auditDecision("reputation.request_campaign_created", "review_request_campaigns", row.id, access, { branchId, details: { triggerType: row.trigger_type, channel: row.channel } });
    return mapCampaign(row);
  },

  sendForAppointment(appointmentId, payload = {}, access) {
    requireTenant(access);
    if (!appointmentId) throw badRequest("appointmentId is required");
    const appointment = repositories.appointments.getById(appointmentId, { tenantId: access.tenantId });
    if (!appointment) throw notFound("Appointment not found");
    const branchId = appointment.branchId || payload.branchId || "";
    if (branchId) assertBranch(access, branchId);

    const guard = this.appointmentSendGuard(appointment, payload);
    if (!guard.allowed) return { status: "skipped", reason: guard.reason, appointmentId, appointment };

    const campaign = payload.campaignId
      ? this.campaign(payload.campaignId, access)
      : this.activeCampaignForBranch(branchId, access);
    const maxAttempts = Number(campaign?.maxAttempts || 2);
    const idempotencyKey = payload.idempotencyKey || `review-request:${access.tenantId}:${branchId}:${appointmentId}:${campaign?.id || "default"}`;
    const existing = this.findSentByIdempotency(idempotencyKey, access);
    if (existing && !payload.retry) return { status: "already_sent", request: existing, appointment, campaign };
    if (existing && Number(existing.attemptCount || 0) >= maxAttempts) return { status: "stopped", reason: "max_attempts_reached", request: existing, appointment, campaign };

    const client = appointment.clientId ? repositories.clients.getById(appointment.clientId, { tenantId: access.tenantId }) : null;
    const branch = branchId ? repositories.branches.getById(branchId, { tenantId: access.tenantId }) : null;
    const channel = this.selectChannel(payload.channel || campaign?.channel || "auto", client);
    const routing = this.smartRouting(payload.rating ?? payload.npsRating, campaign);
    const requestRow = existing
      ? this.updateExistingRequest(existing, { channel, maxAttempts }, access)
      : this.createSentRequest({ campaign, appointment, branchId, channel, idempotencyKey }, access);
    const outbound = this.queueOutbound({ request: requestRow, appointment, campaign, client, branch, channel, routing }, access);

    auditDecision("reputation.review_request_sent", "review_requests_sent", requestRow.id, access, {
      branchId,
      details: { appointmentId, channel, routing, campaignId: campaign?.id || "" }
    });
    emitEvent("reputation:review_request_sent", access, branchId, requestRow.id, { appointmentId, channel, routeTo: routing.routeTo });
    return { status: "queued", request: requestRow, appointment, campaign, channel, routing, outbound };
  },

  internalFeedback(payload = {}, access) {
    requireTenant(access);
    const rating = Number(payload.rating || payload.score || payload.npsRating || 0);
    if (!rating || rating < 1 || rating > 5) throw badRequest("rating from 1 to 5 is required");
    const request = payload.requestId ? this.sentRequest(payload.requestId, access) : null;
    const appointment = payload.appointmentId
      ? repositories.appointments.getById(payload.appointmentId, { tenantId: access.tenantId })
      : request?.appointmentId
        ? repositories.appointments.getById(request.appointmentId, { tenantId: access.tenantId })
        : null;
    const branchId = payload.branchId || request?.branchId || appointment?.branchId || access.branchId || "";
    if (branchId) assertBranch(access, branchId);
    const customerId = payload.customerId || request?.customerId || appointment?.clientId || "";
    const platform = this.ensureInternalPlatform(branchId, access);
    const reviewId = this.upsertInternalReview({ payload, rating, request, appointment, branchId, customerId, platform }, access);
    const review = this.reviewForAlert(reviewId, access);

    if (request) {
      db.prepare(
        `UPDATE review_requests_sent
         SET opened = 1,
             opened_at = COALESCE(opened_at, @stamp),
             clicked = 1,
             clicked_at = COALESCE(clicked_at, @stamp),
             review_submitted = 1,
             submitted_platform = @submitted_platform,
             submitted_review_id = @submitted_review_id,
             updated_at = @stamp
         WHERE id = @id AND tenant_id = @tenant_id`
      ).run({ stamp: now(), submitted_platform: "internal", submitted_review_id: reviewId, id: request.id, tenant_id: access.tenantId });
    }

    auditDecision("reputation.internal_feedback_submitted", "reviews_v2", reviewId, access, { branchId, details: { rating, requestId: request?.id || "" } });
    emitEvent("review:new", access, branchId, reviewId, { rating, platformCode: "internal" });
    if (rating <= 2) emitEvent("review:new_negative", access, branchId, reviewId, { rating, platformCode: "internal" });
    if (rating >= 5) emitEvent("review:new_5star", access, branchId, reviewId, { rating, platformCode: "internal" });
    const alerts = reputationAlertService.evaluateReview(review, { source: "internal_feedback" }, access);
    return {
      status: rating <= 3 ? "internal_recovery" : "public_review_ready",
      routeTo: rating <= 3 ? "internal_feedback" : "public_platform",
      review,
      alerts
    };
  },

  appointmentSendGuard(appointment = {}, payload = {}) {
    const status = String(appointment.status || "").toLowerCase();
    if (BLOCKED_STATUSES.has(status)) return { allowed: false, reason: "appointment_cancelled_or_complaint" };
    if (!payload.force && status && !COMPLETED_STATUSES.has(status)) return { allowed: false, reason: "appointment_not_completed" };
    if (hasComplaintSignal(appointment, payload)) return { allowed: false, reason: "complaint_signal_present" };
    const completedAt = appointment.completedAt || appointment.endAt || "";
    const delayHours = Number(payload.triggerDelayHours ?? payload.trigger_delay_hours ?? 2);
    if (!payload.force && completedAt) {
      const dueAt = new Date(new Date(completedAt).getTime() + delayHours * 60 * 60 * 1000).toISOString();
      if (new Date(dueAt).getTime() > Date.now()) return { allowed: false, reason: "default_delay_not_elapsed", dueAt };
    }
    return { allowed: true };
  },

  activeCampaignForBranch(branchId, access) {
    if (branchId) assertBranch(access, branchId);
    const row = db.prepare(
      `SELECT * FROM review_request_campaigns
       WHERE tenant_id = ? AND branch_id = ? AND is_active = 1 AND trigger_type = 'appointment_completed'
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, branchId || "");
    return row ? mapCampaign(row) : defaultCampaign(branchId);
  },

  campaign(id, access) {
    requireTenant(access);
    const row = db.prepare("SELECT * FROM review_request_campaigns WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Review request campaign not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return mapCampaign(row);
  },

  sentRequest(id, access) {
    requireTenant(access);
    const row = db.prepare("SELECT * FROM review_requests_sent WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Review request not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return mapSent(row);
  },

  findSentByIdempotency(idempotencyKey, access) {
    if (!idempotencyKey) return null;
    const row = db.prepare("SELECT * FROM review_requests_sent WHERE tenant_id = ? AND idempotency_key = ? ORDER BY created_at DESC LIMIT 1").get(access.tenantId, idempotencyKey);
    return row ? mapSent(row) : null;
  },

  createSentRequest({ campaign, appointment, branchId, channel, idempotencyKey }, access) {
    const stamp = now();
    const row = {
      id: makeId("rrsent"),
      tenant_id: access.tenantId,
      branch_id: branchId || "",
      campaign_id: campaign?.id || "",
      customer_id: appointment.clientId || "",
      appointment_id: appointment.id,
      channel,
      attempt_count: 1,
      idempotency_key: idempotencyKey,
      sent_at: stamp,
      delivered: 0,
      opened: 0,
      clicked: 0,
      review_submitted: 0,
      created_at: stamp,
      updated_at: stamp
    };
    db.prepare(
      `INSERT INTO review_requests_sent
       (id, tenant_id, branch_id, campaign_id, customer_id, appointment_id, channel, attempt_count, idempotency_key, sent_at, delivered, opened, clicked, review_submitted, created_at, updated_at)
       VALUES (@id, @tenant_id, @branch_id, @campaign_id, @customer_id, @appointment_id, @channel, @attempt_count, @idempotency_key, @sent_at, @delivered, @opened, @clicked, @review_submitted, @created_at, @updated_at)`
    ).run(row);
    return mapSent(row);
  },

  updateExistingRequest(existing, { channel, maxAttempts }, access) {
    const attemptCount = Math.min(Number(existing.attemptCount || 0) + 1, maxAttempts);
    const stamp = now();
    db.prepare(
      `UPDATE review_requests_sent
       SET channel = @channel,
           attempt_count = @attempt_count,
           sent_at = @sent_at,
           updated_at = @updated_at
       WHERE id = @id AND tenant_id = @tenant_id`
    ).run({ channel, attempt_count: attemptCount, sent_at: stamp, updated_at: stamp, id: existing.id, tenant_id: access.tenantId });
    return this.sentRequest(existing.id, access);
  },

  queueOutbound({ request, appointment, campaign, client, branch, channel, routing }, access) {
    const data = {
      customer_name: client?.name || "there",
      branch_name: branch?.name || "Aura Salon",
      feedback_link: `/reputation/internal-feedback?requestId=${encodeURIComponent(request.id)}`,
      public_review_link: this.publicReviewLink(campaign)
    };
    const body = render(campaign?.messageTemplate || DEFAULT_TEMPLATE, data);
    if (channel === "whatsapp" && client?.phone) {
      const thread = whatsappAutomationService.ensureThread({
        phone: client.phone,
        displayName: client.name,
        client,
        branchId: appointment.branchId || request.branchId,
        source: "review-request"
      }, access);
      return whatsappAutomationService.createOutbound(thread, {
        body,
        eventType: "review-request",
        templateKey: "review_request",
        metadata: { requestId: request.id, appointmentId: appointment.id, routing }
      }, access);
    }
    return repositories.notifications.create({
      id: makeId("note"),
      clientId: client?.id || appointment.clientId || "",
      type: "review-request",
      channel: channel.toUpperCase(),
      message: body,
      status: `queued-${channel}`
    }, { tenantId: access.tenantId, branchId: appointment.branchId || request.branchId });
  },

  selectChannel(channel, client = null) {
    const requested = normalizeChannel(channel);
    if (requested !== "auto") return requested;
    if (client?.phone) return "whatsapp";
    if (client?.mobile || client?.phone) return "sms";
    if (client?.email) return "email";
    return "in_app";
  },

  smartRouting(score, campaign = null) {
    const rating = Number(score || 0);
    if (!campaign?.smartRouting) return { routeTo: "public_platform", reason: "smart_routing_disabled", rating };
    if (!rating) return { routeTo: "nps_gate", reason: "awaiting_customer_rating", rating: 0 };
    if (rating <= 3) return { routeTo: "internal_feedback", reason: "detractor_or_neutral_score", rating };
    return { routeTo: "public_platform", reason: "promoter_score", rating };
  },

  ensureInternalPlatform(branchId, access) {
    const existing = db.prepare(
      `SELECT * FROM review_platforms
       WHERE tenant_id = ? AND branch_id = ? AND platform_code = 'internal'
       ORDER BY created_at DESC
       LIMIT 1`
    ).get(access.tenantId, branchId || "");
    if (existing) return existing;
    const row = {
      id: makeId("rplat"),
      tenant_id: access.tenantId,
      branch_id: branchId || "",
      platform_code: "internal",
      platform_name: "Internal Feedback",
      auto_sync_enabled: 0,
      last_sync_status: "internal",
      rate_limit_per_day: 1000,
      provider_config_json: toJson({ providerStatus: "internal" }),
      is_active: 1,
      created_at: now(),
      updated_at: now()
    };
    db.prepare(
      `INSERT INTO review_platforms
       (id, tenant_id, branch_id, platform_code, platform_name, auto_sync_enabled, last_sync_status, rate_limit_per_day, provider_config_json, is_active, created_at, updated_at)
       VALUES (@id, @tenant_id, @branch_id, @platform_code, @platform_name, @auto_sync_enabled, @last_sync_status, @rate_limit_per_day, @provider_config_json, @is_active, @created_at, @updated_at)`
    ).run(row);
    return row;
  },

  upsertInternalReview({ payload, rating, request, appointment, branchId, customerId, platform }, access) {
    const platformReviewId = payload.platformReviewId || payload.platform_review_id || request?.id || `${appointment?.id || "manual"}:${customerId || "guest"}`;
    const existing = db.prepare(
      `SELECT id FROM reviews_v2
       WHERE tenant_id = ? AND platform_id = ? AND platform_review_id = ?
       LIMIT 1`
    ).get(access.tenantId, platform.id, platformReviewId);
    const sentiment = sentimentFromRating(rating);
    const stamp = now();
    const row = {
      id: existing?.id || makeId("review"),
      tenant_id: access.tenantId,
      branch_id: branchId || "",
      platform_id: platform.id,
      platform_review_id: platformReviewId,
      reviewer_name: payload.reviewerName || payload.reviewer_name || payload.customerName || "",
      customer_id: customerId,
      appointment_id: appointment?.id || payload.appointmentId || "",
      invoice_id: appointment?.invoiceId || payload.invoiceId || "",
      primary_staff_id: appointment?.staffId || payload.staffId || "",
      service_ids: toJson(appointment?.serviceIds || payload.serviceIds || []),
      rating,
      rating_max: 5,
      title: payload.title || "Internal feedback",
      review_text: payload.feedback || payload.reviewText || payload.review_text || "",
      review_language: payload.language || payload.reviewLanguage || "en",
      sentiment,
      sentiment_score: sentimentScoreFromRating(rating),
      topics_json: toJson(payload.topics || []),
      aspects_json: toJson(payload.aspects || {}),
      intent_detected: rating <= 3 ? "complaint" : "compliment",
      status: rating <= 3 ? "new" : "resolved",
      priority: rating <= 2 ? "high" : "normal",
      resolution_required: rating <= 3 ? 1 : 0,
      reviewed_at: stamp,
      imported_at: stamp,
      updated_at: stamp
    };
    if (existing) {
      db.prepare(
        `UPDATE reviews_v2 SET
          reviewer_name = @reviewer_name,
          customer_id = @customer_id,
          appointment_id = @appointment_id,
          invoice_id = @invoice_id,
          primary_staff_id = @primary_staff_id,
          service_ids = @service_ids,
          rating = @rating,
          title = @title,
          review_text = @review_text,
          review_language = @review_language,
          sentiment = @sentiment,
          sentiment_score = @sentiment_score,
          topics_json = @topics_json,
          aspects_json = @aspects_json,
          intent_detected = @intent_detected,
          status = @status,
          priority = @priority,
          resolution_required = @resolution_required,
          reviewed_at = @reviewed_at,
          updated_at = @updated_at
        WHERE id = @id AND tenant_id = @tenant_id`
      ).run(row);
    } else {
      db.prepare(
        `INSERT INTO reviews_v2
         (id, tenant_id, branch_id, platform_id, platform_review_id, reviewer_name, customer_id, appointment_id, invoice_id, primary_staff_id, service_ids, rating, rating_max, title, review_text, review_language, sentiment, sentiment_score, topics_json, aspects_json, intent_detected, status, priority, resolution_required, reviewed_at, imported_at, updated_at)
         VALUES (@id, @tenant_id, @branch_id, @platform_id, @platform_review_id, @reviewer_name, @customer_id, @appointment_id, @invoice_id, @primary_staff_id, @service_ids, @rating, @rating_max, @title, @review_text, @review_language, @sentiment, @sentiment_score, @topics_json, @aspects_json, @intent_detected, @status, @priority, @resolution_required, @reviewed_at, @imported_at, @updated_at)`
      ).run(row);
    }
    return row.id;
  },

  reviewForAlert(reviewId, access) {
    const row = db.prepare(
      `SELECT r.*, p.platform_code, p.platform_name
       FROM reviews_v2 r
       LEFT JOIN review_platforms p ON p.id = r.platform_id AND p.tenant_id = r.tenant_id
       WHERE r.id = ? AND r.tenant_id = ?`
    ).get(reviewId, access.tenantId);
    if (!row) throw notFound("Review not found");
    return {
      id: row.id,
      branchId: row.branch_id || "",
      platformId: row.platform_id,
      platformCode: row.platform_code || "internal",
      rating: Number(row.rating || 0),
      reviewText: row.review_text || "",
      title: row.title || "",
      sentiment: row.sentiment || "",
      topics: parseJson(row.topics_json, []),
      photos: parseJson(row.photos_json, []),
      primaryStaffId: row.primary_staff_id || "",
      customerId: row.customer_id || "",
      appointmentId: row.appointment_id || ""
    };
  },

  publicReviewLink(campaign = null) {
    const target = campaign?.targetPlatforms?.[0] || "google";
    return `/reputation/review-platform/${encodeURIComponent(target)}`;
  }
};

function mapCampaign(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    campaignName: row.campaign_name || "",
    triggerType: row.trigger_type || "appointment_completed",
    triggerDelayHours: Number(row.trigger_delay_hours || 2),
    channel: row.channel || "auto",
    messageTemplate: row.message_template || DEFAULT_TEMPLATE,
    targetPlatforms: parseJson(row.target_platforms, []),
    smartRouting: row.smart_routing !== 0,
    maxAttempts: Number(row.max_attempts || 2),
    incentive: parseJson(row.incentive_json, {}),
    timingRules: parseJson(row.timing_rules_json, {}),
    isActive: row.is_active !== 0,
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapSent(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    campaignId: row.campaign_id || "",
    customerId: row.customer_id || "",
    appointmentId: row.appointment_id || "",
    channel: row.channel || "",
    attemptCount: Number(row.attempt_count || 0),
    idempotencyKey: row.idempotency_key || "",
    sentAt: row.sent_at || "",
    delivered: Boolean(row.delivered),
    deliveredAt: row.delivered_at || "",
    opened: Boolean(row.opened),
    openedAt: row.opened_at || "",
    clicked: Boolean(row.clicked),
    clickedAt: row.clicked_at || "",
    reviewSubmitted: Boolean(row.review_submitted),
    submittedPlatform: row.submitted_platform || "",
    submittedReviewId: row.submitted_review_id || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function defaultCampaign(branchId = "") {
  return {
    id: "",
    branchId,
    campaignName: "Default post-appointment review request",
    triggerType: "appointment_completed",
    triggerDelayHours: 2,
    channel: "auto",
    messageTemplate: DEFAULT_TEMPLATE,
    targetPlatforms: ["google", "justdial"],
    smartRouting: true,
    maxAttempts: 2,
    isActive: true
  };
}

function normalizeChannel(channel = "auto") {
  const value = String(channel || "auto").trim().toLowerCase();
  return ["auto", "whatsapp", "sms", "email", "in_app"].includes(value) ? value : "auto";
}

function render(template, data = {}) {
  return String(template || "").replace(/\{\{(\w+)\}\}/g, (_match, key) => data[key] ?? "");
}

function sentimentFromRating(rating) {
  if (rating <= 1.5) return "very_negative";
  if (rating <= 3) return "negative";
  if (rating < 4) return "neutral";
  if (rating < 4.8) return "positive";
  return "very_positive";
}

function sentimentScoreFromRating(rating) {
  return Math.round(((Number(rating || 0) - 3) / 2) * 100) / 100;
}

function hasComplaintSignal(appointment = {}, payload = {}) {
  const combined = `${appointment.status || ""} ${appointment.notes || ""} ${appointment.complaintReason || ""} ${payload.reason || ""}`.toLowerCase();
  return /\b(complaint|refund|angry|dispute|not happy|issue|problem)\b/.test(combined);
}

function boolInt(value) {
  if (value === false || value === "false" || value === 0 || value === "0") return 0;
  return 1;
}

function limit(value, fallback) {
  return Math.max(1, Math.min(Number(value || fallback), 500));
}
