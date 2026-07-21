import { Router } from "express";
import { staffScheduleService } from "../services/staff-schedule.service.js";
import { staffShiftSwapService } from "../services/staff-shift-swap.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffScheduleRouter = Router();

staffScheduleRouter.get("/staff-os/schedules", route((req, res) => res.json(staffScheduleService.listSchedules(req.query, req.access))));
staffScheduleRouter.post("/staff-os/schedules", route((req, res) => res.status(201).json(staffScheduleService.createSchedule(req.body, req.access))));
staffScheduleRouter.patch("/staff-os/schedules/:id", route((req, res) => res.json(staffScheduleService.updateSchedule(req.params.id, req.body, req.access))));
staffScheduleRouter.delete("/staff-os/schedules/:id", route((req, res) => res.json(staffScheduleService.deleteSchedule(req.params.id, req.access))));
staffScheduleRouter.post("/staff-os/shift-swaps", route((req, res) => res.status(201).json(staffShiftSwapService.createForManager(req.body, req.access))));
staffScheduleRouter.get("/staff-os/shift-swaps", route((req, res) => res.json(staffShiftSwapService.listForManager(req.query, req.access))));
staffScheduleRouter.post("/staff-os/shift-swaps/:id/approve", route((req, res) => res.json(staffShiftSwapService.approve(req.params.id, req.body, req.access))));
staffScheduleRouter.post("/staff-os/shift-swaps/:id/reject", route((req, res) => res.json(staffShiftSwapService.reject(req.params.id, req.body, req.access))));
staffScheduleRouter.post("/staff-os/branch-transfer", route((req, res) => res.json(staffScheduleService.branchTransfer(req.body, req.access))));
