import { resources } from "../db.js";
import { repositories } from "../repositories/repository-registry.js";
import { tenantService } from "./tenant.service.js";

const now = () => new Date().toISOString();

export const levelCatalog = [
  { level: 27, key: "ai-voice-receptionist", label: "AI Voice Receptionist", resources: ["voiceCallLogs", "voiceBookingSessions"], status: "operational" },
  { level: 28, key: "smart-queue", label: "Smart Queue System", resources: ["realtimeQueue", "queueDisplays"], status: "operational" },
  { level: 29, key: "dynamic-pricing", label: "Dynamic Pricing Engine", resources: ["dynamicPricingRules", "innovationRuns"], status: "operational" },
  { level: 30, key: "growth-advisor", label: "AI Growth Advisor", resources: ["growthAdvisorTasks", "innovationRuns"], status: "operational" },
  { level: 31, key: "franchise", label: "Franchise System", resources: ["franchises", "franchiseRoyalties"], status: "operational" },
  { level: 32, key: "training-academy", label: "Training Academy", resources: ["trainingLessons", "trainingAssignments"], status: "operational" },
  { level: 33, key: "image-analysis", label: "AI Image Analysis", resources: ["imageAnalyses"], status: "operational" },
  { level: 34, key: "reputation", label: "Reputation Management", resources: ["reputationReviews"], status: "operational" },
  { level: 35, key: "campaign-engine", label: "Smart Campaign Engine", resources: ["marketingWorkflows", "campaigns"], status: "operational" },
  { level: 36, key: "marketplace-integrations", label: "Marketplace Integration", resources: ["marketplaceConnections", "pluginManifests"], status: "operational" },
  { level: 37, key: "mobile-apps", label: "Mobile App Ecosystem", resources: ["mobileDevices", "pushSubscriptions", "pushNotifications"], status: "operational" },
  { level: 38, key: "gamification", label: "Gamification System", resources: ["gamificationEvents"], status: "operational" },
  { level: 39, key: "fraud-detection", label: "AI Fraud Detection", resources: ["fraudAlerts", "auditLogs"], status: "operational" },
  { level: 40, key: "notification-center", label: "Enterprise Notification Center", resources: ["notifications", "pushNotifications", "messageLogs"], status: "operational" },
  { level: 41, key: "smart-forms", label: "Smart Forms System", resources: ["smartForms", "formResponses"], status: "operational" },
  { level: 42, key: "recommendation-engine", label: "AI Recommendation Engine", resources: ["recommendationEvents", "aiInteractions"], status: "operational" },
  { level: 43, key: "data-warehouse", label: "Data Warehouse Layer", resources: ["warehouseSnapshots", "analyticsSnapshots"], status: "operational" },
  { level: 44, key: "kpi-monitoring", label: "KPI Monitoring", resources: ["kpiMonitors", "analyticsSnapshots"], status: "operational" },
  { level: 45, key: "appointment-optimization", label: "Smart Appointment Optimization", resources: ["appointmentOptimizations", "bookingRecommendations"], status: "operational" },
  { level: 46, key: "api-platform", label: "API Platform", resources: ["apiKeys", "webhooks"], status: "operational" },
  { level: 47, key: "predictive-forecasting", label: "AI Predictive Forecasting", resources: ["forecastingModels", "analyticsSnapshots"], status: "operational" },
  { level: 48, key: "kiosk", label: "Smart Kiosk System", resources: ["kioskSessions", "smartForms"], status: "operational" },
  { level: 49, key: "knowledge-base", label: "AI Knowledge Base", resources: ["knowledgeBaseArticles", "trainingLessons"], status: "operational" },
  { level: 50, key: "ultimate-os", label: "Ultimate Salon OS", resources: ["pluginManifests", "appMarketplaceApps", "localizationProfiles"], status: "operational" }
];

function scope(access, branchId = "") {
  const scoped = tenantService.accessScope(access || {});
  if (branchId) scoped.branchId = branchId;
  return scoped;
}

export class EcosystemService {
  summary(query = {}, access) {
    const branchId = query.branchId || access.branchId || "";
    if (branchId) tenantService.assertBranchAccess(access, branchId);
    const rows = levelCatalog.map((level) => {
      const resourceCounts = Object.fromEntries(level.resources.map((resource) => {
        const repository = repositories[resource];
        const tableConfig = resources[resource];
        const countScope = tableConfig?.tenantScoped === false ? {} : scope(access, branchId);
        return [resource, repository ? repository.count(countScope) : 0];
      }));
      const totalRecords = Object.values(resourceCounts).reduce((sum, count) => sum + Number(count || 0), 0);
      return { ...level, resourceCounts, totalRecords, completion: totalRecords > 0 ? 100 : 70 };
    });
    return {
      generatedAt: now(),
      completion: Math.round(rows.reduce((sum, row) => sum + row.completion, 0) / rows.length),
      levels: rows,
      missing: rows.filter((row) => row.totalRecords === 0),
      architecture: {
        api: "/api/v1/ecosystem/level-coverage",
        persistence: "tenant-scoped SQLite resources",
        ui: "Angular standalone module pages",
        security: "JWT + RBAC + audit-ready resources"
      }
    };
  }
}

export const ecosystemService = new EcosystemService();
