import { Router } from "express";
import { digitalTwinService } from "../services/digital-twin.service.js";
import { route } from "./staff-os-route-utils.js";

export const digitalTwinRouter = Router();

digitalTwinRouter.post("/digital-twin/simulate", route((req, res) => res.status(201).json(digitalTwinService.simulate(req.body, req.access))));
digitalTwinRouter.get("/digital-twin/snapshots", route((req, res) => res.json(digitalTwinService.snapshots(req.query, req.access))));
digitalTwinRouter.post("/digital-twin/snapshots", route((req, res) => res.status(201).json(digitalTwinService.createSnapshot(req.body, req.access))));
digitalTwinRouter.get("/digital-twin/recommendations", route((req, res) => res.json(digitalTwinService.recommendations(req.query, req.access))));
