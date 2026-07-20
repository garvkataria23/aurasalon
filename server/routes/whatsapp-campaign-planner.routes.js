import { Router } from "express";
import { whatsappCampaignPlannerService } from "../services/whatsapp-campaign-planner.service.js";
import { route } from "./staff-os-route-utils.js";

export const whatsappCampaignPlannerRouter = Router();

whatsappCampaignPlannerRouter.post("/whatsapp-campaign-planner/plans", route((req, res) => res.status(201).json(whatsappCampaignPlannerService.createPlan(req.body, req.access))));
whatsappCampaignPlannerRouter.get("/whatsapp-campaign-planner/plans", route((req, res) => res.json(whatsappCampaignPlannerService.plans(req.query, req.access))));
whatsappCampaignPlannerRouter.post("/whatsapp-campaign-planner/plans/:id/approve", route((req, res) => res.json(whatsappCampaignPlannerService.approve(req.params.id, req.body, req.access))));
whatsappCampaignPlannerRouter.post("/whatsapp-campaign-planner/plans/:id/schedule", route((req, res) => res.json(whatsappCampaignPlannerService.schedule(req.params.id, req.body, req.access))));
whatsappCampaignPlannerRouter.get("/whatsapp-campaign-planner/outcomes", route((req, res) => res.json(whatsappCampaignPlannerService.outcomes(req.query, req.access))));
