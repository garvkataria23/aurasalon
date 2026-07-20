import { Router } from "express";
import { staffTipsService } from "../services/staff-tips.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffTipsRouter = Router();

staffTipsRouter.get("/staff-os/tips", route((req, res) => res.json(staffTipsService.listTips(req.query, req.access))));
staffTipsRouter.get("/staff-os/tips/report", route((req, res) => res.json(staffTipsService.tipsReport(req.query, req.access))));
