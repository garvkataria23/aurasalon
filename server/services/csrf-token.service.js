import { createHmac, randomBytes, timingSafeEqual } from "node:crypto";
import { env } from "../config/env.js";

export const csrfCookieName = "aura_csrf";
const CSRF_TTL_SECONDS = 60 * 60;

function signToken(token) {
  return createHmac("sha256", env.jwtSecret).update(token).digest("base64url");
}

function safeEqual(left, right) {
  const a = Buffer.from(String(left || ""));
  const b = Buffer.from(String(right || ""));
  return a.length === b.length && timingSafeEqual(a, b);
}

export function csrfCookieOptions(maxAgeSeconds = CSRF_TTL_SECONDS) {
  return {
    httpOnly: false,
    secure: env.nodeEnv === "production",
    sameSite: env.refreshCookieSameSite,
    path: "/",
    maxAge: maxAgeSeconds * 1000
  };
}

export function issueCsrfToken(res) {
  const csrfToken = randomBytes(32).toString("base64url");
  const signedToken = `${csrfToken}.${signToken(csrfToken)}`;
  res.cookie(csrfCookieName, signedToken, csrfCookieOptions());
  return {
    csrfToken,
    expiresAt: new Date(Date.now() + CSRF_TTL_SECONDS * 1000).toISOString()
  };
}

export function verifyCsrfToken(csrfToken, signedCookie) {
  const [cookieToken, signature] = String(signedCookie || "").split(".");
  if (!csrfToken || !cookieToken || !signature) return false;
  if (!safeEqual(csrfToken, cookieToken)) return false;
  return safeEqual(signToken(cookieToken), signature);
}
