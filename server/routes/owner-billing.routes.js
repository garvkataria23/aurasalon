import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { ownerBillingService } from "../services/owner-billing.service.js";
import { forbidden } from "../utils/app-error.js";

export const ownerBillingRouter = Router();
const base = "/owner-console/billing";

ownerBillingRouter.use(base, (req, _res, next) => req.access?.role === "owner" ? next() : next(forbidden("Owner role is required")));
ownerBillingRouter.get(`${base}/invoices`, requirePermission("read", () => "invoices"), asyncHandler((req, res) => res.json(ownerBillingService.listInvoices(req.access, req.query))));
ownerBillingRouter.get(`${base}/invoices/:id`, requirePermission("read", () => "invoices"), asyncHandler((req, res) => res.json(ownerBillingService.invoice(req.params.id, req.access))));
