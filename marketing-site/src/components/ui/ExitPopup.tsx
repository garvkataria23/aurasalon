"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import { X, ArrowRight } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function ExitPopup() {
  const { t } = useLanguage();
  const [show, setShow] = useState(false);
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);
  const closeRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    const handleMouse = (e: MouseEvent) => {
      if (e.clientY < 10 && !sessionStorage.getItem("exitPopupDismissed")) setShow(true);
    };
    document.addEventListener("mouseleave", handleMouse);
    return () => document.removeEventListener("mouseleave", handleMouse);
  }, []);

  useEffect(() => { if (show) closeRef.current?.focus(); }, [show]);

  const dismiss = useCallback(() => { setShow(false); sessionStorage.setItem("exitPopupDismissed", "true"); }, []);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    sessionStorage.setItem("exitPopupDismissed", "true");
  };

  if (!show) return null;

  return (
    <div className="fixed inset-0 z-[10000] flex items-center justify-center bg-black/40 p-4" onClick={dismiss} role="dialog" aria-modal="true" aria-labelledby="exit-title">
      <div className="relative w-full max-w-md bg-white rounded-2xl shadow-2xl overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <button ref={closeRef} onClick={dismiss} className="absolute top-4 right-4 z-10 w-10 h-10 rounded-full bg-aura-surface-muted flex items-center justify-center text-aura-text-muted hover:text-aura-text transition-colors" aria-label={t("overlay.close")}>
          <X className="w-4 h-4" />
        </button>
        <div className="h-1 bg-aura-primary" />
        <div className="p-8 text-center">
          {submitted ? (
            <div>
              <div className="w-16 h-16 rounded-full bg-aura-primary-soft flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-aura-primary">✓</span>
              </div>
              <h3 id="exit-title" className="text-2xl font-bold text-aura-text mb-2">{t("exit.thanks")}</h3>
              <p className="text-sm text-aura-text-secondary">{t("exit.thanksBody")}</p>
            </div>
          ) : (
            <>
              <div className="w-16 h-16 rounded-full bg-aura-primary-soft flex items-center justify-center mx-auto mb-4">
                <span className="text-2xl font-bold text-aura-primary">A</span>
              </div>
              <h3 id="exit-title" className="text-2xl font-bold text-aura-text mb-2">{t("exit.title")}</h3>
              <p className="text-sm text-aura-text-secondary mb-6">{t("exit.body")}</p>
              <form onSubmit={handleSubmit} className="space-y-3">
                <input type="email" required value={email} onChange={(e) => setEmail(e.target.value)} placeholder={t("overlay.email")} aria-label={t("overlay.email")} className="w-full px-4 py-3 rounded-xl border border-aura-border bg-aura-bg text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-2 focus:ring-aura-primary/30 focus:border-aura-primary transition-all" />
                <button type="submit" className="w-full inline-flex items-center justify-center gap-2 px-6 py-3 text-sm font-semibold text-white rounded-full bg-aura-primary hover:bg-aura-primary-dark transition-colors">
                  {t("exit.cta")}
                  <ArrowRight className="w-4 h-4" />
                </button>
              </form>
              <p className="text-xs text-aura-text-muted mt-4">{t("overlay.noSpam")}</p>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
