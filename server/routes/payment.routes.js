import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { badRequest } from "../utils/app-error.js";
import { validateBody } from "../validators/request-validator.js";
import { paymentService } from "../services/payment.service.js";
import { invoicePaymentCollectionService } from "../services/invoice-payment-collection.service.js";

export const paymentRouter = Router();
export const paymentPublicRouter = Router();

function requireIdempotencyKey(req, _res, next) {
  if (!req.get("Idempotency-Key")) {
    next(badRequest("Idempotency-Key header required"));
    return;
  }
  next();
}

paymentRouter.post("/payments/invoice/:invoiceId/cash", requirePermission("write", () => "payments"), requireIdempotencyKey, validateBody({ required: ["amount"] }), asyncHandler((req, res) => {
  res.status(201).json(paymentService.pay(req.params.invoiceId, "cash", req.body, req.access));
}));

paymentRouter.post("/payments/invoice/:invoiceId/upi", requirePermission("write", () => "payments"), requireIdempotencyKey, validateBody({ required: ["amount"] }), asyncHandler((req, res) => {
  res.status(201).json(paymentService.pay(req.params.invoiceId, "upi", req.body, req.access));
}));

paymentRouter.post("/payments/invoice/:invoiceId/card", requirePermission("write", () => "payments"), requireIdempotencyKey, validateBody({ required: ["amount"] }), asyncHandler((req, res) => {
  res.status(201).json(paymentService.pay(req.params.invoiceId, "card", req.body, req.access));
}));

paymentRouter.post("/payments/invoice/:invoiceId/split", requirePermission("write", () => "payments"), requireIdempotencyKey, validateBody({ required: ["payments"] }), asyncHandler((req, res) => {
  res.status(201).json(paymentService.split(req.params.invoiceId, req.body, req.access));
}));

paymentRouter.post("/payments/invoice/:invoiceId/payment-link", requirePermission("write", () => "payments"), requireIdempotencyKey, asyncHandler((req, res) => {
  res.status(201).json(invoicePaymentCollectionService.createLink(req.params.invoiceId, req.body, req.access));
}));

paymentRouter.get("/payments/invoice/:invoiceId/status", requirePermission("read", () => "payments"), asyncHandler((req, res) => {
  res.json(paymentService.status(req.params.invoiceId, req.access));
}));

paymentRouter.post("/payments/invoices/:invoiceId/link", requirePermission("write", () => "payments"), asyncHandler((req, res) => {
  res.status(201).json(invoicePaymentCollectionService.createLink(req.params.invoiceId, req.body, req.access));
}));

paymentRouter.get("/payments/invoices/:invoiceId/timeline", requirePermission("read", () => "payments"), asyncHandler((req, res) => {
  res.json(invoicePaymentCollectionService.timeline(req.params.invoiceId, req.access));
}));

paymentRouter.post("/payments/invoices/:invoiceId/reconcile", requirePermission("write", () => "payments"), asyncHandler((req, res) => {
  res.status(201).json(invoicePaymentCollectionService.reconcile(req.params.invoiceId, req.body, req.access));
}));

paymentRouter.post("/payments/invoices/:invoiceId/reminder", requirePermission("write", () => "payments"), asyncHandler((req, res) => {
  res.status(201).json(invoicePaymentCollectionService.reminder(req.params.invoiceId, req.body, req.access));
}));

paymentRouter.get("/payments/reconciliation/runs", requirePermission("read", () => "payments"), asyncHandler((req, res) => {
  res.json(invoicePaymentCollectionService.runs(req.query, req.access));
}));

paymentPublicRouter.post("/payments/webhooks/razorpay", asyncHandler((req, res) => {
  res.json(invoicePaymentCollectionService.handleRazorpayWebhook(req.rawBody || req.body, req.get("x-razorpay-signature") || ""));
}));

paymentPublicRouter.post("/payments/razorpay/webhook", asyncHandler((req, res) => {
  res.json(invoicePaymentCollectionService.handleRazorpayWebhook(req.rawBody || req.body, req.get("x-razorpay-signature") || ""));
}));
