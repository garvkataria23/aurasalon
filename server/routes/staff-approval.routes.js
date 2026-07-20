import { Router } from "express";
import { staffApprovalService } from "../services/staff-approval.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffApprovalRouter = Router();

staffApprovalRouter.get("/staff-os/approvals", route((req, res) => res.json(staffApprovalService.list(req.query, req.access))));
staffApprovalRouter.post("/staff-os/approvals", route((req, res) => res.status(201).json(staffApprovalService.create(req.body, req.access))));
staffApprovalRouter.post("/staff-os/approvals/:id/approve", route((req, res) => res.json(staffApprovalService.approve(req.params.id, req.body, req.access))));
staffApprovalRouter.post("/staff-os/approvals/:id/reject", route((req, res) => res.json(staffApprovalService.reject(req.params.id, req.body, req.access))));
staffApprovalRouter.post("/staff-os/approvals/:id/escalate", route((req, res) => res.json(staffApprovalService.escalate(req.params.id, req.body, req.access))));
staffApprovalRouter.get("/staff-os/approvals/policies", route((req, res) => res.json(staffApprovalService.policies(req.query, req.access))));
staffApprovalRouter.post("/staff-os/approvals/policies", route((req, res) => res.status(201).json(staffApprovalService.createPolicy(req.body, req.access))));
