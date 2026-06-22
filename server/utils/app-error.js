export class AppError extends Error {
  constructor(message, status = 500, details = undefined) {
    super(message);
    this.name = "AppError";
    this.status = status;
    this.details = details;
  }
}

export function notFound(message = "Record not found") {
  return new AppError(message, 404);
}

export function badRequest(message, details = undefined) {
  return new AppError(message, 400, details);
}

export function conflict(message, details = undefined) {
  return new AppError(message, 409, details);
}

export function forbidden(message = "You do not have permission to perform this action") {
  return new AppError(message, 403);
}

export function unauthorized(message = "Authentication is required") {
  return new AppError(message, 401);
}
