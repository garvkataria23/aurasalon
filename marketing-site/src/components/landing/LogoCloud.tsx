"use client";

import { useLanguage } from "@/components/providers/LanguageProvider";

const SALON_NAMES = [
  "Owner command centre", "Front desk", "Appointment calendar", "POS & billing", "Customer 360",
  "Staff OS", "Inventory control", "Marketing automation", "Finance engine", "Multi-branch",
];
const SALON_NAMES_HI = ["मालिक कमांड सेंटर", "फ्रंट डेस्क", "अपॉइंटमेंट कैलेंडर", "POS और बिलिंग", "Customer 360", "Staff OS", "इन्वेंटरी कंट्रोल", "मार्केटिंग ऑटोमेशन", "Finance Engine", "मल्टी-ब्रांच"];

const GRADIENT_PAIRS = [
  ["from-aura-primary/20", "to-aura-primary/10"],
  ["from-aura-primary/15", "to-aura-primary/10"],
  ["from-aura-primary/20", "to-aura-primary/15"],
  ["from-aura-primary/10", "to-aura-primary/20"],
  ["from-aura-primary/15", "to-aura-primary/10"],
  ["from-aura-primary/10", "to-aura-primary/15"],
  ["from-aura-primary/20", "to-aura-primary/10"],
  ["from-aura-primary/15", "to-aura-primary/20"],
  ["from-aura-primary/10", "to-aura-primary/15"],
  ["from-aura-primary/20", "to-aura-primary/10"],
];

export function LogoCloud() {
  const { language, t } = useLanguage();
  const roleNames = language === "hi" ? SALON_NAMES_HI : SALON_NAMES;

  return (
    <section className="py-14 md:py-18 border-y border-aura-border bg-aura-surface-muted overflow-hidden">
      <div className="mx-auto max-w-7xl px-6 lg:px-8">
        <p className="text-center text-[11px] font-semibold text-aura-text-secondary/50 mb-9 uppercase tracking-[.2em]">
          {t("logos.title")}
        </p>
      </div>

      <div className="relative group">
        <div className="absolute left-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-r from-aura-surface-muted to-transparent z-10 pointer-events-none" />
        <div className="absolute right-0 top-0 bottom-0 w-16 sm:w-24 bg-gradient-to-l from-aura-surface-muted to-transparent z-10 pointer-events-none" />

        <div className="flex w-max animate-marquee group-hover:[animation-play-state:paused]">
          {[...roleNames, ...roleNames].map((name, i) => {
            const colors = GRADIENT_PAIRS[i % GRADIENT_PAIRS.length];
            return (
              <div
                key={`${name}-${i}`}
                className="inline-flex items-center gap-2.5 px-6 py-3 mx-1.5 rounded-full border border-aura-border bg-white/60 transition-colors duration-300 cursor-default hover:bg-white"
              >
                <div className={`w-8 h-8 rounded-full bg-gradient-to-br ${colors[0]} ${colors[1]} flex items-center justify-center text-xs font-bold text-aura-primary`}>
                  {name.charAt(0)}
                </div>
                <span className="text-sm font-medium text-aura-text-secondary whitespace-nowrap">
                  {name}
                </span>
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}
