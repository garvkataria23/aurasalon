import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { bookingDepositService } from "../services/booking-deposit.service.js";
import { razorpayBookingService } from "../services/razorpay-booking.service.js";
import { badRequest } from "../utils/app-error.js";

export const bookingPaymentsPublicRouter = Router();
export const bookingPaymentsRouter = Router();

bookingPaymentsPublicRouter.post(
  "/booking-payments/webhook/razorpay",
  asyncHandler((req, res) => {
    const rawBody = req.rawBody || JSON.stringify(req.body || {});
    const result = razorpayBookingService.verifyAndProcessWebhook(rawBody, req.get("x-razorpay-signature") || "");
    res.json(result);
  })
);

bookingPaymentsRouter.post(
  "/booking-payments/deposit/calculate",
  requirePermission("read", () => "payments"),
  asyncHandler((req, res) => {
    res.json(bookingDepositService.calculateDeposit(req.body, req.access));
  })
);

bookingPaymentsRouter.post(
  "/booking-payments/payment-link/create",
  requirePermission("write", () => "payments"),
  asyncHandler((req, res) => {
    const amount = Number(req.body.amount || 0);
    if (!amount) throw badRequest("amount is required");
    const result = razorpayBookingService.createPaymentLink({
      tenantId: req.access.tenantId,
      appointmentId: req.body.appointmentId || "",
      sessionId: req.body.sessionId || "",
      amount,
      currency: req.body.currency || "INR",
      customerDetails: req.body.customerDetails || {},
      notes: { ...(req.body.notes || {}), createdBy: req.access.userId || "" },
      expiresInMinutes: req.body.expiresInMinutes || 30
    });
    res.status(201).json(result);
  })
);

bookingPaymentsRouter.get(
  "/booking-payments/:appointmentId/status",
  requirePermission("read", () => "payments"),
  asyncHandler((req, res) => {
    res.json(razorpayBookingService.getStatus(req.params.appointmentId, req.access));
  })
);

bookingPaymentsRouter.post(
  "/booking-payments/:appointmentId/refund",
  requirePermission("write", () => "payments"),
  asyncHandler((req, res) => {
    res.status(201).json(razorpayBookingService.initiateRefund({
      appointmentId: req.params.appointmentId,
      amount: req.body.amount,
      reason: req.body.reason || "",
      access: req.access
    }));
  })
);
