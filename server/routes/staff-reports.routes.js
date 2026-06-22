import { Router } from "express";
import { staffSalesReportService } from "../services/staff-sales-report.service.js";
import { staffReportsService } from "../services/staff-reports.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffReportsRouter = Router();

staffReportsRouter.get("/staff-os/staff-sales", route((req, res) => res.json(staffSalesReportService.report(req.query, req.access))));

for (const type of ["revenue", "attendance", "payroll", "commission", "tips", "utilization", "training", "productivity"]) {
  staffReportsRouter.get(`/staff-os/reports/${type}`, route((req, res) => res.json(staffReportsService.report(type, req.query, req.access))));
}
