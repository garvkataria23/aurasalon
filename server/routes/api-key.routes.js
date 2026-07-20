import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { requirePermission } from "../middleware/rbac.js";
import { apiKeyService } from "../services/api-key.service.js";
import { validateBody } from "../validators/request-validator.js";
import { forbidden } from "../utils/app-error.js";

/** Partner API key admin (ADD-ONLY). Gated to write:security. */
export const apiKeyRouter = Router();

apiKeyRouter.get("/api-keys", requirePermission("read", () => "security"), asyncHandler((req, res) => {
  res.json({ apiKeys: apiKeyService.list(req.access) });
}));

apiKeyRouter.post("/api-keys", requirePermission("write", () => "security"),
  validateBody({ required: ["name"] }),
  asyncHandler((req, res) => res.status(201).json(apiKeyService.create(req.body, req.access))));

apiKeyRouter.post("/api-keys/:id/rotate", requirePermission("write", () => "security"),
  asyncHandler((req, res) => res.json(apiKeyService.rotate(req.params.id, req.access))));

apiKeyRouter.post("/api-keys/:id/revoke", requirePermission("write", () => "security"),
  asyncHandler((req, res) => res.json(apiKeyService.revoke(req.params.id, req.access))));

/**
 * Middleware for partner-facing endpoints: authenticate via x-api-key,
 * enforce per-key rate limit + scope, and populate req.apiKey / req.access.
 */
export function apiKeyAuth(requiredScope) {
  return (req, _res, next) => {
    try {
      const key = apiKeyService.verify(req.get("x-api-key") || "");
      if (requiredScope && !apiKeyService.hasScope(key, requiredScope)) {
        next(forbidden(`API key missing scope: ${requiredScope}`));
        return;
      }
      req.apiKey = key;
      req.access = { tenantId: key.tenantId, role: "apiPartner", userId: key.id, branchId: "", branchIds: [] };
      next();
    } catch (err) {
      next(err);
    }
  };
}
