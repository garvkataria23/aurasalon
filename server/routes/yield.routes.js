import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { discountRulesRepo } from "../repositories/discount-rules.repo.js";
import { badRequest } from "../utils/app-error.js";
import { yieldEngine } from "../utils/yield-engine.js";

export const yieldRouter = Router();

function scope(req) {
  const tenantId = req.header("x-tenant-id") || req.access?.tenantId || req.query?.tenantId || req.body?.tenantId || "";
  const branchId = req.header("x-branch-id") || req.access?.branchId || req.query?.branchId || req.body?.branchId || "";
  if (!tenantId || !branchId) throw badRequest("tenantId and branchId are required");
  return { tenantId, branchId };
}

yieldRouter.get(
  "/recommend",
  asyncHandler((req, res) => {
    const recommendation = yieldEngine.recommendDiscount({
      ...scope(req),
      dayOfWeek: req.query.dayOfWeek,
      hourSlot: req.query.hourSlot,
      servicePricePaise: req.query.servicePricePaise
    });
    res.json(recommendation);
  })
);

yieldRouter.post(
  "/auto-apply",
  asyncHandler((req, res) => {
    const current = scope(req);
    const recommendation = yieldEngine.recommendDiscount({
      ...current,
      dayOfWeek: req.body?.dayOfWeek,
      hourSlot: req.body?.hourSlot,
      servicePricePaise: req.body?.servicePricePaise
    });
    if (recommendation.status !== "ready") {
      res.status(409).json({
        created: false,
        reason: "F1 gate is not ready; draft rule was not created.",
        recommendation
      });
      return;
    }

    const rule = discountRulesRepo.create({
      ...current,
      name: req.body?.name || `F1 Draft ${recommendation.recommendedDiscountPct}% ${req.body?.dayOfWeek || ""} ${req.body?.hourSlot || ""}:00`,
      description: "Draft rule created from F1 RL Dynamic Pricer advisory output. Never auto-active.",
      conditions: [
        { field: "dayOfWeek", operator: "equals", value: req.body?.dayOfWeek },
        { field: "timeRange", operator: "containsHour", value: req.body?.hourSlot }
      ],
      action: {
        type: "percent",
        value: recommendation.recommendedDiscountPct,
        applyTo: "cart"
      },
      priority: Number.parseInt(req.body?.priority, 10) || 50,
      stackable: false,
      status: "draft",
      createdBy: req.header("x-user-id") || req.header("x-user-role") || "f1_yield_engine"
    });

    res.status(201).json({ created: true, rule, recommendation });
  })
);
