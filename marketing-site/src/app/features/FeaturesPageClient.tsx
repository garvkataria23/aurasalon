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
      {/* ── Rich Hero Section ── */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2D124D] via-[#431A72] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-20 -left-20 h-[400px] w-[400px] rounded-full bg-purple-500/15 blur-[100px]" />
          <div className="absolute -right-20 top-1/3 h-72 w-72 rounded-full bg-indigo-500/10 blur-[80px]" />
        </div>

        <Container className="relative z-10 text-center max-w-4xl mx-auto">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/20 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-white/90 backdrop-blur-sm mb-6 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            Complete Salon OS
          </span>
          <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-bold tracking-[-0.04em] leading-[1.08] text-balance">
            {t("features.pageTitle")}
          </h1>
          <p className="mt-5 text-base md:text-xl text-white/75 leading-relaxed max-w-2xl mx-auto text-pretty">
            {t("features.pageBody")}
          </p>

          {/* Quick Stats Strip */}
          <div className="mt-10 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm text-center">
              <div className="text-2xl font-extrabold text-white">9+</div>
              <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mt-0.5">Core Modules</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm text-center">
              <div className="text-2xl font-extrabold text-white">3,500+</div>
              <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mt-0.5">Salons Powered</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm text-center">
              <div className="text-2xl font-extrabold text-white">99.9%</div>
              <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mt-0.5">Uptime SLA</div>
            </div>
            <div className="rounded-2xl border border-white/12 bg-white/[0.07] p-4 backdrop-blur-sm text-center">
              <div className="text-2xl font-extrabold text-white">100%</div>
              <div className="text-[11px] font-semibold text-white/60 uppercase tracking-wider mt-0.5">GST Ready</div>
            </div>
          </div>
        </Container>
      </section>

      {/* ── Features Hub Grid ── */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          {/* Category Tabs */}
          <div className="flex flex-wrap items-center justify-center gap-2.5 mb-14">
            {CATEGORIES.map((cat) => (
              <button
                key={cat.id}
                type="button"
                onClick={() => setSelectedCategory(cat.id)}
                className={`rounded-full px-5 py-2.5 text-xs sm:text-sm font-semibold transition-all ${
                  selectedCategory === cat.id
                    ? "bg-[var(--aura-purple)] text-white shadow-md shadow-purple-500/20"
                    : "bg-white text-[var(--aura-heading)] border border-[var(--aura-border)] hover:border-[var(--aura-purple)]/30 hover:bg-[var(--aura-lavender)]"
                }`}
              >
                {cat.label}
              </button>
            ))}
          </div>

          {/* Grid */}
          <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-6 max-w-6xl mx-auto">
            {filteredFeatures.map((feature, featureIndex) => {
              const Icon = iconMap[feature.icon] || Calendar;
              const translated = language === "hi" ? FEATURE_OVERVIEW_HI[featureIndex] : undefined;
              return (
                <Link
                  key={feature.title}
                  href={feature.href}
                  className="group flex flex-col justify-between rounded-2xl border border-[var(--aura-border)] bg-white p-8 transition-all duration-300 hover:shadow-[0_20px_50px_rgba(45,18,77,0.09)] hover:border-[var(--aura-purple)]/35 hover:-translate-y-1"
                >
                  <div>
                    <div
                      className="w-13 h-13 rounded-2xl flex items-center justify-center mb-6 transition-transform duration-300 group-hover:scale-108 shadow-xs"
                      style={{ backgroundColor: `${feature.color}15` }}
                    >
                      <Icon className="w-6 h-6" style={{ color: feature.color }} />
                    </div>
                    <h2 className="text-lg font-bold text-[var(--aura-heading)] mb-2.5 group-hover:text-[var(--aura-purple)] transition-colors flex items-center justify-between">
                      <span>{translated?.title ?? feature.title}</span>
                      <ArrowUpRight className="h-4 w-4 text-[var(--aura-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[var(--aura-purple)] transition-all" />
                    </h2>
                    <p className="text-sm text-[var(--aura-body)] leading-relaxed">
                      {translated?.description ?? feature.description}
                    </p>
                  </div>

                  <div className="mt-6 pt-4 border-t border-[var(--aura-border)]/60 flex items-center justify-between text-xs font-semibold text-[var(--aura-purple)]">
                    <span>{t("features.learn")}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform group-hover:translate-x-1" />
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
            <h2 className="text-[clamp(1.8rem,3.5vw,2.5rem)] font-bold text-[var(--aura-heading)] mb-4 tracking-tight">
              One connected platform, zero data silos
            </h2>
            <p className="text-base text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto mb-8">
              Unlike cobbled-together apps, Aura connects billing, booking, CRM, inventory, and staff payroll in real time.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 text-left">
              <div className="rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--aura-heading)] mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Auto Sync Everywhere
                </div>
                <p className="text-xs text-[var(--aura-body)] leading-relaxed">
                  Appointments automatically deduct inventory recipes and credit staff commissions.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--aura-heading)] mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                  Multi-Branch Ready
                </div>
                <p className="text-xs text-[var(--aura-body)] leading-relaxed">
                  Manage single salon or 50+ locations from one unified owner dashboard.
                </p>
              </div>
              <div className="rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-5">
                <div className="flex items-center gap-2 font-bold text-sm text-[var(--aura-heading)] mb-2">
                  <CheckCircle2 className="h-4 w-4 text-emerald-600" />
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
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-bold text-[var(--aura-heading)] mb-4 tracking-tight text-balance">
              Ready to see the full platform in action?
            </h2>
            <p className="text-[var(--aura-body)] mb-8 max-w-xl mx-auto text-base leading-relaxed">
              Book a 1-on-1 personalized demo and see how Aura transforms your salon operations.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3">
              <Link
                href={CTA_LINKS.demo}
                className="inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-bold text-white shadow-lg transition-all hover:bg-[var(--aura-purple-hover)] hover:-translate-y-0.5 hover:shadow-xl"
              >
                Book a Free Demo
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
