import { Router } from "express";
import { ownerCommandCenterService } from "../services/owner-command-center.service.js";
import { route } from "./staff-os-route-utils.js";

export const ownerCommandCenterRouter = Router();

ownerCommandCenterRouter.post("/command-center/commands", route((req, res) => res.status(201).json(ownerCommandCenterService.createCommand(req.body, req.access))));
ownerCommandCenterRouter.get("/command-center/commands", route((req, res) => res.json(ownerCommandCenterService.commands(req.query, req.access))));
ownerCommandCenterRouter.get("/command-center/plans/:id", route((req, res) => res.json(ownerCommandCenterService.plan(req.params.id, req.access))));
ownerCommandCenterRouter.post("/command-center/actions/:id/approve", route((req, res) => res.json(ownerCommandCenterService.decideAction(req.params.id, "approve", req.body, req.access))));
ownerCommandCenterRouter.post("/command-center/actions/:id/reject", route((req, res) => res.json(ownerCommandCenterService.decideAction(req.params.id, "reject", req.body, req.access))));
