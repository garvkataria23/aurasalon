import { db } from "../db.js";
import { dashboardAggregationService } from "./dashboard-aggregation.service.js";
import { ensureDashboardSchema } from "./dashboard-schema.service.js";

ensureDashboardSchema();

const money = (value) => Math.round((Number(value) || 0) * 100) / 100;
const todayIso = () => new Date().toISOString().slice(0, 10);

export class CustomerSegmentationService {
  computeRFMScores(tenantId) {
    return dashboardAggregationService.refreshCustomerMetrics(tenantId);
  }

  ensureFreshMetrics(tenantId) {
    const freshness = db.prepare(
      "SELECT COUNT(*) AS count, MAX(updated_at) AS updatedAt FROM customer_metrics WHERE tenant_id = ?"
    ).get(tenantId);
    if (!freshness.count || String(freshness.updatedAt || "").slice(0, 10) < todayIso()) {
      this.computeRFMScores(tenantId);
    }
  }

  assignSegments(tenantId) {
    this.ensureFreshMetrics(tenantId);
    return this.getSegmentStats(tenantId);
  }

  getSegmentStats(tenantId) {
    this.ensureFreshMetrics(tenantId);
    return db.prepare(
      `SELECT segment, COUNT(*) AS customerCount, COALESCE(SUM(clv), 0) AS totalCLV,
              COALESCE(AVG(clv), 0) AS avgCLV
       FROM customer_metrics
       WHERE tenant_id = ?
       GROUP BY segment
       ORDER BY totalCLV DESC`
    ).all(tenantId).map((row) => ({
      segment: row.segment || "Unclassified",
      customerCount: Number(row.customerCount || 0),
      totalCLV: money(row.totalCLV),
      avgCLV: money(row.avgCLV)
    }));
  }

  getCustomersBySegment(tenantId, segment, limit = 50, offset = 0, sortBy = "clv") {
    this.ensureFreshMetrics(tenantId);
    const allowedSort = new Map([
      ["clv", "cm.clv DESC"],
      ["total_spent", "cm.total_spent DESC"],
      ["visits", "cm.total_visits DESC"],
      ["last_visit", "cm.last_visit_date DESC"],
      ["name", "c.name ASC"]
    ]);
    const orderBy = allowedSort.get(sortBy) || allowedSort.get("clv");
    return db.prepare(
      `SELECT c.id, c.name, c.phone, c.email, c.branchId, cm.total_visits AS totalVisits,
              cm.total_spent AS totalSpent, cm.last_visit_date AS lastVisitDate,
              cm.avg_gap_days AS avgGapDays, cm.rfm_recency AS rfmRecency,
              cm.rfm_frequency AS rfmFrequency, cm.rfm_monetary AS rfmMonetary,
              cm.segment, cm.clv
       FROM customer_metrics cm
       JOIN clients c ON c.id = cm.customer_id AND c.tenantId = cm.tenant_id
       WHERE cm.tenant_id = @tenantId AND cm.segment = @segment
       ORDER BY ${orderBy}
       LIMIT @limit OFFSET @offset`
    ).all({
      tenantId,
      segment,
      limit: Math.min(Number(limit) || 50, 200),
      offset: Math.max(Number(offset) || 0, 0)
    });
  }
}

export const customerSegmentationService = new CustomerSegmentationService();
