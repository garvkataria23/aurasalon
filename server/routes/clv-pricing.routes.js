import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { clvRepo } from "../repositories/clv.repo.js";
import { badRequest } from "../utils/app-error.js";
import { clvPricer } from "../utils/clv-pricer.js";

export const clvPricingRouter = Router();

function scope(req) {
  const tenantId = req.header("x-tenant-id") || req.access?.tenantId || req.query?.tenantId || req.body?.tenantId || "";
  const branchId = req.header("x-branch-id") || req.access?.branchId || req.query?.branchId || req.body?.branchId || "";
  if (!tenantId || !branchId) throw badRequest("tenantId and branchId are required");
  return { tenantId, branchId };
}

clvPricingRouter.get(
  "/clv/:clientId",
  asyncHandler((req, res) => {
    const current = scope(req);
    const clientId = Number.parseInt(req.params.clientId, 10) || 0;
    const baseDiscountPercent = Number.parseInt(req.query.baseDiscountPercent, 10) || 0;
    const score = clvRepo.getScore({ ...current, clientId });
    const pricing = clvPricer.getClvAdjustedDiscount({ ...current, clientId, baseDiscountPercent });
    res.json({
      clientId,
      score,
      pricing,
      gate: score
        ? { status: "ready", note: "CLV score is available from stored sidecar/manual output." }
        : { status: "collecting", note: "No CLV score stored yet; keep default discount strategy." }
    });
  })
);

clvPricingRouter.get(
  "/clv/top",
  asyncHandler((req, res) => {
    res.json({ rows: clvRepo.getTopClvClients({ ...scope(req), limit: req.query.limit }) });
  })
);

clvPricingRouter.get(
  "/clv/at-risk",
  asyncHandler((req, res) => {
    res.json({
      rows: clvRepo.getAtRiskClients({
        ...scope(req),
        limit: req.query.limit,
        minCurrentValuePaise: req.query.minCurrentValuePaise
      })
    });
  })
);

clvPricingRouter.post(
  "/clv/scores",
  asyncHandler((req, res) => {
    try {
      const score = clvRepo.upsertScore({ ...scope(req), ...req.body });
      res.status(201).json({ score });
    } catch (error) {
      throw badRequest(error.message || "Unable to store CLV score");
    }
  })
);
