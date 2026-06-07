import { AppError } from "../utils/app-error.js";

export function captchaMiddleware(req, _res, next) {
  const devMode = process.env.NODE_ENV !== "production";
  if (devMode || process.env.CAPTCHA_DISABLED === "true") {
    next();
    return;
  }
  const token = req.get("x-captcha-token") || req.body?.captchaToken || "";
  if (!token) {
    next(new AppError("Captcha verification is required", 403));
    return;
  }
  next();
}
