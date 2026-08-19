"use client";

import Link from "next/link";
import {
  Calendar, CreditCard, Users, UserCheck, Package, Megaphone, TrendingUp, ShieldCheck, Palette,
} from "lucide-react";
import { FEATURES_OVERVIEW } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FEATURE_OVERVIEW_HI } from "@/lib/translations";

const iconMap: Record<string, React.ComponentType<{ className?: string; style?: React.CSSProperties }>> = {
  calendar: Calendar,
  "credit-card": CreditCard,
  users: Users,
  "user-check": UserCheck,
  package: Package,
  megaphone: Megaphone,
  "trending-up": TrendingUp,
  "shield-check": ShieldCheck,
  palette: Palette,
};

export default function FeaturesPage() {
  const { language, t } = useLanguage();
  return (
    <>
      <section className="pt-28 pb-20 md:pt-36 md:pb-28 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] relative overflow-hidden">
        <Container className="relative z-10 text-center max-w-3xl mx-auto">
          <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
            {t("features.badge")}
          </span>
          <h1 className="text-[clamp(2.25rem,5vw,3.75rem)] font-bold tracking-[-0.03em] text-[var(--aura-heading)] leading-[1.1] text-balance">
            {t("features.pageTitle")}
          </h1>
          <p className="mt-5 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto text-pretty">
            {t("features.pageBody")}
          </p>
        </Container>
      </section>

      <section className="py-20 md:py-28 bg-[var(--aura-off-white)]">
        <Container>
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-5xl mx-auto">
            {FEATURES_OVERVIEW.map((feature, featureIndex) => {
              const Icon = iconMap[feature.icon] || Calendar;
              const translated = language === "hi" ? FEATURE_OVERVIEW_HI[featureIndex] : undefined;
              return (
                <div key={feature.title}>
                  <Link href={feature.href} className="block group h-full">
                    <div className="h-full rounded-2xl border border-[var(--aura-border)] bg-white p-8 transition-all duration-300 hover:shadow-[0_20px_60px_rgba(111,79,216,0.12)] hover:border-[var(--aura-purple)]/35 hover:-translate-y-1 flex flex-col justify-between">
                      <div>
                        <div
                          className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 transition-transform duration-300 group-hover:scale-110 shadow-xs"
                          style={{ backgroundColor: `${feature.color}15` }}
                        >
                          <Icon className="w-7 h-7" style={{ color: feature.color }} />
                        </div>
                        <h3 className="text-lg font-bold text-[var(--aura-heading)] mb-2 group-hover:text-[var(--aura-purple)] transition-colors">
                          {translated?.title ?? feature.title}
                        </h3>
                        <p className="text-sm text-[var(--aura-body)] leading-relaxed">
                          {translated?.description ?? feature.description}
                        </p>
                      </div>
                      <div className="mt-6 flex items-center gap-1 text-sm font-semibold text-[var(--aura-purple)] opacity-0 group-hover:opacity-100 transition-opacity">
                        {t("features.learn")} →
                      </div>
                    </div>
                  </Link>
                </div>
              );
            })}
          </div>
        </Container>
      </section>
    </>
  );
}
