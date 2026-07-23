/**
 * Authentication helper for the Aura Staff App E2E tests.
 *
 * Two strategies:
 *   1. API-level login (fast, reliable) — calls POST /api/v1/auth/login directly
 *   2. UI-level login (fallback) — fills the login form and submits
 *
 * If no credentials are set via env vars, tests that require auth are skipped.
 */

import { type Page, type BrowserContext } from "@playwright/test";

/* ── Credentials ───────────────────────────────────────── */

export const CREDENTIALS = {
  tenantId: process.env.STAFF_TENANT || "tenant_aura",
  loginId: process.env.STAFF_USER || "",
  password: process.env.STAFF_PASS || "",
};

const API_BASE = process.env.BASE_URL || "http://127.0.0.1:4320";

export function hasCredentials(): boolean {
  return Boolean(CREDENTIALS.loginId && CREDENTIALS.password);
}

/* ── API-level login ───────────────────────────────────── */

async function fetchCsrfToken(api: BrowserContext["request"]): Promise<string> {
  const res = await api.get(`${API_BASE}/api/v1/auth/csrf`);
  if (!res.ok()) return "";
  const body = await res.json().catch(() => ({}));
  return body?.csrfToken || body?.token || "";
}

export async function apiLogin(context: BrowserContext): Promise<boolean> {
  if (!hasCredentials()) return false;

  try {
    const csrfToken = await fetchCsrfToken(context.request);

    const loginRes = await context.request.post(`${API_BASE}/api/v1/auth/login`, {
      headers: csrfToken ? { "x-csrf-token": csrfToken } : {},
      data: {
        tenantId: CREDENTIALS.tenantId,
        loginId: CREDENTIALS.loginId,
        password: CREDENTIALS.password,
      },
    });

    if (!loginRes.ok()) return false;

    const body = await loginRes.json().catch(() => ({}));
    if (!body?.accessToken) return false;

    // Store accessToken in localStorage so the Angular service can pick it up
    // on the next page load via tryRestoreSession().
    // We use addInitScript to inject it before Angular bootstraps.
    await context.addInitScript((token: string) => {
      localStorage.setItem("auraStaffAccessToken", token);
    }, body.accessToken);

    return true;
  } catch {
    return false;
  }
}

/* ── UI-level login (fallback) ─────────────────────────── */

export async function uiLogin(page: Page): Promise<boolean> {
  if (!hasCredentials()) return false;

  try {
    await page.goto("/staff/login", { waitUntil: "networkidle" });

    await page.locator("#staff-tenant-id").fill(CREDENTIALS.tenantId);
    await page.locator("#staff-login-id").fill(CREDENTIALS.loginId);
    await page.locator("#staff-password").fill(CREDENTIALS.password);
    await page.locator('button[type="submit"]').click();

    await page.waitForURL(/\/staff\/(?!login)/, { timeout: 10_000 });
    return true;
  } catch {
    return false;
  }
}

/* ── Combined login ────────────────────────────────────── */

export async function loginStaff(page: Page): Promise<boolean> {
  const context = page.context();

  // Try API login first (injects token into localStorage)
  const apiOk = await apiLogin(context);
  if (apiOk) {
    await page.goto("/staff/dashboard", { waitUntil: "networkidle" });
    if (!page.url().includes("/staff/login")) return true;
  }

  // Fallback to UI login
  return uiLogin(page);
}

/* ── Navigate to protected route (with auto-login) ─────── */

export async function gotoProtected(page: Page, path: string): Promise<void> {
  await page.goto(path, { waitUntil: "domcontentloaded" });

  if (page.url().includes("/staff/login")) {
    const ok = await loginStaff(page);
    if (ok) {
      await page.goto(path, { waitUntil: "domcontentloaded" });
    }
  }

  // Let Angular settle
  await page.waitForTimeout(400);
}
