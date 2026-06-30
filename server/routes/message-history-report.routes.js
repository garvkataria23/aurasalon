import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { messageHistoryReportService } from "../services/message-history-report.service.js";

export const messageHistoryReportRouter = Router();

messageHistoryReportRouter.get("/reports/message-history", requirePermission("read", () => "reports"), asyncHandler((req, res) => {
  res.json(messageHistoryReportService.report(req.query, req.access));
}));
