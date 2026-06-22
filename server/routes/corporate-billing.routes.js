import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { corporateAccountService } from "../services/corporate-account.service.js";
import { creditBillingService } from "../services/credit-billing.service.js";

export const corporateBillingRouter = Router();

corporateBillingRouter.post("/corporate/accounts", requirePermission("write", () => "finance"), asyncHandler((req, res) => res.status(201).json(corporateAccountService.create(req.body, req.access))));
corporateBillingRouter.get("/corporate/accounts", requirePermission("read", () => "finance"), asyncHandler((req, res) => res.json(corporateAccountService.list(req.query, req.access))));
corporateBillingRouter.get("/corporate/accounts/:id", requirePermission("read", () => "finance"), asyncHandler((req, res) => res.json(corporateAccountService.get(req.params.id, req.access))));
corporateBillingRouter.post("/corporate/accounts/:id/members", requirePermission("write", () => "finance"), asyncHandler((req, res) => res.status(201).json(corporateAccountService.addMember(req.params.id, req.body, req.access))));
corporateBillingRouter.post("/corporate/accounts/:id/credit-payment", requirePermission("write", () => "finance"), asyncHandler((req, res) => res.status(201).json(creditBillingService.recordPayment(req.params.id, req.body, req.access))));
corporateBillingRouter.get("/corporate/accounts/:id/statement", requirePermission("read", () => "finance"), asyncHandler((req, res) => res.json(creditBillingService.statement(req.params.id, req.query, req.access))));
corporateBillingRouter.get("/corporate/outstanding", requirePermission("read", () => "finance"), asyncHandler((req, res) => res.json(creditBillingService.outstanding(req.query, req.access))));
corporateBillingRouter.post("/billing/invoices/:id/convert-to-credit", requirePermission("write", () => "finance"), asyncHandler((req, res) => res.status(201).json(creditBillingService.convertInvoice(req.params.id, req.body, req.access))));
