/** Default production site domain fallback. Override via NEXT_PUBLIC_SITE_URL in production environment. */
const DEFAULT_SITE_URL = "https://aurasalonpos.com";

export const SITE_URL = (process.env.NEXT_PUBLIC_SITE_URL || DEFAULT_SITE_URL).replace(/\/$/, "");
export const SITE_URL_IS_PLACEHOLDER = false;
