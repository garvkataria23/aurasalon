import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { ownerAppointmentService } from "../services/owner-appointment.service.js";
import { ownerPosHandoffService } from "../services/owner-pos-handoff.service.js";
import { forbidden } from "../utils/app-error.js";

export const ownerAppointmentsRouter = Router();

function ownerOnly(req, _res, next) {
  if (req.access?.role !== "owner") return next(forbidden("Owner role is required"));
  next();
}

ownerAppointmentsRouter.use("/owner-console/appointments", ownerOnly);

ownerAppointmentsRouter.get("/owner-console/appointments", requirePermission("read", () => "appointments"), asyncHandler((req, res) => {
  res.json(ownerAppointmentService.list(req.access, req.query));
}));

ownerAppointmentsRouter.get("/owner-console/appointments/options/:resource", requirePermission("read", () => "appointments"), requirePermission("read", (req) => req.params.resource), asyncHandler((req, res) => {
  res.json({ items: ownerAppointmentService.options(req.access, req.params.resource, req.query) });
}));

ownerAppointmentsRouter.get("/owner-console/appointments/:id", requirePermission("read", () => "appointments"), asyncHandler((req, res) => {
  res.json(ownerAppointmentService.detail(req.params.id, req.access));
}));

ownerAppointmentsRouter.post("/owner-console/appointments", requirePermission("write", () => "appointments"), asyncHandler((req, res) => {
  res.status(201).json(ownerAppointmentService.create(req.body, req.access, req));
}));

ownerAppointmentsRouter.patch("/owner-console/appointments/:id", requirePermission("write", () => "appointments"), asyncHandler((req, res) => {
  const result = ownerAppointmentService.update(req.params.id, req.body, req.access, req, req.get("If-Match") || req.body?.version || "");
  res.setHeader("ETag", `W/\"${result.version}\"`);
  res.json(result);
}));

for (const [action, invoke] of Object.entries({
  cancel: (req) => ownerAppointmentService.cancel(req.params.id, req.body, req.access),
  reschedule: (req) => ownerAppointmentService.reschedule(req.params.id, req.body, req.access, req),
  status: (req) => ownerAppointmentService.setStatus(req.params.id, req.body, req.access),
  "check-in": (req) => ownerAppointmentService.checkIn(req.params.id, req.access),
  "start-service": (req) => ownerAppointmentService.startService(req.params.id, req.access),
  complete: (req) => ownerAppointmentService.complete(req.params.id, req.body, req.access),
  "no-show": (req) => ownerAppointmentService.noShow(req.params.id, req.body, req.access)
})) {
  ownerAppointmentsRouter.post(`/owner-console/appointments/:id/${action}`, requirePermission("write", () => "appointments"), asyncHandler((req, res) => res.json(invoke(req))));
}

ownerAppointmentsRouter.post(
  "/owner-console/appointments/:id/pos-handoff",
  requirePermission("read", () => "invoices"),
  requirePermission("use", () => "pos"),
  asyncHandler((req, res) => res.status(201).json(ownerPosHandoffService.create(req.params.id, req.access, req, res)))
);
