"use client";

import Link from "next/link";
import {
  Calendar, CreditCard, Users, Package, Megaphone,
  TrendingUp, ShieldCheck, Palette, Star,
  ArrowRight, ArrowUpRight, CheckCircle2,
  BarChart3, Clock, Target, Globe, Sparkles, Zap,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import type { FeaturePageData } from "@/lib/types";
import { breadcrumbJsonLd } from "@/lib/seo";
import { LandingDecor } from "@/components/landing/LandingDecor";

/* ── Icon Sets ── */
const CAPABILITY_ICONS = [
  Calendar, CreditCard, Users, Package, Megaphone,
  TrendingUp, ShieldCheck, Palette, Star, Zap,
  BarChart3, Clock, Target, Globe, Sparkles,
];

const FEATURE_ICONS: Record<string, typeof Calendar> = {
  appointments: Calendar,
  billing: CreditCard,
  "client-crm": Users,
  "staff-management": Users,
  inventory: Package,
  "marketing-ai": Megaphone,
  finance: TrendingUp,
  compliance: ShieldCheck,
  "white-label": Palette,
};

/* ── Template ── */
interface FeaturePageTemplateProps {
  data: FeaturePageData;
}

export function FeaturePageTemplate({ data }: FeaturePageTemplateProps) {
  const FeatureIcon = FEATURE_ICONS[data.translationKey] || Star;

  const breadcrumbs = breadcrumbJsonLd([
    { name: "Home", url: "/" },
    { name: "Features", url: "/features" },
    { name: data.title, url: `/features/${data.translationKey}` },
  ]);

  return (
    <>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify(breadcrumbs) }}
      />

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 1 — RICH HERO
      ═══════════════════════════════════════════════════════════════ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2D124D] via-[#431A72] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full bg-purple-500/15 blur-[100px]" />
          <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-indigo-500/10 blur-[80px]" />
        </div>

        <Container className="relative z-10">
          <div className="grid items-center gap-10 lg:grid-cols-2 lg:gap-16">
            {/* Left Column */}
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-white/90 backdrop-blur-sm mb-6 shadow-sm">
                <FeatureIcon className="h-3.5 w-3.5 text-amber-300" />
                Feature Spotlight
              </span>
              <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-bold tracking-[-0.04em] leading-[1.06] text-balance">
                {data.title}
              </h1>
              <p className="mt-5 text-base md:text-lg text-white/75 leading-relaxed max-w-xl text-pretty">
                {data.heroDescription || data.subtitle}
              </p>

              {/* CTAs */}
              <div className="mt-8 flex flex-wrap items-center gap-3">
                <Link
                  href={CTA_LINKS.demo}
                  className="inline-flex items-center gap-2 rounded-full bg-white px-6 py-3 text-sm font-bold text-[#431A72] shadow-lg transition-all hover:-translate-y-0.5 hover:shadow-xl hover:bg-purple-50"
                >
                  Book a Free Demo
                  <ArrowRight className="h-4 w-4" />
                </Link>
                <Link
                  href="/features"
                  className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-6 py-3 text-sm font-semibold text-white backdrop-blur-sm transition-all hover:bg-white/20"
                >
                  All Features
                </Link>
              </div>
            </div>

            {/* Right Column — Feature Preview Card */}
            <div className="hidden lg:block">
              <div className="rounded-2xl border border-white/15 bg-white/[0.08] p-5 backdrop-blur-lg shadow-[0_24px_80px_rgba(0,0,0,0.35)] transition-transform duration-500 hover:-translate-y-1">
                {/* Card header */}
                <div className="flex items-center gap-3 border-b border-white/12 pb-4 mb-4">
                  <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-white/15">
                    <FeatureIcon className="h-5 w-5 text-amber-300" />
                  </div>
                  <div>
                    <p className="text-sm font-bold text-white">{data.title}</p>
                    <p className="text-[11px] text-white/50">Aura Salon OS</p>
                  </div>
                  <span className="ml-auto h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                {/* Capability preview rows */}
                <div className="space-y-2.5">
                  {data.capabilities.slice(0, 4).map((cap) => (
                    <div
                      key={cap.title}
                      className="flex items-start gap-3 rounded-xl bg-white/[0.05] p-3 border border-white/[0.07]"
                    >
                      <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-lg bg-emerald-400/20 mt-0.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-300" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-xs font-semibold text-white truncate">{cap.title}</p>
                        <p className="text-[10px] text-white/55 leading-relaxed mt-0.5 line-clamp-2">{cap.description}</p>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Card footer */}
                <div className="mt-4 pt-3 border-t border-white/10 flex items-center justify-between text-[10px] text-white/50">
                  <span>+{Math.max(0, data.capabilities.length - 4)} more capabilities</span>
                  <span className="text-emerald-300 font-semibold">Active &bull; Cloud Connected</span>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 2 — STATS BAR
      ═══════════════════════════════════════════════════════════════ */}
      {data.stats && (
        <section className="py-10 bg-white border-b border-[var(--aura-border)] shadow-xs">
          <Container>
            <div className="grid grid-cols-1 divide-y divide-[var(--aura-border)] sm:grid-cols-3 sm:divide-x sm:divide-y-0 max-w-4xl mx-auto">
              {data.stats.map((stat) => (
                <div key={stat.label} className="px-6 py-4 text-center">
                  <div className="text-3xl md:text-4xl font-extrabold text-[var(--aura-purple)] tracking-tight">
                    {stat.value}
                  </div>
                  <div className="text-xs font-semibold text-[var(--aura-muted)] uppercase tracking-wider mt-1">
                    {stat.label}
                  </div>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 3 — PAIN vs SOLUTION
      ═══════════════════════════════════════════════════════════════ */}
      {data.painPoints && data.solutions && (
        <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
          <Container>
            <div className="text-center mb-12">
              <span className="inline-flex rounded-full border border-[var(--aura-purple)]/15 bg-white px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 shadow-xs">
                Why Switch
              </span>
              <h2 className="text-[clamp(2rem,4.5vw,3rem)] font-bold tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
                Why salons choose Aura
              </h2>
            </div>

            <div className="grid gap-6 md:grid-cols-2 max-w-4xl mx-auto">
              {/* Without Aura */}
              <div className="rounded-2xl border border-red-200/80 bg-red-50/40 p-6 md:p-8">
                <h3 className="text-base font-bold text-red-700 mb-5 flex items-center gap-2">
                  <span className="flex h-7 w-7 items-center justify-center rounded-full bg-red-100 text-red-500 text-xs font-bold">&times;</span>
                  Without Aura
                </h3>
                <div className="space-y-4">
                  {data.painPoints.map((pain) => (
                    <div key={pain} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-red-100 text-red-400 text-[10px]">&times;</span>
                      <p className="text-sm text-red-900/70 leading-relaxed">{pain}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* With Aura */}
              <div className="rounded-2xl border border-emerald-200/80 bg-emerald-50/40 p-6 md:p-8">
                <h3 className="text-base font-bold text-emerald-700 mb-5 flex items-center gap-2">
                  <CheckCircle2 className="h-7 w-7 text-emerald-500" />
                  With Aura
                </h3>
                <div className="space-y-4">
                  {data.solutions.map((sol) => (
                    <div key={sol} className="flex items-start gap-3">
                      <span className="mt-0.5 flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-500 text-[10px]">&check;</span>
                      <p className="text-sm text-emerald-900/70 leading-relaxed">{sol}</p>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </Container>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 4 — CAPABILITIES GRID
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-16 md:py-24 bg-white">
        <Container>
          <div className="text-center mb-14">
            <span className="inline-flex rounded-full border border-[var(--aura-purple)]/15 bg-[var(--aura-lavender)] px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-4 shadow-xs">
              Capabilities
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold tracking-[-0.025em] text-[var(--aura-heading)] leading-[1.12] text-balance">
              Everything you need, built in
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] max-w-2xl mx-auto leading-relaxed">
              Purpose-built for salon, spa, and clinic workflows &mdash; no workarounds needed.
            </p>
          </div>

          <div className="grid gap-5 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
            {data.capabilities.map((cap, i) => {
              const Icon = CAPABILITY_ICONS[i % CAPABILITY_ICONS.length];
              return (
                <div
                  key={cap.title}
                  className="group rounded-2xl border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:border-[var(--aura-purple)]/25 hover:-translate-y-1"
                >
                  <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-[var(--aura-purple)] to-[#9B7FE6] text-white mb-5 shadow-xs group-hover:scale-105 transition-transform duration-300">
                    <Icon className="h-5 w-5" />
                  </div>
                  <h3 className="text-base font-bold text-[var(--aura-heading)] mb-2 group-hover:text-[var(--aura-purple)] transition-colors">
                    {cap.title}
                  </h3>
                  <p className="text-sm text-[var(--aura-body)] leading-relaxed">
                    {cap.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 5 — BUSINESS IMPACT METRICS
      ═══════════════════════════════════════════════════════════════ */}
      {data.impactMetrics && (
        <section className="relative py-16 md:py-24 bg-gradient-to-br from-[#2D124D] via-[#431A72] to-[#5B2D91] text-white overflow-hidden">
          <div className="pointer-events-none absolute inset-0" aria-hidden="true">
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-[500px] w-[500px] rounded-full bg-purple-400/8 blur-[100px]" />
          </div>

          <Container className="relative z-10">
            <div className="text-center mb-12">
              <span className="inline-flex rounded-full border border-white/20 bg-white/10 px-3.5 py-1 text-xs font-semibold uppercase tracking-[.14em] text-white/90 mb-4 backdrop-blur-sm">
                Business Impact
              </span>
              <h2 className="text-[clamp(2rem,4.5vw,3rem)] font-bold tracking-[-0.03em] text-white text-balance">
                Real results for real salons
              </h2>
            </div>

            <div className="grid gap-6 sm:grid-cols-3 max-w-4xl mx-auto">
              {data.impactMetrics.map((metric) => (
                <div
                  key={metric.label}
                  className="rounded-2xl border border-white/12 bg-white/[0.07] p-6 text-center backdrop-blur-sm transition-transform duration-300 hover:-translate-y-1"
                >
                  <div className="text-3xl md:text-4xl font-extrabold text-white mb-1 tracking-tight">
                    {metric.value}
                  </div>
                  <div className="text-xs font-bold text-amber-300 uppercase tracking-wider mb-3">
                    {metric.label}
                  </div>
                  <p className="text-xs text-white/65 leading-relaxed">
                    {metric.description}
                  </p>
                </div>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 6 — RELATED FEATURES CROSS-LINKS
      ═══════════════════════════════════════════════════════════════ */}
      {data.relatedFeatures && (
        <section className="py-14 md:py-20 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]">
          <Container>
            <div className="text-center mb-10">
              <h2 className="text-2xl font-bold text-[var(--aura-heading)]">
                Explore More Features
              </h2>
              <p className="mt-2 text-sm text-[var(--aura-body)]">
                Aura connects every part of your salon business.
              </p>
            </div>
            <div className="flex flex-wrap justify-center gap-3">
              {data.relatedFeatures.map((feat) => (
                <Link
                  key={feat.href}
                  href={feat.href}
                  className="group inline-flex items-center gap-2 rounded-full border border-[var(--aura-border)] bg-white px-5 py-2.5 text-sm font-semibold text-[var(--aura-heading)] shadow-xs transition-all hover:border-[var(--aura-purple)]/30 hover:bg-[var(--aura-lavender)] hover:text-[var(--aura-purple)] hover:-translate-y-0.5"
                >
                  {feat.label}
                  <ArrowUpRight className="h-3.5 w-3.5 opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 transition-all" />
                </Link>
              ))}
            </div>
          </Container>
        </section>
      )}

      {/* ═══════════════════════════════════════════════════════════════
          SECTION 7 — BOTTOM CTA
      ═══════════════════════════════════════════════════════════════ */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
        <Container className="relative z-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold text-[var(--aura-heading)] mb-4 tracking-tight text-balance">
              Experience {data.title} in action
            </h2>
            <p className="text-[var(--aura-body)] mb-8 max-w-xl mx-auto text-base leading-relaxed">
              Join 3,500+ salons using Aura to automate operations and grow revenue. Book a personalized demo today.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={CTA_LINKS.demo}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-[var(--aura-purple-hover)] hover:-translate-y-0.5 hover:shadow-xl"
              >
                Book a Demo
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/pricing"
                className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-border-strong)] bg-white px-6 py-3.5 text-sm font-semibold text-[var(--aura-heading)] shadow-xs transition-all hover:-translate-y-0.5 hover:shadow-sm"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
