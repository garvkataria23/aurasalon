"use client";

import Link from "next/link";
import { ArrowRight, Sparkles, Check } from "lucide-react";
import { CTA_LINKS } from "@/lib/constants";
import { Container } from "@/components/ui/Container";
import { useEffect, useRef, useState } from "react";
import { LandingDecor } from "./LandingDecor";

function useReveal() {
  const ref = useRef<HTMLDivElement>(null);
  const [visible, setVisible] = useState(false);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    const obs = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          setVisible(true);
          obs.disconnect();
        }
      },
      { threshold: 0.12, rootMargin: "0px 0px -40px 0px" }
    );
    obs.observe(el);
    return () => obs.disconnect();
  }, []);
  return { ref, visible };
}

export function CTASection() {
  const { ref, visible } = useReveal();

  return (
    <section className="relative py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF] overflow-hidden">
      <LandingDecor variant="cta" />
      <Container className="relative z-10">
        <div
          ref={ref}
          className={`reveal relative overflow-hidden rounded-[2rem] border border-white/50 bg-white/30 p-8 sm:p-12 md:p-16 lg:p-20 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35 transition-all duration-700 ease-out ${
            visible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8"
          }`}
        >
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
            <div className="mb-6 inline-flex items-center gap-1.5 rounded-full border border-[var(--aura-border)] bg-white px-4 py-1.5 text-xs font-semibold text-[var(--aura-purple)] shadow-sm">
              <Sparkles className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
              Get Started Today
            </div>

            {/* Headline */}
            <h2 className="text-[clamp(2.25rem,5.5vw,4.25rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Ready to transform how you run your salon?
            </h2>

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
                className="inline-flex h-12 w-full sm:w-auto items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] border border-[var(--aura-border)] bg-white px-8 text-sm font-semibold text-[var(--aura-heading)] transition-all duration-200 hover:border-[var(--aura-purple)] hover:text-[var(--aura-purple)] hover:bg-white/80"
              >
                Contact Us
              </Link>
            </div>

            {/* Feature Pills */}
            <div className="mt-8 flex flex-wrap items-center justify-center gap-3 text-xs font-medium text-[var(--aura-body)]">
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-[var(--aura-border)] px-3 py-1.5 backdrop-blur-sm shadow-sm">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Free 15-min demo
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-[var(--aura-border)] px-3 py-1.5 backdrop-blur-sm shadow-sm">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                Full data migration
              </span>
              <span className="inline-flex items-center gap-1.5 rounded-full bg-white/80 border border-[var(--aura-border)] px-3 py-1.5 backdrop-blur-sm shadow-sm">
                <Check className="h-3.5 w-3.5 text-emerald-500" />
                No credit card needed
              </span>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
