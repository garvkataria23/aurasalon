import { Router } from "express";
import { authenticateJwt } from "../middleware/auth.js";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { staffBusinessService } from "../services/staff-business.service.js";

export const staffBusinessRouter = Router();

staffBusinessRouter.get(
  "/staff-self/business/export.csv",
  authenticateJwt(),
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => {
    const filename = staffBusinessService.csvFilename(req.query, req.access);
    res.setHeader("Content-Type", "text/csv; charset=utf-8");
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    staffBusinessService.streamCsv(req.query, req.access, (chunk) => res.write(chunk));
    res.end();
  })
);

staffBusinessRouter.get(
  "/staff-self/business/invoices/:invoiceId",
  authenticateJwt(),
  requirePermission("read", () => "appointments"),
  requirePermission("read", () => "invoices"),
  asyncHandler((req, res) => res.json(staffBusinessService.invoiceDetail(req.params.invoiceId, req.access)))
);

staffBusinessRouter.get(
  "/staff-self/business",
  authenticateJwt(),
  requirePermission("read", () => "appointments"),
  asyncHandler((req, res) => res.json(staffBusinessService.daily(req.query, req.access)))
);
