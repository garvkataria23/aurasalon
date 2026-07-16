import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { ownerFinanceReportsService } from "../services/owner-finance-reports.service.js";
import { forbidden } from "../utils/app-error.js";

export const ownerFinanceReportsRouter = Router();

ownerFinanceReportsRouter.use("/owner-console", (req, _res, next) => req.access?.role === "owner" ? next() : next(forbidden("Owner role is required")));

ownerFinanceReportsRouter.get("/owner-console/finance/overview", requirePermission("read", () => "finance"), asyncHandler((req, res) => res.json(ownerFinanceReportsService.financeOverview(req.access, req.query))));
ownerFinanceReportsRouter.get("/owner-console/finance/drilldown", requirePermission("read", () => "finance"), asyncHandler((req, res) => res.json(ownerFinanceReportsService.financeDrilldown(req.access, req.query))));
ownerFinanceReportsRouter.get("/owner-console/reports/catalogue", requirePermission("read", () => "reports"), asyncHandler((req, res) => res.json(ownerFinanceReportsService.catalogue(req.access, req.query))));
ownerFinanceReportsRouter.get("/owner-console/reports/export", requirePermission("read", () => "reports"), asyncHandler((req, res) => {
  const file = ownerFinanceReportsService.export(req.access, req.query);
  res.setHeader("Content-Type", file.contentType);
  res.setHeader("Content-Disposition", `attachment; filename="${file.filename}"`);
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.send(file.content);
}));
ownerFinanceReportsRouter.get("/owner-console/reports/:key", requirePermission("read", () => "reports"), asyncHandler((req, res) => res.json(ownerFinanceReportsService.report(req.access, req.params.key, req.query))));
