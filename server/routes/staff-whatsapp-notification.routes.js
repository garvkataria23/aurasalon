import { Router } from "express";
import { staffWhatsappNotificationService } from "../services/staff-whatsapp-notification.service.js";
import { route } from "./staff-os-route-utils.js";

export const staffWhatsappNotificationRouter = Router();

staffWhatsappNotificationRouter.get("/staff-os/notifications/templates", route((req, res) => res.json(staffWhatsappNotificationService.listTemplates(req.query, req.access))));
staffWhatsappNotificationRouter.post("/staff-os/notifications/templates", route((req, res) => res.status(201).json(staffWhatsappNotificationService.createTemplate(req.body, req.access))));
staffWhatsappNotificationRouter.post("/staff-os/notifications/queue", route((req, res) => res.status(201).json(staffWhatsappNotificationService.queue(req.body, req.access))));
staffWhatsappNotificationRouter.post("/staff-os/notifications/:id/approve", route((req, res) => res.json(staffWhatsappNotificationService.approve(req.params.id, req.access))));
staffWhatsappNotificationRouter.post("/staff-os/notifications/:id/mark-sent", route((req, res) => res.json(staffWhatsappNotificationService.markSent(req.params.id, req.body, req.access))));
staffWhatsappNotificationRouter.get("/staff-os/notifications/logs", route((req, res) => res.json(staffWhatsappNotificationService.logs(req.query, req.access))));
