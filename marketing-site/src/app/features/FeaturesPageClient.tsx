"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar, CreditCard, Users, UserCheck, Package, Megaphone,
  TrendingUp, ShieldCheck, Palette, ArrowRight, ArrowUpRight, Sparkles,
} from "lucide-react";
import { FEATURES_OVERVIEW, CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { FEATURE_OVERVIEW_HI } from "@/lib/translations";
import { LandingDecor } from "@/components/landing/LandingDecor";

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

const CATEGORIES = [
  { id: "all", label: "All Features" },
  { id: "operations", label: "Operations & Front Desk" },
  { id: "clients", label: "Client CRM & Retention" },
  { id: "growth", label: "Growth & Finance" },
];

const FEATURE_CATEGORIES: Record<string, string> = {
  "/features/appointments": "operations",
  "/features/billing": "operations",
  "/features/staff-management": "operations",
  "/features/client-crm": "clients",
  "/features/marketing-ai": "clients",
  "/features/inventory": "growth",
  "/features/finance": "growth",
  "/features/compliance": "growth",
  "/features/white-label": "growth",
};

export default function FeaturesPage() {
  const { language, t } = useLanguage();
  const [selectedCategory, setSelectedCategory] = useState("all");

  const filteredFeatures = FEATURES_OVERVIEW.filter((feature) => {
    if (selectedCategory === "all") return true;
    return FEATURE_CATEGORIES[feature.href] === selectedCategory;
  });

  return (
    <div className="min-h-screen bg-[var(--aura-off-white)] flex flex-col">
      {/* ── Compact Sleek Hero Header ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2D124D] via-[#431A72] to-[#FCFBF8] text-white pt-20 pb-6 md:pt-24 md:pb-8">
        <LandingDecor variant="hero" />

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-16 -left-16 h-80 w-80 rounded-full bg-purple-500/20 blur-[80px]" />
          <div className="absolute -right-16 top-1/2 h-64 w-64 rounded-full bg-indigo-500/15 blur-[70px]" />
        </div>

        <Container className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <span className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-[.14em] text-white/95 backdrop-blur-md mb-2 shadow-xs">
            <Sparkles className="h-3 w-3 text-amber-300 animate-bounce" />
            Complete Salon OS
          </span>
          <h1 className="text-[clamp(1.75rem,3.5vw,2.75rem)] font-extrabold tracking-[-0.03em] leading-tight text-balance">
            {t("features.pageTitle", "Everything your salon needs")}
          </h1>
          <p className="mt-1.5 text-xs sm:text-sm text-white/80 leading-relaxed max-w-xl mx-auto text-pretty">
            {t("features.pageBody", "Explore every Aura workspace — built specifically for Indian salon and spa operations.")}
          </p>

          {/* Compact Category Filter Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2 mt-5">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-4 py-1.5 text-xs font-semibold transition-all duration-200 cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[var(--aura-purple)] text-white shadow-md shadow-purple-500/30 scale-102"
                    : "bg-white/90 text-[var(--aura-heading)] border border-white/40 hover:border-white hover:bg-white hover:shadow-xs"
                } active:scale-95`}
              >
                {cat.label}
              </button>
            ))}
          </div>
        </Container>
      </section>

      {/* ── Compact 3x3 Features Grid (All 9 cards visible together) ── */}
      <section className="py-5 sm:py-8 bg-[var(--aura-off-white)] grow">
        <Container className="max-w-6xl mx-auto px-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-3.5 md:gap-4">
            {filteredFeatures.map((feature, featureIndex) => {
              const Icon = iconMap[feature.icon] || Calendar;
              const translated = language === "hi" ? FEATURE_OVERVIEW_HI[featureIndex] : undefined;
              const learnText = language === "hi" ? "वर्कस्पेस देखें" : "Explore Feature";

              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="feature-card-hover group flex flex-col justify-between rounded-2xl border border-[var(--aura-border)] bg-white p-4.5 sm:p-5 shadow-xs cursor-pointer hover:border-[var(--aura-purple)]/45 transition-all duration-300"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3">
                      <div
                        className="w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-2 shadow-xs"
                        style={{ backgroundColor: `${feature.color}15` }}
                      >
                        <Icon className="w-5 h-5 transition-transform" style={{ color: feature.color }} />
                      </div>
                      <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--aura-muted)] group-hover:text-[var(--aura-purple)] transition-colors">
                        Module 0{featureIndex + 1}
                      </span>
                    </div>

                    <h2 className="text-sm sm:text-[15px] font-bold text-[var(--aura-heading)] mb-1 group-hover:text-[var(--aura-purple)] transition-colors flex items-center justify-between">
                      <span>{translated?.title ?? feature.title}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[var(--aura-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[var(--aura-purple)] transition-all duration-200" />
                    </h2>

                    <p className="text-[12px] text-[var(--aura-body)] leading-relaxed line-clamp-2">
                      {translated?.description ?? feature.description}
                    </p>
                  </div>

                  <div className="mt-3.5 pt-2.5 border-t border-[var(--aura-border)]/60 flex items-center justify-between text-[11px] font-semibold text-[var(--aura-purple)]">
                    <span>{learnText}</span>
                    <ArrowRight className="h-3 w-3 transition-transform duration-300 group-hover:translate-x-1" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── Compact All-in-One Strip & CTA Footer ── */}
      <section className="py-8 bg-white border-t border-[var(--aura-border)]">
        <Container className="max-w-5xl mx-auto px-4">
          <div className="flex flex-col md:flex-row items-center justify-between gap-6">
            <div>
              <h3 className="text-base sm:text-lg font-bold text-[var(--aura-heading)]">
                One connected platform, zero data silos
              </h3>
              <p className="text-xs text-[var(--aura-body)] mt-0.5 max-w-xl">
                Appointments automatically deduct stock recipes, credit staff commissions, and update daily cash closing.
              </p>
            </div>
            <div className="flex flex-wrap items-center gap-3 shrink-0">
              <Link
                href={CTA_LINKS.demo}
                className="btn-aura-glow inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-5 py-2.5 text-xs sm:text-sm font-bold text-white shadow-md hover:bg-[var(--aura-purple-hover)]"
              >
                Book Free Demo
                <ArrowRight className="h-3.5 w-3.5" />
              </Link>
              <Link
                href="/pricing"
                className="btn-white-glow inline-flex items-center gap-2 rounded-full border border-[var(--aura-border-strong)] bg-white px-4 py-2.5 text-xs sm:text-sm font-semibold text-[var(--aura-heading)] shadow-xs"
              >
                View Pricing
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
