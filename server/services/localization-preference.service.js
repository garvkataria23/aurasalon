import { db } from "../db.js";
import { badRequest } from "../utils/app-error.js";

const SETTING_KEY = "localization.preference";
const DEFAULT_PREFERENCE = {
  countryCode: "IN",
  languageCode: "en",
  direction: "ltr",
  currencyCode: "INR",
  dateLocale: "en-IN",
  numberLocale: "en-IN"
};

const COUNTRY_DEFAULTS = {
  AE: { languageCode: "ar", direction: "rtl", currencyCode: "AED", dateLocale: "ar-AE", numberLocale: "ar-AE" },
  AU: { languageCode: "en", currencyCode: "AUD", dateLocale: "en-AU", numberLocale: "en-AU" },
  BR: { languageCode: "pt", currencyCode: "BRL", dateLocale: "pt-BR", numberLocale: "pt-BR" },
  CA: { languageCode: "en", currencyCode: "CAD", dateLocale: "en-CA", numberLocale: "en-CA" },
  DE: { languageCode: "de", currencyCode: "EUR", dateLocale: "de-DE", numberLocale: "de-DE" },
  ES: { languageCode: "es", currencyCode: "EUR", dateLocale: "es-ES", numberLocale: "es-ES" },
  FR: { languageCode: "fr", currencyCode: "EUR", dateLocale: "fr-FR", numberLocale: "fr-FR" },
  GB: { languageCode: "en", currencyCode: "GBP", dateLocale: "en-GB", numberLocale: "en-GB" },
  ID: { languageCode: "id", currencyCode: "IDR", dateLocale: "id-ID", numberLocale: "id-ID" },
  IN: DEFAULT_PREFERENCE,
  IT: { languageCode: "it", currencyCode: "EUR", dateLocale: "it-IT", numberLocale: "it-IT" },
  JP: { languageCode: "ja", currencyCode: "JPY", dateLocale: "ja-JP", numberLocale: "ja-JP" },
  KR: { languageCode: "ko", currencyCode: "KRW", dateLocale: "ko-KR", numberLocale: "ko-KR" },
  NL: { languageCode: "nl", currencyCode: "EUR", dateLocale: "nl-NL", numberLocale: "nl-NL" },
  SA: { languageCode: "ar", direction: "rtl", currencyCode: "SAR", dateLocale: "ar-SA", numberLocale: "ar-SA" },
  SG: { languageCode: "en", currencyCode: "SGD", dateLocale: "en-SG", numberLocale: "en-SG" },
  TH: { languageCode: "th", currencyCode: "THB", dateLocale: "th-TH", numberLocale: "th-TH" },
  TR: { languageCode: "tr", currencyCode: "TRY", dateLocale: "tr-TR", numberLocale: "tr-TR" },
  US: { languageCode: "en", currencyCode: "USD", dateLocale: "en-US", numberLocale: "en-US" },
  VN: { languageCode: "vi", currencyCode: "VND", dateLocale: "vi-VN", numberLocale: "vi-VN" },
  ZA: { languageCode: "en", currencyCode: "ZAR", dateLocale: "en-ZA", numberLocale: "en-ZA" }
};

const RTL_LANGUAGES = new Set(["ar", "fa", "he", "ur"]);

function parseJson(value, fallback) {
  try {
    return value ? JSON.parse(value) : fallback;
  } catch {
    return fallback;
  }
}

function cleanCode(value, fallback) {
  return String(value || fallback || "").trim();
}

function normalizePreference(payload = {}) {
  const countryCode = cleanCode(payload.countryCode, DEFAULT_PREFERENCE.countryCode).toUpperCase();
  const countryDefault = COUNTRY_DEFAULTS[countryCode] || {};
  const languageCode = cleanCode(payload.languageCode, countryDefault.languageCode || DEFAULT_PREFERENCE.languageCode).toLowerCase();
  const direction = payload.direction || countryDefault.direction || (RTL_LANGUAGES.has(languageCode) ? "rtl" : "ltr");
  if (!/^[A-Z]{2}$/.test(countryCode)) throw badRequest("Country code must be ISO-3166 alpha-2");
  if (!/^[a-z]{2,3}(-[a-z0-9]+)?$/i.test(languageCode)) throw badRequest("Language code must be a valid locale code");
  return {
    countryCode,
    languageCode,
    direction: direction === "rtl" ? "rtl" : "ltr",
    currencyCode: cleanCode(payload.currencyCode, countryDefault.currencyCode || DEFAULT_PREFERENCE.currencyCode).toUpperCase(),
    dateLocale: cleanCode(payload.dateLocale, countryDefault.dateLocale || `${languageCode}-${countryCode}`),
    numberLocale: cleanCode(payload.numberLocale, countryDefault.numberLocale || `${languageCode}-${countryCode}`)
  };
}

function tenantIdFrom(access = {}) {
  return access.tenantId || "tenant_aura";
}

export const localizationPreferenceService = {
  get(access) {
    const tenantId = tenantIdFrom(access);
    const row = db.prepare("SELECT value FROM settings WHERE tenantId = ? AND key = ?").get(tenantId, SETTING_KEY);
    return { preference: normalizePreference(parseJson(row?.value, DEFAULT_PREFERENCE)) };
  },

  save(payload, access) {
    const tenantId = tenantIdFrom(access);
    const preference = normalizePreference(payload);
    const now = new Date().toISOString();
    db.prepare(`
      INSERT INTO settings (id, tenantId, key, value, scope, createdAt, updatedAt)
      VALUES (?, ?, ?, ?, 'tenant', ?, ?)
      ON CONFLICT(tenantId, key) DO UPDATE SET value = excluded.value, updatedAt = excluded.updatedAt
    `).run(`setting_${tenantId}_${SETTING_KEY}`, tenantId, SETTING_KEY, JSON.stringify(preference), now, now);
    return { preference };
  }
};
