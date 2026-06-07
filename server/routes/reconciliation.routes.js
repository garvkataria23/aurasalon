import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { razorpayReconciliationService } from "../services/razorpay-reconciliation.service.js";

export const reconciliationRouter = Router();

reconciliationRouter.post("/reconciliation/razorpay/fetch", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.status(201).json(razorpayReconciliationService.fetchSettlement({ ...req.body, date: req.query.date || req.body.date }, req.access));
}));

reconciliationRouter.get("/reconciliation", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(razorpayReconciliationService.list(req.query, req.access));
}));

reconciliationRouter.post("/reconciliation/:id/mark-reviewed", requirePermission("write", () => "finance"), asyncHandler((req, res) => {
  res.json(razorpayReconciliationService.markReviewed(req.params.id, req.body, req.access));
}));
