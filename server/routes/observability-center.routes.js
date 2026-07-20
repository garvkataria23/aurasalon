import { Router } from "express";
import { observabilityCenterService } from "../services/observability-center.service.js";
import { route } from "./staff-os-route-utils.js";

export const observabilityCenterRouter = Router();

observabilityCenterRouter.get("/observability/health", route((req, res) => res.json(observabilityCenterService.health(req.query, req.access))));
observabilityCenterRouter.get("/observability/errors", route((req, res) => res.json(observabilityCenterService.errors(req.query, req.access))));
observabilityCenterRouter.get("/observability/latency", route((req, res) => res.json(observabilityCenterService.latency(req.query, req.access))));
observabilityCenterRouter.get("/observability/usage", route((req, res) => res.json(observabilityCenterService.usage(req.query, req.access))));
observabilityCenterRouter.post("/observability/snapshot", route((req, res) => res.status(201).json(observabilityCenterService.snapshot(req.body, req.access))));
