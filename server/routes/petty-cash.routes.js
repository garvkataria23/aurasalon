import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { pettyCashService } from "../services/petty-cash.service.js";
import { validateBody } from "../validators/request-validator.js";

export const pettyCashRouter = Router();

pettyCashRouter.get(
  "/transactions/petty-cash",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(pettyCashService.entries(req.query, req.access));
  })
);

pettyCashRouter.get(
  "/transactions/petty-cash/:id",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(pettyCashService.entry(req.params.id, req.access));
  })
);

pettyCashRouter.post(
  "/transactions/petty-cash",
  requirePermission("write", () => "finance"),
  validateBody({ required: ["docDate", "type", "particular", "amount"] }),
  asyncHandler((req, res) => {
    res.status(201).json(pettyCashService.createEntry(req.body, req.access));
  })
);

pettyCashRouter.patch(
  "/transactions/petty-cash/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(pettyCashService.updateEntry(req.params.id, req.body, req.access));
  })
);

pettyCashRouter.delete(
  "/transactions/petty-cash/:id",
  requirePermission("write", () => "finance"),
  asyncHandler((req, res) => {
    res.json(pettyCashService.deleteEntry(req.params.id, req.access));
  })
);
