import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { federatedLearningRepo } from "../repositories/federated-learning.repo.js";
import { badRequest } from "../utils/app-error.js";

export const federatedLearningRouter = Router();

function scope(req) {
  const tenantId = req.header("x-tenant-id") || req.access?.tenantId || req.query?.tenantId || req.body?.tenantId || "";
  const branchId = req.header("x-branch-id") || req.access?.branchId || req.query?.branchId || req.body?.branchId || "";
  if (!tenantId || !branchId) throw badRequest("tenantId and branchId are required");
  return { tenantId, branchId };
}

federatedLearningRouter.get(
  "/federated/readiness",
  asyncHandler((req, res) => {
    res.json(federatedLearningRepo.readiness(scope(req)));
  })
);

federatedLearningRouter.get(
  "/federated/rounds",
  asyncHandler((req, res) => {
    res.json({ rows: federatedLearningRepo.listRounds({ ...scope(req), limit: req.query.limit }) });
  })
);

federatedLearningRouter.post(
  "/federated/rounds",
  asyncHandler((req, res) => {
    const round = federatedLearningRepo.createRound({ ...scope(req), notes: req.body?.notes });
    res.status(round.status === "blocked" ? 409 : 201).json({
      round,
      gate: federatedLearningRepo.readiness(scope(req))
    });
  })
);
