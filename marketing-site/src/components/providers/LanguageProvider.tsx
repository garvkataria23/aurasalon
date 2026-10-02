"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { SOURCE_MESSAGES } from "@/i18n/source";

export type BusinessType = "salon" | "spa" | "nail" | "bridal" | "multi";

type TranslationParams = Record<string, string | number | Date | boolean | null | undefined>;

const BUSINESS_TYPES: readonly BusinessType[] = ["salon", "spa", "nail", "bridal", "multi"];
const BUSINESS_TYPE_STORAGE_KEY = "aura.marketing.businessType";

function humanizeTranslationKey(key: string) {
  const lastSegment = key.split(".").filter(Boolean).pop() ?? key;
  return lastSegment
    .replace(/([a-z0-9])([A-Z])/g, "$1 $2")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .replace(/^./, (char) => char.toUpperCase());
}

function resolveMessage(key: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams) {
  const template = typeof fallbackOrParams === "string" ? fallbackOrParams : SOURCE_MESSAGES[key] ?? humanizeTranslationKey(key);
  const values = typeof fallbackOrParams === "object" ? fallbackOrParams : params;

  if (!values) return template;

  return template.replace(/\{(\w+)\}/g, (match, name) => {
    const value = values[name];
    return value === null || value === undefined ? match : String(value);
  });
}

type LanguageContextValue = {
  /**
   * Content language is always English. Runtime translation of the rendered page
   * is handled by the Google Translate widget (see @/components/ui/GoogleTranslate).
   */
  language: string;
  businessType: BusinessType;
  setBusinessType: (businessType: BusinessType) => void;
  t: (key: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

const fallbackContextValue: LanguageContextValue = {
  language: "en",
  businessType: "salon",
  setBusinessType: () => {},
  t: resolveMessage,
};

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [businessType, setBusinessTypeState] = useState<BusinessType>("salon");

  useEffect(() => {
    const saved = window.localStorage.getItem(BUSINESS_TYPE_STORAGE_KEY);
    if (saved && BUSINESS_TYPES.includes(saved as BusinessType)) {
      queueMicrotask(() => setBusinessTypeState(saved as BusinessType));
    }
  }, []);

  const setBusinessType = useCallback((next: BusinessType) => {
    setBusinessTypeState(next);
    window.localStorage.setItem(BUSINESS_TYPE_STORAGE_KEY, next);
  }, []);

  const t = useCallback((key: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams) =>
    resolveMessage(key, fallbackOrParams, params), []);

  const value = useMemo(
    () => ({ language: "en", businessType, setBusinessType, t }),
    [businessType, setBusinessType, t]
  );

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  return context ?? fallbackContextValue;
}