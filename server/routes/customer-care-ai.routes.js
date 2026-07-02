import { Router } from "express";
import { answerCustomerCareQuestion, getCustomerCareAiContext } from "../services/customer-care-ai.service.js";

export const customerCareAiRouter = Router();

const rateWindowMs = 10 * 60 * 1000;
const rateLimit = 30;
const buckets = new Map();

customerCareAiRouter.get("/customer-care-ai/context", rateLimiter, (req, res) => {
  res.json(getCustomerCareAiContext());
});

customerCareAiRouter.post("/customer-care-ai/chat", rateLimiter, async (req, res, next) => {
  try {
    const message = String(req.body?.message || "").trim();
    if (!message) {
      res.status(400).json({ error: "message is required" });
      return;
    }
    const answer = await answerCustomerCareQuestion(req.body || {}, {
      tenantId: req.access?.tenantId || req.headers["x-tenant-id"] || "",
      branchId: req.access?.branchId || req.headers["x-branch-id"] || "",
      role: req.access?.role || req.headers["x-user-role"] || ""
    });
    res.json(answer);
  } catch (error) {
    next(error);
  }
});

function rateLimiter(req, res, next) {
  const key = [
    req.headers["x-tenant-id"] || "tenant",
    req.headers["x-branch-id"] || "branch",
    req.ip || req.socket?.remoteAddress || "unknown"
  ].join(":");
  const now = Date.now();
  const bucket = buckets.get(key);
  if (!bucket || bucket.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + rateWindowMs });
    next();
    return;
  }
  if (bucket.count >= rateLimit) {
    res.status(429).json({ error: "Too many Customer Care AI requests. Please try again shortly." });
    return;
  }
  bucket.count += 1;
  next();
}
