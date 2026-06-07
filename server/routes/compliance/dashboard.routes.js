import { Router } from "express";
import * as XLSX from "xlsx";
import { asyncHandler } from "../../middleware/async-handler.js";
import { requirePermission } from "../../middleware/rbac.js";
import { complianceDashboardService } from "../../services/compliance/dashboard.service.js";

export const complianceDashboardRouter = Router();

complianceDashboardRouter.get("/compliance/dashboard", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(complianceDashboardService.dashboard(req.access));
}));

complianceDashboardRouter.get("/compliance/dashboard/upcoming-deadlines", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(complianceDashboardService.upcomingDeadlines(req.access));
}));

complianceDashboardRouter.get("/compliance/dashboard/pending-actions", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(complianceDashboardService.pendingActions(req.access));
}));

complianceDashboardRouter.get("/compliance/dashboard/fy-summary/:fy", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(complianceDashboardService.fySummary(req.params.fy, req.access));
}));

complianceDashboardRouter.get("/compliance/dashboard/compliance-score", requirePermission("read", () => "finance"), asyncHandler((req, res) => {
  res.json(complianceDashboardService.complianceScore(req.access));
}));

for (const report of ["pf-monthly", "esi-half-yearly", "pt-monthly", "tds-quarterly", "annual-compliance-pack", "audit-trail"]) {
  complianceDashboardRouter.get(`/compliance/reports/${report}`, requirePermission("read", () => "finance"), asyncHandler((req, res) => {
    sendReport(res, report, complianceDashboardService.report(report, req.query, req.access), req.query.format);
  }));
}

function sendReport(res, reportName, payload, format = "json") {
  if (format === "excel") {
    const workbook = XLSX.utils.book_new();
    const rows = exportRows(payload);
    XLSX.utils.book_append_sheet(workbook, XLSX.utils.json_to_sheet(rows), "Report");
    const buffer = XLSX.write(workbook, { type: "buffer", bookType: "xlsx" });
    res.setHeader("content-type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    res.setHeader("content-disposition", `attachment; filename="${reportName}.xlsx"`);
    res.send(buffer);
    return;
  }
  if (format === "pdf") {
    res.setHeader("content-type", "application/pdf");
    res.setHeader("content-disposition", `attachment; filename="${reportName}.pdf"`);
    res.send(Buffer.from(`AuraShine Compliance Report\n${reportName}\n\n${JSON.stringify(payload, null, 2)}`));
    return;
  }
  res.json(payload);
}

function exportRows(payload) {
  if (Array.isArray(payload)) return payload;
  if (payload?.rows && Array.isArray(payload.rows)) return payload.rows;
  if (payload && typeof payload === "object") {
    return Object.entries(payload).map(([key, value]) => ({
      section: key,
      value: typeof value === "object" ? JSON.stringify(value) : value
    }));
  }
  return [{ value: payload }];
}
