"use client";

import { Shield, Globe, Headphones, Zap } from "lucide-react";
import { useLanguage } from "@/components/providers/LanguageProvider";

const BADGES = [
  { icon: Globe, label: "trust.india", sublabel: "trust.indiaSub" },
  { icon: Shield, label: "trust.secure", sublabel: "trust.secureSub" },
  { icon: Zap, label: "trust.realtime", sublabel: "trust.realtimeSub" },
  { icon: Headphones, label: "trust.support", sublabel: "trust.supportSub" },
];

export function TrustBadges() {
  const { t } = useLanguage();

  return (
    <section className="bg-aura-surface py-10 sm:py-12">
      <div className="mx-auto max-w-[82rem] px-4 sm:px-6 lg:px-10">
        <div className="grid grid-cols-1 gap-px overflow-hidden rounded-2xl border border-aura-border bg-aura-border sm:grid-cols-2 lg:grid-cols-4">
          {BADGES.map((badge) => (
            <div
              key={badge.label}
              className="flex min-h-24 items-center gap-3 bg-[#fffdf9] p-4 sm:p-5 transition-opacity duration-300"
            >
              <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-full bg-aura-bg">
                <badge.icon className="w-4 h-4 text-aura-burgundy" />
              </div>
              <div>
                <div className="text-sm font-semibold text-aura-text">{t(badge.label)}</div>
                <div className="mt-0.5 text-xs leading-5 text-aura-text-muted">{t(badge.sublabel)}</div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
