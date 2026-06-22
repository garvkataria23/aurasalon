import { Router } from "express";
import { securityHardeningService } from "../services/security-hardening.service.js";
import { route } from "./staff-os-route-utils.js";

export const securityHardeningRouter = Router();

securityHardeningRouter.get("/security-hardening/findings", route((req, res) => res.json(securityHardeningService.findings(req.query, req.access))));
securityHardeningRouter.post("/security-hardening/scan", route((req, res) => res.status(201).json(securityHardeningService.scan(req.body, req.access))));
securityHardeningRouter.post("/security-hardening/findings/:id/resolve", route((req, res) => res.json(securityHardeningService.resolve(req.params.id, req.body, req.access))));
securityHardeningRouter.get("/security-hardening/summary", route((req, res) => res.json(securityHardeningService.summary(req.query, req.access))));
