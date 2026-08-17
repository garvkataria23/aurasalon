"use client";

import Link from "next/link";
import { ArrowRight, Sparkles } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";

export function CTASection() {
  return (
    <section className="py-20 md:py-28 bg-white overflow-hidden border-t border-[var(--aura-border)]">
      <Container>
        <div className="relative overflow-hidden rounded-[2rem] border border-[var(--aura-border)] bg-[var(--aura-lavender)] p-8 sm:p-12 md:p-16 lg:p-20 shadow-[var(--aura-shadow-lg)]">
          {/* Subtle decorative background glow */}
          <div
            className="absolute -right-24 -top-24 h-96 w-96 rounded-full bg-[var(--aura-purple)]/10 blur-3xl pointer-events-none"
            aria-hidden="true"
          />
          <div
            className="absolute -left-24 -bottom-24 h-96 w-96 rounded-full bg-white/40 blur-3xl pointer-events-none"
            aria-hidden="true"
          />

          <div className="relative z-10 mx-auto max-w-3xl text-center">
            {/* Badge */}
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--aura-border)] bg-white px-4 py-1.5 text-xs font-semibold text-[var(--aura-purple)] shadow-xs">
              <Sparkles className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
              Start Your Digital Transformation
            </div>

            {/* Headline */}
            <h2 className="text-[clamp(2.25rem,5.5vw,4.25rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              See what running your salon with Aura feels like.
            </h2>

            {/* Supporting copy */}
            <p className="mt-5 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Book a personalised demo and see how Aura can simplify your day-to-day operations.
            </p>

            {/* Buttons */}
            <div className="mt-8 flex flex-col items-center justify-center gap-3 sm:flex-row">
              <Link
                href={CTA_LINKS.demo}
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-8 text-sm font-semibold text-white shadow-[var(--aura-shadow-sm)] transition-all duration-200 hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-md)]"
              >
                Book a Demo
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </Link>
              <Link
                href="/contact"
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] border border-[var(--aura-border)] bg-white px-8 text-sm font-semibold text-[var(--aura-heading)] transition-all duration-200 hover:border-[var(--aura-purple)] hover:text-[var(--aura-purple)] hover:bg-[var(--aura-purple-soft)]"
              >
                Contact Us
              </Link>
            </div>

            {/* Sub-meta reassurance */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-x-6 gap-y-2 text-xs font-medium text-[var(--aura-muted)]">
              <span>Personalised 1-on-1 walkthrough</span>
              <span aria-hidden="true">&bull;</span>
              <span>Full data migration support</span>
              <span aria-hidden="true">&bull;</span>
              <span>Quick 15-minute setup</span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
