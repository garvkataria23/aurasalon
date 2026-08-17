"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";

export function Hero() {
  return (
    <section className="relative overflow-hidden bg-white">
      <Container size="wide" className="relative z-10">
        <div className="flex flex-col items-center pt-10 pb-16 text-center md:pt-16 md:pb-24 lg:pt-20 lg:pb-28">
          {/* Badge */}
          <div
            className="mb-6 inline-flex items-center rounded-full border border-[var(--aura-border)] bg-[var(--aura-off-white)] px-4 py-1.5 text-xs font-medium text-[var(--aura-body)]"
            style={{ animation: "fadeInUp 0.5s ease-out both" }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--aura-purple)]" aria-hidden="true" />
            Salon management, finally simplified
          </div>

          {/* Headline */}
          <h1
            className="max-w-4xl text-[clamp(2.25rem,5.8vw,4.75rem)] font-bold leading-[1.08] tracking-[-0.03em] text-[var(--aura-heading)]"
            style={{ animation: "fadeInUp 0.55s ease-out 0.08s both" }}
          >
            Run your entire salon.
            <br />
            <span className="text-[var(--aura-purple)]">From one beautiful system.</span>
          </h1>

          {/* Supporting copy */}
          <p
            className="mt-6 max-w-2xl text-base leading-relaxed text-[var(--aura-body)] md:text-lg md:leading-8"
            style={{ animation: "fadeInUp 0.55s ease-out 0.16s both" }}
          >
            Manage appointments, billing, staff, clients, inventory, memberships,
            marketing and business performance from one intelligent platform.
          </p>

          {/* CTAs */}
          <div
            className="mt-8 flex flex-col gap-3 sm:flex-row sm:items-center"
            style={{ animation: "fadeInUp 0.55s ease-out 0.24s both" }}
          >
            <Link
              href={CTA_LINKS.demo}
              className="inline-flex items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] bg-[var(--aura-purple)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--aura-shadow-sm)] transition-all duration-200 hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-md)]"
            >
              Book a Demo
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/features"
              className="inline-flex items-center justify-center gap-2 rounded-[var(--aura-radius-btn)] border border-[var(--aura-border)] bg-white px-6 py-3 text-sm font-semibold text-[var(--aura-heading)] transition-all duration-200 hover:border-[var(--aura-purple)] hover:text-[var(--aura-purple)] hover:bg-[var(--aura-purple-soft)]"
            >
              Explore Features
            </Link>
          </div>

          {/* Dashboard Screenshot in Browser Frame */}
          <div
            className="mt-14 w-full max-w-5xl md:mt-16 lg:mt-20"
            style={{ animation: "fadeInUp 0.65s ease-out 0.35s both" }}
          >
            {/* Subtle lavender glow behind */}
            <div className="absolute left-1/2 -translate-x-1/2 top-auto w-[80%] max-w-4xl h-[400px] rounded-full bg-[var(--aura-lavender-strong)] opacity-40 blur-[100px] pointer-events-none" aria-hidden="true" />

            {/* Browser Chrome */}
            <div className="relative rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-xl)] overflow-hidden">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-4 py-3">
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <span className="h-3 w-3 rounded-full bg-[#28CA42]" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-lg bg-white border border-[var(--aura-border)] px-3 py-1 text-xs text-[var(--aura-muted)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                  app.aurasalon.com
                </div>
              </div>

              {/* Dashboard content */}
              <div className="relative bg-[var(--aura-off-white)]">
                <Image
                  src="/media/home-product-demo.svg"
                  alt="Aura dashboard showing connected booking, scheduling, checkout and owner review workflow"
                  width={1600}
                  height={1000}
                  className="w-full h-auto"
                  sizes="(max-width: 768px) 100vw, (max-width: 1200px) 85vw, 1024px"
                  priority
                />
              </div>
            </div>
          </div>
        </div>
      </Container>
    </section>
  );
}
