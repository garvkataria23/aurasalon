"use client";

import Link from "next/link";
import {
  ArrowRight,
  Award,
  BarChart3,
  Calendar,
  Check,
  FileText,
  Info,
  Monitor,
  Package,
  Receipt,
  ShieldCheck,
  Smartphone,
  Sparkles,
  UserCheck,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { ProductShell } from "@/components/ecosystem/ProductShell";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRole, type EcosystemRoute } from "@/lib/ecosystem-content";

const STEP_ICONS = [Smartphone, Calendar, UserCheck, FileText, Receipt, Package, Award, BarChart3];

const EXPERIENCES: Array<{ route: EcosystemRoute; role: EcosystemRole; href: string; icon: typeof Monitor }> = [
  { route: "owner", role: "owner", href: "/owner-crm", icon: Monitor },
  { route: "customer", role: "customer", href: "/customer-app", icon: Smartphone },
  { route: "staff", role: "staff", href: "/staff-app", icon: UsersRound },
];

const FAMILY_LINKS: Array<{ route: EcosystemRoute; href: string; icon: typeof Workflow }> = [
  { route: "platform", href: "/platform", icon: Workflow },
  { route: "owner", href: "/owner-crm", icon: Monitor },
  { route: "customer", href: "/customer-app", icon: Smartphone },
  { route: "staff", href: "/staff-app", icon: UsersRound },
  { route: "workflows", href: "/workflows", icon: ArrowRight },
];

export function PlatformClient() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language as "en" | "hi"] ?? ECOSYSTEM_CONTENT.en;
  const page = copy.route.platform;
  const panel = copy.tour.roles.flow;
  const titleWords = page.title.split(" ");
  const titleHead = titleWords.slice(0, -2).join(" ");
  const titleTail = titleWords.slice(-2).join(" ");

  return (
    <>
      {/* Hero */}
      <section className="relative overflow-hidden bg-aura-bg">
        <div className="absolute inset-0 opacity-50 [background-image:linear-gradient(rgba(18,63,92,.055)_1px,transparent_1px),linear-gradient(90deg,rgba(18,63,92,.055)_1px,transparent_1px)] [background-size:72px_72px]" aria-hidden="true" />
        <div className="pointer-events-none absolute -left-32 top-16 h-96 w-96 rounded-full bg-[radial-gradient(circle,rgba(111,79,216,0.14),transparent_65%)] blur-2xl motion-safe:animate-pulse" aria-hidden="true" />
        <div className="pointer-events-none absolute -right-24 bottom-0 h-80 w-80 rounded-full bg-[radial-gradient(circle,rgba(155,127,230,0.16),transparent_65%)] blur-2xl" aria-hidden="true" />
        <Container size="wide" className="relative z-10 py-20 md:py-28">
          <div className="grid items-center gap-12 lg:grid-cols-[.92fr_1.08fr] lg:gap-14">
            <div>
              <span className="inline-flex items-center gap-2 rounded-full border border-aura-primary/20 bg-white/70 px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.18em] text-aura-primary shadow-sm backdrop-blur-md">
                <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
                {page.eyebrow}
              </span>
              <h1 className="mt-6 font-display text-[clamp(2.7rem,5.6vw,4.9rem)] leading-[1.03] tracking-[-.04em] text-aura-text">
                {titleHead}{" "}
                <span className="bg-gradient-to-r from-[var(--aura-purple)] via-[var(--aura-primary-light)] to-[var(--aura-purple-hover)] bg-clip-text text-transparent">{titleTail}</span>
              </h1>
              <p className="mt-6 max-w-xl text-pretty text-base leading-8 text-aura-text-secondary md:text-lg">{page.body}</p>
              <div className="mt-8 flex flex-col gap-3 sm:flex-row">
                <Link href={CTA_LINKS.demo} className="group inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-aura-primary px-7 text-sm font-semibold text-white shadow-[0_14px_34px_rgba(111,79,216,0.35)] transition-all hover:-translate-y-0.5 hover:bg-[var(--aura-purple-hover)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  {copy.common.demo}
                  <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                </Link>
                <Link href="/workflows" className="inline-flex min-h-12 items-center justify-center rounded-full border border-aura-border-strong bg-white/60 px-7 text-sm font-semibold text-aura-text backdrop-blur transition-all hover:-translate-y-0.5 hover:border-aura-primary/30 hover:text-aura-primary motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  {copy.ecosystem.roles.flow.label}
                </Link>
              </div>
              <p className="mt-6 flex max-w-lg items-start gap-2 text-xs leading-5 text-aura-text-muted">
                <ShieldCheck className="mt-0.5 h-4 w-4 shrink-0 text-aura-success" aria-hidden="true" />
                {page.disclosure}
              </p>
            </div>
            <div className="relative min-w-0">
              <div className="pointer-events-none absolute inset-x-8 -top-6 h-24 rounded-full bg-[radial-gradient(ellipse,rgba(111,79,216,0.22),transparent_70%)] blur-xl" aria-hidden="true" />
              <div className="relative rounded-[1.75rem] bg-gradient-to-br from-white to-[var(--aura-lavender)] p-3 shadow-[0_28px_80px_rgba(72,45,151,0.14)] ring-1 ring-white/60 sm:p-5">
                <ProductShell role="flow" label={panel.label} eyebrow={panel.eyebrow} title={panel.title} body={panel.body} points={panel.points} note={panel.note} disclosure={copy.hero.disclosure} />
              </div>
            </div>
          </div>

          {/* Stats strip */}
          <dl className="mx-auto mt-16 grid max-w-5xl grid-cols-2 gap-4 rounded-[1.5rem] border border-white/80 bg-white/85 p-6 shadow-[0_18px_48px_rgba(29,27,32,0.07)] backdrop-blur-xl md:grid-cols-4 md:p-8">
            {[
              { value: "3", label: language === "hi" ? "जुड़े working experiences" : "Connected working experiences" },
              { value: "1", label: language === "hi" ? "Shared booking record" : "Shared booking record" },
              { value: String(copy.workflow.steps.length), label: language === "hi" ? "Handoffs जुड़े हुए" : "Handoffs kept intact" },
              { value: "0", label: language === "hi" ? "Double entry" : "Double entry" },
            ].map((stat) => (
              <div key={stat.label} className="text-center">
                <dd className="font-display text-3xl font-bold tracking-tight text-aura-primary md:text-4xl">{stat.value}</dd>
                <dt className="mt-1 text-xs font-semibold leading-snug text-aura-text-muted md:text-sm">{stat.label}</dt>
              </div>
            ))}
          </dl>
        </Container>
      </section>

      {/* Three experiences */}
      <section className="bg-aura-surface py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-aura-primary">{copy.ecosystem.eyebrow}</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)] leading-tight tracking-[-.03em] text-aura-text">{copy.ecosystem.title}</h2>
            <p className="mt-4 leading-7 text-aura-text-secondary">{copy.ecosystem.body}</p>
          </div>
          <div className="mt-12 grid gap-5 lg:grid-cols-3">
            {EXPERIENCES.map(({ route, role, href, icon: Icon }) => {
              const exp = copy.route[route];
              const tour = copy.tour.roles[role];
              return (
                <article key={route} className="group flex flex-col rounded-[1.5rem] border border-aura-border bg-white p-7 shadow-[0_1px_3px_rgba(29,27,32,0.045),0_1px_2px_rgba(29,27,32,0.025)] transition-all duration-300 hover:-translate-y-1 hover:border-aura-primary/25 hover:shadow-[0_24px_60px_rgba(72,45,151,0.13)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <div className="flex items-center justify-between">
                    <span className="grid h-12 w-12 place-items-center rounded-2xl bg-aura-primary-soft ring-8 ring-aura-primary-soft/50 transition-colors group-hover:bg-[var(--aura-lavender-strong)] motion-reduce:transition-none">
                      <Icon className="h-6 w-6 text-aura-primary" aria-hidden="true" />
                    </span>
                    <span className="rounded-full bg-aura-surface-muted px-3 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-aura-text-muted">{exp.eyebrow}</span>
                  </div>
                  <h3 className="mt-6 font-display text-2xl leading-snug tracking-[-.02em] text-aura-text transition-colors group-hover:text-aura-primary motion-reduce:transition-none">{tour.title}</h3>
                  <p className="mt-3 text-sm leading-6 text-aura-text-secondary">{tour.body}</p>
                  <ul className="mt-5 space-y-2.5">
                    {tour.points.slice(0, 4).map((point) => (
                      <li key={point} className="flex items-start gap-2.5 text-sm leading-6 text-aura-text-secondary">
                        <Check className="mt-1 h-4 w-4 shrink-0 text-aura-success" aria-hidden="true" />
                        {point}
                      </li>
                    ))}
                  </ul>
                  <Link href={href} className="mt-auto inline-flex items-center gap-1.5 pt-6 text-sm font-semibold text-aura-primary">
                    {copy.common.explore}
                    <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                  </Link>
                </article>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Capability map */}
      <section className="bg-aura-bg-warm py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-aura-primary">{copy.common.productView}</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)] leading-tight tracking-[-.03em] text-aura-text">{page.title}</h2>
          </div>
          <div className="mt-12 space-y-6">
            {page.sections.map((section, index) => (
              <article key={section.title} className="grid gap-8 rounded-[1.75rem] border border-aura-border bg-white p-7 shadow-[0_1px_3px_rgba(29,27,32,0.045)] transition-shadow hover:shadow-[0_18px_48px_rgba(29,27,32,0.07)] sm:p-10 lg:grid-cols-[.85fr_1.15fr]">
                <div>
                  <div className="flex items-center gap-4">
                    <span className="font-display text-5xl font-bold italic leading-none text-aura-primary/25">{String(index + 1).padStart(2, "0")}</span>
                    <span className="h-px flex-1 bg-gradient-to-r from-aura-primary/40 to-transparent" aria-hidden="true" />
                  </div>
                  <h3 className="mt-5 font-display text-3xl leading-tight tracking-[-.02em] text-aura-text">{section.title}</h3>
                  <p className="mt-3 text-sm leading-7 text-aura-text-secondary">{section.body}</p>
                  {section.note && (
                    <p className="mt-6 flex items-start gap-2.5 rounded-2xl border border-[rgba(217,119,6,0.22)] bg-[rgba(217,119,6,0.06)] p-4 text-xs leading-5 text-[#92400E]">
                      <Info className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
                      <span><strong className="font-semibold">{copy.common.qualification}: </strong>{section.note}</span>
                    </p>
                  )}
                </div>
                <ul className="grid content-start gap-3 sm:grid-cols-2">
                  {section.items.map((item) => (
                    <li key={item} className="flex items-start gap-3 rounded-2xl border border-aura-border bg-aura-bg p-4 text-sm leading-6 text-aura-text-secondary transition-colors hover:border-aura-primary/20 hover:bg-[var(--aura-lavender)] motion-reduce:transition-none">
                      <Check className="mt-1 h-4 w-4 shrink-0 text-aura-success" aria-hidden="true" />
                      {item}
                    </li>
                  ))}
                </ul>
              </article>
            ))}
          </div>
        </Container>
      </section>

      {/* Handoff flow */}
      <section className="relative overflow-hidden bg-aura-surface py-20 md:py-28">
        <Container>
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-[11px] font-bold uppercase tracking-[.2em] text-aura-primary">{copy.workflow.eyebrow}</p>
            <h2 className="mt-3 font-display text-[clamp(2rem,4vw,3.2rem)] leading-tight tracking-[-.03em] text-aura-text">{copy.workflow.title}</h2>
            <p className="mt-4 leading-7 text-aura-text-secondary">{copy.workflow.body}</p>
          </div>
          <ol className="relative mt-14 grid gap-5 sm:grid-cols-2 lg:grid-cols-4">
            <span className="pointer-events-none absolute left-0 right-0 top-[52px] hidden h-px bg-gradient-to-r from-transparent via-aura-primary/30 to-transparent lg:block" aria-hidden="true" />
            {copy.workflow.steps.map((step, index) => {
              const Icon = STEP_ICONS[index % STEP_ICONS.length];
              return (
                <li key={step.title} className="group relative rounded-[1.25rem] border border-aura-border bg-white p-6 shadow-[0_1px_3px_rgba(29,27,32,0.045)] transition-all duration-300 hover:-translate-y-1 hover:border-aura-primary/25 hover:shadow-[0_18px_44px_rgba(72,45,151,0.12)] motion-reduce:transition-none motion-reduce:hover:translate-y-0">
                  <div className="flex items-center justify-between">
                    <span className="relative z-10 grid h-[52px] w-[52px] place-items-center rounded-2xl border border-aura-primary/15 bg-white shadow-sm transition-colors group-hover:border-aura-primary/30 group-hover:bg-[var(--aura-lavender)] motion-reduce:transition-none">
                      <Icon className="h-5 w-5 text-aura-primary" aria-hidden="true" />
                    </span>
                    <span className="font-display text-3xl font-bold italic leading-none text-aura-primary/20">{String(index + 1).padStart(2, "0")}</span>
                  </div>
                  <p className="mt-5 inline-flex rounded-full bg-aura-primary-soft px-2.5 py-1 text-[10px] font-bold uppercase tracking-[.14em] text-aura-primary">{step.tag}</p>
                  <h3 className="mt-3 font-bold leading-snug text-aura-text">{step.title}</h3>
                  <p className="mt-2 text-sm leading-6 text-aura-text-secondary">{step.body}</p>
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

      {/* Platform family */}
      <section className="border-y border-aura-border bg-aura-bg-warm py-16">
        <Container>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5">
            {FAMILY_LINKS.map(({ route, href, icon: Icon }) => {
              const linkedPage = copy.route[route];
              const active = route === "platform";
              return (
                <Link key={route} href={href} aria-current={active ? "page" : undefined} className={`group flex min-h-24 items-center gap-4 rounded-2xl border p-4 transition-colors ${active ? "border-aura-primary/40 bg-[var(--aura-lavender)] shadow-sm" : "border-aura-border bg-aura-surface hover:border-aura-border-strong"}`}>
                  <span className={`grid h-11 w-11 shrink-0 place-items-center rounded-xl ${active ? "bg-aura-primary text-white" : "bg-aura-primary-soft text-aura-primary"}`}>
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-sm text-aura-text">{linkedPage.eyebrow}</strong>
                    <span className="mt-1 block text-xs text-aura-text-muted">{active ? copy.common.active : copy.common.explore}</span>
                  </span>
                  {!active && <ArrowRight className="ml-auto h-4 w-4 shrink-0 text-aura-text-muted transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />}
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* Final CTA */}
      <section className="relative overflow-hidden bg-gradient-to-br from-[var(--aura-purple)] to-[var(--aura-purple-hover)] py-20 text-center md:py-24">
        <div className="pointer-events-none absolute -left-20 -top-20 h-72 w-72 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <div className="pointer-events-none absolute -bottom-24 -right-16 h-80 w-80 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
        <Container className="relative">
          <div className="mx-auto grid h-20 w-20 place-items-center rounded-full border border-white/40 bg-white/10 backdrop-blur" aria-hidden="true">
            <Workflow className="h-9 w-9 text-white" />
          </div>
          <h2 className="mx-auto mt-7 max-w-3xl font-display text-[clamp(2.2rem,4.6vw,4rem)] leading-[1.05] tracking-[-.03em] text-white">{copy.hero.title}</h2>
          <p className="mx-auto mt-4 max-w-xl text-sm leading-7 text-white/85">{copy.hero.body}</p>
          <Link href={CTA_LINKS.demo} className="group mt-8 inline-flex min-h-12 items-center gap-2 rounded-full bg-white px-8 text-sm font-bold text-[var(--aura-purple)] shadow-[0_12px_30px_rgba(0,0,0,0.22)] transition-all hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0">
            {copy.common.demo}
            <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
          </Link>
        </Container>
      </section>
    </>
  );
}
