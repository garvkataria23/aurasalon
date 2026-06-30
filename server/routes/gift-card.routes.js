import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { validateBody } from "../validators/request-validator.js";
import { giftCardService } from "../services/gift-card.service.js";
import { storeCreditService } from "../services/store-credit.service.js";

export const giftCardRouter = Router();

giftCardRouter.post("/gift-cards/sell", requirePermission("write", () => "payments"), validateBody({ required: ["amount"] }), asyncHandler((req, res) => res.status(201).json(giftCardService.sell(req.body, req.access))));
giftCardRouter.post("/gift-cards/redeem", requirePermission("write", () => "payments"), validateBody({ required: ["code", "amount"] }), asyncHandler((req, res) => res.json(giftCardService.redeem(req.body, req.access))));
giftCardRouter.get("/gift-cards/:code/status", requirePermission("read", () => "payments"), asyncHandler((req, res) => res.json(giftCardService.status(req.params.code, req.access))));
giftCardRouter.post("/store-credit/create", requirePermission("write", () => "payments"), validateBody({ required: ["amount"] }), asyncHandler((req, res) => res.status(201).json(storeCreditService.create(req.body, req.access))));
giftCardRouter.post("/store-credit/redeem", requirePermission("write", () => "payments"), validateBody({ required: ["amount"] }), asyncHandler((req, res) => res.json(storeCreditService.redeem(req.body, req.access))));
giftCardRouter.get("/customers/:id/store-credit", requirePermission("read", () => "payments"), asyncHandler((req, res) => res.json(storeCreditService.listCustomer(req.params.id, req.access))));
