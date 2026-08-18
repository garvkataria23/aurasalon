"use client";

import { useState, useEffect } from "react";
import { X, Cookie } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

const CONSENT_KEY = "aura_cookie_consent";

export function CookieConsent() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    try {
      const consent = localStorage.getItem(CONSENT_KEY);
      if (!consent) setVisible(true);
    } catch {
      setVisible(true);
    }
  }, []);

  const accept = () => {
    try { localStorage.setItem(CONSENT_KEY, "accepted"); } catch { /* noop */ }
    setVisible(false);
  };

  const dismiss = () => {
    try { localStorage.setItem(CONSENT_KEY, "dismissed"); } catch { /* noop */ }
    setVisible(false);
  };

  if (!visible) return null;

  return (
    <div role="dialog" aria-label={t("cookie.title")} className="fixed bottom-0 inset-x-0 z-[9980] p-4 sm:p-6 pointer-events-none">
      <div className="mx-auto max-w-2xl rounded-2xl border border-aura-border bg-white/95 backdrop-blur-xl shadow-[var(--aura-shadow-xl)] p-5 sm:p-6 pointer-events-auto">
        <div className="flex items-start gap-4">
          <div className="hidden sm:flex shrink-0 h-10 w-10 items-center justify-center rounded-xl bg-aura-surface-muted">
            <Cookie className="h-5 w-5 text-aura-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-semibold text-aura-text mb-1">{t("cookie.title")}</p>
            <p className="text-xs text-aura-text-secondary leading-relaxed">{t("cookie.body")}</p>
            <div className="mt-3 flex items-center gap-2">
              <button type="button" onClick={accept} className="rounded-lg bg-aura-primary px-4 py-2 text-xs font-medium text-white transition-all hover:bg-aura-primary-dark hover:shadow-md">
                {t("cookie.accept")}
              </button>
              <button type="button" onClick={dismiss} className="rounded-lg border border-aura-border px-4 py-2 text-xs font-medium text-aura-text-secondary transition-all hover:bg-aura-surface-muted">
                {t("cookie.decline")}
              </button>
              <a href="/cookies" className="text-[11px] text-aura-text-muted underline underline-offset-2 hover:text-aura-text transition-colors ml-1">
                {t("cookie.policy")}
              </a>
            </div>
          </div>
          <button type="button" onClick={dismiss} aria-label={t("overlay.close")} className="shrink-0 flex h-7 w-7 items-center justify-center rounded-lg text-aura-text-muted hover:text-aura-text hover:bg-aura-surface-muted transition-colors">
            <X className="h-3.5 w-3.5" />
          </button>
        </div>
      </div>
    </div>
  );
}
