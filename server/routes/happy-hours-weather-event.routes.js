import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { happyHoursWeatherEventRepo } from "../repositories/happy-hours-weather-event.repo.js";
import { badRequest } from "../utils/app-error.js";

export const happyHoursWeatherEventRouter = Router();

function scope(req) {
  const tenantId = req.header("x-tenant-id") || req.access?.tenantId || req.query?.tenantId || req.body?.tenantId || "";
  const branchId = req.header("x-branch-id") || req.access?.branchId || req.query?.branchId || req.body?.branchId || "";
  if (!tenantId || !branchId) throw badRequest("tenantId and branchId are required");
  return { tenantId, branchId };
}

function input(req) {
  return {
    ...scope(req),
    city: req.query.city || req.body?.city,
    serviceCategory: req.query.serviceCategory || req.body?.serviceCategory,
    signalDate: req.query.signalDate || req.body?.signalDate,
    dayOfWeek: req.query.dayOfWeek || req.body?.dayOfWeek,
    hourSlot: req.query.hourSlot || req.body?.hourSlot,
    weatherCondition: req.query.weatherCondition || req.body?.weatherCondition,
    temperatureCelsius: req.query.temperatureCelsius || req.body?.temperatureCelsius,
    rainProbabilityPercent: req.query.rainProbabilityPercent || req.body?.rainProbabilityPercent,
    eventType: req.query.eventType || req.body?.eventType,
    eventName: req.query.eventName || req.body?.eventName,
    expectedFootfall: req.query.expectedFootfall || req.body?.expectedFootfall,
    baseDiscountPercent: req.query.baseDiscountPercent || req.body?.baseDiscountPercent,
    servicePricePaise: req.query.servicePricePaise || req.body?.servicePricePaise
  };
}

function asBadRequest(error, fallback) {
  return badRequest(error.message || fallback);
}

happyHoursWeatherEventRouter.get(
  "/evaluate",
  asyncHandler((req, res) => {
    try {
      res.json(happyHoursWeatherEventRepo.evaluate(input(req)));
    } catch (error) {
      throw asBadRequest(error, "Unable to evaluate weather/event offers");
    }
  })
);

happyHoursWeatherEventRouter.get(
  "/suggestions",
  asyncHandler((req, res) => {
    res.json(happyHoursWeatherEventRepo.listSuggestions({
      ...scope(req),
      status: req.query.status,
      limit: req.query.limit
    }));
  })
);

happyHoursWeatherEventRouter.post(
  "/suggestions",
  asyncHandler((req, res) => {
    try {
      res.status(201).json({ suggestion: happyHoursWeatherEventRepo.saveSuggestion(input(req)) });
    } catch (error) {
      throw asBadRequest(error, "Unable to save weather/event suggestion");
    }
  })
);

happyHoursWeatherEventRouter.patch(
  "/suggestions/:id/status",
  asyncHandler((req, res) => {
    try {
      res.json({
        suggestion: happyHoursWeatherEventRepo.updateStatus({
          ...scope(req),
          id: req.params.id,
          status: req.body?.status
        })
      });
    } catch (error) {
      throw asBadRequest(error, "Unable to update weather/event suggestion");
    }
  })
);
