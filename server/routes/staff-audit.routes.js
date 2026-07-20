import { Router } from "express";
import { staffAuditService } from "../services/staff-audit.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffAuditRouter = Router();

staffAuditRouter.get("/staff-os/audit", route((req, res) => res.json(staffAuditService.auditTrail(req.query, req.access))));
