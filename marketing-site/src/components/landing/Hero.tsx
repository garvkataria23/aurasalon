"use client";

import Link from "next/link";
import { ArrowRight, Star, Sparkles, CheckCircle2, TrendingUp, Calendar, UserCheck } from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { LandingDecor } from "./LandingDecor";

export function Hero() {

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-[#2D124D] via-[#431A72] to-[#FCFBF8] text-white pt-24 pb-16 md:pt-28 md:pb-24 lg:pt-32 lg:pb-28">
      {/* Background ambient lighting */}
      <div
        className="pointer-events-none absolute -top-40 left-1/2 -translate-x-1/2 h-[600px] w-[90%] max-w-6xl rounded-full bg-[radial-gradient(ellipse_at_center,rgba(168,85,247,0.22),transparent_70%)] blur-3xl"
        aria-hidden="true"
      />
      <LandingDecor variant="hero" />

      <Container size="wide" className="relative z-10">
        <div className="flex flex-col items-center text-center">
          
          {/* Rating Badges Strip */}
          <div
            className="mb-8 flex flex-wrap items-center justify-center gap-3 sm:gap-4"
            style={{ animation: "fadeInUp 0.5s ease-out both" }}
          >
            {/* Capterra */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-md shadow-sm">
              <span className="font-semibold text-xs text-white">Capterra</span>
              <div className="flex items-center gap-0.5" aria-label="4.8 out of 5 stars">
                <span className="text-xs font-bold text-amber-300">4.8</span>
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </div>

            {/* GetApp */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-md shadow-sm">
              <span className="font-semibold text-xs text-white">GetApp</span>
              <div className="flex items-center gap-0.5" aria-label="4.8 out of 5 stars">
                <span className="text-xs font-bold text-amber-300">4.8</span>
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </div>

            {/* Google Reviews */}
            <div className="inline-flex items-center gap-2 rounded-full border border-white/15 bg-white/10 px-3.5 py-1.5 backdrop-blur-md shadow-sm">
              <span className="font-semibold text-xs text-white">Google</span>
              <div className="flex items-center gap-0.5" aria-label="4.9 out of 5 stars">
                <span className="text-xs font-bold text-amber-300">4.9</span>
                <div className="flex text-amber-400">
                  {Array.from({ length: 5 }).map((_, i) => (
                    <Star key={i} className="h-3 w-3 fill-amber-400 text-amber-400" />
                  ))}
                </div>
              </div>
            </div>
          </div>

          {/* Main Headline */}
          <h1
            className="max-w-4xl text-[clamp(2.4rem,5.5vw,4.8rem)] font-extrabold leading-[1.08] tracking-[-0.04em] text-white"
            style={{ animation: "fadeInUp 0.55s ease-out 0.08s both" }}
          >
            Automate, Manage and Grow Your Salon &amp; Med Spas with{" "}
            <span className="bg-gradient-to-r from-amber-200 via-rose-200 to-purple-200 bg-clip-text text-transparent">
              Aura
            </span>
          </h1>

          {/* Subtitle */}
          <p
            className="mt-6 max-w-2xl text-base leading-relaxed text-white/80 md:text-lg md:leading-8"
            style={{ animation: "fadeInUp 0.55s ease-out 0.16s both" }}
          >
            Stop juggling, start scaling. Aura all-in-one salon software automates your entire business operations — bookings, GST billing, staff payroll, client CRM, and marketing — equipping you with the time and resources to reach new heights.
          </p>

          {/* Action CTAs */}
          <div
            className="mt-8 flex w-full max-w-md flex-col gap-3.5 sm:w-auto sm:max-w-none sm:flex-row sm:items-center"
            style={{ animation: "fadeInUp 0.55s ease-out 0.24s both" }}
          >
            <Link
              href={CTA_LINKS.demo}
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full bg-white px-8 text-base font-bold text-[#2D124D] shadow-[0_12px_36px_rgba(0,0,0,0.24)] transition-all duration-300 hover:-translate-y-0.5 hover:bg-purple-50 hover:shadow-[0_18px_48px_rgba(0,0,0,0.32)]"
            >
              BOOK A DEMO
              <ArrowRight className="h-4 w-4" aria-hidden="true" />
            </Link>
            <Link
              href="/features"
              className="inline-flex h-12 items-center justify-center gap-2 rounded-full border border-white/30 bg-white/10 px-8 text-base font-semibold text-white shadow-sm backdrop-blur-md transition-all duration-300 hover:-translate-y-0.5 hover:bg-white/20 hover:border-white/50"
            >
              Explore Features
            </Link>
          </div>

          {/* Trust Guarantees */}
          <div
            className="mt-6 flex flex-wrap items-center justify-center gap-x-4 gap-y-2 text-xs font-medium text-white/70"
            style={{ animation: "fadeInUp 0.55s ease-out 0.3s both" }}
          >
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              No credit card required
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden="true" />
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              15-min instant setup
            </span>
            <span className="h-1 w-1 rounded-full bg-white/30" aria-hidden="true" />
            <span className="flex items-center gap-1.5">
              <CheckCircle2 className="h-3.5 w-3.5 text-emerald-400" />
              Free 100% data migration
            </span>
          </div>

          {/* Interactive Hero Dashboard Frame */}
          <div
            className="relative mt-12 w-full max-w-5xl md:mt-16"
            style={{ animation: "fadeInUp 0.65s ease-out 0.36s both" }}
          >
            {/* Soft backdrop glow */}
            <div className="absolute left-1/2 top-1/2 h-[350px] w-[85%] -translate-x-1/2 -translate-y-1/2 rounded-full bg-purple-500/20 blur-[90px] pointer-events-none" />

            {/* Hero Main Card */}
            <div className="relative z-10 overflow-hidden rounded-3xl border border-white/20 bg-[#1D1236]/90 p-4 sm:p-6 md:p-8 shadow-[0_32px_90px_rgba(20,5,40,0.45)] backdrop-blur-xl text-left">
              
              {/* Card Header */}
              <div className="flex flex-wrap items-center justify-between gap-4 border-b border-white/10 pb-5">
                <div className="flex items-center gap-3">
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-gradient-to-tr from-purple-600 to-indigo-500 font-bold text-white shadow-md">
                    A
                  </div>
                  <div>
                    <h3 className="text-base font-bold text-white">Aura Salon OS — Live Operations</h3>
                    <p className="text-xs text-purple-200/70">Flagship Branch: Indiranagar, Bengaluru</p>
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/15 border border-emerald-500/30 px-3 py-1 text-xs font-semibold text-emerald-300">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    All 6 Chairs Booked
                  </span>
                  <span className="hidden sm:inline-flex items-center gap-1 rounded-full bg-purple-500/20 border border-purple-500/30 px-3 py-1 text-xs font-semibold text-purple-200">
                    <Sparkles className="h-3 w-3 text-amber-300" />
                    AI Assistant Active
                  </span>
                </div>
              </div>

              {/* Grid of live mockup modules */}
              <div className="mt-6 grid gap-4 md:grid-cols-3">
                
                {/* 1. Quick Booking & Timeslots */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs text-purple-200 mb-3">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <Calendar className="h-3.5 w-3.5 text-purple-400" />
                      Select Time Slot
                    </span>
                    <span className="text-[11px] text-emerald-400 font-medium">Auto-assigned</span>
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <div className="rounded-xl border border-purple-400/30 bg-purple-500/20 p-2 text-center">
                      <p className="text-xs font-bold text-white">09:30 AM</p>
                      <p className="text-[10px] text-purple-200">Ananya (Hair)</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center hover:bg-white/10 transition-colors">
                      <p className="text-xs font-bold text-white">10:30 AM</p>
                      <p className="text-[10px] text-white/60">Vikram (Color)</p>
                    </div>
                    <div className="rounded-xl border border-white/10 bg-white/5 p-2 text-center hover:bg-white/10 transition-colors">
                      <p className="text-xs font-bold text-white">11:45 AM</p>
                      <p className="text-[10px] text-white/60">Riya (Facial)</p>
                    </div>
                    <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/15 p-2 text-center">
                      <p className="text-xs font-bold text-emerald-300">01:00 PM</p>
                      <p className="text-[10px] text-emerald-200">Available</p>
                    </div>
                  </div>
                </div>

                {/* 2. Real-time Revenue & Growth */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs text-purple-200 mb-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <TrendingUp className="h-3.5 w-3.5 text-emerald-400" />
                      Today&apos;s Revenue
                    </span>
                    <span className="rounded-full bg-emerald-400/20 px-2 py-0.5 text-[10px] font-bold text-emerald-300">
                      +42% YoY
                    </span>
                  </div>
                  <p className="text-2xl font-extrabold text-white">₹48,920</p>
                  <p className="text-[11px] text-purple-200/70 mt-0.5">18 Completed bills · 100% GST compliant</p>
                  
                  {/* Mini revenue visual bar */}
                  <div className="mt-3 flex items-end gap-1.5 h-10 pt-2">
                    {[35, 55, 45, 75, 60, 85, 95].map((h, i) => (
                      <div key={i} className="flex-1 bg-white/10 rounded-t-sm relative group overflow-hidden">
                        <div
                          className="bg-gradient-to-t from-purple-500 to-amber-300 rounded-t-sm w-full transition-all duration-500"
                          style={{ height: `${h}%` }}
                        />
                      </div>
                    ))}
                  </div>
                </div>

                {/* 3. VIP Client Profile & AI Reminder */}
                <div className="rounded-2xl border border-white/10 bg-white/5 p-4 backdrop-blur-md">
                  <div className="flex items-center justify-between text-xs text-purple-200 mb-2">
                    <span className="font-semibold text-white flex items-center gap-1.5">
                      <UserCheck className="h-3.5 w-3.5 text-amber-300" />
                      Client Profile
                    </span>
                    <span className="rounded-full bg-amber-400/20 px-2 py-0.5 text-[10px] font-bold text-amber-300">
                      Platinum VIP
                    </span>
                  </div>
                  <div className="flex items-center gap-3 mt-1">
                    <div className="h-9 w-9 rounded-full bg-gradient-to-tr from-rose-400 to-purple-500 flex items-center justify-center font-bold text-xs text-white">
                      CW
                    </div>
                    <div>
                      <p className="text-xs font-bold text-white">Carla Watson</p>
                      <p className="text-[11px] text-purple-200/70">Last visit: 14 days ago · Keratin Spa</p>
                    </div>
                  </div>
                  <div className="mt-3 rounded-xl bg-purple-900/40 border border-purple-500/20 p-2 text-[11px] text-purple-200">
                    💬 <span className="font-semibold text-white">WhatsApp AI:</span> &ldquo;Birthday special voucher sent! 🎁&rdquo;
                  </div>
                </div>

              </div>

              {/* Bottom Quick Feature Tags */}
              <div className="mt-5 flex flex-wrap items-center justify-between gap-2 border-t border-white/10 pt-4 text-xs text-purple-200/80">
                <div className="flex flex-wrap items-center gap-3">
                  <span className="flex items-center gap-1">⚡ 3-Click POS Checkout</span>
                  <span className="hidden sm:inline text-white/20">|</span>
                  <span className="flex items-center gap-1">📲 2-Way WhatsApp Booking</span>
                  <span className="hidden sm:inline text-white/20">|</span>
                  <span className="flex items-center gap-1">👥 Automated Stylist Commissions</span>
                </div>
                <Link
                  href="/demo"
                  className="font-bold text-amber-300 hover:text-amber-200 transition-colors inline-flex items-center gap-1 text-xs"
                >
                  See full demo →
                </Link>
              </div>

            </div>

          </div>
        </div>
      </Container>
    </section>
  );
}
