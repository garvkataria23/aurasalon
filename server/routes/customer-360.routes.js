import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { customer360Service } from "../services/customer-360.service.js";

export const customer360Router = Router();

customer360Router.get(
  "/customer-360/summary",
  requirePermission("read", () => "customer-360"),
  asyncHandler((req, res) => {
    res.json(customer360Service.summary(req.query, req.access));
  })
);

customer360Router.get(
  "/customer-360/clients/:id",
  requirePermission("read", () => "customer-360"),
  asyncHandler((req, res) => {
    res.json(customer360Service.profile(req.params.id, req.access));
  })
);

customer360Router.post(
  "/customer-360/clients/:id/timeline",
  requirePermission("write", () => "customer-360"),
  asyncHandler((req, res) => {
    res.status(201).json(customer360Service.addTimelineEvent(req.params.id, req.body, req.access));
  })
);

customer360Router.post(
  "/customer-360/clients/:id/snapshot",
  requirePermission("write", () => "customer-360"),
  asyncHandler((req, res) => {
    res.status(201).json(customer360Service.generateSnapshot(req.params.id, req.access));
  })
);
