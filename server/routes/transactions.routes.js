import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { transactionsService } from "../services/transactions.service.js";
import { validateBody } from "../validators/request-validator.js";

export const transactionsRouter = Router();

transactionsRouter.get(
  "/transactions/outgoing-funds",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(transactionsService.outgoingFunds(req.query, req.access));
  })
);

transactionsRouter.get(
  "/transactions/outgoing-funds/:id",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(transactionsService.outgoingFund(req.params.id, req.access));
  })
);

transactionsRouter.post(
  "/transactions/outgoing-funds",
  requirePermission("write", () => "finance"),
  validateBody({ required: ["entryDate", "amount"] }),
  asyncHandler((req, res) => {
    res.status(201).json(transactionsService.createOutgoingFund(req.body, req.access));
  })
);

transactionsRouter.patch(
  "/transactions/outgoing-funds/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(transactionsService.updateOutgoingFund(req.params.id, req.body, req.access));
  })
);

transactionsRouter.delete(
  "/transactions/outgoing-funds/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(transactionsService.deleteOutgoingFund(req.params.id, req.access));
  })
);

