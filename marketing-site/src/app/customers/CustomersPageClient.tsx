"use client";

import { ArrowRight, CheckCircle2, Fingerprint, Quote, ShieldCheck, Sparkles, TrendingUp, Workflow } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { SectionHeading } from "@/components/ui/SectionHeading";
import { GridBackground } from "@/components/ui/GridBackground";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { CTA_LINKS } from "@/lib/constants";
import { useScrollReveal } from "@/hooks/useScrollReveal";

const EVIDENCE_ITEMS = [
  { key: "identity", icon: Fingerprint },
  { key: "workflow", icon: Workflow },
  { key: "outcome", icon: TrendingUp },
  { key: "permission", icon: ShieldCheck },
] as const;

const WORKFLOW_KEYS = ["appointments", "customer", "pos", "inventory"] as const;

export default function CustomersPage() {
  const { t } = useLanguage();
  const reveal = useScrollReveal();
  return (
    <div ref={reveal as React.RefObject<HTMLDivElement | null>} className="overflow-x-clip">
      <section className="relative overflow-hidden bg-[linear-gradient(135deg,#FFFDFB_0%,#F8F4FF_42%,#ECE4FF_100%)] pb-16 pt-28 md:pb-24 md:pt-36">
        <GridBackground className="opacity-25" />
        <div className="absolute -left-24 top-24 h-80 w-80 rounded-full bg-[var(--aura-purple)]/12 blur-3xl" aria-hidden="true" />
        <div className="absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-[#B89CFF]/20 blur-3xl" aria-hidden="true" />
        <Container size="narrow" className="relative z-10">
          <div className="fade-in-up mx-auto max-w-2xl text-center">
            <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/15 bg-white/75 px-4 py-2 text-xs font-bold uppercase tracking-[.16em] text-[var(--aura-purple)] shadow-[0_10px_30px_rgba(111,79,216,0.08)] backdrop-blur-md">
              <Sparkles className="h-3.5 w-3.5" aria-hidden="true" />
              {t("customers.badge")}
            </span>
            <h1 className="text-balance text-[clamp(2.5rem,6vw,4.25rem)] font-bold leading-[1.02] tracking-[-0.05em] text-[var(--aura-heading)]">
              {t("customerProof.title")}
            </h1>
            <p className="mx-auto mt-5 max-w-xl text-pretty text-base leading-8 text-[var(--aura-body)] md:text-lg">
              {t("customerProof.body")}
            </p>
            <div className="mt-8 flex flex-col items-center justify-center gap-3 text-sm font-semibold text-[var(--aura-heading)] sm:flex-row">
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-[var(--aura-shadow-sm)]">
                <ShieldCheck className="h-4 w-4 text-[var(--aura-purple)]" aria-hidden="true" /> Verified stories only
              </span>
              <span className="inline-flex items-center gap-2 rounded-full bg-white/80 px-4 py-2 shadow-[var(--aura-shadow-sm)]">
                <Quote className="h-4 w-4 text-[var(--aura-purple)]" aria-hidden="true" /> No fake metrics
              </span>
            </div>
          </div>
        </Container>
      </section>

      <section className="bg-[var(--aura-off-white)] py-14 md:py-24">
        <Container>
          <div className="reveal-stagger mx-auto grid max-w-5xl gap-5 sm:grid-cols-2">
            {EVIDENCE_ITEMS.map(({ key, icon: Icon }, index) => (
              <article
                key={key}
                className="group relative overflow-hidden rounded-[2rem] border border-white/80 bg-white/85 p-7 shadow-[0_18px_60px_rgba(72,45,151,0.08)] backdrop-blur-xl transition-all duration-300 hover:-translate-y-1 hover:bg-white hover:shadow-[0_28px_80px_rgba(72,45,151,0.14)] motion-reduce:transition-none motion-reduce:hover:translate-y-0 sm:p-8"
              >
                <span
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-0 top-0 h-px bg-[linear-gradient(90deg,transparent,rgba(111,79,216,0.4),transparent)] opacity-0 transition-opacity duration-300 group-hover:opacity-100 motion-reduce:transition-none"
                />
                <div className="flex items-start justify-between gap-4">
                  <div className="flex h-11 w-11 items-center justify-center rounded-2xl bg-[var(--aura-lavender)] text-[var(--aura-purple)] transition-colors duration-300 group-hover:bg-[var(--aura-lavender-strong)] motion-reduce:transition-none">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <span className="text-xs font-bold tabular-nums tracking-widest text-[var(--aura-muted)] transition-colors duration-300 group-hover:text-[var(--aura-purple)]/70 motion-reduce:transition-none">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                </div>
                <h2 className="mt-6 font-display text-xl font-semibold tracking-[-0.02em] text-[var(--aura-heading)] md:text-2xl">{t(`customerProof.${key}`)}</h2>
                <p className="mt-2.5 text-sm leading-7 text-[var(--aura-body)]">{t(`customerProof.${key}.body`)}</p>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="relative overflow-hidden bg-[linear-gradient(180deg,#FCFBF8_0%,#F3F0FF_55%,#EDE7FF_100%)] py-20 md:py-28">
        <Container>
          <SectionHeading badge={t("customers.cases")} title={t("customerProof.workflowTitle")} subtitle={t("customerProof.workflowBody")} />
          <div className="reveal-stagger mx-auto mt-12 grid max-w-5xl gap-5 md:grid-cols-2">
            {WORKFLOW_KEYS.map((item) => (
              <article
                key={item}
                data-case-study-slot={item}
                className="rounded-[1.75rem] border border-[var(--aura-border)] bg-white p-6 shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/35 hover:shadow-[0_22px_54px_-12px_rgba(111,79,216,0.28)] motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                <div className="flex items-start gap-4">
                  <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-emerald-500/12 ring-4 ring-emerald-500/5">
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" aria-hidden="true" />
                  </span>
                  <div className="min-w-0 flex-1">
                    <h3 className="font-semibold tracking-[-0.01em] text-[var(--aura-heading)]">{t(`tour.${item}`)}</h3>
                    <p className="mt-1.5 text-sm leading-7 text-[var(--aura-body)]">{t(`customerProof.${item}`)}</p>
                    <span className="mt-4 inline-flex items-center rounded-full bg-amber-400/15 px-3 py-1 text-[10px] font-bold uppercase tracking-wider text-amber-600 ring-1 ring-inset ring-amber-400/25">
                      {t("proof.pending")}
                    </span>
                  </div>
                </div>
              </article>
            ))}
          </div>
        </Container>
      </section>

      <section className="bg-white py-20">
        <Container>
          <div className="reveal relative mx-auto max-w-4xl overflow-hidden rounded-[2rem] bg-[linear-gradient(135deg,#2A173D_0%,#6F4FD8_58%,#A98AFF_100%)] px-6 py-12 text-center shadow-[0_28px_90px_rgba(72,45,151,0.28)] sm:py-14">
            <div className="absolute -right-16 -top-16 h-56 w-56 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
            <div className="absolute -bottom-20 -left-10 h-48 w-48 rounded-full bg-[#B89CFF]/30 blur-3xl" aria-hidden="true" />
            <div className="relative z-10 mx-auto max-w-md">
              <h2 className="text-balance text-2xl font-bold tracking-[-0.03em] text-white sm:text-3xl">{t("customers.ctaTitle")}</h2>
              <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-white/75 md:text-base">{t("customers.ctaBody")}</p>
              <a
                href={CTA_LINKS.trial}
                className="group mt-7 inline-flex min-h-11 items-center justify-center gap-2 rounded-full bg-white px-7 py-3 text-sm font-bold text-[var(--aura-purple)] shadow-lg transition-all duration-300 hover:-translate-y-0.5 hover:shadow-xl focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-white motion-reduce:transition-none motion-reduce:hover:translate-y-0"
              >
                {t("nav.trial")}
                <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
              </a>
            </div>
          </div>
        </Container>
      </section>
    </div>
  );
}
