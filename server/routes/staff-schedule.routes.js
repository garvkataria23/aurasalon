import { Router } from "express";
import { staffScheduleService } from "../services/staff-schedule.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffScheduleRouter = Router();

staffScheduleRouter.get("/staff-os/schedules", route((req, res) => res.json(staffScheduleService.listSchedules(req.query, req.access))));
staffScheduleRouter.post("/staff-os/schedules", route((req, res) => res.status(201).json(staffScheduleService.createSchedule(req.body, req.access))));
staffScheduleRouter.patch("/staff-os/schedules/:id", route((req, res) => res.json(staffScheduleService.updateSchedule(req.params.id, req.body, req.access))));
staffScheduleRouter.delete("/staff-os/schedules/:id", route((req, res) => res.json(staffScheduleService.deleteSchedule(req.params.id, req.access))));
staffScheduleRouter.post("/staff-os/shift-swaps", route((req, res) => res.status(201).json(staffScheduleService.createShiftSwap(req.body, req.access))));
staffScheduleRouter.post("/staff-os/shift-swaps/:id/approve", route((req, res) => res.json(staffScheduleService.approveShiftSwap(req.params.id, req.body, req.access))));
staffScheduleRouter.post("/staff-os/branch-transfer", route((req, res) => res.json(staffScheduleService.branchTransfer(req.body, req.access))));
