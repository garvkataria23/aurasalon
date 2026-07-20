import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { dayCloseLockService } from "../services/day-close-lock.service.js";
import { zReportService } from "../services/z-report.service.js";

export const zReportRouter = Router();

zReportRouter.post("/day-close/:branchId/:date/lock", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.json(dayCloseLockService.lock(req.params.branchId, req.params.date, req.body, req.access));
}));

zReportRouter.post("/day-close/:branchId/:date/reopen", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.json(dayCloseLockService.reopen(req.params.branchId, req.params.date, req.body, req.access));
}));

zReportRouter.get("/day-close/:branchId/:date/status", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json(dayCloseLockService.status(req.params.branchId, req.params.date, req.access));
}));

zReportRouter.post("/z-reports/generate", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.status(201).json(zReportService.generate(req.body, req.access));
}));

zReportRouter.get("/z-reports/:branchId/:date", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json(zReportService.get(req.params.branchId, req.params.date, req.access));
}));

zReportRouter.get("/z-reports/export", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  const result = zReportService.export(req.query.branchId, req.query.date, req.query.format || "json", req.access);
  if (result.body) {
    res.type(result.contentType).send(result.body);
    return;
  }
  res.json(result.report);
}));
