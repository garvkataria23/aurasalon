"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState } from "react";
import { TolgeeProvider, useTolgee, useTranslate } from "@tolgee/react";
import { createTolgee, resolveInitialLanguage } from "@/i18n/tolgee";
import { DEFAULT_LANGUAGE, getLanguageMeta, isRTL, isSupportedLanguage, LANGUAGE_STORAGE_KEY, SUPPORTED_LANGUAGES, type Language, type TextDirection } from "@/i18n/languages";
import { SOURCE_MESSAGES } from "@/i18n/source";

export type { Language };
export type BusinessType = "salon" | "spa" | "nail" | "bridal" | "multi";

type TranslationParams = Record<string, string | number | Date | boolean | null | undefined>;

type LanguageContextValue = {
  language: Language;
  setLanguage: (language: Language) => void;
  bilingual: boolean;
  setBilingual: (v: boolean) => void;
  businessType: BusinessType;
  setBusinessType: (businessType: BusinessType) => void;
  t: (key: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams) => string;
  allLanguages: typeof SUPPORTED_LANGUAGES;
  direction: TextDirection;
  locale: string;
  formatDate: (value: Date | string | number, options?: Intl.DateTimeFormatOptions) => string;
  formatNumber: (value: number, options?: Intl.NumberFormatOptions) => string;
  formatCurrency: (value: number, currency?: string, options?: Intl.NumberFormatOptions) => string;
};

const LanguageContext = createContext<LanguageContextValue | null>(null);

function applyDocumentLanguage(language: Language) {
  const meta = getLanguageMeta(language);
  document.documentElement.lang = meta.locale;
  document.documentElement.dir = meta.dir;
}

function InnerLanguageProvider({ children, initialLanguage }: { children: React.ReactNode; initialLanguage: Language }) {
  const tolgee = useTolgee(["language"]);
  const { t: tolgeeT } = useTranslate();
  const [language, setLanguageState] = useState<Language>(initialLanguage);
  const [bilingual, setBilingualState] = useState(false);
  const [businessType, setBusinessTypeState] = useState<BusinessType>("salon");

  useEffect(() => {
    const active = tolgee.getLanguage();
    const next = isSupportedLanguage(active) ? active : DEFAULT_LANGUAGE;
    setLanguageState(next);
    applyDocumentLanguage(next);

    const savedBusinessType = window.localStorage.getItem("aura.marketing.businessType");
    if (savedBusinessType === "salon" || savedBusinessType === "spa" || savedBusinessType === "nail" || savedBusinessType === "bridal" || savedBusinessType === "multi") {
      setBusinessTypeState(savedBusinessType);
    }
  }, [tolgee]);

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    window.localStorage.setItem(LANGUAGE_STORAGE_KEY, next);
    window.localStorage.setItem("aura.marketing.language", next);
    applyDocumentLanguage(next);
    void tolgee.changeLanguage(next);
  }, [tolgee]);

  const setBilingual = useCallback((v: boolean) => {
    setBilingualState(v);
    window.localStorage.setItem("aura.marketing.bilingual", String(v));
  }, []);

  const setBusinessType = useCallback((next: BusinessType) => {
    setBusinessTypeState(next);
    window.localStorage.setItem("aura.marketing.businessType", next);
  }, []);

  const t = useCallback((key: string, fallbackOrParams?: string | TranslationParams, params?: TranslationParams) => {
    const fallback = typeof fallbackOrParams === "string" ? fallbackOrParams : SOURCE_MESSAGES[key] ?? key;
    const values = typeof fallbackOrParams === "object" ? fallbackOrParams : params;
    return tolgeeT(key, fallback, values ?? {});
  }, [tolgeeT]);

  const meta = getLanguageMeta(language);
  const direction: TextDirection = isRTL(language) ? "rtl" : "ltr";

  const formatDate = useCallback((value: Date | string | number, options?: Intl.DateTimeFormatOptions) => {
    return new Intl.DateTimeFormat(meta.locale, options).format(new Date(value));
  }, [meta.locale]);

  const formatNumber = useCallback((value: number, options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(meta.locale, options).format(value);
  }, [meta.locale]);

  const formatCurrency = useCallback((value: number, currency = "INR", options?: Intl.NumberFormatOptions) => {
    return new Intl.NumberFormat(meta.locale, { style: "currency", currency, ...options }).format(value);
  }, [meta.locale]);

  const value = useMemo(() => ({
    language,
    setLanguage,
    bilingual,
    setBilingual,
    businessType,
    setBusinessType,
    t,
    allLanguages: SUPPORTED_LANGUAGES,
    direction,
    locale: meta.locale,
    formatDate,
    formatNumber,
    formatCurrency,
  }), [language, setLanguage, bilingual, setBilingual, businessType, setBusinessType, t, direction, meta.locale, formatDate, formatNumber, formatCurrency]);

  return <LanguageContext.Provider value={value}>{children}</LanguageContext.Provider>;
}

export function LanguageProvider({ children }: { children: React.ReactNode }) {
  const [initialLanguage] = useState(resolveInitialLanguage);
  const tolgee = useMemo(() => createTolgee(initialLanguage), [initialLanguage]);

  return (
    <TolgeeProvider tolgee={tolgee} fallback={null}>
      <InnerLanguageProvider initialLanguage={initialLanguage}>{children}</InnerLanguageProvider>
    </TolgeeProvider>
  );
}

export function useLanguage() {
  const context = useContext(LanguageContext);
  if (!context) throw new Error("useLanguage must be used within LanguageProvider");
  return context;
}
