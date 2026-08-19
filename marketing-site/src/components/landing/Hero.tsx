"use client";

import Link from "next/link";
import Image from "next/image";
import { ArrowRight, TrendingUp } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { LandingDecor } from "./LandingDecor";

export function Hero() {
  const { t } = useLanguage();

  return (
    <section className="relative overflow-hidden bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
      <LandingDecor variant="hero" />
      <Container size="wide" className="relative z-10">
        <div className="flex flex-col items-center pt-10 pb-16 text-center md:pt-16 md:pb-24 lg:pt-20 lg:pb-32">
          {/* Badge */}
          <div
            className="mb-6 inline-flex items-center rounded-full bg-[var(--aura-lavender)] px-4 py-1.5 text-xs font-semibold text-[var(--aura-purple)]"
            style={{ animation: "fadeInUp 0.5s ease-out both" }}
          >
            {t("home.hero.badge")}
          </div>

          {/* Headline */}
          <h1
            className="max-w-4xl text-[clamp(2.5rem,6vw,5rem)] font-bold leading-[1.05] tracking-[-0.04em] text-[var(--aura-heading)]"
            style={{ animation: "fadeInUp 0.55s ease-out 0.08s both" }}
          >
            {t("home.hero.title.line1")}
            <br />
            <span className="text-[var(--aura-purple)]">{t("home.hero.title.highlight")}</span>
          </h1>

          {/* Supporting copy */}
          <p
            className="mt-6 max-w-2xl text-lg leading-relaxed text-[var(--aura-body)] md:text-xl md:leading-8"
            style={{ animation: "fadeInUp 0.55s ease-out 0.16s both" }}
          >
            {t("home.hero.subtitle")}
          </p>

          {/* CTAs */}
          <div
            className="mt-8 flex w-full max-w-md flex-col gap-4 sm:w-auto sm:max-w-none sm:flex-row sm:items-center"
            style={{ animation: "fadeInUp 0.55s ease-out 0.24s both" }}
          >
            <Link
              href={CTA_LINKS.demo}
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl bg-[var(--aura-purple)] px-8 py-3.5 text-base font-semibold text-white shadow-[var(--aura-shadow-md)] transition-all duration-300 hover:-translate-y-1 hover:bg-[var(--aura-purple-hover)] hover:shadow-[var(--aura-shadow-lg)]"
            >
              {t("home.hero.cta.primary")}
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </Link>
            <Link
              href="/features"
              className="inline-flex h-13 items-center justify-center gap-2 rounded-xl border border-white/50 bg-white/30 px-8 py-3.5 text-base font-semibold text-[var(--aura-heading)] shadow-[0_12px_32px_rgba(109,63,209,0.12)] backdrop-blur-md ring-1 ring-white/35 transition-all duration-300 hover:border-white/70 hover:bg-white/45 hover:-translate-y-1 hover:shadow-[0_18px_44px_rgba(109,63,209,0.16)]"
            >
              {t("home.hero.cta.secondary")}
            </Link>
          </div>

          {/* Trust Micro-copy */}
          <div
            className="mt-6 flex flex-wrap items-center justify-center gap-x-3 gap-y-2 text-sm font-medium text-[var(--aura-muted)]"
            style={{ animation: "fadeInUp 0.55s ease-out 0.3s both" }}
          >
            <span>No credit card required</span>
            <span className="h-1 w-1 rounded-full bg-[var(--aura-border)]" aria-hidden="true" />
            <span>15-min setup</span>
            <span className="h-1 w-1 rounded-full bg-[var(--aura-border)]" aria-hidden="true" />
            <span>Free migration</span>
          </div>

          {/* Dashboard Screenshot in Browser Frame */}
          <div
            className="relative mt-12 w-full max-w-5xl md:mt-16 lg:mt-20"
            style={{ animation: "fadeInUp 0.65s ease-out 0.36s both" }}
          >
            {/* Subtle lavender glow behind */}
            <div className="absolute left-1/2 top-1/2 h-[500px] w-[80%] max-w-4xl -translate-x-1/2 -translate-y-1/2 rounded-full bg-[var(--aura-lavender-strong)] opacity-50 blur-[100px] pointer-events-none" aria-hidden="true" />

            {/* Floating Metric Card 1 (Left) */}
            <div className="float-card absolute -left-8 top-12 z-20 hidden items-center gap-3 rounded-2xl border border-white/50 bg-white/30 p-4 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35 lg:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-50 text-green-600">
                <TrendingUp className="h-5 w-5" />
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--aura-heading)]">+42% Repeat Visits</p>
              </div>
            </div>

            {/* Floating Metric Card 2 (Right) */}
            <div className="float-card-delayed absolute -right-8 bottom-24 z-20 hidden items-center gap-3 rounded-2xl border border-white/50 bg-white/30 p-4 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35 lg:flex">
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[var(--aura-lavender)] text-[var(--aura-purple)] text-lg font-bold">
                ₹
              </div>
              <div>
                <p className="text-sm font-semibold text-[var(--aura-heading)]">₹0 Commission on Bookings</p>
              </div>
            </div>

            {/* Browser Chrome */}
            <div className="relative z-10 overflow-hidden rounded-[1.7rem] border border-white/50 bg-white/30 shadow-[0_24px_80px_rgba(109,63,209,0.16)] backdrop-blur-xl ring-1 ring-white/35">
              {/* Title bar */}
              <div className="flex items-center gap-2 border-b border-white/45 bg-white/25 px-4 py-3 backdrop-blur-sm">
                <div className="flex gap-1.5" aria-hidden="true">
                  <span className="h-3 w-3 rounded-full bg-[#FF5F57]" />
                  <span className="h-3 w-3 rounded-full bg-[#FFBD2E]" />
                  <span className="h-3 w-3 rounded-full bg-[#28CA42]" />
                </div>
                <div className="mx-auto flex items-center gap-2 rounded-lg bg-white/35 border border-white/55 px-4 py-1.5 text-xs text-[var(--aura-muted)] shadow-inner backdrop-blur-sm">
                  <svg className="h-3.5 w-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2} aria-hidden="true"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11c0 3.517-1.009 6.799-2.753 9.571m-3.44-2.04l.054-.09A13.916 13.916 0 008 11a4 4 0 118 0c0 1.017-.07 2.019-.203 3m-2.118 6.844A21.88 21.88 0 0015.171 17m3.839 1.132c.645-2.266.99-4.659.99-7.132A8 8 0 008 4.07M3 15.364c.64-1.319 1-2.8 1-4.364 0-1.457.39-2.823 1.07-4" /></svg>
                  app.aurasalon.com
                </div>
              </div>

              {/* Dashboard content */}
              <div className="relative bg-white/20">
                <Image
                  src="/media/home-product-demo.svg"
                  alt={t("home.hero.dashboardAlt")}
                  width={1600}
                  height={1000}
                  className="w-full h-auto object-cover"
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
