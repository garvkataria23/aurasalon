"use client";

import { useState, useEffect } from "react";
import { ArrowUp } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function BackToTop() {
  const { t } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 500);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <button
      onClick={() => window.scrollTo({ top: 0, behavior: "smooth" })}
      className="fixed bottom-6 right-6 z-[9990] w-12 h-12 rounded-full bg-white/80 backdrop-blur-xl border border-aura-border shadow-lg flex items-center justify-center text-aura-text-secondary hover:text-aura-text hover:shadow-xl hover:border-aura-border-strong hover:scale-105 transition-all duration-300 animate-in fade-in slide-in-from-bottom-5 fill-mode-both"
       aria-label={t("overlay.top")}
    >
      <ArrowUp className="w-4 h-4" />
    </button>
  );
}
