import test from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { createApp } from "../server/app.js";
import { db } from "../server/db.js";

const read = (path) => readFileSync(new URL(`../${path}`, import.meta.url), "utf8");

function listen(app) {
  return new Promise((resolve) => {
    const server = app.listen(0, "127.0.0.1", () => resolve(server));
  });
}

function close(server) {
  return new Promise((resolve, reject) => server.close((error) => (error ? reject(error) : resolve())));
}

function headers(role = "owner", tenantId = "tenant_aura", branchId = "") {
  return {
    "content-type": "application/json",
    "x-tenant-id": tenantId,
    "x-user-role": role,
    ...(branchId ? { "x-branch-id": branchId } : {})
  };
}

async function api(baseUrl, path, { method = "GET", body, role = "owner", tenantId = "tenant_aura", branchId = "" } = {}) {
  const response = await fetch(`${baseUrl}${path}`, {
    method,
    headers: headers(role, tenantId, branchId),
    body: body === undefined ? undefined : JSON.stringify(body)
  });
  const text = await response.text();
  return { response, payload: text ? JSON.parse(text) : null };
}

function ensureTenant(id, slug) {
  const stamp = new Date().toISOString();
  const plan = db.prepare("SELECT id FROM subscription_plans ORDER BY createdAt ASC LIMIT 1").get();
  db.prepare(`INSERT OR IGNORE INTO tenants (id, name, slug, status, planId, subscriptionStatus, createdAt, updatedAt)
    VALUES (?, ?, ?, ?, ?, ?, ?, ?)`).run(id, `Tenant ${slug}`, slug, "active", plan?.id || null, "active", stamp, stamp);
}

test("growth rank bot schema and app route stay wired to both API surfaces", () => {
  const schema = read("server/services/growth-rank-bot-schema.service.js");
  const app = read("server/app.js");
  const angularRoutes = read("src/app/app.routes.ts");
  const angularComponent = read("src/app/pages/growth-rank-bot.component.ts");
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_audits/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_clients/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_tasks/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_leads/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_content_approvals/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_reports/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_integrations/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_rank_keywords/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_rank_snapshots/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_competitor_signals/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_content_factory/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_attribution_events/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_review_engine/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_proposals/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_portal_sessions/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_copilot_chats/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_campaign_profit/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_publishing_planner/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_seo_pages/);
  assert.match(schema, /CREATE TABLE IF NOT EXISTS growth_rank_bot_competitor_alerts/);
  assert.match(schema, /tenant_id TEXT NOT NULL/);
  assert.match(schema, /branch_id TEXT NOT NULL DEFAULT ''/);
  assert.match(app, /app\.use\("\/api\/v1", authenticateJwt\(\), growthRankBotRouter\)/);
  assert.match(app, /app\.use\("\/api", growthRankBotRouter\)/);
  assert.match(angularRoutes, /growth-rank-bot/);
  assert.match(angularComponent, /Growth Copilot/);
  assert.match(angularComponent, /Profit Engine/);
  assert.match(angularComponent, /SEO Website/);
  assert.match(angularComponent, /Competitor Watch/);
  assert.match(angularComponent, /loadAuditDetail\(audits\[0\]\.id\)/);
  assert.match(angularComponent, /loadAuditDetail\(audit\.id\)/);
  assert.match(angularComponent, /\[disabled\]="actionBusy\(\) \|\| !audit\.workspace"/);
});

test("growth rank bot creates ethical persisted audits and blocks cross-tenant reads", async () => {
  ensureTenant("tenant_growth_other", "growth-other");
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_growth_${Date.now()}`;
  try {
    const created = await api(baseUrl, "/growth-rank-bot/audits", {
      method: "POST",
      branchId,
      body: {
        businessName: "Aftab Glow Studio",
        industry: "Salon and skin clinic",
        city: "Lucknow",
        targetArea: "Hazratganj",
        clientEmail: "owner@aftabglow.in",
        instagramUrl: "https://instagram.com/aftabglow",
        facebookUrl: "https://facebook.com/aftabglow",
        googleProfileUrl: "https://maps.google.com/?q=Aftab+Glow+Studio",
        topServices: ["hair spa", "facial", "bridal makeup"],
        competitors: ["Glow One", "Glow Two", "Glow Three", "Glow Four", "Glow Five"],
        packageName: "Agency Pro",
        monthlyFee: 45000,
        goal: "Get more local discovery and WhatsApp bookings"
      }
    });
    assert.equal(created.response.status, 201);
    assert.equal(created.payload.businessName, "Aftab Glow Studio");
    assert.equal(created.payload.branchId, branchId);
    assert.ok(created.payload.plan.rankReadinessScore >= 70);
    assert.equal(created.payload.plan.platforms.length, 3);
    assert.ok(created.payload.plan.platforms.some((platform) => platform.label === "Google Business Profile"));
    assert.ok(created.payload.plan.contentCalendar.length >= 30);
    assert.equal(created.payload.plan.proGrowthBot.competitorAudit.length, 5);
    assert.ok(created.payload.plan.proGrowthBot.googleRankingChecklist.length >= 8);
    assert.ok(created.payload.plan.proGrowthBot.reelStudio.length >= 3);
    assert.ok(created.payload.plan.automationDashboard.dailyTaskBoard.length >= 5);
    assert.ok(created.payload.plan.integrationHub.providers.some((provider) => provider.provider === "Meta Graph API"));
    assert.equal(created.payload.plan.agencySaas.clientPortfolio.packageName, "Agency Pro");
    assert.ok(created.payload.plan.advancedGrowthSystem.rankTracker.keywords.length >= 10);
    assert.equal(created.payload.plan.advancedGrowthSystem.contentFactory90.length, 90);
    assert.ok(created.payload.plan.advancedGrowthSystem.realIntegrationReadiness.providers.some((provider) => provider.provider === "Google Business Profile API"));
    assert.ok(created.payload.plan.advancedGrowthSystem.reviewGrowthEngine.workflows.some((workflow) => workflow.reviewType === "negative_alert"));
    assert.ok(created.payload.plan.levels.some((level) => level.level === 15 && level.title === "AI Competitor Watch"));
    assert.ok(created.payload.plan.advancedGrowthSystem.aiGrowthCopilot.suggestedQuestions.length >= 5);
    assert.equal(created.payload.plan.advancedGrowthSystem.campaignProfitEngine.campaigns.length, 5);
    assert.ok(created.payload.plan.advancedGrowthSystem.approvalPublishingPlanner.scheduledItems.length >= 10);
    assert.ok(created.payload.plan.advancedGrowthSystem.localSeoWebsiteBuilder.pages.length >= 5);
    assert.equal(created.payload.plan.advancedGrowthSystem.aiCompetitorWatch.alerts.length, 5);
    assert.ok(created.payload.workspace.tasks.length >= 13);
    assert.equal(created.payload.workspace.leads.length, 3);
    assert.equal(created.payload.workspace.approvals.length, 3);
    assert.equal(created.payload.workspace.integrations.length, 3);
    assert.ok(created.payload.workspace.rankKeywords.length >= 10);
    assert.ok(created.payload.workspace.rankSnapshots.length >= 10);
    assert.equal(created.payload.workspace.competitorSignals.length, 5);
    assert.equal(created.payload.workspace.contentFactory.length, 90);
    assert.equal(created.payload.workspace.attributionEvents.length, 4);
    assert.equal(created.payload.workspace.reviewEngine.length, 3);
    assert.equal(created.payload.workspace.proposals.length, 1);
    assert.equal(created.payload.workspace.portalSessions.length, 1);
    assert.equal(created.payload.workspace.copilotChats.length, 3);
    assert.equal(created.payload.workspace.campaignProfit.length, 5);
    assert.equal(created.payload.workspace.publishingPlanner.length, 10);
    assert.ok(created.payload.workspace.seoPages.length >= 5);
    assert.equal(created.payload.workspace.competitorAlerts.length, 5);
    assert.equal(created.payload.workspace.client.monthlyFee, 45000);
    assert.match(created.payload.plan.positioning, /No system can guarantee rank one/i);
    assert.ok(created.payload.plan.guardrails.some((item) => /fake followers/i.test(item)));
    assert.ok(created.payload.plan.guardrails.some((item) => /fake reviews/i.test(item)));
    assert.match(created.payload.plan.reviewEngine.policy, /honest review/i);

    const list = await api(baseUrl, `/growth-rank-bot/audits?branchId=${branchId}`, { branchId });
    assert.equal(list.response.status, 200);
    assert.ok(list.payload.some((audit) => audit.id === created.payload.id));

    const detail = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}`, { branchId });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.payload.plan.providerStrategy.mode, "provider-agnostic");
    assert.equal(detail.payload.workspace.reports.length, 1);
    assert.equal(detail.payload.workspace.contentFactory.length, 90);

    const dashboard = await api(baseUrl, `/growth-rank-bot/dashboard?branchId=${branchId}`, { branchId });
    assert.equal(dashboard.response.status, 200);
    assert.equal(dashboard.payload.metrics.clients, 1);
    assert.ok(dashboard.payload.metrics.openTasks >= 13);
    assert.equal(dashboard.payload.metrics.pendingApprovals, 3);
    assert.ok(dashboard.payload.metrics.trackedKeywords >= 10);
    assert.equal(dashboard.payload.metrics.contentFactoryItems, 90);
    assert.equal(dashboard.payload.metrics.attributedLeads, 4);
    assert.equal(dashboard.payload.metrics.reviewAlerts, 1);
    assert.equal(dashboard.payload.metrics.proposals, 1);
    assert.equal(dashboard.payload.metrics.copilotChats, 3);
    assert.ok(dashboard.payload.metrics.campaignProfit > 0);
    assert.ok(dashboard.payload.metrics.campaignRoiPercent > 0);
    assert.equal(dashboard.payload.metrics.scheduledPublishing, 10);
    assert.ok(dashboard.payload.metrics.seoPages >= 5);
    assert.equal(dashboard.payload.metrics.competitorAlerts, 5);

    const report = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/weekly-report`, { branchId });
    assert.equal(report.response.status, 200);
    assert.match(report.payload.title, /weekly growth report/i);
    assert.ok(report.payload.portalToken);

    const rankTracker = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/rank-tracker`, { branchId });
    assert.equal(rankTracker.response.status, 200);
    assert.ok(rankTracker.payload.keywords.length >= 10);
    assert.match(rankTracker.payload.sourcePolicy, /Do not scrape Google/i);

    const rankImport = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/rank-snapshots/import`, {
      method: "POST",
      branchId,
      body: {
        source: "manual_rank_import",
        positions: rankTracker.payload.keywords.slice(0, 3).map((keyword, index) => ({
          keyword: keyword.keyword,
          rankPosition: index + 4
        }))
      }
    });
    assert.equal(rankImport.response.status, 201);
    assert.ok(rankImport.payload.keywords.some((keyword) => keyword.status === "manual_imported"));
    assert.ok(rankImport.payload.snapshots.length > rankTracker.payload.snapshots.length);

    const kpiSync = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/integration-sync`, {
      method: "POST",
      branchId,
      body: {
        providers: [
          { provider: "Meta Graph API", status: "manual_synced", metrics: { reach: 12000, messages: 44 } },
          { provider: "Google Business Profile API", status: "manual_synced", metrics: { views: 1800, calls: 61 } }
        ]
      }
    });
    assert.equal(kpiSync.response.status, 200);
    assert.ok(kpiSync.payload.some((provider) => provider.status === "manual_synced"));

    const portal = await api(baseUrl, `/growth-rank-bot/client-portal/${created.payload.workspace.portalSessions[0].portalToken}`, { branchId });
    assert.equal(portal.response.status, 200);
    assert.equal(portal.payload.session.clientEmail, "owner@aftabglow.in");
    assert.equal(portal.payload.audit.businessName, "Aftab Glow Studio");

    const attribution = await api(baseUrl, "/growth-rank-bot/attribution-events", {
      method: "POST",
      branchId,
      body: {
        auditId: created.payload.id,
        source: "Instagram DM",
        leadName: "Riya Lead",
        eventType: "booking_confirmed",
        bookingId: "booking_1001",
        estimatedValue: 3200
      }
    });
    assert.equal(attribution.response.status, 201);
    assert.equal(attribution.payload.bookingId, "booking_1001");
    assert.equal(attribution.payload.estimatedValue, 3200);

    const contentStatus = await api(baseUrl, `/growth-rank-bot/content/${created.payload.workspace.contentFactory[0].id}/status`, {
      method: "PATCH",
      branchId,
      body: { status: "approved" }
    });
    assert.equal(contentStatus.response.status, 200);
    assert.equal(contentStatus.payload.status, "approved");

    const executiveReport = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/weekly-report`, {
      method: "POST",
      branchId,
      body: { note: "Generated from test command layer" }
    });
    assert.equal(executiveReport.response.status, 201);
    assert.equal(executiveReport.payload.reportType, "executive_weekly");
    assert.ok(executiveReport.payload.payload.scorecard.trackedKeywords >= 10);

    const taskBatch = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/auto-tasks/run`, {
      method: "POST",
      branchId,
      body: { note: "test batch" }
    });
    assert.equal(taskBatch.response.status, 201);
    assert.ok(taskBatch.payload.tasks.length >= 8);

    const copilot = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/copilot/ask`, {
      method: "POST",
      branchId,
      body: { question: "mere salon ki ranking kyu down hai?" }
    });
    assert.equal(copilot.response.status, 201);
    assert.equal(copilot.payload.intent, "rank_diagnosis");
    assert.match(copilot.payload.answer, /Aftab Glow Studio/);

    const campaign = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/campaign-profit`, {
      method: "POST",
      branchId,
      body: {
        campaignName: "Test Google post",
        source: "Google Post",
        spend: 1000,
        leads: 8,
        bookings: 3,
        revenue: 10000
      }
    });
    assert.equal(campaign.response.status, 201);
    assert.equal(campaign.payload.profit, 4800);
    assert.equal(campaign.payload.roiPercent, 480);

    const planner = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/publishing-planner`, {
      method: "POST",
      branchId,
      body: {
        title: "Approved test reel",
        channel: "Instagram",
        scheduledFor: "2026-06-04",
        approvalStatus: "approved"
      }
    });
    assert.equal(planner.response.status, 201);
    assert.equal(planner.payload.approvalStatus, "approved");
    assert.equal(planner.payload.publishStatus, "scheduled_draft");

    const seoPages = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/seo-pages/generate`, {
      method: "POST",
      branchId,
      body: {}
    });
    assert.equal(seoPages.response.status, 201);
    assert.equal(seoPages.payload.generated, 0);
    assert.ok(seoPages.payload.pages.length >= 5);

    const competitorAlert = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}/competitor-alerts`, {
      method: "POST",
      branchId,
      body: {
        competitorName: "Glow One",
        signalType: "new_offer",
        severity: "high",
        recommendedAction: "Launch counter offer"
      }
    });
    assert.equal(competitorAlert.response.status, 201);
    assert.equal(competitorAlert.payload.signalType, "new_offer");
    assert.equal(competitorAlert.payload.status, "open");

    const proposalStatus = await api(baseUrl, `/growth-rank-bot/proposals/${created.payload.workspace.proposals[0].id}/status`, {
      method: "PATCH",
      branchId,
      body: { status: "won", invoiceStatus: "issued" }
    });
    assert.equal(proposalStatus.response.status, 200);
    assert.equal(proposalStatus.payload.status, "won");
    assert.equal(proposalStatus.payload.invoiceStatus, "issued");

    const updatedTask = await api(baseUrl, `/growth-rank-bot/tasks/${created.payload.workspace.tasks[0].id}/status`, {
      method: "PATCH",
      branchId,
      body: { status: "done" }
    });
    assert.equal(updatedTask.response.status, 200);
    assert.equal(updatedTask.payload.status, "done");

    const otherTenantList = await api(baseUrl, `/growth-rank-bot/audits?branchId=${branchId}`, {
      tenantId: "tenant_growth_other",
      branchId
    });
    assert.equal(otherTenantList.response.status, 200);
    assert.equal(otherTenantList.payload.length, 0);

    const otherTenantDetail = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}`, {
      tenantId: "tenant_growth_other",
      branchId
    });
    assert.equal(otherTenantDetail.response.status, 404);
  } finally {
    await close(server);
  }
});

test("growth rank bot backfills legacy audit proposal and portal rows", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  const branchId = `branch_growth_legacy_${Date.now()}`;
  try {
    const created = await api(baseUrl, "/growth-rank-bot/audits", {
      method: "POST",
      branchId,
      body: {
        businessName: "Legacy Aura Growth",
        industry: "Salon",
        city: "Mumbai",
        targetArea: "Bandra",
        clientEmail: "legacy@auragrowth.test",
        instagramUrl: "https://instagram.com/legacyaura",
        facebookUrl: "https://facebook.com/legacyaura",
        googleProfileUrl: "https://maps.google.com/?q=Legacy+Aura+Growth",
        topServices: ["hair spa", "facial"],
        competitors: ["Legacy One", "Legacy Two"],
        packageName: "Legacy Pro",
        monthlyFee: 32000
      }
    });
    assert.equal(created.response.status, 201);
    db.prepare("DELETE FROM growth_rank_bot_proposals WHERE audit_id = ? AND tenant_id = ?").run(created.payload.id, "tenant_aura");
    db.prepare("DELETE FROM growth_rank_bot_portal_sessions WHERE audit_id = ? AND tenant_id = ?").run(created.payload.id, "tenant_aura");

    const detail = await api(baseUrl, `/growth-rank-bot/audits/${created.payload.id}`, { branchId });
    assert.equal(detail.response.status, 200);
    assert.equal(detail.payload.workspace.proposals.length, 1);
    assert.equal(detail.payload.workspace.portalSessions.length, 1);
    assert.equal(detail.payload.workspace.client.portalToken, detail.payload.workspace.portalSessions[0].portalToken);

    const portal = await api(baseUrl, `/growth-rank-bot/client-portal/${detail.payload.workspace.portalSessions[0].portalToken}`, { branchId });
    assert.equal(portal.response.status, 200);
    assert.equal(portal.payload.audit.businessName, "Legacy Aura Growth");
  } finally {
    await close(server);
  }
});

test("growth rank bot preview validates required business name", async () => {
  const server = await listen(createApp());
  const baseUrl = `http://127.0.0.1:${server.address().port}/api`;
  try {
    const missing = await api(baseUrl, "/growth-rank-bot/preview", {
      method: "POST",
      body: { city: "Delhi" }
    });
    assert.equal(missing.response.status, 400);
    assert.match(missing.payload.error, /businessName/);

    const preview = await api(baseUrl, "/growth-rank-bot/preview", {
      method: "POST",
      body: { businessName: "Preview Salon", city: "Delhi", topServices: ["haircut"] }
    });
    assert.equal(preview.response.status, 200);
    assert.equal(preview.payload.input.businessName, "Preview Salon");
    assert.equal(preview.payload.plan.providerStrategy.currentEngine, "deterministic audit planner with persisted outputs");
  } finally {
    await close(server);
  }
});
