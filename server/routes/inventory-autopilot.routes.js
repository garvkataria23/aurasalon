import { Router } from "express";
import { inventoryAutopilotService } from "../services/inventory-autopilot.service.js";
import { route } from "./staff-os-route-utils.js";

export const inventoryAutopilotRouter = Router();

inventoryAutopilotRouter.get("/inventory-autopilot/risks", route((req, res) => res.json(inventoryAutopilotService.risks(req.query, req.access))));
inventoryAutopilotRouter.post("/inventory-autopilot/scan", route((req, res) => res.status(201).json(inventoryAutopilotService.scan(req.body, req.access))));
inventoryAutopilotRouter.get("/inventory-autopilot/purchase-recommendations", route((req, res) => res.json(inventoryAutopilotService.recommendations(req.query, req.access))));
inventoryAutopilotRouter.post("/inventory-autopilot/recommendations/:id/approve", route((req, res) => res.json(inventoryAutopilotService.approve(req.params.id, req.body, req.access))));
