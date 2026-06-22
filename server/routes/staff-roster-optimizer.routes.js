import { Router } from "express";
import { staffRosterOptimizerService } from "../services/staff-roster-optimizer.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffRosterOptimizerRouter = Router();

staffRosterOptimizerRouter.post("/staff-os/roster/optimize", route((req, res) => res.status(201).json(staffRosterOptimizerService.optimize(req.body, req.access))));
staffRosterOptimizerRouter.post("/staff-os/roster/drafts/:id/apply", route((req, res) => res.json(staffRosterOptimizerService.applyDraft(req.params.id, req.access))));
staffRosterOptimizerRouter.get("/staff-os/roster/gaps", route((req, res) => res.json(staffRosterOptimizerService.gaps(req.query, req.access))));
staffRosterOptimizerRouter.get("/staff-os/roster/coverage", route((req, res) => res.json(staffRosterOptimizerService.coverage(req.query, req.access))));
