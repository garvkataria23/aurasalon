import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { whatsappAutomationService } from "../services/whatsapp-automation.service.js";
import { validateBody } from "../validators/request-validator.js";

export const whatsappRouter = Router();

whatsappRouter.get(
  "/whatsapp/summary",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(whatsappAutomationService.summary(req.access));
  })
);

whatsappRouter.get(
  "/whatsapp/threads",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(whatsappAutomationService.threads(req.query, req.access));
  })
);

whatsappRouter.get(
  "/whatsapp/messages",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(whatsappAutomationService.messages(req.query, req.access));
  })
);

whatsappRouter.get(
  "/whatsapp/rules",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(whatsappAutomationService.rules(req.query, req.access));
  })
);

whatsappRouter.get(
  "/whatsapp/handoffs",
  requirePermission("read", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(whatsappAutomationService.handoffs(req.query, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/inbound",
  requirePermission("write", () => "whatsapp"),
  validateBody({ required: ["phone", "body"] }),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.processInbound(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/booking-confirmation",
  requirePermission("write", () => "whatsapp"),
  validateBody({ required: ["appointmentId"] }),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.bookingConfirmation(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/reminders",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.reminderMessages(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/missed-call",
  requirePermission("write", () => "whatsapp"),
  validateBody({ required: ["phone"] }),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.missedCallFollowUp(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/payment-reminders",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.paymentReminders(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/birthday-wishes",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.birthdayWishes(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/campaign-broadcast",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.campaignBroadcast(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/qualify-lead",
  requirePermission("write", () => "whatsapp"),
  validateBody({ required: ["body"] }),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.qualifyLead(req.body, req.access));
  })
);

whatsappRouter.post(
  "/whatsapp/handoffs",
  requirePermission("write", () => "whatsapp"),
  validateBody({ required: ["threadId", "reason"] }),
  asyncHandler((req, res) => {
    res.status(201).json(whatsappAutomationService.createHandoff(req.body, req.access));
  })
);

whatsappRouter.patch(
  "/whatsapp/handoffs/:id",
  requirePermission("write", () => "whatsapp"),
  asyncHandler((req, res) => {
    res.json(whatsappAutomationService.updateHandoff(req.params.id, req.body, req.access));
  })
);
