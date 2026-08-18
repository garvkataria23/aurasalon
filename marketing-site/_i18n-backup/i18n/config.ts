import i18next from "i18next";
import { initReactI18next } from "react-i18next";
import LanguageDetector from "i18next-browser-languagedetector";
import { SUPPORTED_LANGUAGES, resolveBrowserLocale, type LanguageCode } from "./languages";
import en from "../locales/en/common.json";
import hi from "../locales/hi/common.json";

const SUPPORTED_CODES = SUPPORTED_LANGUAGES.map((l) => l.code);

/* Lazy-loaded locale cache */
const loadedLocales: Record<string, typeof en> = { en, hi };

async function loadLocale(lng: string): Promise<typeof en | null> {
  if (loadedLocales[lng]) return loadedLocales[lng];
  try {
    const mod = await import(`../locales/${lng}/common.json`);
    loadedLocales[lng] = mod.default || mod;
    return loadedLocales[lng];
  } catch {
    return null;
  }
}

i18next
  .use(LanguageDetector)
  .use(initReactI18next)
  .init({
    resources: {
      en: { translation: en },
      hi: { translation: hi },
    },
    fallbackLng: "en",
    supportedLngs: SUPPORTED_CODES,
    interpolation: { escapeValue: false },
    detection: {
      order: ["localStorage", "navigator"],
      lookupLocalStorage: "aura.i18n.lng",
      caches: ["localStorage"],
    },
    react: { useSuspense: false },
  });

/* Load non-bundled locale on demand */
export async function ensureLocale(lng: string): Promise<void> {
  if (!SUPPORTED_CODES.includes(lng as LanguageCode)) return;
  const data = await loadLocale(lng);
  if (data && !i18next.hasResourceBundle(lng, "translation")) {
    i18next.addResourceBundle(lng, "translation", data, true, true);
  }
}

export function getInitialLanguage(): LanguageCode {
  if (typeof window === "undefined") return "en";
  const saved = localStorage.getItem("aura.i18n.lng");
  if (saved && SUPPORTED_CODES.includes(saved as LanguageCode)) return saved as LanguageCode;
  return resolveBrowserLocale(navigator.language);
}

export default i18next;
