"use client";

import { Container } from "@/components/ui/Container";
import { ShieldCheck, Building2, Zap, Calendar, Sparkles } from "lucide-react";

export function Stats() {
  const foundations = [
    {
      num: "01",
      icon: ShieldCheck,
      title: "Tenant Isolation",
      body: "Tenant-owned data and access remain strictly scoped to your salon organization.",
    },
    {
      num: "02",
      icon: Building2,
      title: "Branch-Aware Records",
      body: "Bookings, staff, stock and reports respect authorized branch context.",
    },
    {
      num: "03",
      icon: Zap,
      title: "Real-Time Events",
      body: "Booking, dashboard, queue and notification changes flow through the realtime layer.",
    },
    {
      num: "04",
      icon: Calendar,
      title: "IST Business Dates",
      body: "Operational dates and daily workflows follow Indian business time.",
    },
  ];

  return (
    <section className="relative py-20 md:py-28 overflow-hidden bg-gradient-to-br from-[#7651D8] via-[#6540C7] to-[#4A269E] text-white shadow-xl">
      {/* Decorative background aura shapes */}
      <div className="absolute inset-0 pointer-events-none" aria-hidden="true">
        <div className="absolute -top-24 -left-24 h-96 w-96 rounded-full bg-white/10 blur-3xl" />
        <div className="absolute -bottom-24 -right-24 h-96 w-96 rounded-full bg-[#361775]/50 blur-3xl" />
      </div>

      <Container className="relative z-10">
        {/* Section Header */}
        <div className="mb-14 max-w-3xl">
          <div className="inline-flex items-center gap-1.5 rounded-full border border-white/25 bg-white/10 px-3.5 py-1 text-xs font-semibold text-white backdrop-blur-sm mb-4 shadow-sm">
            <Sparkles className="h-3.5 w-3.5 text-amber-300" />
            <span className="uppercase tracking-[.14em] text-[11px]">Confirmed Product Foundations</span>
          </div>
          <h2 className="text-[clamp(2.25rem,5vw,3.5rem)] font-bold leading-[1.08] tracking-[-0.03em] !text-white text-balance">
            Built for operational integrity
          </h2>
          <p className="mt-4 text-base md:text-lg leading-relaxed text-white/85 max-w-2xl">
            Enterprise tenant security, branch context isolation, and Indian business operations built directly into the core foundation.
          </p>
        </div>

        {/* 4 Purple Glassmorphic Cards Grid */}
        <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {foundations.map((item) => {
            const Icon = item.icon;
            return (
              <div
                key={item.num}
                className="group rounded-[var(--aura-radius-xl)] border border-white/20 bg-white/10 p-6 backdrop-blur-md transition-all duration-300 hover:bg-white/15 hover:border-white/35 hover:-translate-y-1 shadow-lg flex flex-col justify-between"
              >
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <span className="text-2xl font-bold text-white tabular-nums tracking-tight">
                      {item.num}
                    </span>
                    <div className="grid h-10 w-10 place-items-center rounded-xl bg-white/20 text-white shadow-xs transition-transform group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </div>
                  </div>
                  <h3 className="text-lg font-bold !text-white leading-snug">
                    {item.title}
                  </h3>
                  <p className="mt-2.5 text-xs leading-relaxed text-white/80">
                    {item.body}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      </Container>
    </section>
  );
}
