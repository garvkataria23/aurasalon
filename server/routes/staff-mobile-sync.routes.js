import { Router } from "express";
import { staffMobileSyncService } from "../services/staff-mobile-sync.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffMobileSyncRouter = Router();

staffMobileSyncRouter.post("/staff-os/mobile/devices/register", route((req, res) => res.status(201).json(staffMobileSyncService.registerDevice(req.body, req.access))));
staffMobileSyncRouter.get("/staff-os/mobile/snapshot", route((req, res) => res.json(staffMobileSyncService.snapshot(req.query, req.access))));
staffMobileSyncRouter.post("/staff-os/mobile/sync", route((req, res) => res.json(staffMobileSyncService.sync(req.body, req.access))));
staffMobileSyncRouter.get("/staff-os/mobile/conflicts", route((req, res) => res.json(staffMobileSyncService.conflicts(req.query, req.access))));
staffMobileSyncRouter.post("/staff-os/mobile/conflicts/:id/resolve", route((req, res) => res.json(staffMobileSyncService.resolveConflict(req.params.id, req.body, req.access))));
