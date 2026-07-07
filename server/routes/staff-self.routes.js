import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { authenticateJwt } from "../middleware/auth.js";
import { requirePermission } from "../middleware/rbac.js";
import { staffLoginService } from "../services/staff-login.service.js";

export const staffSelfRouter = Router();

staffSelfRouter.get(
  "/staff-self/dashboard",
  authenticateJwt(),
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(staffLoginService.staffDashboard(req.query, req.access));
  })
);

staffSelfRouter.get(
  "/staff-self/enterprise-os",
  authenticateJwt(),
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(staffLoginService.enterpriseOs(req.query, req.access));
  })
);

staffSelfRouter.get(
  "/staff-self/clients/:clientId/360",
  authenticateJwt(),
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    res.json(staffLoginService.client360(req.params.clientId, req.query, req.access));
  })
);
