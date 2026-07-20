import { dashboardAggregationService } from "../../services/dashboard-aggregation.service.js";

export async function run(job) {
  if (!job.tenantId) return { success: false, error: "tenantId is required" };
  dashboardAggregationService.refreshDailySummary(job.tenantId);
  return { success: true };
}
