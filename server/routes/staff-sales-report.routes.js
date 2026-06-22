import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { staffCommissionPreviewService } from "../services/staff-commission-preview.service.js";
import { staffSalesReportService } from "../services/staff-sales-report.service.js";

export const staffSalesReportRouter = Router();

staffSalesReportRouter.get(
  "/reports/staff-sales",
  requirePermission("read", () => "reports"),
  asyncHandler((req, res) => {
    res.json(staffSalesReportService.report(req.query, req.access));
  })
);

staffSalesReportRouter.get(
  "/reports/commission-preview",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(staffCommissionPreviewService.preview(req.query, req.access));
  })
);
