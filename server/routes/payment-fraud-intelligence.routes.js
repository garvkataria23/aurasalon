import { Router } from "express";
import { paymentFraudIntelligenceService } from "../services/payment-fraud-intelligence.service.js";
import { route } from "./staff-os-route-utils.js";

export const paymentFraudIntelligenceRouter = Router();

paymentFraudIntelligenceRouter.get("/payment-intelligence/risks", route((req, res) => res.json(paymentFraudIntelligenceService.risks(req.query, req.access))));
paymentFraudIntelligenceRouter.post("/payment-intelligence/scan", route((req, res) => res.status(201).json(paymentFraudIntelligenceService.scan(req.body, req.access))));
paymentFraudIntelligenceRouter.post("/payment-intelligence/risks/:id/resolve", route((req, res) => res.json(paymentFraudIntelligenceService.resolve(req.params.id, req.body, req.access))));
paymentFraudIntelligenceRouter.get("/payment-intelligence/summary", route((req, res) => res.json(paymentFraudIntelligenceService.summary(req.query, req.access))));
