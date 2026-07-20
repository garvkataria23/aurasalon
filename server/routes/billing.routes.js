import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { badRequest } from "../utils/app-error.js";
import { billingController } from "../controllers/billing.controller.js";

export const billingRouter = Router();

function requireIdempotencyKey(req, _res, next) {
  if (!req.get("Idempotency-Key")) {
    next(badRequest("Idempotency-Key header required"));
    return;
  }
  next();
}

billingRouter.get("/billing/invoices", requirePermission("read", () => "invoices"), asyncHandler(billingController.list));
billingRouter.post("/billing/invoices/draft", requirePermission("write", () => "invoices"), asyncHandler(billingController.createDraft));
billingRouter.get("/billing/invoices/:id", requirePermission("read", () => "invoices"), asyncHandler(billingController.get));
billingRouter.patch("/billing/invoices/:id", requirePermission("write", () => "invoices"), asyncHandler(billingController.update));
billingRouter.post("/billing/invoices/:id/add-item", requirePermission("write", () => "invoices"), asyncHandler(billingController.addItem));
billingRouter.patch("/billing/invoices/:id/items/:itemId", requirePermission("write", () => "invoices"), asyncHandler(billingController.updateItem));
billingRouter.delete("/billing/invoices/:id/items/:itemId", requirePermission("write", () => "invoices"), asyncHandler(billingController.deleteItem));
billingRouter.post("/billing/invoices/:id/apply-discount", requirePermission("write", () => "invoices"), asyncHandler(billingController.applyDiscount));
billingRouter.post("/billing/invoices/:id/payment", requirePermission("write", () => "payments"), requireIdempotencyKey, asyncHandler(billingController.payment));
billingRouter.post("/billing/invoices/:id/finalize", requirePermission("write", () => "invoices"), requireIdempotencyKey, asyncHandler(billingController.finalize));
billingRouter.post("/billing/invoices/:id/void", requirePermission("write", () => "invoices"), asyncHandler(billingController.void));
billingRouter.post("/billing/invoices/:id/refund", requirePermission("write", () => "payments"), requireIdempotencyKey, asyncHandler(billingController.refund));
billingRouter.post("/billing/invoices/:id/credit-note", requirePermission("write", () => "invoices"), asyncHandler(billingController.creditNote));
billingRouter.get("/billing/invoices/:id/pdf", requirePermission("read", () => "invoices"), asyncHandler(billingController.pdf));
billingRouter.get("/billing/invoices/:id/print", requirePermission("read", () => "invoices"), asyncHandler(billingController.print));
billingRouter.post("/billing/invoices/:id/send-whatsapp", requirePermission("write", () => "invoices"), asyncHandler(billingController.sendWhatsapp));
billingRouter.post("/billing/invoices/:id/send-email", requirePermission("write", () => "invoices"), asyncHandler(billingController.sendEmail));
billingRouter.get("/billing/customer/:customerId/history", requirePermission("read", () => "invoices"), asyncHandler(billingController.customerHistory));
billingRouter.get("/billing/appointment/:appointmentId/draft", requirePermission("read", () => "invoices"), asyncHandler(billingController.appointmentDraft));
