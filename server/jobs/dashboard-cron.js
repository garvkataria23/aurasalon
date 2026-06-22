import { dashboardAggregationService } from "../services/dashboard-aggregation.service.js";
import { anomalyDetectionService } from "../services/anomaly-detection.service.js";
import { db } from "../db.js";
import { logger } from "../utils/logger.js";

let started = false;

function activeTenants() {
  return db
    .prepare("SELECT id FROM tenants WHERE COALESCE(status, 'active') NOT IN ('deleted', 'suspended')")
    .all()
    .map((row) => row.id);
}

function guarded(name, fn) {
  try {
    fn();
  } catch (error) {
    logger.error("dashboard_cron_failed", { job: name, error: error.message });
  }
}

function runHourlyAndDaily() {
  guarded("dashboard-hourly-daily", () => {
    for (const tenantId of activeTenants()) {
      dashboardAggregationService.refreshHourlySummary(tenantId);
      dashboardAggregationService.refreshDailySummary(tenantId);
    }
  });
}

function runFullRefresh() {
  guarded("dashboard-full-refresh", () => {
    dashboardAggregationService.refreshAllTenants();
  });
}

function runAnomalies() {
  guarded("dashboard-anomalies", () => {
    for (const tenantId of activeTenants()) anomalyDetectionService.runAllChecks(tenantId);
  });
}

export function startDashboardCron() {
  if (started) return;
  started = true;

  runHourlyAndDaily();
  setInterval(runHourlyAndDaily, 5 * 60 * 1000);
  setInterval(runFullRefresh, 60 * 60 * 1000);
  setInterval(runAnomalies, 60 * 60 * 1000);

  logger.info("dashboard_cron_started", {
    schedules: ["*/5 * * * * hourly/daily", "0 * * * * full/anomaly lightweight"]
  });
}
