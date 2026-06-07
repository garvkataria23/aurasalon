import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { realtimeService } from "../services/realtime.service.js";
import { salonOperationsService } from "../services/salon-operations.service.js";
import { securityService } from "../services/security.service.js";
import { validateBody } from "../validators/request-validator.js";

export const operationsRouter = Router();

operationsRouter.get("/health", (_req, res) => {
  res.json({ ok: true, service: "Aura Salon CRM/POS API", timestamp: new Date().toISOString() });
});

operationsRouter.post(
  "/appointments/:id/complete",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    const result = salonOperationsService.completeAppointment(req.params.id, req.body.notes, req.access);
    securityService.audit({ action: "booking.completed", targetType: "appointment", targetId: result.appointment.id, details: { notesChanged: Boolean(req.body.notes) } }, req.access, req);
    realtimeService.bookingUpdated(req.access, result.appointment, "completed");
    res.json(result);
  })
);

operationsRouter.post(
  "/appointments/:id/status",
  requirePermission("write", () => "appointments"),
  validateBody({ required: ["status"], enums: { status: ["booked", "arrived", "no-show", "completed", "cancelled"] } }),
  asyncHandler((req, res) => {
    const appointment = salonOperationsService.updateAppointmentStatus(req.params.id, req.body.status, req.access);
    securityService.audit({ action: "booking.status_changed", targetType: "appointment", targetId: appointment.id, details: { status: req.body.status } }, req.access, req);
    realtimeService.bookingUpdated(req.access, appointment, "status");
    res.json(appointment);
  })
);

operationsRouter.post(
  "/inventory/adjust",
  requirePermission("write", () => "inventory"),
  validateBody({ required: ["productId", "branchId", "quantity"] }),
  asyncHandler((req, res) => {
    const result = salonOperationsService.adjustInventory(req.body, req.access);
    securityService.audit({ action: "inventory.adjusted", targetType: "inventory_transaction", targetId: result.id, details: req.body }, req.access, req);
    realtimeService.dashboardUpdated(req.access, result.branchId, { source: "inventory", transactionId: result.id });
    res.status(201).json(result);
  })
);

operationsRouter.post(
  "/branches/transfer-stock",
  requirePermission("write", () => "branches"),
  validateBody({ required: ["productId", "fromBranchId", "toBranchId", "quantity"] }),
  asyncHandler((req, res) => {
    const result = salonOperationsService.transferStock(req.body, req.access);
    securityService.audit({ action: "inventory.transferred", targetType: "branch-transfer", targetId: req.body.productId, details: req.body }, req.access, req);
    res.json(result);
  })
);

operationsRouter.post(
  "/sales/coupons/validate",
  requirePermission("read", () => "sales"),
  validateBody({ required: ["code"] }),
  asyncHandler((req, res) => {
    res.json(salonOperationsService.validateCoupon(req.body, req.access));
  })
);

operationsRouter.post(
  "/sales/checkout",
  requirePermission("write", () => "sales"),
  validateBody({ required: ["clientId", "branchId", "items"] }),
  asyncHandler((req, res) => {
    const result = salonOperationsService.checkoutSale(req.body, req.access);
    securityService.audit({ action: "bill.created", targetType: "invoice", targetId: result.invoice.id, details: { saleId: result.sale.id, total: result.invoice.total } }, req.access, req);
    if (Number(req.body.discount || 0) > 0) {
      securityService.audit({ action: "discount.approved", targetType: "invoice", targetId: result.invoice.id, details: { discount: Number(req.body.discount || 0), saleId: result.sale.id } }, req.access, req);
    }
    realtimeService.dashboardUpdated(req.access, result.sale.branchId, { source: "sale", saleId: result.sale.id, invoiceId: result.invoice.id });
    res.status(201).json(result);
  })
);

operationsRouter.post(
  "/clients/:id/wallet",
  requirePermission("write", () => "clients"),
  validateBody({ required: ["type", "amount"] }),
  asyncHandler((req, res) => {
    const result = salonOperationsService.adjustWallet(req.params.id, req.body, req.access);
    securityService.audit({ action: `wallet.${req.body.type === "debit" ? "debited" : "credited"}`, targetType: "client", targetId: req.params.id, details: { amount: req.body.amount, referenceType: req.body.referenceType || "manual" } }, req.access, req);
    res.status(201).json(result);
  })
);

operationsRouter.post(
  "/invoices/:id/document",
  requirePermission("read", () => "invoices"),
  asyncHandler((req, res) => {
    const result = salonOperationsService.generateInvoiceDocument(req.params.id, req.access);
    res.status(201).json(result);
  })
);

operationsRouter.post(
  "/invoices/:id/credit-note",
  requirePermission("write", () => "invoices"),
  validateBody({ required: ["amount"] }),
  asyncHandler((req, res) => {
    const result = salonOperationsService.createCreditNote({ ...req.body, invoiceId: req.params.id }, req.access);
    securityService.audit({ action: "credit_note.issued", targetType: "invoice", targetId: req.params.id, details: { creditNoteId: result.id, amount: result.amount, reason: result.reason } }, req.access, req);
    res.status(201).json(result);
  })
);

operationsRouter.post(
  "/invoices/:id/payments",
  requirePermission("write", () => "payments"),
  validateBody({ required: ["mode", "amount"] }),
  asyncHandler((req, res) => {
    const result = salonOperationsService.addInvoicePayment(req.params.id, req.body, req.access);
    securityService.audit({ action: "payment.created", targetType: "invoice", targetId: req.params.id, details: { paymentId: result.payment.id, amount: req.body.amount, mode: req.body.mode } }, req.access, req);
    res.status(201).json(result);
  })
);

operationsRouter.post(
  "/memberships/:id/redeem",
  requirePermission("write", () => "memberships"),
  asyncHandler((req, res) => {
    const result = salonOperationsService.redeemMembership({ membershipId: req.params.id, creditsUsed: Number(req.body.creditsUsed || 1), serviceId: req.body.serviceId || "" }, req.access);
    securityService.audit({ action: "membership.redeemed", targetType: "membership", targetId: req.params.id, details: { creditsUsed: Number(req.body.creditsUsed || 1), serviceId: req.body.serviceId || "" } }, req.access, req);
    res.json(result);
  })
);

operationsRouter.post(
  "/marketing/segments",
  requirePermission("read", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(salonOperationsService.segmentClients(req.body, req.access));
  })
);

operationsRouter.post(
  "/marketing/:id/send",
  requirePermission("write", () => "marketing"),
  asyncHandler((req, res) => {
    res.json(salonOperationsService.sendCampaign(req.params.id, req.body.clients || [], req.access));
  })
);

operationsRouter.get(
  "/reports/dashboard",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(salonOperationsService.dashboardReport(req.query.branchId || "", req.access));
  })
);

operationsRouter.get(
  "/reports/advanced",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(salonOperationsService.advancedReport(req.query, req.access));
  })
);

operationsRouter.get(
  "/reports/:type",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(salonOperationsService.reportByType(req.params.type, req.query.branchId || "", req.access));
  })
);
