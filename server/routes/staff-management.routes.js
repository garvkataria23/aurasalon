import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { smartStaffService } from "../services/smart-staff.service.js";
import { validateBody } from "../validators/request-validator.js";

export const staffManagementRouter = Router();

staffManagementRouter.get(
  "/staff-management/summary",
  requirePermission("read", () => "staff"),
  asyncHandler((req, res) => {
    res.json(smartStaffService.summary(req.query, req.access));
  })
);

staffManagementRouter.get(
  "/staff-management/performance",
  requirePermission("read", () => "staff"),
  asyncHandler((req, res) => {
    res.json(smartStaffService.performance(req.query, req.access));
  })
);

staffManagementRouter.get(
  "/staff-management/runs",
  requirePermission("read", () => "staff"),
  asyncHandler((req, res) => {
    res.json(smartStaffService.latestRuns(req.query, req.access));
  })
);

staffManagementRouter.post(
  "/staff-management/attendance",
  requirePermission("write", () => "staff"),
  validateBody({ required: ["staffId", "status"] }),
  asyncHandler((req, res) => {
    res.status(201).json(smartStaffService.recordAttendance(req.body, req.access));
  })
);

staffManagementRouter.post(
  "/staff-management/shifts",
  requirePermission("write", () => "staff"),
  validateBody({ required: ["staffId", "date", "startTime", "endTime"] }),
  asyncHandler((req, res) => {
    res.status(201).json(smartStaffService.planShift(req.body, req.access));
  })
);

staffManagementRouter.post(
  "/staff-management/commissions/run",
  requirePermission("write", () => "staff"),
  asyncHandler((req, res) => {
    res.status(201).json(smartStaffService.runCommission(req.body, req.access));
  })
);

staffManagementRouter.post(
  "/staff-management/incentives/calculate",
  requirePermission("write", () => "staff"),
  asyncHandler((req, res) => {
    res.json(smartStaffService.calculateIncentives(req.body, req.access));
  })
);

staffManagementRouter.post(
  "/staff-management/payroll/export",
  requirePermission("write", () => "staff"),
  asyncHandler((req, res) => {
    res.status(201).json(smartStaffService.exportPayroll(req.body, req.access));
  })
);
