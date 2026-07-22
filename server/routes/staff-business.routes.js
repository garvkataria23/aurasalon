import { Router } from "express";
import { authenticateJwt } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requireStaffAppSelfPermission } from "../middleware/rbac.js";
import { staffBusinessService } from "../services/staff-business.service.js";
import { staffSelfResponsePresenterService } from "../services/staff-self-response-presenter.service.js";

export const staffBusinessRouter = Router();

staffBusinessRouter.get(
  "/staff-self/business/invoices/:invoiceId",
  authenticateJwt(),
  requireStaffAppSelfPermission("read", "staff-app-appointments"),
  requireStaffAppSelfPermission("read", "staff-app-invoices"),
  asyncHandler((req, res) => res.json(staffSelfResponsePresenterService.invoiceDetail(staffBusinessService.invoiceDetail(req.params.invoiceId, req.access))))
);

staffBusinessRouter.get(
  "/staff-self/business",
  authenticateJwt(),
  requireStaffAppSelfPermission("read", "staff-app-appointments"),
  asyncHandler((req, res) => res.json(staffSelfResponsePresenterService.staffData(staffBusinessService.daily(req.query, req.access), req.access)))
);
