import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { captchaMiddleware } from "../middleware/captcha.middleware.js";
import { publicBookingRateLimit } from "../middleware/public-booking-rate-limit.middleware.js";
import { publicBookingActionService } from "../services/public-booking-action.service.js";
import { publicActionTokenService } from "../services/public-action-token.service.js";
import { AppError } from "../utils/app-error.js";

export const publicBookingActionsRouter = Router();

publicBookingActionsRouter.use("/public-booking", publicBookingRateLimit({ max: 30, windowMs: 60_000 }));

function tokenGuard(req, _res, next) {
  const result = publicActionTokenService.recordAttempt(req.params.token, req.ip || "");
  if (result.ipCount >= 5 || result.attempts > 60) {
    next(new AppError("This booking link has been locked after suspicious activity", 423));
    return;
  }
  next();
}

publicBookingActionsRouter.get(
  "/public-booking/:token/details",
  tokenGuard,
  asyncHandler((req, res) => {
    res.json(publicBookingActionService.getBookingDetails(req.params.token));
  })
);

publicBookingActionsRouter.post(
  "/public-booking/:token/cancel",
  tokenGuard,
  captchaMiddleware,
  asyncHandler((req, res) => {
    res.json(publicBookingActionService.cancelBooking({
      token: req.params.token,
      reason: req.body?.reason || ""
    }));
  })
);

publicBookingActionsRouter.post(
  "/public-booking/:token/reschedule/options",
  tokenGuard,
  captchaMiddleware,
  asyncHandler((req, res) => {
    res.json(publicBookingActionService.getRescheduleOptions({
      token: req.params.token,
      date: req.body?.date || req.query.date || ""
    }));
  })
);

publicBookingActionsRouter.post(
  "/public-booking/:token/reschedule/confirm",
  tokenGuard,
  captchaMiddleware,
  asyncHandler((req, res) => {
    res.json(publicBookingActionService.confirmReschedule({
      token: req.params.token,
      newSlot: req.body?.newSlot || req.body?.slot || {},
      reason: req.body?.reason || ""
    }));
  })
);
