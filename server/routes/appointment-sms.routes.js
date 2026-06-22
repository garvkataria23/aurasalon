import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { appointmentSmsService } from "../services/appointment-sms.service.js";

export const appointmentSmsRouter = Router();

appointmentSmsRouter.post(
  "/appointment-sms/appointments/:appointmentId/queue",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.status(201).json(appointmentSmsService.queueAppointmentSms(req.params.appointmentId, req.body, req.access));
  })
);
