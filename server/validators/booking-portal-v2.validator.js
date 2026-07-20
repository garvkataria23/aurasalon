import { badRequest } from "../utils/app-error.js";

const phonePattern = /^\+?[1-9]\d{7,14}$/;
const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function assertPhone(phone) {
  const normalized = String(phone || "").replace(/\s+/g, "");
  if (!phonePattern.test(normalized)) throw badRequest("Valid mobile number is required");
  return normalized;
}

export function assertEmail(email) {
  if (!email) return "";
  if (!emailPattern.test(String(email))) throw badRequest("Valid email is required");
  return String(email);
}

export function assertServiceIds(serviceIds) {
  const ids = Array.isArray(serviceIds) ? serviceIds : String(serviceIds || "").split(",");
  const clean = ids.map((id) => String(id).trim()).filter(Boolean);
  if (!clean.length) throw badRequest("At least one service is required");
  return clean;
}
