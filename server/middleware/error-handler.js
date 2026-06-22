import { logger } from "../utils/logger.js";

export function notFoundHandler(req, _res, next) {
  const error = new Error(`Route not found: ${req.method} ${req.originalUrl}`);
  error.status = 404;
  next(error);
}

export function errorHandler(err, req, res, _next) {
  const status = err.status || 500;
  const response = {
    error: err.message || "Internal server error",
    status,
    requestId: req.requestId
  };
  if (err.details) response.details = err.details;

  logger.error("request_error", {
    requestId: req.requestId,
    method: req.method,
    path: req.originalUrl,
    status,
    error: err.message,
    stack: status >= 500 ? err.stack : undefined
  });

  if (req.apiVersion === "v1") {
    res.status(status).json({
      success: false,
      error: {
        message: response.error,
        status,
        details: response.details
      },
      meta: {
        requestId: req.requestId,
        version: req.apiVersion,
        timestamp: new Date().toISOString()
      }
    });
    return;
  }

  res.status(status).json(response);
}
