"use client";

import { useState } from "react";
import { CheckCircle } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Newsletter() {
  const { t } = useLanguage();
  const [email, setEmail] = useState("");
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) return;
    setSubmitted(true);
    setEmail("");
  };

  return (
    <div className="rounded-2xl border border-aura-border bg-aura-surface p-6">
      <h3 className="text-sm font-bold text-aura-text mb-2">{t("newsletter.title")}</h3>
      <p className="text-xs text-aura-text-muted mb-4">
        {t("newsletter.body")}
      </p>
      {submitted ? (
        <div className="flex items-center gap-2 text-sm text-emerald-400 animate-in fade-in slide-in-from-bottom-2 fill-mode-both">
          <CheckCircle className="w-4 h-4" />
          {t("newsletter.done")}
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="flex gap-2">
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="you@salon.com"
            aria-label={t("newsletter.email")}
            required
            className="flex-1 px-3 py-2 rounded-lg bg-aura-surface border border-aura-border text-sm text-aura-text placeholder:text-aura-text-muted focus:outline-none focus:ring-1 focus:ring-aura-primary/50"
          />
          <button
            type="submit"
            className="px-4 py-2 rounded-lg bg-aura-primary text-white text-xs font-semibold hover:bg-aura-primary-dark transition-colors"
          >
            {t("newsletter.join")}
          </button>
        </form>
      )}
    </div>
  );
}
