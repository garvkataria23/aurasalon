import { Router } from "express";
import { staffLeaveService } from "../services/staff-leave.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffLeaveRouter = Router();

staffLeaveRouter.post("/staff-os/leaves", route((req, res) => res.status(201).json(staffLeaveService.requestLeave(req.body, req.access))));
staffLeaveRouter.patch("/staff-os/leaves/:id/approve", route((req, res) => res.json(staffLeaveService.decideLeave(req.params.id, "approved", req.body, req.access))));
staffLeaveRouter.patch("/staff-os/leaves/:id/reject", route((req, res) => res.json(staffLeaveService.decideLeave(req.params.id, "rejected", req.body, req.access))));
staffLeaveRouter.get("/staff-os/leaves", route((req, res) => res.json(staffLeaveService.listLeaves(req.query, req.access))));
staffLeaveRouter.get("/staff-os/leave-calendar", route((req, res) => res.json(staffLeaveService.listLeaves(req.query, req.access))));
staffLeaveRouter.get("/staff-os/leave-balances", route((req, res) => res.json(staffLeaveService.leaveBalances(req.query, req.access))));
