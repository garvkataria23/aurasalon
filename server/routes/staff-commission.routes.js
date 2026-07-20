import { Router } from "express";
import { staffOsService } from "../services/staff-os.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffCommissionRouter = Router();

staffCommissionRouter.get("/staff-os/commissions", route((req, res) => res.json(staffOsService.listCommissions(req.query, req.access))));
staffCommissionRouter.post("/staff-os/commissions/calculate", route((req, res) => res.status(201).json(staffOsService.calculateCommission(req.body, req.access))));
staffCommissionRouter.post("/staff-os/commissions/:id/approve", route((req, res) => res.json(staffOsService.approveCommission(req.params.id, req.access))));
