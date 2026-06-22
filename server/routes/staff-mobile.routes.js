import { Router } from "express";
import { staffMobileService } from "../services/staff-mobile.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffMobileRouter = Router();

staffMobileRouter.get("/staff-os/mobile/dashboard", route((req, res) => res.json(staffMobileService.mobileDashboard(req.query, req.access))));
staffMobileRouter.get("/staff-os/mobile/today", route((req, res) => res.json(staffMobileService.mobileToday(req.query, req.access))));
staffMobileRouter.post("/staff-os/mobile/start-service", route((req, res) => res.json(staffMobileService.startService(req.body, req.access))));
staffMobileRouter.post("/staff-os/mobile/complete-service", route((req, res) => res.json(staffMobileService.completeService(req.body, req.access))));
staffMobileRouter.get("/staff-os/mobile/payroll", route((req, res) => res.json(staffMobileService.mobilePayroll(req.query, req.access))));
staffMobileRouter.get("/staff-os/mobile/targets", route((req, res) => res.json(staffMobileService.mobileTargets(req.query, req.access))));
staffMobileRouter.post("/staff-os/mobile/request-leave", route((req, res) => res.status(201).json(staffMobileService.requestLeave(req.body, req.access))));
