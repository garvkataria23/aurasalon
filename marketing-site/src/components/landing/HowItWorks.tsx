"use client";

import { HOW_IT_WORKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";

function StepCard({ step, index, total }: { step: typeof HOW_IT_WORKS[number]; index: number; total: number }) {
  return (
    <div className="relative text-center group">
      {/* Step Number Badge */}
      <div className="relative inline-flex items-center justify-center mb-6">
        <div className="grid h-14 w-14 place-items-center rounded-2xl bg-[var(--aura-purple)] text-white text-xl font-bold shadow-[var(--aura-shadow-sm)] transition-transform duration-300 group-hover:scale-105">
          {step.step}
        </div>
      </div>

      <h3 className="text-lg font-bold text-[var(--aura-heading)] mb-2.5">{step.title}</h3>
      <p className="text-xs sm:text-sm text-[var(--aura-body)] leading-relaxed max-w-xs mx-auto">
        {step.description}
      </p>

      {/* Connector line */}
      {index < total - 1 && (
        <div className="hidden md:block absolute top-7 left-[calc(50%+36px)] w-[calc(100%-72px)] h-px" aria-hidden="true">
          <div className="h-full bg-gradient-to-r from-[var(--aura-purple)]/40 via-[var(--aura-border)] to-transparent" />
        </div>
      )}
    </div>
  );
}

export function HowItWorks() {
  return (
    <section className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]">
      <Container>
        <div className="mx-auto max-w-3xl text-center mb-16">
          <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
            Quick Onboarding
          </span>
          <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
            Up and running in minutes
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
            No complex hardware setup or lengthy staff training. Start taking appointments and billing immediately.
          </p>
        </div>

        <div className="grid md:grid-cols-3 gap-8 lg:gap-12 max-w-5xl mx-auto">
          {HOW_IT_WORKS.map((step, i) => (
            <StepCard key={step.step} step={step} index={i} total={HOW_IT_WORKS.length} />
          ))}
        </div>
      </Container>
    </section>
  );
}
