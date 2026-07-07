import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { appointmentLifecycleService } from "../services/appointment-lifecycle.service.js";
import { blackoutService } from "../services/blackout.service.js";
import { bookingAttributionService } from "../services/booking-attribution.service.js";
import { calendarExportService } from "../services/calendar-export.service.js";
import { customerPreferencesService } from "../services/customer-preferences.service.js";
import { familyAccountService } from "../services/family-account.service.js";
import { groupBookingService } from "../services/group-booking.service.js";
import { jobQueueService } from "../services/job-queue.service.js";
import { securityService } from "../services/security.service.js";
import { serviceRulesService } from "../services/service-rules.service.js";
import { warrantyService } from "../services/warranty.service.js";
import { wizardStateService } from "../services/wizard-state.service.js";

export const appointmentSafetyRouter = Router();
export const calendarPublicRouter = Router();

appointmentSafetyRouter.post(
  "/appointments/:id/status",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    const result = appointmentLifecycleService.setStatus(req.params.id, req.body, req.access);
    securityService.audit({ action: "appointment.status_changed", targetType: "appointment", targetId: req.params.id, details: { status: req.body.status } }, req.access, req);
    res.json(result);
  })
);

appointmentSafetyRouter.post(
  "/appointment-lifecycle/appointments/:id/status",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    const result = appointmentLifecycleService.setStatus(req.params.id, req.body, req.access);
    securityService.audit({ action: "appointment.status_changed", targetType: "appointment", targetId: req.params.id, details: { status: req.body.status } }, req.access, req);
    res.json(result);
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/cancel",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    const result = appointmentLifecycleService.cancel(req.params.id, req.body, req.access);
    securityService.audit({ action: "appointment.cancelled", targetType: "appointment", targetId: req.params.id, details: { reason: req.body.reason || "" }, severity: "warning" }, req.access, req);
    res.json(result);
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/reschedule",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    const result = appointmentLifecycleService.reschedule(req.params.id, req.body, req.access, req);
    securityService.audit({ action: "appointment.rescheduled", targetType: "appointment", targetId: req.params.id, details: { startAt: req.body.startAt || req.body.slot?.startAt || req.body.slot?.startTime || "" } }, req.access, req);
    res.json(result);
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/check-in",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(appointmentLifecycleService.checkIn(req.params.id, req.access));
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/start-service",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(appointmentLifecycleService.startService(req.params.id, req.access));
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/complete",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(appointmentLifecycleService.complete(req.params.id, req.body, req.access));
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/no-show",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(appointmentLifecycleService.noShow(req.params.id, req.body, req.access));
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/duplicate",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(appointmentLifecycleService.duplicate(req.params.id, req.body, req.access, req));
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/convert-to-sale",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(appointmentLifecycleService.convertToSale(req.params.id, req.body, req.access));
  })
);

appointmentSafetyRouter.get(
  "/appointments/:id/touchup-eligibility",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(warrantyService.eligibility(req.params.id, req.access));
  })
);

appointmentSafetyRouter.post(
  "/appointments/:id/create-touchup",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(warrantyService.createTouchupAppointment(req.params.id, req.body, req.access, req));
  })
);

appointmentSafetyRouter.get(
  "/audit/appointments/:id",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json({
      appointmentId: req.params.id,
      auditLogs: securityService.auditTrail({ targetId: req.params.id, limit: req.query.limit || 100 }, req.access)
    });
  })
);

appointmentSafetyRouter.post(
  "/services/resolve-chain",
  requirePermission("read", () => "services"),
  asyncHandler((req, res) => {
    res.json({
      services: serviceRulesService.resolveServiceChain(req.access.tenantId, req.body?.serviceIds || [])
    });
  })
);

appointmentSafetyRouter.post(
  "/services/validate-combo",
  requirePermission("read", () => "services"),
  asyncHandler((req, res) => {
    res.json(serviceRulesService.validateServiceCombo(
      req.access.tenantId,
      req.body?.customerId || req.body?.clientId || "",
      req.body?.serviceIds || [],
      req.body?.date || req.body?.startAt || new Date().toISOString()
    ));
  })
);

appointmentSafetyRouter.get(
  "/blackouts",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(blackoutService.listBlackouts(req.access, req.query));
  })
);

appointmentSafetyRouter.post(
  "/blackouts",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(blackoutService.createBlackout(req.access, req.body));
  })
);

appointmentSafetyRouter.delete(
  "/blackouts/:id",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(blackoutService.deleteBlackout(req.access, req.params.id));
  })
);

appointmentSafetyRouter.put(
  "/booking-wizard/state",
  requirePermission("write", () => "booking-portal"),
  asyncHandler((req, res) => {
    res.json(wizardStateService.saveState(req.access, req.body));
  })
);

appointmentSafetyRouter.get(
  "/booking-wizard/state/:sessionId",
  requirePermission("read", () => "booking-portal"),
  asyncHandler((req, res) => {
    res.json(wizardStateService.loadState(req.access, req.params.sessionId));
  })
);

appointmentSafetyRouter.delete(
  "/booking-wizard/state/:sessionId",
  requirePermission("write", () => "booking-portal"),
  asyncHandler((req, res) => {
    res.json(wizardStateService.clearState(req.access, req.params.sessionId));
  })
);

appointmentSafetyRouter.get(
  "/reports/booking-attribution",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(bookingAttributionService.getAttributionReport(req.access, req.query));
  })
);

appointmentSafetyRouter.get(
  "/reports/warranty-cost-impact",
  requirePermission("read", () => "analytics"),
  asyncHandler((req, res) => {
    res.json(warrantyService.costImpact(req.access, req.query));
  })
);

appointmentSafetyRouter.post(
  "/booking-groups",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(groupBookingService.createGroup(req.body, req.access));
  })
);

appointmentSafetyRouter.get(
  "/booking-groups/:id/calendar",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(groupBookingService.calendarView(req.params.id, req.access));
  })
);

appointmentSafetyRouter.post(
  "/booking-groups/:id/confirm",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(groupBookingService.confirmGroup(req.params.id, req.body, req.access, req));
  })
);

appointmentSafetyRouter.post(
  "/booking-groups/:id/consolidate-billing",
  requirePermission("write", () => "sales"),
  asyncHandler((req, res) => {
    res.status(201).json(groupBookingService.consolidateGroupBilling(req.params.id, req.body, req.access));
  })
);

appointmentSafetyRouter.get(
  "/booking-groups/:id",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(groupBookingService.getGroup(req.params.id, req.access));
  })
);

appointmentSafetyRouter.patch(
  "/booking-groups/:id",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(groupBookingService.updateGroup(req.params.id, req.body, req.access));
  })
);

appointmentSafetyRouter.post(
  "/calendar/tokens",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(calendarExportService.generateToken(req.access, req.body));
  })
);

appointmentSafetyRouter.delete(
  "/calendar/tokens/:id",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(calendarExportService.revokeToken(req.access, req.params.id));
  })
);

appointmentSafetyRouter.get(
  "/jobs",
  requirePermission("read", () => "security"),
  asyncHandler((req, res) => {
    res.json(jobQueueService.list(req.access, req.query));
  })
);

appointmentSafetyRouter.post(
  "/jobs/:id/retry",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.json(jobQueueService.retry(req.access, req.params.id));
  })
);

appointmentSafetyRouter.delete(
  "/jobs/:id",
  requirePermission("write", () => "security"),
  asyncHandler((req, res) => {
    res.json(jobQueueService.delete(req.access, req.params.id));
  })
);

function mountFamilyRoutes(basePath) {
  appointmentSafetyRouter.get(
    `${basePath}/:id/preferences`,
    requirePermission("read", () => "clients"),
    asyncHandler((req, res) => {
      res.json(customerPreferencesService.getPreferences(req.params.id, req.access));
    })
  );

  appointmentSafetyRouter.patch(
    `${basePath}/:id/preferences`,
    requirePermission("write", () => "clients"),
    asyncHandler((req, res) => {
      res.json(customerPreferencesService.updatePreferences(req.params.id, req.body, req.access));
    })
  );

  appointmentSafetyRouter.get(
    `${basePath}/family-tree`,
    requirePermission("read", () => "clients"),
    asyncHandler((req, res) => {
      res.json(familyAccountService.familyTreeByPhone(req.query.phone || "", req.access));
    })
  );

  appointmentSafetyRouter.get(
    `${basePath}/:id/family-members`,
    requirePermission("read", () => "clients"),
    asyncHandler((req, res) => {
      res.json(familyAccountService.members(req.params.id, req.access));
    })
  );

  appointmentSafetyRouter.post(
    `${basePath}/:id/link-member`,
    requirePermission("write", () => "clients"),
    asyncHandler((req, res) => {
      res.status(201).json(familyAccountService.linkMember(req.params.id, req.body, req.access));
    })
  );

  appointmentSafetyRouter.delete(
    `${basePath}/:id/link-member/:memberId`,
    requirePermission("write", () => "clients"),
    asyncHandler((req, res) => {
      res.json(familyAccountService.unlinkMember(req.params.id, req.params.memberId, req.access));
    })
  );
}

mountFamilyRoutes("/clients");
mountFamilyRoutes("/customers");

calendarPublicRouter.get(
  "/calendar/ical/staff/:staffId",
  asyncHandler((req, res) => {
    const feed = calendarExportService.getICalFeed({
      scope: "staff",
      scopeId: req.params.staffId,
      token: req.query.token || ""
    });
    res.type("text/calendar").send(feed);
  })
);

calendarPublicRouter.get(
  "/calendar/ical/branch/:branchId",
  asyncHandler((req, res) => {
    const feed = calendarExportService.getICalFeed({
      scope: "branch",
      scopeId: req.params.branchId,
      token: req.query.token || ""
    });
    res.type("text/calendar").send(feed);
  })
);
