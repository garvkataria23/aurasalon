import { clvRepo } from "../repositories/clv.repo.js";

function clampPercent(value) {
  return Math.max(0, Math.min(40, Math.round(Number(value || 0))));
}

export function getClvAdjustedDiscount(input = {}) {
  const baseDiscountPercent = clampPercent(input.baseDiscountPercent);
  const clv = clvRepo.getScore(input);
  if (!clv) {
    return {
      discountPercent: baseDiscountPercent,
      strategy: "default",
      reason: "No CLV score exists for this client yet."
    };
  }

  if (clv.acquisitionStage === "new" && clv.predictedClvPaise > 5000000) {
    return {
      discountPercent: clampPercent(baseDiscountPercent + 10),
      strategy: "acquisition_invest",
      reason: "New high-potential client; allow controlled acquisition discount."
    };
  }

  if (clv.acquisitionStage === "at_risk" && clv.currentValuePaise > 2000000) {
    return {
      discountPercent: clampPercent(baseDiscountPercent + 15),
      strategy: "retention_save",
      reason: "High-value at-risk client; retention budget can justify a stronger offer."
    };
  }

  if (clv.acquisitionStage === "mature" && clv.churnRisk < 0.2) {
    return {
      discountPercent: clampPercent(baseDiscountPercent - 10),
      strategy: "loyal_optimize",
      reason: "Mature low-churn client; reduce unnecessary discount leakage."
    };
  }

  return {
    discountPercent: baseDiscountPercent,
    strategy: "standard",
    reason: "CLV score exists but does not require adjustment."
  };
}

export const clvPricer = { getClvAdjustedDiscount };
