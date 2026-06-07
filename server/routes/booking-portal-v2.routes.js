import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { captchaMiddleware } from "../middleware/captcha.middleware.js";
import { idempotencyMiddleware } from "../middleware/idempotency.middleware.js";
import { publicBookingRateLimit } from "../middleware/public-booking-rate-limit.middleware.js";
import { db } from "../db.js";
import { bookingOtpService } from "../services/booking-otp.service.js";
import { bookingDepositService } from "../services/booking-deposit.service.js";
import { bookingRulesService } from "../services/booking-rules.service.js";
import { bookingSessionService } from "../services/booking-session.service.js";
import { multiServiceEngineService } from "../services/multi-service-engine.service.js";
import { onlineSlotEngineService } from "../services/online-slot-engine.service.js";
import { publicActionTokenService } from "../services/public-action-token.service.js";
import { razorpayBookingService } from "../services/razorpay-booking.service.js";
import { resourceService } from "../services/resource.service.js";
import { slotReservationService } from "../services/slot-reservation.service.js";
import { assertEmail, assertPhone, assertServiceIds } from "../validators/booking-portal-v2.validator.js";
import { badRequest } from "../utils/app-error.js";

export const bookingPortalV2Router = Router();

bookingPortalV2Router.use("/booking-portal/v2", publicBookingRateLimit({ max: 90 }));

bookingPortalV2Router.get("/booking-portal/v2/public/:tenantSlug", asyncHandler((req, res) => {
  const tenant = db.prepare("SELECT id, name, slug, status FROM tenants WHERE slug = ?").get(req.params.tenantSlug);
  if (!tenant) throw badRequest("Tenant not found");
  const branches = db.prepare("SELECT id, name, city, address, phone, slug, themeConfig, seoConfig FROM branches WHERE tenantId = ? AND status = 'active'").all(tenant.id);
  res.json({ tenant, branches });
}));

bookingPortalV2Router.post("/booking-portal/v2/sessions", captchaMiddleware, asyncHandler((req, res) => {
  const branchId = req.body.branchId || req.access.branchId || db.prepare("SELECT id FROM branches WHERE tenantId = ? LIMIT 1").get(req.access.tenantId)?.id;
  const session = bookingSessionService.createSession({
    tenantId: req.access.tenantId,
    branchId,
    source: req.body.source || "portal",
    deviceType: req.body.deviceType || "",
    ip: req.ip,
    userAgent: req.get("user-agent") || "",
    utm: req.body.utm || req.query
  });
  res.status(201).json(session);
}));

bookingPortalV2Router.post("/booking-portal/v2/sessions/:id/events", asyncHandler((req, res) => {
  const event = bookingSessionService.recordFunnelEvent({
    tenantId: req.access.tenantId,
    sessionId: req.params.id,
    eventName: req.body.eventName,
    eventData: req.body.eventData || {},
    stepOrder: req.body.stepOrder
  });
  res.status(201).json(event);
}));

bookingPortalV2Router.get("/booking-portal/v2/services", asyncHandler((req, res) => {
  const rows = db.prepare(
    `SELECT * FROM services
     WHERE tenantId = ?
       AND status = 'active'
       AND COALESCE(onlineBookable, 1) = 1
     ORDER BY category, name`
  ).all(req.access.tenantId);
  res.json(rows);
}));

bookingPortalV2Router.get("/booking-portal/v2/staff", asyncHandler((req, res) => {
  const branchId = req.query.branchId || req.access.branchId || "";
  const rows = db.prepare(
    `SELECT id, name, role, branchId, assignedServices, status FROM staff
     WHERE tenantId = ?
       AND (? = '' OR branchId = ?)
       AND status = 'active'
     ORDER BY name`
  ).all(req.access.tenantId, branchId, branchId);
  res.json(rows);
}));

bookingPortalV2Router.post("/booking-portal/v2/slots", captchaMiddleware, asyncHandler((req, res) => {
  const serviceIds = assertServiceIds(req.body.serviceIds);
  const result = onlineSlotEngineService.recommendSlots({ ...req.body, serviceIds }, req.access);
  if (req.body.sessionId) {
    bookingSessionService.recordFunnelEvent({ tenantId: req.access.tenantId, sessionId: req.body.sessionId, eventName: "slot_selected", eventData: { count: result.slots.length } });
  }
  res.setHeader("X-Cache", result.cache || "MISS");
  res.json(result);
}));

bookingPortalV2Router.post("/booking-portal/v2/holds", asyncHandler((req, res) => {
  const hold = slotReservationService.createHold(req.body, req.access);
  if (req.body.sessionId) {
    bookingSessionService.recordFunnelEvent({ tenantId: req.access.tenantId, sessionId: req.body.sessionId, eventName: "hold_created", eventData: { holdId: hold.holdId } });
  }
  res.status(201).json(hold);
}));

bookingPortalV2Router.post("/booking-portal/v2/otps/send", asyncHandler((req, res) => {
  const mobile = assertPhone(req.body.mobile);
  const result = bookingOtpService.sendOtp({ tenantId: req.access.tenantId, mobile, purpose: req.body.purpose || "booking", language: req.body.language || "en" });
  res.status(201).json(result);
}));

bookingPortalV2Router.post("/booking-portal/v2/otps/verify", asyncHandler((req, res) => {
  const mobile = assertPhone(req.body.mobile);
  res.json(bookingOtpService.verifyOtp({ tenantId: req.access.tenantId, mobile, purpose: req.body.purpose || "booking", otp: req.body.otp }));
}));

bookingPortalV2Router.post("/booking-portal/v2/multi-service/timeline", asyncHandler((req, res) => {
  res.json(multiServiceEngineService.buildTimeline(req.body, req.access));
}));

bookingPortalV2Router.post("/booking-portal/v2/multi-service/confirm", asyncHandler((req, res) => {
  res.json(multiServiceEngineService.buildTimeline(req.body, req.access));
}));

bookingPortalV2Router.post("/booking-portal/v2/confirm", idempotencyMiddleware, asyncHandler((req, res) => {
  const customer = req.body.customer || {};
  const mobile = customer.mobile || req.body.mobile || "";
  if (mobile) {
    const normalized = assertPhone(mobile);
    if (!req.body.otpVerified && !bookingOtpService.isVerified({ tenantId: req.access.tenantId, mobile: normalized, purpose: "booking" })) {
      throw badRequest("OTP verification is required before confirming booking");
    }
  }
  const serviceIds = assertServiceIds(req.body.serviceIds);
  const slot = req.body.slot || {};
  const branchId = req.body.branchId || slot.branchId || req.access.branchId;
  const ruleCheck = bookingRulesService.evaluateRules({ ...req.body, tenantId: req.access.tenantId, branchId, startAt: slot.startAt || req.body.startAt });
  if (!ruleCheck.allowed) throw badRequest("Booking rules blocked this request", { violations: ruleCheck.violations });

  const clientId = req.body.clientId || resourceService.create("clients", {
    name: customer.name || "Online guest",
    phone: mobile,
    email: assertEmail(customer.email || ""),
    branchId,
    preferredLanguage: customer.language || customer.preferredLanguage || "en",
    preferredChannel: customer.preferredChannel || "whatsapp"
  }, req.access, { req }).id;

  const appointment = resourceService.create("appointments", {
    clientId,
    branchId,
    staffId: slot.staffId || req.body.staffId || "",
    serviceIds,
    startAt: slot.startAt || req.body.startAt,
    endAt: slot.endAt || req.body.endAt,
    chair: slot.chair || slot.chairId || req.body.chair || "",
    status: "booked",
    source: "online-v2",
    sourceChannel: "portal",
    reservedFromSlotId: req.body.holdId || req.body.reservedFromSlotId || ""
  }, req.access, { req });

  const deposit = bookingDepositService.calculateDeposit({
    branchId,
    clientId,
    serviceIds,
    totalAmount: req.body.totalAmount,
    startAt: slot.startAt || req.body.startAt
  }, req.access);
  const paymentLink = deposit.required
    ? razorpayBookingService.createPaymentLink({
        tenantId: req.access.tenantId,
        appointmentId: appointment.id,
        sessionId: req.body.sessionId || "",
        amount: deposit.amount,
        currency: deposit.currency,
        customerDetails: customer,
        notes: { purpose: "deposit", source: "booking-portal-v2" }
      })
    : null;

  if (req.body.sessionId) {
    bookingSessionService.markCompleted(req.access.tenantId, req.body.sessionId, appointment.id);
  }
  const publicActions = publicActionTokenService.generateTokenSet({
    tenantId: req.access.tenantId,
    appointmentId: appointment.id
  });
  res.status(201).json({
    appointmentId: appointment.id,
    version: appointment.version || 1,
    appointment,
    deposit,
    paymentLink,
    publicActions,
    requiredActions: ruleCheck.requiredActions
  });
}));

bookingPortalV2Router.get("/booking-portal/v2/my-bookings", asyncHandler((req, res) => {
  const mobile = assertPhone(req.query.mobile || "");
  const clients = db.prepare("SELECT id FROM clients WHERE tenantId = ? AND phone = ?").all(req.access.tenantId, mobile);
  if (!clients.length) return res.json([]);
  const ids = clients.map((client) => client.id);
  const placeholders = ids.map(() => "?").join(",");
  const rows = db.prepare(`SELECT * FROM appointments WHERE tenantId = ? AND clientId IN (${placeholders}) ORDER BY startAt DESC LIMIT 50`).all(req.access.tenantId, ...ids);
  res.json(rows);
}));

bookingPortalV2Router.get("/booking-portal/v2/sessions", asyncHandler((req, res) => {
  const rows = db.prepare("SELECT * FROM online_booking_sessions WHERE tenantId = ? ORDER BY startedAt DESC LIMIT 100").all(req.access.tenantId);
  res.json(rows);
}));

bookingPortalV2Router.get("/booking-portal/v2/abandonments", asyncHandler((req, res) => {
  const rows = db.prepare("SELECT * FROM booking_abandonments WHERE tenantId = ? ORDER BY abandonedAt DESC LIMIT 100").all(req.access.tenantId);
  res.json(rows);
}));
