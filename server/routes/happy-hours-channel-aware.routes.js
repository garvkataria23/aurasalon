import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { happyHoursChannelAwareRepo } from "../repositories/happy-hours-channel-aware.repo.js";
import { badRequest } from "../utils/app-error.js";

export const happyHoursChannelAwareRouter = Router();

function scope(req) {
  const tenantId = req.header("x-tenant-id") || req.access?.tenantId || req.query?.tenantId || req.body?.tenantId || "";
  const branchId = req.header("x-branch-id") || req.access?.branchId || req.query?.branchId || req.body?.branchId || "";
  if (!tenantId || !branchId) throw badRequest("tenantId and branchId are required");
  return { tenantId, branchId };
}

function input(req) {
  return {
    ...scope(req),
    sourceChannel: req.query.sourceChannel || req.body?.sourceChannel,
    campaignChannel: req.query.campaignChannel || req.body?.campaignChannel,
    serviceCategory: req.query.serviceCategory || req.body?.serviceCategory,
    signalDate: req.query.signalDate || req.body?.signalDate,
    dayOfWeek: req.query.dayOfWeek || req.body?.dayOfWeek,
    hourSlot: req.query.hourSlot || req.body?.hourSlot,
    servicePricePaise: req.query.servicePricePaise || req.body?.servicePricePaise,
    baseDiscountPercent: req.query.baseDiscountPercent || req.body?.baseDiscountPercent,
    channelFeePercent: req.query.channelFeePercent || req.body?.channelFeePercent,
    conversionRatePercent: req.query.conversionRatePercent || req.body?.conversionRatePercent,
    lookbackDays: req.query.lookbackDays || req.body?.lookbackDays
  };
}

function asBadRequest(error, fallback) {
  return badRequest(error.message || fallback);
}

happyHoursChannelAwareRouter.get(
  "/evaluate",
  asyncHandler((req, res) => {
    try {
      res.json(happyHoursChannelAwareRepo.evaluate(input(req)));
    } catch (error) {
      throw asBadRequest(error, "Unable to evaluate channel-aware offers");
    }
  })
);

happyHoursChannelAwareRouter.get(
  "/suggestions",
  asyncHandler((req, res) => {
    res.json(happyHoursChannelAwareRepo.listSuggestions({
      ...scope(req),
      status: req.query.status,
      limit: req.query.limit
    }));
  })
);

happyHoursChannelAwareRouter.post(
  "/suggestions",
  asyncHandler((req, res) => {
    try {
      res.status(201).json({ suggestion: happyHoursChannelAwareRepo.saveSuggestion(input(req)) });
    } catch (error) {
      throw asBadRequest(error, "Unable to save channel-aware suggestion");
    }
  })
);

happyHoursChannelAwareRouter.patch(
  "/suggestions/:id/status",
  asyncHandler((req, res) => {
    try {
      res.json({
        suggestion: happyHoursChannelAwareRepo.updateStatus({
          ...scope(req),
          id: req.params.id,
          status: req.body?.status
        })
      });
    } catch (error) {
      throw asBadRequest(error, "Unable to update channel-aware suggestion");
    }
  })
);
