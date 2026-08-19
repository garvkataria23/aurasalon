"use client";

import {
  Calendar, CreditCard, Users, Package, Megaphone,
  TrendingUp, ShieldCheck, Palette, Check, ArrowRight,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { GridBackground } from "@/components/ui/GridBackground";
import { CTA_LINKS } from "@/lib/constants";
import type { FeaturePageData } from "@/lib/types";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FEATURE_MESSAGES_HI } from "@/lib/translations";
import { breadcrumbJsonLd } from "@/lib/seo";

const CAPABILITY_ICONS = [
  Calendar, CreditCard, Users, Package, Megaphone,
  TrendingUp, ShieldCheck, Palette, Check,
];

interface FeaturePageTemplateProps {
  data: FeaturePageData;
}

export function FeaturePageTemplate({ data }: FeaturePageTemplateProps) {
  const { language, t } = useLanguage();
  const translated = language === "hi" ? FEATURE_MESSAGES_HI[data.translationKey] : undefined;
  const title = translated?.title ?? data.title;
  const subtitle = translated?.subtitle ?? data.subtitle;
  const capabilities = translated?.capabilities ?? data.capabilities;

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Features", url: "/features" },
    { name: title, url: `/features/${data.translationKey}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />
      {/* Hero Section */}
      <section className="relative pt-28 pb-20 md:pt-36 md:pb-28 bg-gradient-to-br from-[#FBF8FF] via-[#F6F1FF] to-[#EFE7FF] overflow-hidden">
        <GridBackground className="opacity-25" />

        <Container className="relative z-10">
          <div className="max-w-4xl mx-auto text-center">
            <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-6 backdrop-blur-sm shadow-xs">
              {t("feature.spotlight")}
            </span>
            <h1 className="text-[clamp(2.5rem,6vw,4.5rem)] font-bold tracking-[-0.03em] text-[var(--aura-heading)] leading-[1.08] text-balance">
              {title}
            </h1>
            <p className="mt-6 text-base md:text-xl text-[var(--aura-body)] max-w-2xl mx-auto leading-relaxed text-pretty">
              {subtitle}
            </p>
          </div>
        </Container>
      </section>

      {/* Stats Bar */}
      {data.stats && (
        <section className="py-12 bg-white border-y border-[var(--aura-border)] shadow-xs">
          <Container>
            <div className="grid grid-cols-1 divide-y divide-[var(--aura-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 max-w-4xl mx-auto">
              {data.stats.map((stat, i) => (
                <div
                  key={stat.label}
                  className="px-6 py-4 text-center"
                >
                  <div className="text-3xl md:text-4xl font-bold text-[var(--aura-purple)] tracking-tight tabular-nums">{stat.value}</div>
                  <div className="text-xs font-semibold text-[var(--aura-muted)] uppercase tracking-wider mt-1">{translated?.stats[i] ?? stat.label}</div>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* Capabilities Cards Grid */}
      <section className="py-20 md:py-28 bg-[var(--aura-off-white)]">
        <Container>
          <div className="text-center max-w-3xl mx-auto mb-16">
            <span className="inline-flex items-center rounded-full border border-[var(--aura-purple)]/15 bg-white/65 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 backdrop-blur-sm shadow-xs">
              {t("feature.capabilities")}
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--aura-heading)] leading-[1.12] text-balance">
              {t("feature.what")}
            </h2>
            <p className="mt-4 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto text-pretty">
              {t("feature.whatBody")}
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-2 max-w-5xl mx-auto">
            {capabilities.map((cap, i) => {
              const Icon = CAPABILITY_ICONS[i % CAPABILITY_ICONS.length];
              return (
                <div
                  key={cap.title}
                  className="group rounded-2xl border border-[var(--aura-border)] bg-white p-8 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:border-[var(--aura-purple)]/30 hover:-translate-y-1 flex flex-col justify-between"
                >
                  <div>
                    <div className="w-12 h-12 rounded-2xl bg-gradient-to-br from-[var(--aura-purple)] to-[#9B7FE6] text-white flex items-center justify-center mb-6 shadow-xs group-hover:scale-105 transition-transform duration-300">
                      <Icon className="w-6 h-6" />
                    </div>
                    <h3 className="text-lg font-bold text-[var(--aura-heading)] mb-2 group-hover:text-[var(--aura-purple)] transition-colors">{cap.title}</h3>
                    <p className="text-sm text-[var(--aura-body)] leading-relaxed">{cap.description}</p>
                  </div>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Bottom CTA */}
      <section className="py-20 md:py-24 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
        <Container>
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold text-[var(--aura-heading)] mb-4 tracking-tight text-balance">
              {t("feature.experience", { name: title })}
            </h2>
            <p className="text-[var(--aura-body)] mb-8 max-w-xl mx-auto text-base">
              {t("feature.experienceBody", { name: title })}
            </p>
            <a
              href={CTA_LINKS.trial}
              className="inline-flex items-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-semibold text-white shadow-[var(--aura-shadow-sm)] transition-all duration-200 hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-0.5"
            >
              {t("feature.demo")}
              <ArrowRight className="w-4 h-4" />
            </a>
          </div>
        </Container>
      </section>
    </>
  );
}
