import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { happyHoursNoShowRiskRepo } from "../repositories/happy-hours-no-show-risk.repo.js";
import { badRequest } from "../utils/app-error.js";

export const happyHoursNoShowRiskRouter = Router();

function scope(req) {
  const tenantId = req.header("x-tenant-id") || req.access?.tenantId || req.query?.tenantId || req.body?.tenantId || "";
  const branchId = req.header("x-branch-id") || req.access?.branchId || req.query?.branchId || req.body?.branchId || "";
  if (!tenantId || !branchId) throw badRequest("tenantId and branchId are required");
  return { tenantId, branchId };
}

function input(req) {
  return {
    ...scope(req),
    clientId: req.query.clientId || req.body?.clientId,
    serviceCategory: req.query.serviceCategory || req.body?.serviceCategory,
    signalDate: req.query.signalDate || req.body?.signalDate,
    dayOfWeek: req.query.dayOfWeek || req.body?.dayOfWeek,
    hourSlot: req.query.hourSlot || req.body?.hourSlot,
    requestedStartAt: req.query.requestedStartAt || req.body?.requestedStartAt,
    cartTotalPaise: req.query.cartTotalPaise || req.body?.cartTotalPaise,
    servicePricePaise: req.query.servicePricePaise || req.body?.servicePricePaise,
    baseDiscountPercent: req.query.baseDiscountPercent || req.body?.baseDiscountPercent,
    clientNoShowCount: req.query.clientNoShowCount || req.body?.clientNoShowCount,
    clientCancelCount: req.query.clientCancelCount || req.body?.clientCancelCount,
    clientCompletedCount: req.query.clientCompletedCount || req.body?.clientCompletedCount,
    branchNoShowRatePercent: req.query.branchNoShowRatePercent || req.body?.branchNoShowRatePercent,
    depositStatus: req.query.depositStatus || req.body?.depositStatus,
    lookbackDays: req.query.lookbackDays || req.body?.lookbackDays
  };
}

function asBadRequest(error, fallback) {
  return badRequest(error.message || fallback);
}

happyHoursNoShowRiskRouter.get(
  "/evaluate",
  asyncHandler((req, res) => {
    try {
      res.json(happyHoursNoShowRiskRepo.evaluate(input(req)));
    } catch (error) {
      throw asBadRequest(error, "Unable to evaluate no-show risk offers");
    }
  })
);

happyHoursNoShowRiskRouter.get(
  "/suggestions",
  asyncHandler((req, res) => {
    res.json(happyHoursNoShowRiskRepo.listSuggestions({
      ...scope(req),
      status: req.query.status,
      limit: req.query.limit
    }));
  })
);

happyHoursNoShowRiskRouter.post(
  "/suggestions",
  asyncHandler((req, res) => {
    try {
      res.status(201).json({ suggestion: happyHoursNoShowRiskRepo.saveSuggestion(input(req)) });
    } catch (error) {
      throw asBadRequest(error, "Unable to save no-show risk suggestion");
    }
  })
);

happyHoursNoShowRiskRouter.patch(
  "/suggestions/:id/status",
  asyncHandler((req, res) => {
    try {
      res.json({
        suggestion: happyHoursNoShowRiskRepo.updateStatus({
          ...scope(req),
          id: req.params.id,
          status: req.body?.status
        })
      });
    } catch (error) {
      throw asBadRequest(error, "Unable to update no-show risk suggestion");
    }
  })
);
