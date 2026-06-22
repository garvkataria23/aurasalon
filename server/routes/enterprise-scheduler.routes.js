import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { enterpriseSchedulerService } from "../services/enterprise-scheduler.service.js";

export const enterpriseSchedulerRouter = Router();

enterpriseSchedulerRouter.get(
  "/enterprise-scheduler/context",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(enterpriseSchedulerService.context(req.query, req.access));
  })
);

enterpriseSchedulerRouter.get(
  "/enterprise-scheduler/appointments/:id/billing-status",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(enterpriseSchedulerService.appointmentBillingStatus(req.params.id, req.access));
  })
);

enterpriseSchedulerRouter.post(
  "/enterprise-scheduler/blocked-times",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(enterpriseSchedulerService.createBlockedTime(req.body, req.access));
  })
);

enterpriseSchedulerRouter.delete(
  "/enterprise-scheduler/blocked-times/:id",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(enterpriseSchedulerService.removeBlockedTime(req.params.id, req.access));
  })
);

enterpriseSchedulerRouter.post(
  "/enterprise-scheduler/multi-service-bookings",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(enterpriseSchedulerService.createMultiServiceBooking(req.body, req.access, req));
  })
);

enterpriseSchedulerRouter.patch(
  "/enterprise-scheduler/appointments/:id/move",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(enterpriseSchedulerService.moveAppointment(req.params.id, req.body, req.access, req));
  })
);
