import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { staffEnterpriseActionService } from "../services/staff-enterprise-action.service.js";
import { staffEnterpriseReadService } from "../services/staff-enterprise-read.service.js";

export const staffEnterpriseRouter = Router();

const canReadStaff = requirePermission("read", () => "staff");
const canWriteStaff = requirePermission("write", () => "staff");
const requestMeta = (req) => ({
  ipAddress: req.ip || req.socket?.remoteAddress || "",
  userAgent: req.get("user-agent") || ""
});

staffEnterpriseRouter.get(
  "/staff-enterprise/command-center",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.commandCenter(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/digital-twins",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.digitalTwins(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/digital-twins/:staffId",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.digitalTwin(req.params.staffId, req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/skill-matrix",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.skillMatrix(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/risk-signals",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.riskSignals(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/floor-control",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.floorControl(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/payroll-intelligence",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.payrollIntelligence(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/audit-trail",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.auditTrail(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/training",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.training(req.query, req.access));
  })
);

staffEnterpriseRouter.get(
  "/staff-enterprise/approvals",
  canReadStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseReadService.approvals(req.query, req.access));
  })
);

staffEnterpriseRouter.post(
  "/staff-enterprise/training/assign",
  canWriteStaff,
  asyncHandler((req, res) => {
    res.status(201).json(staffEnterpriseActionService.assignTraining(req.body, req.access, requestMeta(req)));
  })
);

staffEnterpriseRouter.post(
  "/staff-enterprise/approval-request",
  canWriteStaff,
  asyncHandler((req, res) => {
    res.status(201).json(staffEnterpriseActionService.createApprovalRequest(req.body, req.access, requestMeta(req)));
  })
);

staffEnterpriseRouter.post(
  "/staff-enterprise/approve",
  canWriteStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseActionService.approve(req.body, req.access, requestMeta(req)));
  })
);

staffEnterpriseRouter.post(
  "/staff-enterprise/reject",
  canWriteStaff,
  asyncHandler((req, res) => {
    res.json(staffEnterpriseActionService.reject(req.body, req.access, requestMeta(req)));
  })
);

staffEnterpriseRouter.post(
  "/staff-enterprise/audit-event",
  canWriteStaff,
  asyncHandler((req, res) => {
    res.status(201).json(staffEnterpriseActionService.manualAuditEvent(req.body, req.access, requestMeta(req)));
  })
);
