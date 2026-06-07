import { Router } from "express";
import { clientMemoryGraphService } from "../services/client-memory-graph.service.js";
import { route } from "./staff-os-route-utils.js";

export const clientMemoryGraphRouter = Router();

clientMemoryGraphRouter.get("/client-memory/:clientId", route((req, res) => res.json(clientMemoryGraphService.get(req.params.clientId, req.access))));
clientMemoryGraphRouter.post("/client-memory/:clientId/rebuild", route((req, res) => res.status(201).json(clientMemoryGraphService.rebuild(req.params.clientId, req.body, req.access))));
clientMemoryGraphRouter.get("/client-memory/:clientId/next-best-actions", route((req, res) => res.json(clientMemoryGraphService.nextBestActions(req.params.clientId, req.access))));
clientMemoryGraphRouter.post("/client-memory/:clientId/feedback", route((req, res) => res.json(clientMemoryGraphService.feedback(req.params.clientId, req.body, req.access))));
