import { env } from "../config/env.js";

export function mobileApiContext(req, res, next) {
  req.apiVersion = env.apiVersion;
  res.setHeader("x-api-version", env.apiVersion);
  const originalJson = res.json.bind(res);
  res.json = (body) => {
    if (body && typeof body === "object" && Object.prototype.hasOwnProperty.call(body, "success") && body.meta) {
      return originalJson(body);
    }
    const status = res.statusCode || 200;
    if (status >= 400 || body?.error) {
      return originalJson({
        success: false,
        error: {
          message: body?.error || "Request failed",
          status,
          details: body?.details
        },
        meta: meta(req)
      });
    }
    return originalJson({
      success: true,
      data: body,
      meta: meta(req)
    });
  };
  next();
}

export function meta(req) {
  return {
    requestId: req.requestId,
    version: env.apiVersion,
    timestamp: new Date().toISOString()
  };
}
