"use client";

import { useState } from "react";
import { Play, Sparkles, Magnet, LineChart, TrendingUp, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { LandingDecor } from "./LandingDecor";

export function ValuePillarsSection() {
  const [isPlaying, setIsPlaying] = useState(false);

  return (
    <section className="relative bg-[#FCFBF8] py-20 md:py-28 overflow-hidden">
      <LandingDecor variant="quiet" />
      <Container className="relative z-10">
        
        {/* Section Heading */}
        <div className="mx-auto max-w-3xl text-center">
          <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-3">
            The Best software in the industry
          </p>
          <h2 className="text-[clamp(2.2rem,4.8vw,3.6rem)] font-extrabold tracking-[-0.04em] text-[var(--aura-heading)] leading-[1.12]">
            Effortless Management, Unmatched Expansion
          </h2>
          <p className="mt-5 text-base md:text-lg text-[var(--aura-body)] leading-relaxed max-w-2xl mx-auto">
            Aura equips you with the tools to run your business smoothly and profitably. With multi-channel booking, customer loyalty features and easy lead management, we are your partner in scaling your business with precision and ease.
          </p>
        </div>

        {/* Video / Interactive Player Preview */}
        <div className="mt-14 mx-auto max-w-4xl">
          <div className="relative overflow-hidden rounded-3xl border border-[var(--aura-border)] bg-gradient-to-tr from-[#1E0D36] to-[#3B145E] p-6 sm:p-10 text-white shadow-[0_24px_70px_rgba(45,18,77,0.18)]">
            
            {/* Ambient inner glow */}
            <div className="absolute -right-20 -top-20 h-64 w-64 rounded-full bg-purple-500/30 blur-3xl" />
            <div className="absolute -left-20 -bottom-20 h-64 w-64 rounded-full bg-amber-500/20 blur-3xl" />

            <div className="relative z-10 flex flex-col md:flex-row items-center justify-between gap-8">
              <div className="max-w-md">
                <div className="inline-flex items-center gap-2 rounded-full bg-white/10 px-3.5 py-1 text-xs font-semibold text-purple-200 backdrop-blur-md mb-4">
                  <Sparkles className="h-3.5 w-3.5 text-amber-300" />
                  Aura Product Tour — 2 min
                </div>
                <h3 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white leading-snug">
                  See how top salons scale with Aura OS.
                </h3>
                <p className="mt-3 text-sm text-purple-200/80 leading-relaxed">
                  Watch how 3-click POS billing, automated WhatsApp reminders, and multi-chair staff scheduling work seamlessly together.
                </p>
                <div className="mt-6 flex flex-wrap items-center gap-4 text-xs text-white/80">
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> GST Invoicing
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> WhatsApp AI
                  </span>
                  <span className="flex items-center gap-1.5 font-medium">
                    <CheckCircle2 className="h-4 w-4 text-emerald-400" /> Realtime Sync
                  </span>
                </div>
              </div>

              {/* Play Button Card */}
              <div className="shrink-0 flex flex-col items-center gap-3">
                <button
                  type="button"
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="group relative flex h-24 w-24 sm:h-28 sm:w-28 items-center justify-center rounded-full bg-white text-[#2D124D] shadow-[0_16px_40px_rgba(0,0,0,0.35)] transition-all duration-300 hover:scale-105 hover:bg-purple-50"
                  aria-label="Play product video"
                >
                  <span className="absolute inset-0 rounded-full bg-white/40 animate-ping" />
                  <Play className="h-10 w-10 fill-[#2D124D] ml-1 transition-transform group-hover:scale-110" />
                </button>
                <span className="text-xs font-semibold uppercase tracking-wider text-purple-200">
                  {isPlaying ? "Playing Overview" : "Click to Preview"}
                </span>
              </div>
            </div>

          </div>
        </div>

        {/* 3 Core Value Pillar Cards */}
        <div className="mt-14 grid gap-8 sm:grid-cols-2 lg:grid-cols-3 max-w-6xl mx-auto">
          
          {/* Pillar 1: Enhance Customer Engagement */}
          <div className="group rounded-3xl border border-[var(--aura-border)] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/30 hover:shadow-[0_20px_45px_rgba(111,79,216,0.08)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-purple-50 border border-purple-100 text-[var(--aura-purple)] transition-colors group-hover:bg-[var(--aura-purple)] group-hover:text-white">
              <Magnet className="h-8 w-8" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-[var(--aura-heading)]">
              Enhance Customer Engagement
            </h3>
            <p className="mt-2 text-sm text-[var(--aura-body)] leading-relaxed">
              Loyalty programs, smart packages, memberships, and digital wallet credits that keep your clients excited and recurring.
            </p>
            <ul className="mt-4 space-y-2 border-t border-[var(--aura-border)] pt-4 text-xs font-medium text-[var(--aura-heading)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Automated loyalty points per ₹100 spent
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Tiered VIP memberships with instant perks
              </li>
            </ul>
          </div>

          {/* Pillar 2: Drive Business With Data */}
          <div className="group rounded-3xl border border-[var(--aura-border)] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/30 hover:shadow-[0_20px_45px_rgba(111,79,216,0.08)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 transition-colors group-hover:bg-indigo-600 group-hover:text-white">
              <LineChart className="h-8 w-8" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-[var(--aura-heading)]">
              Drive Business With Data
            </h3>
            <p className="mt-2 text-sm text-[var(--aura-body)] leading-relaxed">
              Get real-time insights and track progress, staff time, product consumption, and net profit margins across all chairs.
            </p>
            <ul className="mt-4 space-y-2 border-t border-[var(--aura-border)] pt-4 text-xs font-medium text-[var(--aura-heading)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Chair occupancy &amp; service turnaround metrics
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Recipe-level inventory consumption tracking
              </li>
            </ul>
          </div>

          {/* Pillar 3: Increase Revenue */}
          <div className="group rounded-3xl border border-[var(--aura-border)] bg-white p-8 shadow-[0_4px_20px_rgba(0,0,0,0.03)] transition-all duration-300 hover:-translate-y-1 hover:border-[var(--aura-purple)]/30 hover:shadow-[0_20px_45px_rgba(111,79,216,0.08)]">
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-emerald-50 border border-emerald-100 text-emerald-600 transition-colors group-hover:bg-emerald-600 group-hover:text-white">
              <TrendingUp className="h-8 w-8" />
            </div>
            <h3 className="mt-6 text-xl font-bold text-[var(--aura-heading)]">
              Increase Revenue
            </h3>
            <p className="mt-2 text-sm text-[var(--aura-body)] leading-relaxed">
              Automate marketing, boost average ticket size, and recover lost clients with 2-way WhatsApp nudges and smart upsells.
            </p>
            <ul className="mt-4 space-y-2 border-t border-[var(--aura-border)] pt-4 text-xs font-medium text-[var(--aura-heading)]">
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Automated birthday &amp; anniversary triggers
              </li>
              <li className="flex items-center gap-2">
                <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                Smart waitlist auto-fills last-minute cancellations
              </li>
            </ul>
          </div>

        </div>

      </Container>
    </section>
  );
}
