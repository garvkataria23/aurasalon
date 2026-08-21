"use client";

import Link from "next/link";
import { Apple, Play, CheckCircle2 } from "lucide-react";
import { Container } from "@/components/ui/Container";

export function AppDownloadSection() {
  return (
    <section className="relative bg-[#FCFBF8] py-20 md:py-28 overflow-hidden border-t border-[var(--aura-border)]">
      <Container className="relative z-10">
        <div className="grid items-center gap-12 lg:grid-cols-2 max-w-6xl mx-auto">
          
          {/* Left Column: Text & App Store Badges */}
          <div>
            <p className="font-serif italic text-base md:text-lg text-[var(--aura-purple)] font-medium mb-3">
              Download App
            </p>
            <h2 className="text-[clamp(2.2rem,4.8vw,3.6rem)] font-extrabold tracking-[-0.04em] text-[var(--aura-heading)] leading-[1.12]">
              Scale Your Salon Business Everywhere
            </h2>
            <p className="mt-2 text-xl font-medium text-[var(--aura-purple)]">
              Aura spells the growth of your brand.
            </p>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed">
              Run your salon on the go with dedicated mobile apps for Owners, Managers, Stylists, and Clients. Access live appointment rosters, real-time GST sales, staff commissions, and inventory alerts from your pocket.
            </p>

            {/* Feature Bullets */}
            <div className="mt-6 space-y-3">
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-[var(--aura-heading)]">
                  Owner App: Real-time revenue, chair occupancy &amp; audit reports
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-[var(--aura-heading)]">
                  Stylist App: Daily schedule, service turns &amp; transparent commissions
                </span>
              </div>
              <div className="flex items-center gap-3">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-emerald-100 text-emerald-700 text-xs">
                  <CheckCircle2 className="h-4 w-4" />
                </span>
                <span className="text-sm font-semibold text-[var(--aura-heading)]">
                  Client Self-Service: 24/7 Pay-at-salon booking &amp; loyalty wallet
                </span>
              </div>
            </div>

            {/* App Store Buttons */}
            <div className="mt-8 flex flex-wrap items-center gap-4">
              {/* Google Play */}
              <Link
                href="/demo"
                className="inline-flex items-center gap-3 rounded-2xl bg-[#18181B] px-6 py-3.5 text-white shadow-md transition-all duration-300 hover:bg-zinc-800 hover:-translate-y-0.5"
              >
                <Play className="h-6 w-6 fill-white" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400">Get it on</p>
                  <p className="text-sm font-bold leading-none">Google Play</p>
                </div>
              </Link>

              {/* App Store */}
              <Link
                href="/demo"
                className="inline-flex items-center gap-3 rounded-2xl bg-[#18181B] px-6 py-3.5 text-white shadow-md transition-all duration-300 hover:bg-zinc-800 hover:-translate-y-0.5"
              >
                <Apple className="h-6 w-6 fill-white" />
                <div className="text-left">
                  <p className="text-[10px] uppercase font-medium tracking-wider text-zinc-400">Download on the</p>
                  <p className="text-sm font-bold leading-none">App Store</p>
                </div>
              </Link>
            </div>
          </div>

          {/* Right Column: Phone Mockup Frame */}
          <div className="relative flex items-center justify-center">
            {/* Ambient Background glow */}
            <div className="absolute h-80 w-80 rounded-full bg-[var(--aura-purple)]/15 blur-3xl" />

            {/* Smartphone Shell */}
            <div className="relative z-10 w-full max-w-[320px] rounded-[2.8rem] border-[10px] border-[#1D1B20] bg-[#140C24] p-4 text-white shadow-[0_30px_90px_rgba(0,0,0,0.22)]">
              {/* Speaker / Notch */}
              <div className="mx-auto mb-4 h-4 w-28 rounded-full bg-[#1D1B20]" />

              {/* App Screen Content */}
              <div className="space-y-4">
                {/* Header */}
                <div className="flex items-center justify-between border-b border-white/10 pb-3">
                  <div className="flex items-center gap-2">
                    <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-[var(--aura-purple)] text-xs font-bold">A</span>
                    <div>
                      <p className="text-xs font-bold">Aura Staff App</p>
                      <p className="text-[9px] text-purple-200">Hi, Ananya (Lead Stylist)</p>
                    </div>
                  </div>
                  <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                </div>

                {/* Day Summary */}
                <div className="rounded-xl bg-white/10 p-3 backdrop-blur-md">
                  <div className="flex items-center justify-between text-[11px] text-purple-200">
                    <span>Today&apos;s Target</span>
                    <span className="font-bold text-amber-300">₹8,500 / ₹10,000</span>
                  </div>
                  <div className="mt-2 h-1.5 w-full rounded-full bg-white/15 overflow-hidden">
                    <div className="h-full w-[85%] bg-gradient-to-r from-purple-400 to-amber-300 rounded-full" />
                  </div>
                </div>

                {/* Next Appointment Card */}
                <div className="rounded-xl border border-purple-400/30 bg-purple-900/30 p-3">
                  <div className="flex items-center justify-between text-[10px] text-purple-200 mb-1">
                    <span className="font-semibold text-emerald-300">NEXT IN 15 MIN</span>
                    <span>11:30 AM</span>
                  </div>
                  <p className="text-xs font-bold text-white">Carla Watson</p>
                  <p className="text-[10px] text-white/70">Keratin Treatment &amp; Blowdry</p>
                  <div className="mt-2 flex items-center justify-between text-[10px] border-t border-white/10 pt-2 text-purple-200">
                    <span>Est. Commission</span>
                    <span className="font-bold text-emerald-400">+₹450</span>
                  </div>
                </div>

                {/* Quick actions */}
                <div className="grid grid-cols-2 gap-2 text-center text-[10px]">
                  <div className="rounded-lg bg-white/5 p-2 border border-white/10">
                    <p className="font-bold text-white">4 Bookings</p>
                    <p className="text-[9px] text-white/60">Scheduled</p>
                  </div>
                  <div className="rounded-lg bg-white/5 p-2 border border-white/10">
                    <p className="font-bold text-white">₹1,850</p>
                    <p className="text-[9px] text-emerald-400">Earned Today</p>
                  </div>
                </div>

                {/* Bottom nav */}
                <div className="flex items-center justify-around border-t border-white/10 pt-2 text-[9px] text-purple-200">
                  <span className="font-bold text-white">Schedule</span>
                  <span>Queue</span>
                  <span>Earnings</span>
                  <span>Profile</span>
                </div>
              </div>

              {/* Bottom bar */}
              <div className="mx-auto mt-4 h-1 w-20 rounded-full bg-white/30" />
            </div>

          </div>

        </div>
      </Container>
    </section>
  );
}
