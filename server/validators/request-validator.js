import { resources } from "../db.js";
import { badRequest } from "../utils/app-error.js";

export function validateResourceName(req, _res, next) {
  if (!resources[req.params.resource]) {
    next(badRequest(`Unknown API resource: ${req.params.resource}`));
    return;
  }
  next();
}

export function validateResourcePayload(req, _res, next) {
  const config = resources[req.params.resource];
  const missing = (config?.required || []).filter((field) => {
    const value = req.body?.[field];
    return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
  });

  if (missing.length) {
    next(badRequest(`Missing required fields: ${missing.join(", ")}`, { missing }));
    return;
  }
  next();
}

export function validateBody({ required = [], enums = {} } = {}) {
  return (req, _res, next) => {
    const missing = required.filter((field) => {
      const value = req.body?.[field];
      return value === undefined || value === null || value === "" || (Array.isArray(value) && value.length === 0);
    });
    if (missing.length) {
      next(badRequest(`Missing required fields: ${missing.join(", ")}`, { missing }));
      return;
    }
    for (const [field, values] of Object.entries(enums)) {
      if (req.body?.[field] !== undefined && !values.includes(req.body[field])) {
        next(badRequest(`Invalid ${field}. Allowed values: ${values.join(", ")}`));
        return;
      }
    }
    next();
  };
}

export function validateAnalyticsRequest(req, _res, next) {
  const dateFields = ["periodStart", "periodEnd"];
  for (const field of dateFields) {
    const value = req.body?.[field];
    if (value !== undefined && value !== "" && !/^\d{4}-\d{2}-\d{2}$/.test(String(value))) {
      next(badRequest(`${field} must use YYYY-MM-DD format`));
      return;
    }
  }
  if (req.body?.periodStart && req.body?.periodEnd && req.body.periodStart > req.body.periodEnd) {
    next(badRequest("periodStart must be before or equal to periodEnd"));
    return;
  }
  if (req.body?.type && !["advanced", "forecast", "retention", "branch", "membership"].includes(req.body.type)) {
    next(badRequest("Invalid analytics type"));
    return;
  }
  next();
}
