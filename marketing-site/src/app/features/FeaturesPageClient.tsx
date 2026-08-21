"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Calendar, CreditCard, Users, UserCheck, Package, Megaphone,
  TrendingUp, ShieldCheck, Palette, ArrowRight, ArrowUpRight, Sparkles, CheckCircle2,
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
    <>
      {/* ── Full Rich Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2D124D] via-[#431A72] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full bg-purple-500/20 blur-[100px] animate-pulse" />
          <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-indigo-500/15 blur-[90px]" />
        </div>

        <Container className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-white/95 backdrop-blur-md mb-6 shadow-md transition-all hover:border-white/40 hover:bg-white/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-bounce" />
            Complete Salon OS
          </span>
          <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold tracking-[-0.04em] leading-[1.08] text-balance drop-shadow-sm">
            {t("features.pageTitle", "Everything your salon needs")}
          </h1>
          <p className="mt-5 text-base md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto text-pretty">
            {t("features.pageBody", "Explore every Aura workspace — designed for real salon operations, not generic business workflows.")}
          </p>

          {/* Quick Stats Strip */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="group rounded-2xl border border-white/15 bg-white/[0.08] p-4.5 backdrop-blur-md text-center transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(111,79,216,0.28)]">
              <div className="text-2xl md:text-3xl font-extrabold text-white transition-transform group-hover:scale-108">9+</div>
              <div className="text-[11px] font-semibold text-white/65 uppercase tracking-wider mt-1">Core Modules</div>
            </div>
            <div className="group rounded-2xl border border-white/15 bg-white/[0.08] p-4.5 backdrop-blur-md text-center transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(111,79,216,0.28)]">
              <div className="text-2xl md:text-3xl font-extrabold text-white transition-transform group-hover:scale-108">3,500+</div>
              <div className="text-[11px] font-semibold text-white/65 uppercase tracking-wider mt-1">Salons Powered</div>
            </div>
            <div className="group rounded-2xl border border-white/15 bg-white/[0.08] p-4.5 backdrop-blur-md text-center transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(111,79,216,0.28)]">
              <div className="text-2xl md:text-3xl font-extrabold text-white transition-transform group-hover:scale-108">99.9%</div>
              <div className="text-[11px] font-semibold text-white/65 uppercase tracking-wider mt-1">Uptime SLA</div>
            </div>
            <div className="group rounded-2xl border border-white/15 bg-white/[0.08] p-4.5 backdrop-blur-md text-center transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(111,79,216,0.28)]">
              <div className="text-2xl md:text-3xl font-extrabold text-white transition-transform group-hover:scale-108">100%</div>
              <div className="text-[11px] font-semibold text-white/65 uppercase tracking-wider mt-1">GST Ready</div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Features Hub Grid Section (Compact Cards) ── */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-12">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all duration-300 cursor-pointer ${
                  selectedCategory === cat.id
                    ? "bg-[var(--aura-purple)] text-white shadow-lg shadow-purple-500/25 scale-105"
                    : "bg-white text-[var(--aura-heading)] border border-[var(--aura-border)] hover:border-[var(--aura-purple)]/40 hover:bg-[var(--aura-lavender)] hover:-translate-y-0.5"
                } active:scale-95`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Compact Feature Cards Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-4 md:gap-5 max-w-6xl mx-auto">
            {filteredFeatures.map((feature, featureIndex) => {
              const Icon = iconMap[feature.icon] || Calendar;
              const translated = language === "hi" ? FEATURE_OVERVIEW_HI[featureIndex] : undefined;
              const learnText = language === "hi" ? "वर्कस्पेस देखें" : "Explore Feature";

              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="feature-card-hover group flex flex-col justify-between rounded-2xl border border-[var(--aura-border)] bg-white p-5 md:p-6 cursor-pointer shadow-xs"
                >
                  <div>
                    <div className="flex items-center justify-between mb-3.5">
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

                    <h2 className="text-base font-bold text-[var(--aura-heading)] mb-1.5 group-hover:text-[var(--aura-purple)] transition-colors flex items-center justify-between">
                      <span>{translated?.title ?? feature.title}</span>
                      <ArrowUpRight className="h-3.5 w-3.5 text-[var(--aura-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[var(--aura-purple)] transition-all duration-200" />
                    </h2>

                    <p className="text-xs sm:text-sm text-[var(--aura-body)] leading-relaxed line-clamp-2">
                      {translated?.description ?? feature.description}
                    </p>
                  </div>

                  <div className="mt-4 pt-3 border-t border-[var(--aura-border)]/50 flex items-center justify-between text-xs font-semibold text-[var(--aura-purple)]">
                    <span>{learnText}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── All-in-One Comparison Strip ── */}
      <section className="py-16 md:py-20 bg-white border-y border-[var(--aura-border)]">
        <Container>
          <div className="max-w-4xl mx-auto text-center">
            <h2 className="text-[clamp(1.8rem,3.5vw,2.5rem)] font-extrabold text-[var(--aura-heading)] mb-4 tracking-tight">
              One connected platform, zero data silos
            </h2>
            <p className="text-base text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto mb-8">
              Unlike cobbled-together apps, Aura connects billing, booking, CRM, inventory, and staff payroll in real time.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5 transition-all duration-300 hover:border-[var(--aura-purple)]/30 hover:-translate-y-1 hover:shadow-md">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--aura-heading)] mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shadow-xs" />
                  Auto Sync Everywhere
                </div>
                <p className="text-xs text-[var(--aura-body)] leading-relaxed">
                  Appointments automatically deduct inventory recipes and credit staff commissions.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5 transition-all duration-300 hover:border-[var(--aura-purple)]/30 hover:-translate-y-1 hover:shadow-md">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--aura-heading)] mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shadow-xs" />
                  Multi-Branch Ready
                </div>
                <p className="text-xs text-[var(--aura-body)] leading-relaxed">
                  Manage single salon or 50+ locations from one unified owner dashboard.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5 transition-all duration-300 hover:border-[var(--aura-purple)]/30 hover:-translate-y-1 hover:shadow-md">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--aura-heading)] mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600 shadow-xs" />
                  Instant WhatsApp Connect
                </div>
                <p className="text-xs text-[var(--aura-body)] leading-relaxed">
                  Direct 2-way WhatsApp API for reminders, receipts, and client chat.
                </p>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Bottom CTA ── */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
        <Container className="relative z-10">
          <div className="text-center max-w-2xl mx-auto">
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] mb-4 tracking-tight text-balance">
              Ready to see the full platform in action?
            </h2>
            <p className="text-[var(--aura-body)] mb-8 max-w-xl mx-auto text-base leading-relaxed">
              Book a 1-on-1 personalized demo and see how Aura transforms your salon operations.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5">
              <Link
                href={CTA_LINKS.demo}
                className="btn-aura-glow inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-bold text-white shadow-xl hover:bg-[var(--aura-purple-hover)]"
              >
                Book a Free Demo
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" />
              </Link>
              <Link
                href="/pricing"
                className="btn-white-glow inline-flex items-center gap-2 rounded-full border border-[var(--aura-border-strong)] bg-white px-7 py-3.5 text-sm font-semibold text-[var(--aura-heading)] shadow-md hover:border-[var(--aura-purple)]/40"
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
