import { BackendFetch, DevBackend, DevTools, LanguageDetector, LanguageStorage, Tolgee } from "@tolgee/react";
import { FormatIcu } from "@tolgee/format-icu";
import { AVAILABLE_LANGUAGE_CODES, DEFAULT_LANGUAGE, LANGUAGE_STORAGE_KEY, normalizeLanguage, type Language } from "./languages";
import { SOURCE_MESSAGES } from "./source";

const apiUrl = process.env.NEXT_PUBLIC_TOLGEE_API_URL;
const apiKey = process.env.NEXT_PUBLIC_TOLGEE_API_KEY;
const cdnUrl = process.env.NEXT_PUBLIC_TOLGEE_CDN_URL;

export function resolveInitialLanguage(): Language {
  if (typeof window === "undefined") return DEFAULT_LANGUAGE;

  const saved = normalizeLanguage(window.localStorage.getItem(LANGUAGE_STORAGE_KEY));
  if (saved) return saved;

  for (const browserLanguage of window.navigator.languages ?? [window.navigator.language]) {
    const detected = normalizeLanguage(browserLanguage);
    if (detected) return detected;
  }

  return DEFAULT_LANGUAGE;
}

export function createTolgee(language: Language) {
  const tolgee = Tolgee()
    .use(FormatIcu())
    .use(LanguageStorage())
    .use(LanguageDetector());

  if (cdnUrl) {
    tolgee.use(BackendFetch({ prefix: cdnUrl, fallbackOnFail: true }));
  }

  if (apiUrl && apiKey) {
    tolgee.use(DevBackend());
    tolgee.use(DevTools());
  }

  return tolgee.init({
    language,
    defaultLanguage: DEFAULT_LANGUAGE,
    fallbackLanguage: DEFAULT_LANGUAGE,
    availableLanguages: [...AVAILABLE_LANGUAGE_CODES],
    apiUrl,
    apiKey,
    staticData: {
      en: SOURCE_MESSAGES,
    },
    onTranslationMissing: ({ key }) => SOURCE_MESSAGES[key] ?? key,
  });
}
