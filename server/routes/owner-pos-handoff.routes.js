import { Router } from "express";
import { asyncHandler } from "../middleware/async-handler.js";
import { publicAuthSession, setAuthRefreshCookie } from "../services/auth-cookie-session.service.js";
import { ownerPosHandoffService } from "../services/owner-pos-handoff.service.js";

export const ownerPosHandoffPublicRouter = Router();

ownerPosHandoffPublicRouter.post("/auth/owner-pos-handoff/consume", asyncHandler((req, res) => {
  const result = ownerPosHandoffService.consume(req, res);
  setAuthRefreshCookie(res, result.session);
  res.json({ session: publicAuthSession(result.session), posContext: result.posContext });
}));
