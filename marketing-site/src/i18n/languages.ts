export const SUPPORTED_LANGUAGES = [
  { code: "en", name: "English", nativeName: "English", dir: "ltr", locale: "en-IN" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", dir: "ltr", locale: "hi-IN" },
  { code: "es", name: "Spanish", nativeName: "Español", dir: "ltr", locale: "es" },
  { code: "fr", name: "French", nativeName: "Français", dir: "ltr", locale: "fr" },
  { code: "de", name: "German", nativeName: "Deutsch", dir: "ltr", locale: "de" },
  { code: "pt", name: "Portuguese", nativeName: "Português", dir: "ltr", locale: "pt" },
  { code: "it", name: "Italian", nativeName: "Italiano", dir: "ltr", locale: "it" },
  { code: "ar", name: "Arabic", nativeName: "العربية", dir: "rtl", locale: "ar" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", dir: "ltr", locale: "nl" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", dir: "ltr", locale: "tr" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", dir: "ltr", locale: "id" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", dir: "ltr", locale: "vi" },
  { code: "th", name: "Thai", nativeName: "ไทย", dir: "ltr", locale: "th" },
  { code: "ja", name: "Japanese", nativeName: "日本語", dir: "ltr", locale: "ja" },
  { code: "ko", name: "Korean", nativeName: "한국어", dir: "ltr", locale: "ko" },
  { code: "zh-CN", name: "Chinese Simplified", nativeName: "简体中文", dir: "ltr", locale: "zh-CN" },
  { code: "zh-TW", name: "Chinese Traditional", nativeName: "繁體中文", dir: "ltr", locale: "zh-TW" },
  { code: "ru", name: "Russian", nativeName: "Русский", dir: "ltr", locale: "ru" },
  { code: "pl", name: "Polish", nativeName: "Polski", dir: "ltr", locale: "pl" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", dir: "ltr", locale: "uk" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", dir: "ltr", locale: "bn" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", dir: "ltr", locale: "mr" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", dir: "ltr", locale: "gu" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", dir: "ltr", locale: "ta" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", dir: "ltr", locale: "te" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", dir: "ltr", locale: "pa" },
  { code: "ur", name: "Urdu", nativeName: "اردو", dir: "rtl", locale: "ur" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", dir: "ltr", locale: "ms" },
  { code: "fil", name: "Filipino", nativeName: "Filipino", dir: "ltr", locale: "fil" },
  { code: "ro", name: "Romanian", nativeName: "Română", dir: "ltr", locale: "ro" },
] as const;

export type Language = (typeof SUPPORTED_LANGUAGES)[number]["code"];
export type TextDirection = "ltr" | "rtl";

export const DEFAULT_LANGUAGE: Language = "en";
export const LANGUAGE_STORAGE_KEY = "aura.marketing.language";
export const AVAILABLE_LANGUAGE_CODES = SUPPORTED_LANGUAGES.map((language) => language.code);

export function isSupportedLanguage(value: string | null | undefined): value is Language {
  return Boolean(value && AVAILABLE_LANGUAGE_CODES.includes(value as Language));
}

export function normalizeLanguage(value: string | null | undefined): Language | null {
  if (!value) return null;
  if (isSupportedLanguage(value)) return value;
  const base = value.split("-")[0];
  return isSupportedLanguage(base) ? base : null;
}

export function getLanguageMeta(language: Language) {
  return SUPPORTED_LANGUAGES.find((item) => item.code === language) ?? SUPPORTED_LANGUAGES[0];
}

export function isRTL(language: Language) {
  return getLanguageMeta(language).dir === "rtl";
}
