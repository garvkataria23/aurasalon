import { Router } from "express";
import { staffAttendanceService } from "../services/staff-attendance.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffAttendanceRouter = Router();

staffAttendanceRouter.post("/staff-os/attendance/clock-in", route((req, res) => res.status(201).json(staffAttendanceService.clockIn(req.body, req.access))));
staffAttendanceRouter.post("/staff-os/attendance/clock-out", route((req, res) => res.json(staffAttendanceService.clockOut(req.body, req.access))));
staffAttendanceRouter.post("/staff-os/attendance/break-start", route((req, res) => res.status(201).json(staffAttendanceService.startBreak(req.body, req.access))));
staffAttendanceRouter.post("/staff-os/attendance/break-end", route((req, res) => res.json(staffAttendanceService.endBreak(req.body, req.access))));
staffAttendanceRouter.get("/staff-os/attendance", route((req, res) => res.json(staffAttendanceService.listAttendance(req.query, req.access))));
staffAttendanceRouter.post("/staff-os/attendance/correction", route((req, res) => res.status(201).json(staffAttendanceService.correctAttendance(req.body, req.access))));
