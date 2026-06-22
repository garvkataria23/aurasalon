import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { appointmentDepositGateService } from "../services/appointment-deposit-gate.service.js";

export const appointmentDepositGateRouter = Router();

appointmentDepositGateRouter.post(
  "/appointment-deposits/quote",
  requirePermission("read", () => "appointments"),
  requirePermission("read", () => "appointment_deposits"),
  asyncHandler((req, res) => {
    res.json(appointmentDepositGateService.quote(req.body, req.access));
  })
);

appointmentDepositGateRouter.post(
  "/appointment-deposits/multi-service-bookings",
  requirePermission("write", () => "appointments"),
  requirePermission("write", () => "appointment_deposits"),
  asyncHandler((req, res) => {
    res.status(201).json(appointmentDepositGateService.createBooking(req.body, req.access, req));
  })
);

appointmentDepositGateRouter.get(
  "/appointment-deposits/report",
  requirePermission("read", () => "appointment_deposits"),
  asyncHandler((req, res) => {
    res.json(appointmentDepositGateService.report(req.query, req.access));
  })
);

appointmentDepositGateRouter.patch(
  "/appointment-deposits/followups/:paymentLinkId",
  requirePermission("write", () => "appointment_deposits"),
  asyncHandler((req, res) => {
    res.json(appointmentDepositGateService.updateFollowUp(req.params.paymentLinkId, req.body, req.access));
  })
);
