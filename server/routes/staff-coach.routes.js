import { Router } from "express";
import { staffCoachService } from "../services/staff-coach.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffCoachRouter = Router();

staffCoachRouter.get("/staff-os/coach/insights", route((req, res) => res.json(staffCoachService.insights(req.query, req.access))));
staffCoachRouter.get("/staff-os/coach/staff/:id", route((req, res) => res.json(staffCoachService.staffInsights(req.params.id, req.query, req.access))));
staffCoachRouter.post("/staff-os/coach/goals", route((req, res) => res.status(201).json(staffCoachService.createGoal(req.body, req.access))));
staffCoachRouter.post("/staff-os/coach/actions/:id/complete", route((req, res) => res.json(staffCoachService.completeAction(req.params.id, req.body, req.access))));
