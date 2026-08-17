"use client";

import { useState, useEffect } from "react";
import { Radio } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function SocialProofToast() {
  const { language } = useLanguage();
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    const showTimer = setTimeout(() => setVisible(true), 9000);
    const hideTimer = setTimeout(() => setVisible(false), 15000);
    return () => { clearTimeout(showTimer); clearTimeout(hideTimer); };
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-4 left-4 z-[45] hidden pointer-events-none sm:block" aria-live="polite">
      <div className="flex max-w-xs items-center gap-3 rounded-full border border-aura-border bg-white px-4 py-3 shadow-lg fade-in visible">
        <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-aura-primary-soft text-aura-primary">
          <Radio className="h-4 w-4" />
        </div>
        <div className="min-w-0">
          <div className="text-sm font-semibold text-aura-text truncate">
            {language === "hi" ? "रियल-टाइम संचालन" : "Real-time operations"}
          </div>
          <div className="text-xs text-aura-text-muted">
            {language === "hi" ? "बुकिंग, कतार और डैशबोर्ड जुड़े रहें" : "Bookings, queue and dashboards stay connected"}
          </div>
        </div>
      </div>
    </div>
  );
}
