"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

export function SkipLink() {
  const { t } = useLanguage();
  return <a href="#main-content" className="skip-link">{t("a11y.skip")}</a>;
}
