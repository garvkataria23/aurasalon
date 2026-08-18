"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";

export function Hero() {
  const { t } = useLanguage();
  const proofPoints = ["GST billing", "Online booking", "Staff & inventory"];

  return (
    <section className="relative overflow-hidden bg-[linear-gradient(180deg,#fff_0%,#fff_62%,var(--aura-off-white)_100%)]">
      <Container size="wide" className="relative z-10">
        <div className="flex flex-col items-center pt-8 pb-14 text-center md:pt-12 md:pb-20 lg:pt-16 lg:pb-24">
          {/* Badge */}
          <div
            className="mb-5 inline-flex items-center rounded-full border border-[var(--aura-border)] bg-white/90 px-4 py-1.5 text-xs font-medium text-[var(--aura-body)] shadow-[var(--aura-shadow-xs)]"
            style={{ animation: "fadeInUp 0.5s ease-out both" }}
          >
            <span className="mr-2 inline-block h-1.5 w-1.5 rounded-full bg-[var(--aura-purple)]" aria-hidden="true" />
            {t("home.hero.badge")}
          </div>

          {/* Headline */}
          <h1
            className="max-w-4xl text-[clamp(2.35rem,5.6vw,4.6rem)] font-semibold leading-[1.06] tracking-[-0.045em] text-[var(--aura-heading)]"
            style={{ animation: "fadeInUp 0.55s ease-out 0.08s both" }}
          >
            {t("home.hero.title.line1")}
            <br />
            <span className="text-[var(--aura-purple)]">{t("home.hero.title.highlight")}</span>
          </h1>

          {/* Supporting copy */}
          <p
            className="mt-5 max-w-2xl text-base leading-7 text-[var(--aura-body)] md:text-lg md:leading-8"
            style={{ animation: "fadeInUp 0.55s ease-out 0.16s both" }}
          >
            {t("home.hero.subtitle")}
          </p>

          {/* CTAs */}
          <div
            className="mt-7 flex w-full max-w-md flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row sm:items-center"
            style={{ animation: "fadeInUp 0.55s ease-out 0.24s both" }}
          >
            <Link
              href={CTA_LINKS.demo}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-[var(--aura-purple)] px-6 py-3 text-sm font-semibold text-white shadow-[var(--aura-shadow-sm)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-md)]"
            >
              {t("home.hero.cta.primary")}
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/features"
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full border border-[var(--aura-border)] bg-white px-6 py-3 text-sm font-semibold text-[var(--aura-heading)] transition-all duration-300 hover:border-[var(--aura-border-strong)] hover:bg-[var(--aura-off-white)]"
            >
              {t("home.hero.cta.secondary")}
            </Link>
          </div>

          <div
            className="mt-5 flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs font-medium text-[var(--aura-muted)]"
            style={{ animation: "fadeInUp 0.55s ease-out 0.3s both" }}
          >
            {proofPoints.map((point) => (
              <span key={point} className="inline-flex items-center gap-2">
                <span className="h-1.5 w-1.5 rounded-full bg-[var(--aura-purple)]/45" aria-hidden="true" />
                {point}
              </span>
            ))}
          </div>

          {/* Dashboard Screenshot in Browser Frame */}
          <div
            className="mt-10 w-full max-w-5xl md:mt-12 lg:mt-14"
            style={{ animation: "fadeInUp 0.65s ease-out 0.36s both" }}
          >
            {/* Subtle lavender glow behind */}
            <div className="absolute left-1/2 top-auto h-[340px] w-[74%] max-w-4xl -translate-x-1/2 rounded-full bg-[var(--aura-lavender-strong)] opacity-35 blur-[90px] pointer-events-none" aria-hidden="true" />

            {/* Browser Chrome */}
            <div className="relative overflow-hidden rounded-[1.7rem] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-lg)] ring-1 ring-white/80">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-[var(--aura-border)] bg-white px-4 py-3">
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <span className="h-3 w-3 rounded-full bg-[#28CA42]" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-full bg-[var(--aura-off-white)] border border-[var(--aura-border)] px-3 py-1 text-xs text-[var(--aura-muted)]">
                  <svg className="h-3 w-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                  app.aurasalon.com
                </div>
              </div>

              {/* Dashboard content */}
              <div className="relative bg-white">
                <Image
                  src="/media/home-product-demo.svg"
                  alt={t("home.hero.dashboardAlt")}
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
