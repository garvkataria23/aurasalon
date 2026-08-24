"use client";

import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  FileText,
  Info,
  Layers,
  Monitor,
  Package,
  Receipt,
  Smartphone,
  Sparkles,
  UserCheck,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProductShell } from "@/components/ecosystem/ProductShell";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRole, type EcosystemRoute } from "@/lib/ecosystem-content";
import { LandingDecor } from "@/components/landing/LandingDecor";

const STEP_ICONS = [Smartphone, Calendar, UserCheck, FileText, Receipt, Package, Award, BarChart3];

const EXPERIENCES: Array<{ route: EcosystemRoute; role: EcosystemRole; href: string; icon: typeof Monitor; color: string }> = [
  { route: "owner", role: "owner", href: "/owner-crm", icon: Monitor, color: "#6F4FD8" },
  { route: "customer", role: "customer", href: "/customer-app", icon: Smartphone, color: "#059669" },
  { route: "staff", role: "staff", href: "/staff-app", icon: UsersRound, color: "#D97706" },
];

const FAMILY_LINKS: Array<{ route: EcosystemRoute; href: string; icon: typeof Workflow }> = [
  { route: "platform", href: "/platform", icon: Workflow },
  { route: "owner", href: "/owner-crm", icon: Monitor },
  { route: "customer", href: "/customer-app", icon: Smartphone },
  { route: "staff", href: "/staff-app", icon: UsersRound },
  { route: "workflows", href: "/workflows", icon: ArrowRight },
];

const SECTION_ICONS = [Layers, Smartphone, UsersRound];
const SECTION_COLORS = ["#6F4FD8", "#059669", "#D97706"];

export function PlatformClient() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language as "en" | "hi"] ?? ECOSYSTEM_CONTENT.en;
  const page = copy.route.platform;
  const panel = copy.tour.roles.flow;

  return (
    <>
      {/* ═══ HERO — Dark Premium Gradient ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#2D124D] via-[#431A72] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        {/* Ambient orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-20 -left-20 h-[420px] w-[420px] rounded-full bg-purple-500/20 blur-[100px] animate-pulse" />
          <div className="absolute -right-20 top-1/3 h-80 w-80 rounded-full bg-indigo-500/15 blur-[90px]" />
          <div className="absolute left-1/3 bottom-0 h-56 w-56 rounded-full bg-fuchsia-500/10 blur-[80px]" />
        </div>

        <Container className="relative z-10 text-center max-w-4xl mx-auto px-4">
          <span className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-semibold uppercase tracking-[.14em] text-white/95 backdrop-blur-md mb-6 shadow-md transition-all hover:border-white/40 hover:bg-white/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-bounce" aria-hidden="true" />
            {page.eyebrow}
          </span>
          <h1 className="text-[clamp(2.5rem,6vw,4.25rem)] font-extrabold tracking-[-0.04em] leading-[1.08] text-balance drop-shadow-sm">
            {page.title}
          </h1>
          <p className="mt-5 text-base md:text-xl text-white/80 leading-relaxed max-w-2xl mx-auto text-pretty">
            {page.body}
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-3.5">
            <Link
              href={CTA_LINKS.demo}
              className="group inline-flex items-center gap-2 rounded-full bg-white px-8 py-3.5 text-sm font-bold text-[var(--aura-purple)] shadow-[0_14px_34px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 hover:shadow-[0_18px_42px_rgba(0,0,0,0.28)] active:scale-[0.98]"
            >
              {copy.common.demo}
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
            </Link>
            <Link
              href="/workflows"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-3.5 text-sm font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/18 hover:border-white/45"
            >
              {copy.ecosystem.roles.flow.label}
            </Link>
          </div>

          {/* Stats Strip — Glassmorphism */}
          <div className="mt-12 grid grid-cols-2 sm:grid-cols-4 gap-4 max-w-3xl mx-auto">
            {[
              { value: "3", label: language === "hi" ? "जुड़े Experiences" : "Connected Experiences" },
              { value: "1", label: language === "hi" ? "Shared Record" : "Shared Booking Record" },
              { value: String(copy.workflow.steps.length), label: language === "hi" ? "Handoffs जुड़े" : "Handoffs Intact" },
              { value: "0", label: language === "hi" ? "Double Entry" : "Double Entry" },
            ].map((stat) => (
              <div
                key={stat.label}
                className="group rounded-2xl border border-white/15 bg-white/[0.08] p-4.5 backdrop-blur-md text-center transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1 hover:shadow-[0_12px_32px_rgba(111,79,216,0.28)]"
              >
                <div className="text-2xl md:text-3xl font-extrabold text-white transition-transform group-hover:scale-105">{stat.value}</div>
                <div className="text-[11px] font-semibold text-white/65 uppercase tracking-wider mt-1">{stat.label}</div>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ Product Shell Preview ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container size="wide">
          <div className="mx-auto max-w-5xl">
            <div className="relative rounded-[1.75rem] bg-gradient-to-br from-white to-[var(--aura-lavender)] p-3 shadow-[0_28px_80px_rgba(72,45,151,0.14)] ring-1 ring-white/60 sm:p-5">
              <div className="pointer-events-none absolute inset-x-8 -top-6 h-24 rounded-full bg-[radial-gradient(ellipse,rgba(111,79,216,0.22),transparent_70%)] blur-xl" aria-hidden="true" />
              <ProductShell role="flow" label={panel.label} eyebrow={panel.eyebrow} title={panel.title} body={panel.body} points={panel.points} note={panel.note} disclosure={copy.hero.disclosure} />
            </div>
            <p className="mt-5 flex items-start justify-center gap-2 text-center text-xs leading-5 text-aura-text-muted">
              <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
              {page.disclosure}
            </p>
          </div>
        </Container>
      </section>

      {/* ═══ Three Experiences — Rich Cards ═══ */}
      <section className="py-16 md:py-24 bg-white border-y border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/20 bg-[var(--aura-lavender)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--aura-purple)] shadow-xs mb-4">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.ecosystem.eyebrow}
            </span>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance">
              {copy.ecosystem.title}
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">
              {copy.ecosystem.body}
            </p>
          </div>
          <div className="grid gap-5 lg:grid-cols-3 max-w-6xl mx-auto">
            {EXPERIENCES.map(({ route, role, href, icon: Icon, color }) => {
              const exp = copy.route[route];
              const tour = copy.tour.roles[role];
              return (
                <Link
                  key={route}
                  href={href}
                  className="feature-card-hover group flex flex-col rounded-2xl border border-[var(--aura-border)] bg-white p-6 md:p-7 cursor-pointer"
                >
                  <div className="flex items-center justify-between mb-4">
                    <div
                      className="w-11 h-11 rounded-xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-2 shadow-xs"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-5 h-5 transition-transform" style={{ color }} aria-hidden="true" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--aura-muted)] group-hover:text-[var(--aura-purple)] transition-colors">
                      {exp.eyebrow}
                    </span>
                  </div>

                  <h3 className="text-lg font-bold text-[var(--aura-heading)] mb-1.5 group-hover:text-[var(--aura-purple)] transition-colors flex items-center justify-between">
                    <span>{tour.title}</span>
                    <ArrowUpRight className="h-3.5 w-3.5 text-[var(--aura-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[var(--aura-purple)] transition-all duration-200" aria-hidden="true" />
                  </h3>
                  <p className="text-sm text-[var(--aura-body)] leading-relaxed mb-5">{tour.body}</p>

                  <ul className="space-y-2.5 mb-5">
                    {tour.points.slice(0, 4).map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm leading-6 text-aura-text-secondary">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-aura-success" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>

                  <div className="mt-auto pt-4 border-t border-[var(--aura-border)]/50 flex items-center justify-between text-xs font-semibold text-[var(--aura-purple)]">
                    <span>{copy.common.explore}</span>
                    <ArrowRight className="h-3.5 w-3.5 transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ Capability Map — Alternating Accent ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--aura-purple)]">{copy.common.productView}</span>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance">
              {page.title}
            </h2>
          </div>
          <div className="space-y-6 max-w-6xl mx-auto">
            {page.sections.map((section, index) => {
              const SectionIcon = SECTION_ICONS[index % SECTION_ICONS.length];
              const accentColor = SECTION_COLORS[index % SECTION_COLORS.length];
              return (
                <article
                  key={section.title}
                  className="group grid gap-8 rounded-[1.75rem] border border-[var(--aura-border)] bg-white p-7 shadow-[0_1px_3px_rgba(29,27,32,0.04)] transition-all duration-300 hover:shadow-[0_20px_50px_-10px_rgba(111,79,216,0.12)] hover:border-[var(--aura-purple)]/20 sm:p-10 lg:grid-cols-[.85fr_1.15fr]"
                >
                  <div>
                    <div className="flex items-center gap-4 mb-5">
                      <div
                        className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 shadow-xs"
                        style={{ backgroundColor: `${accentColor}12` }}
                      >
                        <SectionIcon className="w-6 h-6" style={{ color: accentColor }} aria-hidden="true" />
                      </div>
                      <div className="flex items-center gap-3 flex-1 min-w-0">
                        <span className="font-display text-4xl font-bold italic leading-none" style={{ color: `${accentColor}30` }}>
                          {String(index + 1).padStart(2, "0")}
                        </span>
                        <span className="h-px flex-1 bg-gradient-to-r from-[var(--aura-purple)]/20 to-transparent" aria-hidden="true" />
                      </div>
                    </div>
                    <h3 className="font-display text-2xl md:text-3xl font-bold leading-tight tracking-[-.02em] text-[var(--aura-heading)] group-hover:text-[var(--aura-purple)] transition-colors">
                      {section.title}
                    </h3>
                    <p className="mt-3 text-sm leading-7 text-[var(--aura-body)]">{section.body}</p>
                    {section.note && (
                      <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[rgba(217,119,6,0.22)] bg-[rgba(217,119,6,0.06)] p-4 text-xs leading-5 text-[#92400E]">
                        <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                        <span><strong className="font-semibold">{copy.common.qualification}: </strong>{section.note}</span>
                      </p>
                    )}
                  </div>
                  <ul className="grid content-start gap-3 sm:grid-cols-2">
                    {section.items.map((item) => (
                      <li
                        key={item}
                        className="flex items-start gap-3 rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-4 text-sm leading-6 text-[var(--aura-body)] transition-all duration-200 hover:border-[var(--aura-purple)]/20 hover:bg-[var(--aura-lavender)] hover:-translate-y-0.5"
                      >
                        <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0 text-emerald-600" aria-hidden="true" />
                        {item}
                      </li>
                    ))}
                  </ul>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ Handoff Flow — Visual Timeline ═══ */}
      <section className="relative overflow-hidden py-16 md:py-24 bg-white">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/20 bg-[var(--aura-lavender)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--aura-purple)] shadow-xs mb-4">
              <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.workflow.eyebrow}
            </span>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance">
              {copy.workflow.title}
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">{copy.workflow.body}</p>
          </div>

          <ol className="relative grid gap-5 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {/* Connecting line */}
            <span className="pointer-events-none absolute left-0 right-0 top-[52px] hidden h-px bg-gradient-to-r from-transparent via-[var(--aura-purple)]/30 to-transparent lg:block" aria-hidden="true" />
            {copy.workflow.steps.map((step, index) => {
              const Icon = STEP_ICONS[index % STEP_ICONS.length];
              return (
                <li key={step.title} className="group relative rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-6 transition-all duration-300 hover:-translate-y-1.5 hover:border-[var(--aura-purple)]/25 hover:shadow-[0_20px_50px_-10px_rgba(111,79,216,0.16)] hover:bg-white">
                  <div className="flex items-center justify-between">
                    <span className="relative z-10 grid h-[52px] w-[52px] place-items-center rounded-2xl border border-[var(--aura-purple)]/15 bg-white shadow-sm transition-all duration-300 group-hover:border-[var(--aura-purple)]/30 group-hover:bg-[var(--aura-lavender)] group-hover:scale-110">
                      <Icon className="h-5 w-5 text-[var(--aura-purple)]" aria-hidden="true" />
                    </span>
                    <span className="font-display text-3xl font-bold italic leading-none text-[var(--aura-purple)]/15 group-hover:text-[var(--aura-purple)]/30 transition-colors">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-5 inline-flex rounded-full bg-[var(--aura-lavender)] px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-[var(--aura-purple)]">{step.tag}</p>
                  <h3 className="mt-3 font-bold leading-snug text-[var(--aura-heading)] group-hover:text-[var(--aura-purple)] transition-colors">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-[var(--aura-body)]">{step.body}</p>
                </li>
              );
            })}
          </ol>
          <p className="mx-auto mt-10 flex max-w-3xl items-start justify-center gap-2 text-center text-xs leading-5 text-aura-text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
            {copy.workflow.note}
          </p>
        </Container>
      </section>

      {/* ═══ Platform Family Nav ═══ */}
      <section className="border-y border-[var(--aura-border)] bg-[var(--aura-off-white)] py-14">
        <Container>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 max-w-6xl mx-auto">
            {FAMILY_LINKS.map(({ route, href, icon: Icon }) => {
              const linkedPage = copy.route[route];
              const active = route === "platform";
              return (
                <Link
                  key={route}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-24 items-center gap-4 rounded-2xl border p-4 transition-all duration-300 ${active
                    ? "border-[var(--aura-purple)]/40 bg-[var(--aura-lavender)] shadow-[0_8px_24px_rgba(111,79,216,0.12)]"
                    : "border-[var(--aura-border)] bg-white hover:border-[var(--aura-purple)]/25 hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl transition-all ${active ? "bg-[var(--aura-purple)] text-white shadow-sm" : "bg-[var(--aura-lavender)] text-[var(--aura-purple)] group-hover:bg-[var(--aura-lavender-strong)]"}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm text-[var(--aura-heading)]">{linkedPage.eyebrow}</strong>
                    <span className="mt-1 block text-xs text-[var(--aura-muted)]">{active ? copy.common.active : copy.common.explore}</span>
                  </span>
                  {!active && <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-[var(--aura-muted)] transition-transform group-hover:translate-x-1" aria-hidden="true" />}
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ Final CTA — Rich Gradient ═══ */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
        <Container className="relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div className="mx-auto mb-7 grid h-20 w-20 place-items-center rounded-full border border-[var(--aura-purple)]/25 bg-white shadow-lg" aria-hidden="true">
              <Workflow className="h-9 w-9 text-[var(--aura-purple)]" />
            </div>
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance">
              {copy.hero.title}
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">{copy.hero.body}</p>
            <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
              <Link
                href={CTA_LINKS.demo}
                className="btn-aura-glow group inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-bold text-white shadow-xl hover:bg-[var(--aura-purple-hover)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                {copy.common.demo}
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="btn-white-glow inline-flex items-center gap-2 rounded-full border border-[var(--aura-border-strong)] bg-white px-7 py-3.5 text-sm font-semibold text-[var(--aura-heading)] shadow-md hover:border-[var(--aura-purple)]/40 transition-all hover:-translate-y-0.5"
              >
                {language === "hi" ? "कीमत देखें" : "View Pricing"}
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
