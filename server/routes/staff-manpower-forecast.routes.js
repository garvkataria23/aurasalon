import { Router } from "express";
import { staffManpowerForecastService } from "../services/staff-manpower-forecast.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffManpowerForecastRouter = Router();

staffManpowerForecastRouter.get("/staff-os/manpower/forecast", route((req, res) => res.json(staffManpowerForecastService.forecast(req.query, req.access))));
staffManpowerForecastRouter.get("/staff-os/manpower/branch-comparison", route((req, res) => res.json(staffManpowerForecastService.branchComparison(req.query, req.access))));
staffManpowerForecastRouter.post("/staff-os/manpower/recalculate", route((req, res) => res.status(201).json(staffManpowerForecastService.recalculate(req.body, req.access))));
staffManpowerForecastRouter.get("/staff-os/manpower/hiring-recommendations", route((req, res) => res.json(staffManpowerForecastService.hiringRecommendations(req.query, req.access))));
