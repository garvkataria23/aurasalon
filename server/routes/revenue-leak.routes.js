import { Router } from "express";
import { revenueLeakService } from "../services/revenue-leak.service.js";
import { route } from "./staff-os-route-utils.js";

export const revenueLeakRouter = Router();

revenueLeakRouter.get("/revenue-leaks", route((req, res) => res.json(revenueLeakService.list(req.query, req.access))));
revenueLeakRouter.post("/revenue-leaks/scan", route((req, res) => res.status(201).json(revenueLeakService.scan(req.body, req.access))));
revenueLeakRouter.post("/revenue-leaks/:id/approve-action", route((req, res) => res.json(revenueLeakService.approveAction(req.params.id, req.body, req.access))));
revenueLeakRouter.post("/revenue-leaks/:id/dismiss", route((req, res) => res.json(revenueLeakService.dismiss(req.params.id, req.body, req.access))));
revenueLeakRouter.get("/revenue-leaks/summary", route((req, res) => res.json(revenueLeakService.summary(req.query, req.access))));
