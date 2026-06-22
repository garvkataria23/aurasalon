import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { bookingPortalService } from "../services/booking-portal.service.js";
import { securityService } from "../services/security.service.js";
import { enrichServicesWithHappyHours, enrichSlotsWithHappyHours } from "../utils/happy-hours-portal-enrichment.js";

export const bookingPortalRouter = Router();

bookingPortalRouter.get(
  "/booking-portal/context",
  requirePermission("read", () => "booking-portal"),
  asyncHandler((req, res) => {
    const context = bookingPortalService.context(req.query, req.access);
    const scope = { ...req.access, branchId: req.query.branchId || req.access.branchId || context.branches?.[0]?.id || "" };
    res.json({
      ...context,
      services: enrichServicesWithHappyHours(context.services || [], scope)
    });
  })
);

bookingPortalRouter.post(
  "/booking-portal/slots",
  requirePermission("write", () => "booking-portal"),
  asyncHandler((req, res) => {
    const result = bookingPortalService.slots(req.body, req.access);
    const scope = { ...req.access, branchId: req.body.branchId || req.access.branchId || "" };
    res.status(201).json({
      ...result,
      recommendations: enrichSlotsWithHappyHours(result.recommendations || [], scope)
    });
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
