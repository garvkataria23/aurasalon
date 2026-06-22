import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { gstReportService } from "../services/gst-report.service.js";
import { gstTaxService } from "../services/gst-tax.service.js";

export const gstRouter = Router();

function sendReport(req, res, filename, report) {
  if (req.query.format === "excel") {
    res.setHeader("content-type", "application/vnd.ms-excel; charset=utf-8");
    res.setHeader("content-disposition", `attachment; filename="${filename}.xls"`);
    res.send(gstReportService.toExcel(report, filename));
    return;
  }
  res.json(report);
}

gstRouter.get(
  "/gst/tax-preview",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(gstTaxService.taxPreview(req.query.invoiceId, req.access));
  })
);

gstRouter.get(
  "/gst/gstr1",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    const report = gstReportService.gstr1(req.access?.tenantId, req.query.month);
    sendReport(req, res, `gstr1-${report.month}`, report);
  })
);

gstRouter.get(
  "/gst/gstr3b",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    const report = gstReportService.gstr3b(req.access?.tenantId, req.query.month);
    sendReport(req, res, `gstr3b-${report.month}`, report);
  })
);

gstRouter.get(
  "/gst/hsn-summary",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    const today = new Date().toISOString().slice(0, 10);
    const report = gstReportService.hsnSummary(req.access?.tenantId, req.query.from || today, req.query.to || today);
    sendReport(req, res, `hsn-summary-${report.from}-${report.to}`, report);
  })
);

gstRouter.get(
  "/gst/invoice/:invoiceId/einvoice-json",
  requirePermission("read", () => "finance"),
  asyncHandler((req, res) => {
    res.json(gstTaxService.eInvoiceJson(req.params.invoiceId, req.access));
  })
);
