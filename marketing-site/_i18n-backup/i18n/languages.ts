export type LanguageCode =
  | "en" | "hi" | "es" | "fr" | "de" | "pt" | "ar" | "it" | "nl" | "tr"
  | "id" | "th" | "ja" | "ko" | "zh-CN" | "zh-TW" | "vi" | "pl" | "ru" | "ms"
  | "fil" | "bn" | "ta" | "te" | "mr" | "gu" | "pa" | "ur" | "fa" | "he"
  | "el" | "ro" | "cs" | "hu" | "sv" | "da" | "no" | "fi" | "uk" | "sw";

export interface Language {
  code: LanguageCode;
  name: string;
  nativeName: string;
  direction: "ltr" | "rtl";
}

export const RTL_LANGUAGES: LanguageCode[] = ["ar", "ur", "fa", "he"];

export const SUPPORTED_LANGUAGES: Language[] = [
  { code: "en", name: "English", nativeName: "English", direction: "ltr" },
  { code: "hi", name: "Hindi", nativeName: "हिन्दी", direction: "ltr" },
  { code: "es", name: "Spanish", nativeName: "Español", direction: "ltr" },
  { code: "fr", name: "French", nativeName: "Français", direction: "ltr" },
  { code: "de", name: "German", nativeName: "Deutsch", direction: "ltr" },
  { code: "pt", name: "Portuguese", nativeName: "Português", direction: "ltr" },
  { code: "ar", name: "Arabic", nativeName: "العربية", direction: "rtl" },
  { code: "it", name: "Italian", nativeName: "Italiano", direction: "ltr" },
  { code: "nl", name: "Dutch", nativeName: "Nederlands", direction: "ltr" },
  { code: "tr", name: "Turkish", nativeName: "Türkçe", direction: "ltr" },
  { code: "id", name: "Indonesian", nativeName: "Bahasa Indonesia", direction: "ltr" },
  { code: "th", name: "Thai", nativeName: "ไทย", direction: "ltr" },
  { code: "ja", name: "Japanese", nativeName: "日本語", direction: "ltr" },
  { code: "ko", name: "Korean", nativeName: "한국어", direction: "ltr" },
  { code: "zh-CN", name: "Chinese (Simplified)", nativeName: "简体中文", direction: "ltr" },
  { code: "zh-TW", name: "Chinese (Traditional)", nativeName: "繁體中文", direction: "ltr" },
  { code: "vi", name: "Vietnamese", nativeName: "Tiếng Việt", direction: "ltr" },
  { code: "pl", name: "Polish", nativeName: "Polski", direction: "ltr" },
  { code: "ru", name: "Russian", nativeName: "Русский", direction: "ltr" },
  { code: "ms", name: "Malay", nativeName: "Bahasa Melayu", direction: "ltr" },
  { code: "fil", name: "Filipino", nativeName: "Filipino", direction: "ltr" },
  { code: "bn", name: "Bengali", nativeName: "বাংলা", direction: "ltr" },
  { code: "ta", name: "Tamil", nativeName: "தமிழ்", direction: "ltr" },
  { code: "te", name: "Telugu", nativeName: "తెలుగు", direction: "ltr" },
  { code: "mr", name: "Marathi", nativeName: "मराठी", direction: "ltr" },
  { code: "gu", name: "Gujarati", nativeName: "ગુજરાતી", direction: "ltr" },
  { code: "pa", name: "Punjabi", nativeName: "ਪੰਜਾਬੀ", direction: "ltr" },
  { code: "ur", name: "Urdu", nativeName: "اردو", direction: "rtl" },
  { code: "fa", name: "Persian", nativeName: "فارسی", direction: "rtl" },
  { code: "he", name: "Hebrew", nativeName: "עברית", direction: "rtl" },
  { code: "el", name: "Greek", nativeName: "Ελληνικά", direction: "ltr" },
  { code: "ro", name: "Romanian", nativeName: "Română", direction: "ltr" },
  { code: "cs", name: "Czech", nativeName: "Čeština", direction: "ltr" },
  { code: "hu", name: "Hungarian", nativeName: "Magyar", direction: "ltr" },
  { code: "sv", name: "Swedish", nativeName: "Svenska", direction: "ltr" },
  { code: "da", name: "Danish", nativeName: "Dansk", direction: "ltr" },
  { code: "no", name: "Norwegian", nativeName: "Norsk", direction: "ltr" },
  { code: "fi", name: "Finnish", nativeName: "Suomi", direction: "ltr" },
  { code: "uk", name: "Ukrainian", nativeName: "Українська", direction: "ltr" },
  { code: "sw", name: "Swahili", nativeName: "Kiswahili", direction: "ltr" },
];

export function getLanguageByCode(code: string): Language | undefined {
  return SUPPORTED_LANGUAGES.find((l) => l.code === code);
}

export function isRTL(code: string): boolean {
  return RTL_LANGUAGES.includes(code as LanguageCode);
}

/** Map browser locale to supported code. Returns "en" if unsupported. */
export function resolveBrowserLocale(browserLang: string): LanguageCode {
  const tag = browserLang.toLowerCase().split("-")[0];
  const exact = SUPPORTED_LANGUAGES.find((l) => l.code === browserLang || l.code.toLowerCase() === browserLang.toLowerCase());
  if (exact) return exact.code;
  const byPrefix = SUPPORTED_LANGUAGES.find((l) => l.code.toLowerCase().startsWith(tag));
  if (byPrefix) return byPrefix.code;
  if (tag === "zh") return "zh-CN";
  return "en";
}
