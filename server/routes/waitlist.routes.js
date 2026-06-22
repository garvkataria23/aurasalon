import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody } from "../validators/request-validator.js";
import { waitlistService } from "../services/waitlist.service.js";

export const waitlistRouter = Router();

waitlistRouter.get(
  "/waitlist",
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(waitlistService.list(req.query, req.access));
  })
);

waitlistRouter.post(
  "/waitlist",
  requirePermission("write", () => "appointments"),
  validateBody({ required: ["clientId"] }),
  asyncHandler((req, res) => {
    res.status(201).json(waitlistService.add(req.body, req.access));
  })
);

waitlistRouter.post(
  "/waitlist/:id/cancel",
  requirePermission("write", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(waitlistService.cancel(req.params.id, req.access));
  })
);
