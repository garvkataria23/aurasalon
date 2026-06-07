import { Router } from "express";
import { staffPerformanceService } from "../services/staff-performance.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffPerformanceRouter = Router();

staffPerformanceRouter.get("/staff-os/performance", route((req, res) => res.json(staffPerformanceService.performance(req.query, req.access))));
staffPerformanceRouter.get("/staff-os/performance/:id", route((req, res) => res.json(staffPerformanceService.performanceByStaff(req.params.id, req.query, req.access))));
staffPerformanceRouter.get("/staff-os/leaderboard", route((req, res) => res.json(staffPerformanceService.leaderboard(req.query, req.access))));
