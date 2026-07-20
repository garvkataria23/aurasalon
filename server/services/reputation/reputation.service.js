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
  requireTenant,
  toJson
} from "../enterprise-command-utils.js";
import { resourceService } from "../resource.service.js";
import { reputationAlertService } from "./alert.service.js";
import { syncReputationPlatform } from "./provider-sync.service.js";
import { reviewRequesterService } from "./review-requester.service.js";

const SUPPORTED_PLATFORMS = {
  google: { name: "Google Business Profile", rateLimitPerDay: 100 },
  justdial: { name: "Justdial", rateLimitPerDay: 100 },
  zomato: { name: "Zomato", rateLimitPerDay: 100 },
  urbanclap: { name: "Urban Company", rateLimitPerDay: 100 },
  facebook: { name: "Facebook", rateLimitPerDay: 200 },
  instagram: { name: "Instagram", rateLimitPerDay: 200 },
  yelp: { name: "Yelp", rateLimitPerDay: 100 },
  tripadvisor: { name: "Tripadvisor", rateLimitPerDay: 100 },
  mouthshut: { name: "MouthShut", rateLimitPerDay: 100 },
  trustpilot: { name: "Trustpilot", rateLimitPerDay: 100 },
  bookmysalon: { name: "BookMySalon", rateLimitPerDay: 100 },
  nykaa: { name: "Nykaa", rateLimitPerDay: 100 },
  meta_ads_feedback: { name: "Meta Ads Feedback", rateLimitPerDay: 200 },
  internal: { name: "Internal Reviews", rateLimitPerDay: 1000 },
  whatsapp: { name: "WhatsApp Review Requests", rateLimitPerDay: 1000 },
  sms: { name: "SMS Review Requests", rateLimitPerDay: 1000 }
};

const REVIEW_PATCH_FIELDS = {
  branchId: "branch_id",
  platformId: "platform_id",
  platformReviewId: "platform_review_id",
  reviewerName: "reviewer_name",
  reviewerAvatar: "reviewer_avatar",
  reviewerPlatformId: "reviewer_platform_id",
  reviewerVerified: "reviewer_verified",
  reviewerReviewCount: "reviewer_review_count",
  customerId: "customer_id",
  appointmentId: "appointment_id",
  invoiceId: "invoice_id",
  primaryStaffId: "primary_staff_id",
  serviceIds: "service_ids",
  rating: "rating",
  ratingMax: "rating_max",
  title: "title",
  reviewText: "review_text",
  reviewLanguage: "review_language",
  reviewTranslatedText: "review_translated_text",
  photos: "photos_json",
  videos: "videos_json",
  sentiment: "sentiment",
  sentimentScore: "sentiment_score",
  sentimentConfidence: "sentiment_confidence",
  emotionPrimary: "emotion_primary",
  topics: "topics_json",
  aspects: "aspects_json",
  intentDetected: "intent_detected",
  toxicityScore: "toxicity_score",
  fakeProbability: "fake_probability",
  isCompetitorSmear: "is_competitor_smear",
  status: "status",
  priority: "priority",
  assignedTo: "assigned_to",
  resolutionRequired: "resolution_required",
  resolvedAt: "resolved_at",
  resolvedBy: "resolved_by",
  isFeatured: "is_featured",
  isHidden: "is_hidden",
  isFlagged: "is_flagged",
  flaggedReason: "flagged_reason"
};

const LEGACY_PATCH_FIELDS = new Set(["branchId", "platform", "reviewer", "rating", "sentiment", "reviewText", "aiReply", "alerts", "status"]);

export const reputationService = {
  dashboard(query = {}, access) {
    const reviews = this.reviews({ ...query, limit: query.limit || 500 }, access);
    const alerts = this.alerts({ ...query, limit: 10 }, access);
    const score = this.score(query, access);
    const platforms = this.platformSummary(reviews, query, access);
    const replyTimes = reviews
      .map((review) => replyTimeHours(review))
      .filter((value) => Number.isFinite(value));
    const replyRate = reviews.length
      ? Math.round((reviews.filter((review) => review.hasReply || review.replyText || review.aiReply).length / reviews.length) * 100)
      : 0;
    return {
      score,
      metrics: {
        averageRating: average(reviews.map((review) => Number(review.rating || 0))),
        totalReviews: reviews.length,
        replyRate,
        avgReplyTimeHours: replyTimes.length ? average(replyTimes) : 0,
        unresolvedNegative: reviews.filter((review) => isNegative(review) && !["resolved", "closed"].includes(String(review.status || ""))).length,
        pendingReplyApprovals: this.pendingReplyCount(query, access)
      },
      platforms,
      recentReviews: reviews.slice(0, 10),
      alerts,
      approvalRequiredByDefault: true
    };
  },

  score(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const stored = db.prepare(
      `SELECT * FROM reputation_scores_daily
       WHERE tenant_id = @tenant_id AND branch_id = @branch_id
       ORDER BY score_date DESC
       LIMIT 1`
    ).get({ tenant_id: access.tenantId, branch_id: branchId || "" });
    if (stored) return mapScore(stored, "stored");

    const reviews = this.reviews({ ...query, limit: 1000 }, access);
    const total = reviews.length;
    const avgRating = average(reviews.map((review) => Number(review.rating || 0)));
    const positive = reviews.filter((review) => isPositive(review)).length;
    const negative = reviews.filter((review) => isNegative(review)).length;
    const replied = reviews.filter((review) => review.hasReply || review.replyText || review.aiReply).length;
    const quality = clamp((avgRating / 5) * 100);
    const sentiment = total ? clamp((positive / total) * 100 - (negative / total) * 35) : 0;
    const response = total ? clamp((replied / total) * 100) : 0;
    const quantity = clamp(Math.min(total, 100) * 0.8);
    const recency = recentReviewScore(reviews);
    const overallScore = Math.round(quality * 0.35 + sentiment * 0.25 + response * 0.2 + quantity * 0.1 + recency * 0.1);
    return {
      source: "computed",
      branchId: branchId || "",
      scoreDate: now().slice(0, 10),
      overallScore,
      avgRating,
      totalReviews: total,
      positivePct: total ? Math.round((positive / total) * 100) : 0,
      negativePct: total ? Math.round((negative / total) * 100) : 0,
      replyRate: total ? Math.round((replied / total) * 100) : 0,
      netPromoterScore: npsProxy(reviews),
      segments: { quantity, quality, recency, response, sentiment }
    };
  },

  reviews(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId || "", limit: limit(query.limit, 100) };
    const filters = ["r.tenant_id = @tenant_id"];
    if (branchId) filters.push("r.branch_id = @branch_id");
    if (["staff", "frontDesk"].includes(access.role) && access.branchId) {
      filters.push("r.branch_id = @access_branch_id");
      params.access_branch_id = access.branchId;
    }
    if (query.status) {
      filters.push("r.status = @status");
      params.status = query.status;
    }
    if (query.sentiment) {
      filters.push("r.sentiment = @sentiment");
      params.sentiment = query.sentiment;
    }
    if (query.platformId) {
      filters.push("r.platform_id = @platform_id");
      params.platform_id = query.platformId;
    }
    if (query.customerId) {
      filters.push("r.customer_id = @customer_id");
      params.customer_id = query.customerId;
    }
    if (query.staffId) {
      filters.push("r.primary_staff_id = @staff_id");
      params.staff_id = query.staffId;
    }
    if (query.search) {
      filters.push("(LOWER(r.reviewer_name) LIKE @search OR LOWER(r.review_text) LIKE @search OR LOWER(r.title) LIKE @search)");
      params.search = `%${String(query.search).toLowerCase()}%`;
    }
    const rows = db.prepare(
      `SELECT r.*, p.platform_code, p.platform_name
       FROM reviews_v2 r
       LEFT JOIN review_platforms p ON p.id = r.platform_id AND p.tenant_id = r.tenant_id
       WHERE ${filters.join(" AND ")}
       ORDER BY COALESCE(r.reviewed_at, r.imported_at, r.updated_at) DESC
       LIMIT @limit`
    ).all(params).map(mapReviewV2);

    if (query.includeLegacy === "false" || query.includeLegacy === false) return rows;
    return [...rows, ...this.legacyReviews(query, access, params.limit)].slice(0, params.limit);
  },

  review(id, access) {
    const review = this.findReview(id, access);
    if (review.source === "legacy") return review;
    return {
      ...review,
      replies: this.repliesForReview(id, access),
      alerts: this.alertsForReview(id, access),
      staffAttribution: this.staffAttributionForReview(id, access)
    };
  },

  updateReview(id, payload = {}, access) {
    const existing = this.findReview(id, access);
    if (existing.source === "legacy") return this.updateLegacyReview(id, payload, access, existing);

    const updates = {};
    for (const [inputKey, column] of Object.entries(REVIEW_PATCH_FIELDS)) {
      if (!(inputKey in payload)) continue;
      updates[column] = encodeValue(column, payload[inputKey]);
    }
    if (payload.branchId) assertBranch(access, payload.branchId);
    updates.updated_at = now();
    const keys = Object.keys(updates);
    if (!keys.length) return existing;
    const setSql = keys.map((key) => `${key} = @${key}`).join(", ");
    db.prepare(`UPDATE reviews_v2 SET ${setSql} WHERE id = @id AND tenant_id = @tenant_id`).run({
      ...updates,
      id,
      tenant_id: access.tenantId
    });
    const next = this.review(id, access);
    auditDecision("reputation.review_updated", "reviews_v2", id, access, { branchId: next.branchId, details: { before: existing, after: payload } });
    emitEvent("review:updated", access, next.branchId, id, { status: next.status });
    if (payload.isFlagged || payload.is_flagged || payload.flaggedReason || payload.flagged_reason) {
      emitEvent("review:flagged_fake", access, next.branchId, id, { flaggedReason: next.flaggedReason || payload.flaggedReason || payload.flagged_reason || "" });
    }
    if (["rating", "sentiment", "reviewText", "review_text", "photos", "photos_json", "topics", "topics_json", "primaryStaffId", "primary_staff_id"].some((key) => key in payload)) {
      reputationAlertService.evaluateReview(next, { source: "review_update" }, access);
    }
    return next;
  },

  assignReview(id, payload = {}, access) {
    requireManager(access);
    const assignedTo = payload.assignedTo || payload.assigned_to || payload.userId || "";
    if (!assignedTo) throw badRequest("assignedTo is required");
    const review = this.updateReview(id, { assignedTo, status: payload.status || "assigned" }, access);
    auditDecision("reputation.review_assigned", review.source === "legacy" ? "reputation_reviews" : "reviews_v2", id, access, { branchId: review.branchId, details: { assignedTo } });
    emitEvent("review:assigned", access, review.branchId, id, { assignedTo });
    return review;
  },

  resolveReview(id, payload = {}, access) {
    requireManager(access);
    const review = this.updateReview(id, {
      status: payload.status || "resolved",
      resolutionRequired: 0,
      resolvedAt: now(),
      resolvedBy: access.userId || "",
      priority: payload.priority || "normal"
    }, access);
    auditDecision("reputation.review_resolved", review.source === "legacy" ? "reputation_reviews" : "reviews_v2", id, access, { branchId: review.branchId, details: payload });
    emitEvent("review:resolved", access, review.branchId, id, { resolvedBy: access.userId || "" });
    return review;
  },

  createReply(reviewId, payload = {}, access) {
    const review = this.findReview(reviewId, access);
    const replyText = payload.replyText || payload.reply_text || payload.text || "";
    if (!replyText) throw badRequest("replyText is required");
    const row = {
      id: makeId("reply"),
      tenant_id: access.tenantId,
      branch_id: review.branchId || "",
      review_id: reviewId,
      reply_text: replyText,
      reply_language: payload.replyLanguage || payload.reply_language || review.reviewLanguage || "en",
      ai_generated: payload.aiGenerated || payload.ai_generated ? 1 : 0,
      ai_model_used: payload.aiModelUsed || payload.ai_model_used || "",
      ai_prompt_version: payload.aiPromptVersion || payload.ai_prompt_version || "",
      approval_status: payload.approvalStatus || payload.approval_status || "pending",
      posted_to_platform: 0,
      created_by: access.userId || "",
      created_at: now(),
      updated_at: now()
    };
    db.prepare(`INSERT INTO review_replies
      (id, tenant_id, branch_id, review_id, reply_text, reply_language, ai_generated, ai_model_used, ai_prompt_version, approval_status, posted_to_platform, created_by, created_at, updated_at)
      VALUES (@id, @tenant_id, @branch_id, @review_id, @reply_text, @reply_language, @ai_generated, @ai_model_used, @ai_prompt_version, @approval_status, @posted_to_platform, @created_by, @created_at, @updated_at)`).run(row);
    if (review.source !== "legacy") {
      db.prepare("UPDATE reviews_v2 SET has_reply = 1, reply_text = @reply_text, reply_ai_generated = @ai_generated, reply_approval_status = @approval_status, updated_at = @updated_at WHERE id = @id AND tenant_id = @tenant_id")
        .run({ reply_text: row.reply_text, ai_generated: row.ai_generated, approval_status: row.approval_status, updated_at: now(), id: reviewId, tenant_id: access.tenantId });
    }
    auditDecision("reputation.reply_created", "review_replies", row.id, access, { branchId: row.branch_id, details: { reviewId, approvalStatus: row.approval_status } });
    emitEvent("review:replied", access, row.branch_id, reviewId, { replyId: row.id, approvalStatus: row.approval_status });
    return mapReply(row);
  },

  draftReplies(reviewId, payload = {}, access) {
    const review = this.findReview(reviewId, access);
    auditDecision("reputation.ai_draft_requested", review.source === "legacy" ? "reputation_reviews" : "reviews_v2", reviewId, access, { branchId: review.branchId, details: { tone: payload.tone || "warm" } });
    const drafts = buildReplyDrafts(review, payload);
    return {
      reviewId,
      providerStatus: "local_rule_draft",
      approvalRequired: true,
      drafts,
      message: "AI provider is not connected, so Aura generated approval-ready local draft options from the review rating and sentiment."
    };
  },

  approveReply(id, payload = {}, access) {
    requireManager(access);
    const reply = this.reply(id, access);
    const approvedAt = now();
    db.prepare(
      `UPDATE review_replies
       SET approval_status = 'approved', approved_by = @approved_by, approved_at = @approved_at, updated_at = @updated_at
       WHERE id = @id AND tenant_id = @tenant_id`
    ).run({ approved_by: access.userId || "", approved_at: approvedAt, updated_at: approvedAt, id, tenant_id: access.tenantId });
    this.syncReviewReplyStatus(reply.reviewId, "approved", access);
    auditDecision("reputation.reply_approved", "review_replies", id, access, { branchId: reply.branchId, details: payload });
    emitEvent("review:reply_approved", access, reply.branchId, reply.reviewId, { replyId: id, approvedBy: access.userId || "" });
    return this.reply(id, access);
  },

  postReply(id, payload = {}, access) {
    requireManager(access);
    const reply = this.reply(id, access);
    if (reply.approvalStatus !== "approved") throw badRequest("Reply must be approved before posting to a platform");
    auditDecision("reputation.reply_post_attempted", "review_replies", id, access, { branchId: reply.branchId, details: { status: "not_configured", ...payload } });
    emitEvent("review:reply_failed", access, reply.branchId, reply.reviewId, { replyId: id, status: "not_configured" });
    return {
      reply,
      status: "not_configured",
      postedToPlatform: false,
      message: "Platform posting provider is not configured. No reply was posted externally."
    };
  },

  platforms(query = {}, access) {
    requireTenant(access);
    const branchId = branchFrom(query, access);
    if (branchId) assertBranch(access, branchId);
    const params = { tenant_id: access.tenantId, branch_id: branchId || "", limit: limit(query.limit, 100) };
    const filters = ["tenant_id = @tenant_id"];
    if (branchId) filters.push("branch_id = @branch_id");
    const rows = db.prepare(`SELECT * FROM review_platforms WHERE ${filters.join(" AND ")} ORDER BY platform_name, platform_code LIMIT @limit`).all(params).map(mapPlatform);
    return {
      platforms: rows,
      supported: Object.entries(SUPPORTED_PLATFORMS).map(([code, config]) => ({ code, ...config }))
    };
  },

  connectPlatform(code, payload = {}, access) {
    requireManager(access);
    const platformCode = normalizePlatformCode(code);
    const config = SUPPORTED_PLATFORMS[platformCode];
    if (!config) throw badRequest(`Unsupported review platform: ${code}`);
    const branchId = branchFrom(payload, access);
    if (!branchId) throw badRequest("branchId is required to connect a review platform");
    assertBranch(access, branchId);
    const existing = db.prepare(
      `SELECT * FROM review_platforms
       WHERE tenant_id = ? AND branch_id = ? AND platform_code = ?
       ORDER BY created_at DESC LIMIT 1`
    ).get(access.tenantId, branchId, platformCode);
    const providerConfig = providerConfigFromPayload(platformCode, payload);
    const data = {
      id: existing?.id || makeId("rplat"),
      tenant_id: access.tenantId,
      branch_id: branchId,
      platform_code: platformCode,
      platform_name: payload.platformName || payload.platform_name || config.name,
      platform_url: payload.platformUrl || payload.platform_url || "",
      business_listing_id: payload.businessListingId || payload.business_listing_id || "",
      business_listing_url: payload.businessListingUrl || payload.business_listing_url || "",
      auto_sync_enabled: payload.autoSyncEnabled === false || payload.auto_sync_enabled === 0 ? 0 : 1,
      last_sync_status: "not_configured",
      rate_limit_per_day: payload.rateLimitPerDay || payload.rate_limit_per_day || config.rateLimitPerDay,
      provider_config_json: toJson(providerConfig),
      is_active: 1,
      updated_at: now()
    };
    if (existing) {
      db.prepare(`UPDATE review_platforms SET
        platform_name = @platform_name,
        platform_url = @platform_url,
        business_listing_id = @business_listing_id,
        business_listing_url = @business_listing_url,
        auto_sync_enabled = @auto_sync_enabled,
        last_sync_status = @last_sync_status,
        rate_limit_per_day = @rate_limit_per_day,
        provider_config_json = @provider_config_json,
        is_active = @is_active,
        updated_at = @updated_at
        WHERE id = @id AND tenant_id = @tenant_id`).run(data);
    } else {
      db.prepare(`INSERT INTO review_platforms
        (id, tenant_id, branch_id, platform_code, platform_name, platform_url, business_listing_id, business_listing_url, auto_sync_enabled, last_sync_status, rate_limit_per_day, provider_config_json, is_active, created_at, updated_at)
        VALUES (@id, @tenant_id, @branch_id, @platform_code, @platform_name, @platform_url, @business_listing_id, @business_listing_url, @auto_sync_enabled, @last_sync_status, @rate_limit_per_day, @provider_config_json, @is_active, CURRENT_TIMESTAMP, @updated_at)`).run(data);
    }
    const platform = this.platform(data.id, access);
    auditDecision(existing ? "reputation.platform_updated" : "reputation.platform_connected", "review_platforms", platform.id, access, { branchId, details: { platformCode, providerStatus: providerConfig.providerStatus, tokenEnvKey: providerConfig.tokenEnvKey || "" } });
    emitEvent("reputation:platform_sync_failed", access, branchId, platform.id, { platformCode, status: "not_configured" });
    return {
      platform,
      providerStatus: providerConfig.providerStatus,
      oauthRequired: true,
      message: "OAuth provider credentials are not configured. Platform record was saved without external sync."
    };
  },

  async syncPlatform(id, payload = {}, access) {
    requireManager(access);
    const platform = this.platform(id, access);
    try {
      const result = await syncReputationPlatform(platform, access, payload);
      const stamp = now();
      db.prepare(
        `UPDATE review_platforms
         SET last_sync_status = @status,
             last_synced_at = @last_synced_at,
             updated_at = @updated_at
         WHERE id = @id AND tenant_id = @tenant_id`
      ).run({
        status: result.status || "synced",
        last_synced_at: result.synced ? stamp : platform.lastSyncedAt || "",
        updated_at: stamp,
        id,
        tenant_id: access.tenantId
      });
      auditDecision("reputation.platform_sync_attempted", "review_platforms", id, access, { branchId: platform.branchId, details: result });
      emitEvent(result.synced ? "reputation:platform_synced" : "reputation:platform_sync_failed", access, platform.branchId, id, { platformCode: platform.platformCode, ...result });
      return { platform: this.platform(id, access), ...result };
    } catch (error) {
      db.prepare("UPDATE review_platforms SET last_sync_status = 'failed', updated_at = ? WHERE id = ? AND tenant_id = ?").run(now(), id, access.tenantId);
      auditDecision("reputation.platform_sync_failed", "review_platforms", id, access, { branchId: platform.branchId, details: { error: error.message } });
      emitEvent("reputation:platform_sync_failed", access, platform.branchId, id, { platformCode: platform.platformCode, status: "failed" });
      return { platform: this.platform(id, access), status: "failed", synced: false, importedReviews: 0, message: error.message };
    }
  },

  oauthUrl(id, access) {
    const platform = this.platform(id, access);
    return {
      platformId: id,
      platformCode: platform.platformCode,
      status: "not_configured",
      oauthUrl: null,
      message: "OAuth provider credentials are not configured for this platform."
    };
  },

  requestCampaigns(query = {}, access) {
    return reviewRequesterService.campaigns(query, access);
  },

  createRequestCampaign(payload = {}, access) {
    return reviewRequesterService.createCampaign(payload, access);
  },

  sendReviewRequest(appointmentId, payload = {}, access) {
    return reviewRequesterService.sendForAppointment(appointmentId, payload, access);
  },

  publicReviewRequest(requestId) {
    return reviewRequesterService.publicRequest(requestId);
  },

  submitPublicFeedback(requestId, payload = {}) {
    return reviewRequesterService.submitPublicFeedback(requestId, payload);
  },

  internalFeedback(payload = {}, access) {
    return reviewRequesterService.internalFeedback(payload, access);
  },

  alerts(query = {}, access) {
    return reputationAlertService.alerts(query, access);
  },

  acknowledgeAlert(id, payload = {}, access) {
    return reputationAlertService.acknowledgeAlert(id, payload, access);
  },

  resolveAlert(id, payload = {}, access) {
    return reputationAlertService.resolveAlert(id, payload, access);
  },

  findReview(id, access) {
    requireTenant(access);
    const row = db.prepare(
      `SELECT r.*, p.platform_code, p.platform_name
       FROM reviews_v2 r
       LEFT JOIN review_platforms p ON p.id = r.platform_id AND p.tenant_id = r.tenant_id
       WHERE r.id = ? AND r.tenant_id = ?`
    ).get(id, access.tenantId);
    if (row) {
      if (row.branch_id) assertBranch(access, row.branch_id);
      return mapReviewV2(row);
    }
    try {
      return mapLegacyReview(resourceService.get("reputationReviews", id, access));
    } catch {
      throw notFound("Review not found");
    }
  },

  legacyReviews(query, access, maxLimit) {
    try {
      const rows = resourceService.list("reputationReviews", { branchId: branchFrom(query, access), limit: maxLimit }, access).map(mapLegacyReview);
      return filterLegacyRows(rows, query);
    } catch {
      return [];
    }
  },

  platform(id, access) {
    requireTenant(access);
    const row = db.prepare("SELECT * FROM review_platforms WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Review platform not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return mapPlatform(row);
  },

  reply(id, access) {
    requireTenant(access);
    const row = db.prepare("SELECT * FROM review_replies WHERE id = ? AND tenant_id = ?").get(id, access.tenantId);
    if (!row) throw notFound("Review reply not found");
    if (row.branch_id) assertBranch(access, row.branch_id);
    return mapReply(row);
  },

  repliesForReview(reviewId, access) {
    return db.prepare("SELECT * FROM review_replies WHERE tenant_id = ? AND review_id = ? ORDER BY created_at DESC").all(access.tenantId, reviewId).map(mapReply);
  },

  alertsForReview(reviewId, access) {
    return db.prepare("SELECT * FROM negative_review_alerts WHERE tenant_id = ? AND review_id = ? ORDER BY created_at DESC").all(access.tenantId, reviewId).map(mapAlert);
  },

  staffAttributionForReview(reviewId, access) {
    return db.prepare("SELECT * FROM staff_review_attribution WHERE tenant_id = ? AND review_id = ? ORDER BY created_at DESC").all(access.tenantId, reviewId).map(mapStaffAttribution);
  },

  updateLegacyReview(id, payload, access, existing) {
    const nextPayload = {};
    for (const key of LEGACY_PATCH_FIELDS) {
      if (key in payload) nextPayload[key] = payload[key];
    }
    if (!Object.keys(nextPayload).length) return existing;
    const updated = mapLegacyReview(resourceService.update("reputationReviews", id, nextPayload, access));
    auditDecision("reputation.legacy_review_updated", "reputation_reviews", id, access, { branchId: updated.branchId, details: { before: existing, after: payload } });
    emitEvent("review:updated", access, updated.branchId, id, { source: "legacy", status: updated.status });
    return updated;
  },

  syncReviewReplyStatus(reviewId, approvalStatus, access) {
    const row = db.prepare("SELECT id FROM reviews_v2 WHERE id = ? AND tenant_id = ?").get(reviewId, access.tenantId);
    if (!row) return;
    db.prepare("UPDATE reviews_v2 SET reply_approval_status = ?, updated_at = ? WHERE id = ? AND tenant_id = ?").run(approvalStatus, now(), reviewId, access.tenantId);
  },

  pendingReplyCount(query = {}, access) {
    const branchId = branchFrom(query, access);
    const params = { tenant_id: access.tenantId, branch_id: branchId || "" };
    const filters = ["tenant_id = @tenant_id", "approval_status = 'pending'"];
    if (branchId) filters.push("branch_id = @branch_id");
    return Number(db.prepare(`SELECT COUNT(*) AS count FROM review_replies WHERE ${filters.join(" AND ")}`).get(params)?.count || 0);
  },

  platformSummary(reviews, query, access) {
    const connected = this.platforms(query, access).platforms;
    const grouped = new Map();
    for (const platform of connected) {
      grouped.set(platform.id, {
        platformId: platform.id,
        platformCode: platform.platformCode,
        platformName: platform.platformName,
        connected: true,
        reviewCount: 0,
        averageRating: 0,
        lastSyncedAt: platform.lastSyncedAt,
        lastSyncStatus: platform.lastSyncStatus || "not_configured"
      });
    }
    for (const review of reviews) {
      const key = review.platformId || review.platformCode || review.platform || "legacy";
      const current = grouped.get(key) || {
        platformId: review.platformId || "",
        platformCode: review.platformCode || normalizePlatformCode(review.platform || "legacy"),
        platformName: review.platformName || review.platform || "Legacy Reviews",
        connected: false,
        reviewCount: 0,
        ratings: [],
        averageRating: 0,
        lastSyncedAt: "",
        lastSyncStatus: "legacy"
      };
      current.reviewCount += 1;
      current.ratings = [...(current.ratings || []), Number(review.rating || 0)];
      current.averageRating = average(current.ratings);
      grouped.set(key, current);
    }
    return [...grouped.values()].map(({ ratings, ...platform }) => platform);
  }
};

function mapReviewV2(row = {}) {
  return {
    id: row.id,
    source: "v2",
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    platformId: row.platform_id,
    platformCode: row.platform_code || "",
    platformName: row.platform_name || row.platform_code || "Review platform",
    platformReviewId: row.platform_review_id || "",
    reviewerName: row.reviewer_name || "",
    reviewer: row.reviewer_name || "",
    reviewerAvatar: row.reviewer_avatar || "",
    reviewerPlatformId: row.reviewer_platform_id || "",
    reviewerVerified: Boolean(row.reviewer_verified),
    reviewerReviewCount: Number(row.reviewer_review_count || 0),
    customerId: row.customer_id || "",
    appointmentId: row.appointment_id || "",
    invoiceId: row.invoice_id || "",
    primaryStaffId: row.primary_staff_id || "",
    serviceIds: parseJson(row.service_ids, []),
    rating: Number(row.rating || 0),
    ratingMax: Number(row.rating_max || 5),
    title: row.title || "",
    reviewText: row.review_text || "",
    reviewLanguage: row.review_language || "",
    reviewTranslatedText: row.review_translated_text || "",
    photos: parseJson(row.photos_json, []),
    videos: parseJson(row.videos_json, []),
    sentiment: row.sentiment || "",
    sentimentScore: Number(row.sentiment_score || 0),
    sentimentConfidence: Number(row.sentiment_confidence || 0),
    aiAnalyzedAt: row.ai_analyzed_at || "",
    aiProvider: row.ai_provider || "",
    aiModelUsed: row.ai_model_used || "",
    aiPromptVersion: row.ai_prompt_version || "",
    emotionPrimary: row.emotion_primary || "",
    topics: parseJson(row.topics_json, []),
    aspects: parseJson(row.aspects_json, {}),
    intentDetected: row.intent_detected || "",
    toxicityScore: Number(row.toxicity_score || 0),
    fakeProbability: Number(row.fake_probability || 0),
    isCompetitorSmear: Boolean(row.is_competitor_smear),
    recoveryOpportunity: parseJson(row.recovery_opportunity_json, {}),
    status: row.status || "new",
    priority: row.priority || "normal",
    assignedTo: row.assigned_to || "",
    resolutionRequired: Boolean(row.resolution_required),
    resolvedAt: row.resolved_at || "",
    resolvedBy: row.resolved_by || "",
    hasReply: Boolean(row.has_reply),
    replyText: row.reply_text || "",
    replyPostedAt: row.reply_posted_at || "",
    replyBy: row.reply_by || "",
    replyAiGenerated: Boolean(row.reply_ai_generated),
    replyApprovalStatus: row.reply_approval_status || "pending",
    helpfulCount: Number(row.helpful_count || 0),
    viewsCount: Number(row.views_count || 0),
    reviewedAt: row.reviewed_at || "",
    importedAt: row.imported_at || "",
    updatedAt: row.updated_at || "",
    createdAt: row.imported_at || row.reviewed_at || row.updated_at || "",
    isFeatured: Boolean(row.is_featured),
    isHidden: Boolean(row.is_hidden),
    isFlagged: Boolean(row.is_flagged),
    flaggedReason: row.flagged_reason || ""
  };
}

function mapLegacyReview(row = {}) {
  const aiReply = parseJson(row.aiReply, row.aiReply || {});
  const alerts = parseJson(row.alerts, row.alerts || []);
  const review = {
    id: row.id,
    source: "legacy",
    tenantId: row.tenantId || "",
    branchId: row.branchId || "",
    platform: row.platform || "Legacy",
    platformCode: normalizePlatformCode(row.platform || "legacy"),
    platformName: row.platform || "Legacy Reviews",
    reviewer: row.reviewer || "",
    reviewerName: row.reviewer || "",
    rating: Number(row.rating || 0),
    ratingMax: 5,
    sentiment: row.sentiment || "",
    reviewText: row.reviewText || "",
    aiReply,
    alerts,
    hasReply: Boolean(replyTextFromAny(aiReply)),
    replyText: replyTextFromAny(aiReply),
    status: row.status || "new",
    reviewedAt: row.createdAt || "",
    createdAt: row.createdAt || "",
    updatedAt: row.updatedAt || row.createdAt || ""
  };
  return review;
}

function mapReply(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    reviewId: row.review_id,
    replyText: row.reply_text || "",
    replyLanguage: row.reply_language || "",
    aiGenerated: Boolean(row.ai_generated),
    aiModelUsed: row.ai_model_used || "",
    aiPromptVersion: row.ai_prompt_version || "",
    approvalStatus: row.approval_status || "pending",
    approvedBy: row.approved_by || "",
    approvedAt: row.approved_at || "",
    postedToPlatform: Boolean(row.posted_to_platform),
    postedAt: row.posted_at || "",
    platformResponseId: row.platform_response_id || "",
    createdBy: row.created_by || "",
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapPlatform(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    platformCode: row.platform_code,
    platformName: row.platform_name || SUPPORTED_PLATFORMS[row.platform_code]?.name || row.platform_code,
    platformUrl: row.platform_url || "",
    businessListingId: row.business_listing_id || "",
    businessListingUrl: row.business_listing_url || "",
    autoSyncEnabled: Boolean(row.auto_sync_enabled),
    lastSyncedAt: row.last_synced_at || "",
    lastSyncStatus: row.last_sync_status || "",
    rateLimitPerDay: Number(row.rate_limit_per_day || 0),
    rateLimitUsedToday: Number(row.rate_limit_used_today || 0),
    providerConfig: parseJson(row.provider_config_json, {}),
    isActive: Boolean(row.is_active),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

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

function mapStaffAttribution(row = {}) {
  return {
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    reviewId: row.review_id,
    staffId: row.staff_id,
    serviceId: row.service_id || "",
    attributionType: row.attribution_type || "",
    attributionConfidence: Number(row.attribution_confidence || 0),
    ratingAttributed: Number(row.rating_attributed || 0),
    mentionedByName: Boolean(row.mentioned_by_name),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function mapScore(row = {}, source = "stored") {
  return {
    source,
    id: row.id,
    tenantId: row.tenant_id,
    branchId: row.branch_id || "",
    scoreDate: row.score_date,
    overallScore: Number(row.overall_score || 0),
    googleRating: Number(row.google_rating || 0),
    googleCount: Number(row.google_count || 0),
    justdialRating: Number(row.justdial_rating || 0),
    zomatoRating: Number(row.zomato_rating || 0),
    avgRating: Number(row.avg_rating || 0),
    totalReviews: Number(row.total_reviews || 0),
    newReviewsToday: Number(row.new_reviews_today || 0),
    positivePct: Number(row.positive_pct || 0),
    negativePct: Number(row.negative_pct || 0),
    replyRate: Number(row.reply_rate || 0),
    avgReplyTimeHours: Number(row.avg_reply_time_hours || 0),
    trend7d: Number(row.trend_7d || 0),
    trend30d: Number(row.trend_30d || 0),
    rankInArea: Number(row.rank_in_area || 0),
    netPromoterScore: Number(row.net_promoter_score || 0),
    createdAt: row.created_at || "",
    updatedAt: row.updated_at || ""
  };
}

function filterLegacyRows(rows, query) {
  return rows.filter((row) => {
    if (query.status && row.status !== query.status) return false;
    if (query.sentiment && row.sentiment !== query.sentiment) return false;
    if (query.search) {
      const term = String(query.search).toLowerCase();
      return [row.platform, row.reviewer, row.reviewText, row.sentiment].some((value) => String(value || "").toLowerCase().includes(term));
    }
    return true;
  });
}

function providerConfigFromPayload(platformCode, payload = {}) {
  const incoming = typeof payload.providerConfig === "object" && payload.providerConfig
    ? payload.providerConfig
    : parseJson(payload.providerConfig || payload.provider_config_json, {});
  const tokenEnvKey = payload.tokenEnvKey || payload.providerTokenEnvKey || incoming.tokenEnvKey || defaultProviderEnvKey(platformCode);
  const accountId = payload.accountId || incoming.accountId || "";
  const locationId = payload.locationId || incoming.locationId || "";
  const instagramAccountId = payload.instagramAccountId || payload.pageAccountId || incoming.instagramAccountId || "";
  const pageId = payload.pageId || payload.pageAccountId || incoming.pageId || "";
  return {
    providerStatus: tokenEnvKey && process.env[tokenEnvKey] ? "configured" : "not_configured",
    oauthRequired: true,
    credentialMode: "env_reference",
    tokenEnvKey,
    accountId,
    locationId,
    instagramAccountId,
    pageId,
    graphVersion: payload.graphVersion || incoming.graphVersion || "",
    updatedAt: now()
  };
}

function defaultProviderEnvKey(platformCode) {
  const envKeys = {
    google: "GOOGLE_BUSINESS_PROFILE_ACCESS_TOKEN",
    instagram: "META_GRAPH_ACCESS_TOKEN",
    facebook: "META_GRAPH_ACCESS_TOKEN",
    yelp: "YELP_API_KEY"
  };
  return envKeys[platformCode] || "";
}

function buildReplyDrafts(review = {}, payload = {}) {
  const name = String(review.reviewerName || "there").split(/\s+/)[0] || "there";
  const rating = Number(review.rating || 0);
  const platformName = review.platformName || review.platform || "your review";
  const tone = String(payload.tone || "warm").toLowerCase();
  if (isNegative(review)) {
    return [
      `Hi ${name}, thank you for telling us about this. We are sorry your visit did not meet the standard we expect. Please share a convenient time or contact detail so our manager can review this and make it right.`,
      `Hi ${name}, we appreciate your honest feedback on ${platformName}. We are checking this with the team and would like to resolve it personally. Please message us with your visit details.`
    ];
  }
  if (rating >= 4) {
    return [
      `Hi ${name}, thank you for the lovely review. We are glad you enjoyed your visit and look forward to welcoming you again soon.`,
      `Thanks ${name}. Your feedback means a lot to the team. We will keep working to give you the same great experience every time.`
    ];
  }
  return [
    `Hi ${name}, thank you for sharing your feedback. We are noting this with the team and will use it to improve your next visit.`,
    tone === "formal"
      ? `Dear ${name}, thank you for reviewing us. We appreciate the feedback and will review it internally for service improvement.`
      : `Thanks ${name}. We appreciate the honest review and will keep improving.`
  ];
}

function encodeValue(column, value) {
  if (column.endsWith("_json") || column === "service_ids") return toJson(value);
  if (typeof value === "boolean") return value ? 1 : 0;
  return value;
}

function normalizePlatformCode(code = "") {
  return String(code || "").trim().toLowerCase().replace(/[^a-z0-9_]+/g, "_") || "legacy";
}

function replyTextFromAny(value) {
  if (!value) return "";
  if (typeof value === "string") return value;
  if (typeof value === "object") return value.reply || value.text || value.message || value.body || value.draft || "";
  return "";
}

function isPositive(review) {
  return String(review.sentiment || "").toLowerCase().includes("positive") || Number(review.rating || 0) >= 4;
}

function isNegative(review) {
  return String(review.sentiment || "").toLowerCase().includes("negative") || Number(review.rating || 0) <= 3;
}

function average(values) {
  const usable = values.map(Number).filter((value) => Number.isFinite(value));
  if (!usable.length) return 0;
  return Math.round((usable.reduce((sum, value) => sum + value, 0) / usable.length) * 100) / 100;
}

function npsProxy(reviews) {
  if (!reviews.length) return 0;
  const promoters = reviews.filter((review) => Number(review.rating || 0) >= 4.5).length;
  const detractors = reviews.filter((review) => Number(review.rating || 0) <= 3).length;
  return Math.round(((promoters - detractors) / reviews.length) * 100);
}

function recentReviewScore(reviews) {
  if (!reviews.length) return 0;
  const cutoff = Date.now() - 30 * 24 * 60 * 60 * 1000;
  const recent = reviews.filter((review) => {
    const stamp = new Date(review.reviewedAt || review.createdAt || review.updatedAt || 0).getTime();
    return Number.isFinite(stamp) && stamp >= cutoff;
  }).length;
  return clamp((recent / reviews.length) * 100);
}

function replyTimeHours(review) {
  if (!review.replyPostedAt || !review.reviewedAt) return Number.NaN;
  const start = new Date(review.reviewedAt).getTime();
  const end = new Date(review.replyPostedAt).getTime();
  if (!Number.isFinite(start) || !Number.isFinite(end) || end < start) return Number.NaN;
  return Math.round(((end - start) / 36_000) / 10);
}

function clamp(value) {
  return Math.max(0, Math.min(100, Math.round(Number(value || 0))));
}

function limit(value, fallback) {
  return Math.max(1, Math.min(Number(value || fallback), 500));
}
