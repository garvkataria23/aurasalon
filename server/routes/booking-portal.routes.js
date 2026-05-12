import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { bookingPortalService } from "../services/booking-portal.service.js";
import { securityService } from "../services/security.service.js";

export const bookingPortalRouter = Router();

bookingPortalRouter.get(
  "/booking-portal/context",
  requirePermission("read", () => "booking-portal"),
  asyncHandler((req, res) => {
    res.json(bookingPortalService.context(req.query, req.access));
  })
);

bookingPortalRouter.post(
  "/booking-portal/slots",
  requirePermission("write", () => "booking-portal"),
  asyncHandler((req, res) => {
    res.status(201).json(bookingPortalService.slots(req.body, req.access));
  })
);

bookingPortalRouter.post(
  "/booking-portal/confirm",
  requirePermission("write", () => "booking-portal"),
  asyncHandler((req, res) => {
    const result = bookingPortalService.confirm(req.body, req.access);
    securityService.audit({ action: "booking.created", targetType: "appointment", targetId: result.appointment?.id || "", details: { source: "booking-portal", requestId: result.request?.id || "" } }, req.access, req);
    res.status(201).json(result);
  })
);

bookingPortalRouter.patch(
  "/booking-portal/appointments/:id/cancel",
  requirePermission("write", () => "booking-portal"),
  asyncHandler((req, res) => {
    const result = bookingPortalService.cancel(req.params.id, req.body, req.access);
    securityService.audit({ action: "booking.cancelled", targetType: "appointment", targetId: req.params.id, details: { reason: req.body.reason || "", source: "booking-portal" }, severity: "warning" }, req.access, req);
    res.json(result);
  })
);

bookingPortalRouter.patch(
  "/booking-portal/appointments/:id/reschedule",
  requirePermission("write", () => "booking-portal"),
  asyncHandler((req, res) => {
    const result = bookingPortalService.reschedule(req.params.id, req.body, req.access);
    securityService.audit({ action: "booking.rescheduled", targetType: "appointment", targetId: req.params.id, details: { startAt: req.body.startAt, staffId: req.body.staffId, source: "booking-portal" } }, req.access, req);
    res.json(result);
  })
);
