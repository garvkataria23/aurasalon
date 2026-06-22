import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { securityService } from "../services/security.service.js";
import { smartBookingService } from "../services/smart-booking.service.js";

export const smartBookingRouter = Router();

smartBookingRouter.get(
  "/smart-booking/summary",
  requirePermission("read", () => "smart-booking"),
  asyncHandler((req, res) => {
    res.json(smartBookingService.summary(req.query, req.access));
  })
);

smartBookingRouter.post(
  "/smart-booking/recommend-slots",
  requirePermission("write", () => "smart-booking"),
  asyncHandler((req, res) => {
    res.status(201).json(smartBookingService.recommendSlots(req.body, req.access));
  })
);

smartBookingRouter.post(
  "/smart-booking/bookings",
  requirePermission("write", () => "smart-booking"),
  asyncHandler((req, res) => {
    const result = smartBookingService.createBooking(req.body, req.access);
    securityService.audit({ action: "booking.created", targetType: "appointment", targetId: result.appointment?.id || result.id || "", details: { source: "smart-booking", recommendationId: result.recommendation?.id || "" } }, req.access, req);
    res.status(201).json(result);
  })
);

smartBookingRouter.post(
  "/smart-booking/waitlist",
  requirePermission("write", () => "smart-booking"),
  asyncHandler((req, res) => {
    res.status(201).json(smartBookingService.addWaitlist(req.body, req.access));
  })
);

smartBookingRouter.post(
  "/smart-booking/waitlist/:id/promote",
  requirePermission("write", () => "smart-booking"),
  asyncHandler((req, res) => {
    const result = smartBookingService.promoteWaitlist(req.params.id, req.body, req.access);
    securityService.audit({ action: "booking.created", targetType: "appointment", targetId: result.appointment?.id || "", details: { source: "waitlist", waitlistId: req.params.id } }, req.access, req);
    res.json(result);
  })
);

smartBookingRouter.post(
  "/smart-booking/online-request",
  requirePermission("write", () => "smart-booking"),
  asyncHandler((req, res) => {
    res.status(201).json(smartBookingService.onlineRequest(req.body, req.access));
  })
);

smartBookingRouter.post(
  "/smart-booking/qr-check-in",
  requirePermission("write", () => "smart-booking"),
  asyncHandler((req, res) => {
    res.status(201).json(smartBookingService.qrCheckIn(req.body, req.access));
  })
);

smartBookingRouter.get(
  "/smart-booking/queue-prediction",
  requirePermission("read", () => "smart-booking"),
  asyncHandler((req, res) => {
    res.json(smartBookingService.queuePrediction(req.query, req.access));
  })
);
