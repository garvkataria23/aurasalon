import { Router } from "express";
import { staffIntelligenceService } from "../services/staff-intelligence.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffIntelligenceRouter = Router();

staffIntelligenceRouter.get("/staff-os/intelligence/burnout-risk", route((req, res) => res.json(staffIntelligenceService.burnoutRisk(req.query, req.access))));
staffIntelligenceRouter.get("/staff-os/intelligence/churn-risk", route((req, res) => res.json(staffIntelligenceService.churnRisk(req.query, req.access))));
staffIntelligenceRouter.post("/staff-os/intelligence/best-staff", route((req, res) => res.json(staffIntelligenceService.bestStaff(req.body, req.access))));
staffIntelligenceRouter.post("/staff-os/intelligence/replacement-suggestion", route((req, res) => res.json(staffIntelligenceService.replacementSuggestion(req.body, req.access))));
