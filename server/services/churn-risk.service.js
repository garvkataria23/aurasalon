import { db } from "../db.js";

function daysSince(value) {
  if (!value) return 9999;
  return Math.max(0, Math.floor((Date.now() - new Date(value).getTime()) / 864e5));
}

function scoreRow(row) {
  const avgGap = Number(row.avg_gap_days || 45) || 45;
  const days = daysSince(row.last_visit_date);
  const factors = [];
  let score = 0;
  if (days > avgGap * 2) {
    score += 50;
    factors.push({ rule: "days_since_last_visit_gt_2x_gap", points: 50, value: days });
  } else if (days > avgGap * 1.5) {
    score += 30;
    factors.push({ rule: "days_since_last_visit_gt_1_5x_gap", points: 30, value: days });
  }
  if (Number(row.noShowCount || 0) > 3) {
    score += 20;
    factors.push({ rule: "no_show_history", points: 20, value: row.noShowCount });
  }
  if (Number(row.cancellationCount || 0) > 5) {
    score += 10;
    factors.push({ rule: "cancellation_history", points: 10, value: row.cancellationCount });
  }
  if (Number(row.total_visits || 0) > 10) {
    score -= 10;
    factors.push({ rule: "loyal_history", points: -10, value: row.total_visits });
  }
  const churnScore = Math.max(0, Math.min(100, score));
  return {
    customerId: row.customer_id || row.id,
    name: row.name,
    phone: row.phone,
    clv: Number(row.clv || row.total_spent || 0),
    lastVisitDate: row.last_visit_date,
    avgGapDays: avgGap,
    churnScore,
    riskLevel: churnScore >= 70 ? "critical" : churnScore >= 50 ? "high" : churnScore >= 30 ? "medium" : "low",
    factors
  };
}

export const churnRiskService = {
  calculateChurnScore(access, customerId) {
    const row = db.prepare(
      `SELECT c.id, c.name, c.phone, c.noShowCount, c.cancellationCount,
              m.customer_id, m.total_visits, m.total_spent, m.last_visit_date,
              m.avg_gap_days, m.clv
       FROM clients c
       LEFT JOIN customer_metrics m ON m.tenant_id = c.tenantId AND m.customer_id = c.id
       WHERE c.tenantId = ? AND c.id = ?`
    ).get(access.tenantId, customerId);
    return scoreRow(row || { id: customerId });
  },

  getAtRiskCustomers(access, { branchId = "", limit = 100 } = {}) {
    const rows = db.prepare(
      `SELECT c.id, c.name, c.phone, c.branchId, c.noShowCount, c.cancellationCount,
              m.customer_id, m.total_visits, m.total_spent, m.last_visit_date,
              m.avg_gap_days, m.clv
       FROM clients c
       LEFT JOIN customer_metrics m ON m.tenant_id = c.tenantId AND m.customer_id = c.id
       WHERE c.tenantId = ? AND (? = '' OR c.branchId = ?)
       LIMIT ?`
    ).all(access.tenantId, branchId, branchId, Math.min(Number(limit || 100), 500));
    return rows.map(scoreRow).filter((row) => row.churnScore >= 30).sort((a, b) => b.churnScore - a.churnScore || b.clv - a.clv);
  }
};
