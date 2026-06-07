import { Router } from "express";
import { staffReportsService } from "../services/staff-reports.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffReportsRouter = Router();

for (const type of ["revenue", "attendance", "payroll", "commission", "tips", "utilization", "training", "productivity"]) {
  staffReportsRouter.get(`/staff-os/reports/${type}`, route((req, res) => res.json(staffReportsService.report(type, req.query, req.access))));
}
