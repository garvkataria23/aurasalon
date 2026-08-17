"use client";

import { useEffect, useRef, useState } from "react";
import { Container } from "@/components/ui/Container";
import {
  TrendingUp,
  CalendarCheck,
  Receipt,
  Users2,
  Briefcase,
  Boxes,
  Crown,
  Sparkles,
  Scissors,
  Layers,
  IndianRupee,
  Smartphone,
  Building,
  BarChart3,
  Calendar,
  CreditCard,
  UserCheck,
  Megaphone,
  LineChart,
  ArrowUpRight,
  ShieldCheck,
} from "lucide-react";

/* ── Scroll Reveal Hook ── */
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

/* ===================================================================
   SECTION 1: ANALYTICS
   =================================================================== */
function AnalyticsMockup() {
  const topServices = [
    { name: "Hair Treatments & Keratin", count: 84, rev: "₹1,18,000", share: "42%" },
    { name: "Hydra & Brightening Facials", count: 62, rev: "₹86,800", share: "31%" },
    { name: "Styling, Cut & Blowdry", count: 142, rev: "₹45,440", share: "16%" },
    { name: "Nail Art & Manicures", count: 54, rev: "₹31,320", share: "11%" },
  ];

  return (
    <div className="relative rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white shadow-[var(--aura-shadow-xl)] overflow-hidden">
      {/* Top Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-[var(--aura-border)] bg-[var(--aura-off-white)] px-5 py-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="h-2.5 w-2.5 rounded-full bg-emerald-500 animate-pulse" />
            <h3 className="text-sm font-bold text-[var(--aura-heading)]">Executive Salon Performance</h3>
          </div>
          <p className="text-[11px] text-[var(--aura-muted)]">This Month (1 Aug – 17 Aug) &bull; Bandra West Branch</p>
        </div>
        <div className="flex items-center gap-2">
          <span className="rounded-lg border border-[var(--aura-border)] bg-white px-2.5 py-1 text-xs font-semibold text-[var(--aura-heading)]">
            Monthly View
          </span>
          <span className="rounded-lg bg-[var(--aura-purple)] px-2.5 py-1 text-xs font-semibold text-white">
            Export GST Report
          </span>
        </div>
      </div>

      {/* 8 Genuine Supported Metric Cards Grid */}
      <div className="grid grid-cols-2 gap-3 p-5 sm:grid-cols-4">
        {/* Metric 1 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Gross Revenue</span>
            <TrendingUp className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-[var(--aura-heading)] tabular-nums">₹2,81,560</p>
          <span className="text-[10px] font-bold text-emerald-600">+18.4% vs last mo</span>
        </div>

        {/* Metric 2 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Appointments</span>
            <CalendarCheck className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
          </div>
          <p className="text-lg font-bold text-[var(--aura-heading)] tabular-nums">342</p>
          <span className="text-[10px] text-[var(--aura-muted)]">94% seat capacity</span>
        </div>

        {/* Metric 3 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Average Bill</span>
            <Receipt className="h-3.5 w-3.5 text-indigo-600" />
          </div>
          <p className="text-lg font-bold text-[var(--aura-heading)] tabular-nums">₹1,640</p>
          <span className="text-[10px] font-bold text-emerald-600">+12% ticket upsell</span>
        </div>

        {/* Metric 4 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Client Retention</span>
            <Users2 className="h-3.5 w-3.5 text-amber-600" />
          </div>
          <p className="text-lg font-bold text-[var(--aura-heading)] tabular-nums">68.2%</p>
          <span className="text-[10px] text-[var(--aura-muted)]">233 returning clients</span>
        </div>

        {/* Metric 5 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Staff Utilisation</span>
            <Briefcase className="h-3.5 w-3.5 text-[var(--aura-purple)]" />
          </div>
          <p className="text-lg font-bold text-[var(--aura-heading)] tabular-nums">86%</p>
          <span className="text-[10px] text-[var(--aura-muted)]">6.8 hrs / stylist</span>
        </div>

        {/* Metric 6 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Inventory Cost</span>
            <Boxes className="h-3.5 w-3.5 text-rose-600" />
          </div>
          <p className="text-lg font-bold text-[var(--aura-heading)] tabular-nums">7.8%</p>
          <span className="text-[10px] text-emerald-600">Controlled ratio</span>
        </div>

        {/* Metric 7 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Memberships</span>
            <Crown className="h-3.5 w-3.5 text-amber-500" />
          </div>
          <p className="text-lg font-bold text-[var(--aura-heading)] tabular-nums">₹54,000</p>
          <span className="text-[10px] text-[var(--aura-muted)]">24 new signups</span>
        </div>

        {/* Metric 8 */}
        <div className="rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] p-3.5">
          <div className="flex items-center justify-between text-[var(--aura-muted)] mb-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider">Net Profit Est.</span>
            <Sparkles className="h-3.5 w-3.5 text-emerald-600" />
          </div>
          <p className="text-lg font-bold text-emerald-700 tabular-nums">₹1,12,400</p>
          <span className="text-[10px] font-bold text-emerald-600">39.9% Net Margin</span>
        </div>
      </div>

      {/* Service Breakdown */}
      <div className="border-t border-[var(--aura-border)] p-5">
        <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] mb-3">
          Top Category Revenue &amp; Volume
        </h4>
        <div className="space-y-3">
          {topServices.map((svc) => (
            <div key={svc.name} className="flex flex-col gap-1 sm:flex-row sm:items-center sm:justify-between text-xs">
              <div className="min-w-0 sm:w-1/3">
                <p className="font-semibold text-[var(--aura-heading)] truncate">{svc.name}</p>
                <p className="text-[10px] text-[var(--aura-muted)]">{svc.count} services performed</p>
              </div>
              <div className="flex flex-1 items-center gap-3">
                <div className="h-2 flex-1 rounded-full bg-[var(--aura-lavender)] overflow-hidden">
                  <div className="h-full rounded-full bg-[var(--aura-purple)]" style={{ width: svc.share }} />
                </div>
                <span className="font-bold text-[var(--aura-heading)] tabular-nums sm:w-20 text-right">{svc.rev}</span>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   SECTION 2: WHY AURA (6 CARDS)
   =================================================================== */
const WHY_AURA_CARDS = [
  {
    icon: Scissors,
    title: "Built specifically for salons",
    description: "No unnecessary generic business-software complexity. Every feature is tuned for chair turns, service recipes, and stylist workflows.",
  },
  {
    icon: Layers,
    title: "One system, every operation",
    description: "From online booking and GST billing to staff attendance, commission tracking, and stock depletion.",
  },
  {
    icon: IndianRupee,
    title: "Designed for Indian businesses",
    description: "Full GST invoicing with itemized tax splits, dynamic UPI QR at checkout, and automated WhatsApp appointment reminders.",
  },
  {
    icon: Smartphone,
    title: "Simple enough for your team",
    description: "Clear, intuitive touch-friendly workflows that your receptionists and stylists can master in 15 minutes.",
  },
  {
    icon: Building,
    title: "Made to grow with you",
    description: "Effortlessly scale from an independent single-outlet boutique to multi-location chains with unified owner controls.",
  },
  {
    icon: BarChart3,
    title: "Real business visibility",
    description: "Instant clarity on net margin, staff productivity, and customer lifetime value — without waiting for monthly spreadsheets.",
  },
];

/* ===================================================================
   SECTION 3: ONE PLATFORM VISUAL (CUSTOM OPERATING SYSTEM DIAGRAM)
   =================================================================== */
const MODULES = [
  { name: "Appointments", icon: Calendar, pos: "top-0 left-1/2 -translate-x-1/2 -translate-y-1/2" },
  { name: "GST Billing & UPI", icon: CreditCard, pos: "top-[15%] right-[10%]" },
  { name: "Client CRM", icon: UserCheck, pos: "top-[50%] right-0 translate-x-1/2 -translate-y-1/2" },
  { name: "Staff & Payroll", icon: Briefcase, pos: "bottom-[15%] right-[10%]" },
  { name: "Inventory", icon: Boxes, pos: "bottom-0 left-1/2 -translate-x-1/2 translate-y-1/2" },
  { name: "Memberships", icon: Crown, pos: "bottom-[15%] left-[10%]" },
  { name: "Marketing AI", icon: Megaphone, pos: "top-[50%] left-0 -translate-x-1/2 -translate-y-1/2" },
  { name: "Analytics", icon: LineChart, pos: "top-[15%] left-[10%]" },
];

function OnePlatformVisual() {
  return (
    <div className="relative mx-auto w-full max-w-4xl py-12">
      {/* Desktop Radial Visual */}
      <div className="relative hidden md:block aspect-[16/10] w-full">
        {/* Pulsing Concentric Rings */}
        <div className="absolute inset-0 grid place-items-center pointer-events-none" aria-hidden="true">
          <div className="h-[75%] w-[75%] rounded-full border border-[var(--aura-purple)]/15 animate-[spin_60s_linear_infinite]" />
          <div className="absolute h-[55%] w-[55%] rounded-full border border-dashed border-[var(--aura-purple)]/25" />
          <div className="absolute h-[35%] w-[35%] rounded-full bg-[var(--aura-lavender)]/50 blur-xl" />
        </div>

        {/* Center Aura Hub */}
        <div className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 z-20">
          <div className="grid h-28 w-28 place-items-center rounded-3xl bg-[var(--aura-purple)] text-white shadow-[0_12px_40px_rgba(118,81,216,0.35)] transition-transform hover:scale-105">
            <div className="text-center">
              <span className="font-bold text-2xl tracking-tight">AURA</span>
              <p className="text-[9px] font-semibold uppercase tracking-widest text-white/80 mt-0.5">Salon OS</p>
            </div>
          </div>
        </div>

        {/* Satellite Module Nodes */}
        {MODULES.map((mod) => {
          const Icon = mod.icon;
          return (
            <div
              key={mod.name}
              className={`absolute z-10 ${mod.pos}`}
            >
              <div className="flex items-center gap-2.5 rounded-2xl border border-[var(--aura-border)] bg-white px-4 py-2.5 shadow-[var(--aura-shadow-md)] transition-all hover:border-[var(--aura-purple)] hover:shadow-lg hover:-translate-y-0.5">
                <span className="grid h-7 w-7 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-bold text-[var(--aura-heading)] whitespace-nowrap">{mod.name}</span>
              </div>
            </div>
          );
        })}
      </div>

      {/* Mobile Grid Presentation */}
      <div className="md:hidden">
        <div className="mb-6 mx-auto grid h-20 w-20 place-items-center rounded-2xl bg-[var(--aura-purple)] text-white shadow-lg text-center">
          <div>
            <span className="font-bold text-xl">AURA</span>
            <p className="text-[8px] font-semibold uppercase tracking-wider text-white/80">Salon OS</p>
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2.5">
          {MODULES.map((mod) => {
            const Icon = mod.icon;
            return (
              <div
                key={mod.name}
                className="flex items-center gap-2 rounded-xl border border-[var(--aura-border)] bg-white p-3 shadow-xs"
              >
                <span className="grid h-7 w-7 shrink-0 place-items-center rounded-lg bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                  <Icon className="h-3.5 w-3.5" />
                </span>
                <span className="text-xs font-semibold text-[var(--aura-heading)]">{mod.name}</span>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}

/* ===================================================================
   MAIN COMPONENT EXPORT
   =================================================================== */
export function AnalyticsAndPlatform() {
  const analyticsReveal = useReveal();
  const whyReveal = useReveal();
  const platformReveal = useReveal();

  return (
    <>
      {/* ── SECTION 1: ANALYTICS ── */}
      <section
        ref={analyticsReveal.ref}
        className="py-20 md:py-28 bg-white border-t border-[var(--aura-border)]"
      >
        <Container>
          <div
            className="mx-auto max-w-3xl text-center mb-14"
            style={{
              opacity: analyticsReveal.visible ? 1 : 0,
              transform: analyticsReveal.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Real-Time Intelligence
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Know what's happening before you ask.
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Get an instant, unified pulse on revenue, staff occupancy, client retention, and margin — directly on your phone or desktop.
            </p>
          </div>

          <div
            style={{
              opacity: analyticsReveal.visible ? 1 : 0,
              transform: analyticsReveal.visible ? "translateY(0)" : "translateY(24px)",
              transition: "opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s",
            }}
          >
            <AnalyticsMockup />
          </div>
        </Container>
      </section>

      {/* ── SECTION 2: WHY AURA (6 CARDS) ── */}
      <section
        ref={whyReveal.ref}
        className="py-20 md:py-28 bg-[var(--aura-off-white)] border-t border-[var(--aura-border)]"
      >
        <Container>
          <div
            className="mx-auto max-w-3xl text-center mb-16"
            style={{
              opacity: whyReveal.visible ? 1 : 0,
              transform: whyReveal.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              The Aura Advantage
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              Why salons choose Aura
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Engineered exclusively for modern beauty salons, luxury spas, nail bars, and multi-location aesthetic clinics.
            </p>
          </div>

          <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
            {WHY_AURA_CARDS.map((card, i) => {
              const Icon = card.icon;
              return (
                <div
                  key={card.title}
                  className="rounded-[var(--aura-radius-xl)] border border-[var(--aura-border)] bg-white p-7 shadow-[var(--aura-shadow-xs)] transition-all duration-300 hover:shadow-[var(--aura-shadow-md)] hover:-translate-y-1"
                  style={{
                    opacity: whyReveal.visible ? 1 : 0,
                    transform: whyReveal.visible ? "translateY(0)" : "translateY(20px)",
                    transition: `opacity 0.5s ease-out ${0.1 + i * 0.05}s, transform 0.5s ease-out ${0.1 + i * 0.05}s`,
                  }}
                >
                  <div className="mb-5 grid h-11 w-11 place-items-center rounded-xl bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </div>
                  <h3 className="text-lg font-bold text-[var(--aura-heading)] leading-snug">
                    {card.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-[var(--aura-body)]">
                    {card.description}
                  </p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ── SECTION 3: ONE CONNECTED PLATFORM VISUAL ── */}
      <section
        ref={platformReveal.ref}
        className="py-20 md:py-28 bg-white border-t border-[var(--aura-border)]"
      >
        <Container>
          <div
            className="mx-auto max-w-3xl text-center mb-10"
            style={{
              opacity: platformReveal.visible ? 1 : 0,
              transform: platformReveal.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.55s ease-out, transform 0.55s ease-out",
            }}
          >
            <span className="inline-block text-xs font-semibold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              Unified Operating System
            </span>
            <h2 className="text-[clamp(2rem,4.5vw,3.25rem)] font-bold leading-[1.1] tracking-[-0.03em] text-[var(--aura-heading)] text-balance">
              One connected brain for your entire business
            </h2>
            <p className="mt-4 text-base md:text-lg leading-relaxed text-[var(--aura-body)] max-w-2xl mx-auto text-pretty">
              Every appointment updates your inventory, calculates staff commissions, records GST, and feeds your profit analytics automatically.
            </p>
          </div>

          <div
            style={{
              opacity: platformReveal.visible ? 1 : 0,
              transform: platformReveal.visible ? "translateY(0)" : "translateY(20px)",
              transition: "opacity 0.6s ease-out 0.15s, transform 0.6s ease-out 0.15s",
            }}
          >
            <OnePlatformVisual />
          </div>
        </Container>
      </section>
    </>
  );
}
