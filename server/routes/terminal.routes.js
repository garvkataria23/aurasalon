import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { deviceSessionService } from "../services/device-session.service.js";
import { terminalService } from "../services/terminal.service.js";

export const terminalRouter = Router();

terminalRouter.post("/terminals/register", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.status(201).json(terminalService.register(req.body, req.access));
}));

terminalRouter.get("/terminals", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json({ rows: terminalService.list(req.query, req.access) });
}));

terminalRouter.post("/terminals/:id/start-session", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.status(201).json(deviceSessionService.start(req.params.id, req.body, req.access, req));
}));

terminalRouter.post("/terminals/:id/end-session", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.json(deviceSessionService.end(req.params.id, req.body, req.access));
}));

terminalRouter.post("/terminals/:id/heartbeat", requirePermission("write", () => "invoices"), asyncHandler((req, res) => {
  res.json(terminalService.heartbeat(req.params.id, req.body, req.access));
}));

terminalRouter.get("/terminals/:id/sales", requirePermission("read", () => "invoices"), asyncHandler((req, res) => {
  res.json(terminalService.sales(req.params.id, req.query, req.access));
}));
