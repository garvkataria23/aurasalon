import { SITE_URL } from "@/lib/site";
import { DEFAULT_LANGUAGE, SUPPORTED_LANGUAGES, type Language } from "./languages";

function cleanPath(path: string) {
  if (!path || path === "/") return "";
  return path.startsWith("/") ? path : `/${path}`;
}

export function getPlannedLocalizedPath(language: Language, path = "/") {
  const normalizedPath = cleanPath(path);
  return `/${language}${normalizedPath}`;
}

export function getPlannedHreflangAlternates(path = "/") {
  const alternates = Object.fromEntries(
    SUPPORTED_LANGUAGES.map((language) => [language.locale, `${SITE_URL}${getPlannedLocalizedPath(language.code, path)}`])
  );

  return {
    ...alternates,
    "x-default": `${SITE_URL}${getPlannedLocalizedPath(DEFAULT_LANGUAGE, path)}`,
  };
}
