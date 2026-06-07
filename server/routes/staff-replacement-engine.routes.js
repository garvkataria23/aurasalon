import { Router } from "express";
import { staffReplacementEngineService } from "../services/staff-replacement-engine.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffReplacementEngineRouter = Router();

staffReplacementEngineRouter.post("/staff-os/replacement/recommend", route((req, res) => res.status(201).json(staffReplacementEngineService.recommend(req.body, req.access))));
staffReplacementEngineRouter.post("/staff-os/replacement/:id/approve", route((req, res) => res.json(staffReplacementEngineService.approve(req.params.id, req.body, req.access))));
staffReplacementEngineRouter.post("/staff-os/replacement/:id/reject", route((req, res) => res.json(staffReplacementEngineService.reject(req.params.id, req.body, req.access))));
staffReplacementEngineRouter.get("/staff-os/replacement/history", route((req, res) => res.json(staffReplacementEngineService.history(req.query, req.access))));
