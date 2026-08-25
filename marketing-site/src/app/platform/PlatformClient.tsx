"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  ArrowUpRight,
  Award,
  BarChart3,
  Calendar,
  Check,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  FileText,
  Info,
  Monitor,
  Package,
  Receipt,
  Smartphone,
  Sparkles,
  UserCheck,
  UsersRound,
  Workflow,
  Zap,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRole, type EcosystemRoute } from "@/lib/ecosystem-content";
import { LandingDecor } from "@/components/landing/LandingDecor";

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS & CONFIG
   ───────────────────────────────────────────────────────────────────────────── */

const STEP_ICONS = [Smartphone, Calendar, UserCheck, FileText, Receipt, Package, Award, BarChart3];

const EXPERIENCES: Array<{
  route: EcosystemRoute;
  role: EcosystemRole;
  href: string;
  icon: typeof Monitor;
  color: string;
  badge: string;
  tagline: string;
}> = [
  {
    route: "owner",
    role: "owner",
    href: "/owner-crm",
    icon: Monitor,
    color: "#6F4FD8",
    badge: "For Salon Owners & Front Desk",
    tagline: "Reception command, GST POS, inventory recipes, payroll and multi-branch ledger.",
  },
  {
    route: "customer",
    role: "customer",
    href: "/customer-app",
    icon: Smartphone,
    color: "#059669",
    badge: "For Salon Clients",
    tagline: "Zero prepayment pay-at-salon booking, saved stylists and loyalty passbook.",
  },
  {
    route: "staff",
    role: "staff",
    href: "/staff-app",
    icon: UsersRound,
    color: "#D97706",
    badge: "For Stylists & Therapists",
    tagline: "Personal roster, tasks, tipping view and Android attendance.",
  },
];

const FAMILY_LINKS: Array<{ route: EcosystemRoute; href: string; icon: typeof Workflow; desc: string }> = [
  { route: "platform", href: "/platform", icon: Workflow, desc: "Unified Salon OS" },
  { route: "owner", href: "/owner-crm", icon: Monitor, desc: "Reception & Owner POS" },
  { route: "customer", href: "/customer-app", icon: Smartphone, desc: "Self-Service Booking" },
  { route: "staff", href: "/staff-app", icon: UsersRound, desc: "Stylist Daily Workspace" },
  { route: "workflows", href: "/workflows", icon: ArrowRight, desc: "Full Operational Chain" },
];

const ARCHITECTURE_COMPARISON = [
  {
    feature: "Booking Record Synchronization",
    fragmented: "Manual re-entry across paper register, WhatsApp chats, and billing software",
    aura: "Instant single source of truth across Front Desk, Stylist Roster, and Client App",
  },
  {
    feature: "Stock & Service Recipe Deduction",
    fragmented: "Monthly manual guess estimation; regular product leakage and theft",
    aura: "Automated batch & expiry-aware milliliter/gram consumption per checkout",
  },
  {
    feature: "Staff Commission & Payouts",
    fragmented: "End-of-month dispute-heavy Excel calculations taking 2-3 full days",
    aura: "Real-time automated service attribution with tier rules and GST deductions",
  },
  {
    feature: "Customer Retention & History",
    fragmented: "Customer history lost whenever a front-desk receptionist or stylist resigns",
    aura: "Centralized Customer 360 with color formulas, patch tests, and visit logs",
  },
  {
    feature: "GST POS & Payment Splits",
    fragmented: "Generic retail POS without salon split tender (Cash + UPI + Loyalty Points)",
    aura: "3-click salon POS with auto HSN/SAC, tip splits, and multi-mode payment",
  },
];

const FAQ_ITEMS = [
  {
    q: "How do the three apps (Owner CRM, Customer App, Staff App) stay synchronized?",
    a: "All three interfaces connect directly to Aura's real-time tenant backend. When a customer books a slot, the Owner calendar blocks the chair instantly, the assigned stylist's daily schedule updates on their phone, and inventory requirements are staged automatically.",
  },
  {
    q: "Does Aura require expensive proprietary hardware?",
    a: "No. Aura runs seamlessly in any modern web browser on laptops, iPads, Android tablets, standard desktop PCs, thermal receipt printers, and Android/iOS smartphones.",
  },
  {
    q: "Can we migrate our existing customer data and booking history?",
    a: "Yes! Aura includes automated migration templates for Excel/CSV data, plus pre-built importers for legacy salon software with zero downtime onboarding.",
  },
  {
    q: "How does the pay-at-salon customer booking flow prevent no-shows?",
    a: "Aura's automated 2-way WhatsApp confirmation engine sends interactive confirmation reminders 24h and 2h before the appointment, allowing instant self-service rescheduling with a single tap.",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────────────────────── */

export function PlatformClient() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language as "en" | "hi"] ?? ECOSYSTEM_CONTENT.en;
  const page = copy.route.platform;

  // Interactive preview states
  const [activeTab, setActiveTab] = useState<"flow" | "owner" | "customer" | "staff">("flow");
  const [activeFaq, setActiveFaq] = useState<number | null>(0);
  const [activeTimelineStep, setActiveTimelineStep] = useState<number>(0);

  return (
    <>
      {/* ═══ 1. HERO — Ultra Modern Dark Gradient with Live Ecosystem Telemetry ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1C0D36] via-[#2F145C] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        {/* Ambient background orbs */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 -left-24 h-[480px] w-[480px] rounded-full bg-purple-600/25 blur-[120px] animate-pulse" />
          <div className="absolute -right-20 top-1/4 h-96 w-96 rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute left-1/2 bottom-10 -translate-x-1/2 h-64 w-[600px] rounded-full bg-fuchsia-500/15 blur-[110px]" />
        </div>

        <Container className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Eyebrow badge */}
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-white/95 backdrop-blur-md mb-6 shadow-md transition-all hover:border-white/40 hover:bg-white/15">
            <Sparkles className="h-3.5 w-3.5 text-amber-300 animate-bounce" aria-hidden="true" />
            <span>{page.eyebrow} · Unified Salon Architecture</span>
          </div>

          {/* Heading */}
          <h1 className="text-[clamp(2.4rem,5.5vw,4.5rem)] font-extrabold tracking-[-0.04em] leading-[1.08] text-balance drop-shadow-sm">
            {page.title}
          </h1>

          {/* Subtitle */}
          <p className="mt-5 text-base md:text-xl text-white/80 leading-relaxed max-w-3xl mx-auto text-pretty">
            {page.body}
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={CTA_LINKS.demo}
              className="group inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-sm font-bold text-[#4B1E8A] shadow-[0_16px_36px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.32)] active:scale-[0.98]"
            >
              <span>{copy.common.demo}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/workflows"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-4 text-sm font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:border-white/50"
            >
              <Workflow className="h-4 w-4 text-purple-300" />
              <span>Explore Interactive Workflows</span>
            </Link>
          </div>

          {/* Ecosystem Highlights Grid */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 max-w-4xl mx-auto text-left">
            {[
              {
                icon: Monitor,
                title: "Owner CRM & POS",
                metric: "3-Click Billing",
                color: "text-purple-300",
                desc: "GST billing, stock & multi-branch",
              },
              {
                icon: Smartphone,
                title: "Customer App",
                metric: "0% Commission",
                color: "text-emerald-300",
                desc: "Direct bookings & loyalty tracking",
              },
              {
                icon: UsersRound,
                title: "Staff OS",
                metric: "Live Attribution",
                color: "text-amber-300",
                desc: "Shift rosters, tasks & commission",
              },
              {
                icon: Zap,
                title: "Shared Core",
                metric: "Real-time Sync",
                color: "text-cyan-300",
                desc: "1 tenant record, 0 data duplication",
              },
            ].map((item, idx) => {
              const Icon = item.icon;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-white/15 bg-white/[0.08] p-4.5 backdrop-blur-md transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1 hover:border-white/25 hover:shadow-[0_12px_32px_rgba(0,0,0,0.2)]"
                >
                  <div className="flex items-center justify-between mb-2.5">
                    <div className="h-9 w-9 rounded-xl bg-white/10 flex items-center justify-center">
                      <Icon className={`h-4.5 w-4.5 ${item.color}`} />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-white/60">
                      {item.metric}
                    </span>
                  </div>
                  <h3 className="text-sm font-bold text-white">{item.title}</h3>
                  <p className="text-xs text-white/65 mt-1 leading-snug">{item.desc}</p>
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ 2. INTERACTIVE PLATFORM SIMULATOR (Live Multi-Role Workspace) ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)] border-b border-[var(--aura-border)]">
        <Container size="wide">
          <div className="max-w-3xl mx-auto text-center mb-10">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/20 bg-[var(--aura-lavender)] px-4 py-1 text-xs font-bold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              <Cpu className="h-3.5 w-3.5" />
              Live Workspace Switcher
            </span>
            <h2 className="text-[clamp(1.85rem,3.5vw,2.75rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Experience the 3 interconnected perspectives
            </h2>
            <p className="mt-3 text-sm md:text-base text-[var(--aura-body)]">
              Switch between roles to inspect how one salon appointment flows through Owner, Customer, and Staff interfaces in real time.
            </p>

            {/* Role Tabs - Single line pill layout */}
            <div className="mt-8 inline-grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-white border border-[var(--aura-border)] shadow-sm max-w-4xl mx-auto w-full md:w-auto">
              {[
                { id: "flow", label: "Full Operational Chain", icon: Workflow },
                { id: "owner", label: "Owner CRM & POS", icon: Monitor },
                { id: "customer", label: "Customer Self-Service", icon: Smartphone },
                { id: "staff", label: "Staff Daily Workspace", icon: UsersRound },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as typeof activeTab)}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap ${
                      active
                        ? "bg-[var(--aura-purple)] text-white shadow-sm"
                        : "text-[var(--aura-body)] hover:text-[var(--aura-heading)] hover:bg-[var(--aura-lavender)]"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Screen Display */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-[var(--aura-border)] bg-white p-4 sm:p-7 shadow-[0_24px_70px_rgba(72,45,151,0.08)]">
            {/* Top Device Bar */}
            <div className="flex items-center justify-between border-b border-[var(--aura-border)] pb-4 mb-6">
              <div className="flex items-center gap-2">
                <span className="h-3 w-3 rounded-full bg-red-400" />
                <span className="h-3 w-3 rounded-full bg-amber-400" />
                <span className="h-3 w-3 rounded-full bg-emerald-400" />
                <span className="ml-2 text-xs font-mono text-[var(--aura-muted)]">
                  aura://app/{activeTab}-view · Branch: Jubilee Hills Main
                </span>
              </div>
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 px-2.5 py-0.5 text-[11px] font-semibold">
                  <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Synced with Cloud
                </span>
              </div>
            </div>

            {/* TAB CONTENT 1: FULL CHAIN */}
            {activeTab === "flow" && (
              <div className="space-y-6">
                <div className="flex flex-col md:flex-row md:items-center justify-between gap-4 p-5 rounded-2xl bg-gradient-to-r from-purple-50 via-indigo-50 to-white border border-purple-100">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700">Traceable Appointment Pipeline</span>
                    <h3 className="text-xl font-bold text-[var(--aura-heading)] mt-0.5">Booking #AUR-88219 · Hair Spa & Keratin Therapy</h3>
                    <p className="text-xs text-[var(--aura-body)] mt-1">Single continuous record moving across 4 stages with zero double-entry.</p>
                  </div>
                  <Link
                    href="/workflows"
                    className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-[var(--aura-purple)] text-white text-xs font-bold shadow-xs hover:bg-[var(--aura-purple-hover)]"
                  >
                    <span>View Step Explorer</span>
                    <ArrowRight className="h-3.5 w-3.5" />
                  </Link>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  {[
                    {
                      step: "01",
                      title: "Client Booking",
                      actor: "Customer App",
                      status: "Confirmed (Pay-at-salon)",
                      time: "10:15 AM",
                      color: "border-emerald-200 bg-emerald-50/50",
                    },
                    {
                      step: "02",
                      title: "Chair & Stylist Assign",
                      actor: "Owner CRM Calendar",
                      status: "Chair 3 · Stylist Rahul",
                      time: "10:16 AM",
                      color: "border-purple-200 bg-purple-50/50",
                    },
                    {
                      step: "03",
                      title: "Service Execution & Notes",
                      actor: "Staff Workday App",
                      status: "Color Batch #K92 Logged",
                      time: "11:30 AM",
                      color: "border-amber-200 bg-amber-50/50",
                    },
                    {
                      step: "04",
                      title: "POS Checkout & Stock Deduct",
                      actor: "GST POS & Inventory",
                      status: "₹3,400 Paid via UPI",
                      time: "12:15 PM",
                      color: "border-blue-200 bg-blue-50/50",
                    },
                  ].map((item, idx) => (
                    <div key={idx} className={`p-4 rounded-2xl border ${item.color} flex flex-col justify-between`}>
                      <div>
                        <div className="flex items-center justify-between mb-2">
                          <span className="text-[10px] font-bold text-[var(--aura-purple)] bg-white px-2 py-0.5 rounded-full border border-purple-100">
                            STEP {item.step}
                          </span>
                          <span className="text-[10px] font-mono text-[var(--aura-muted)]">{item.time}</span>
                        </div>
                        <h4 className="text-sm font-bold text-[var(--aura-heading)]">{item.title}</h4>
                        <p className="text-xs text-[var(--aura-body)] font-medium mt-0.5">{item.actor}</p>
                      </div>
                      <div className="mt-4 pt-2 border-t border-black/5 text-[11px] font-semibold text-emerald-800 flex items-center gap-1.5">
                        <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                        <span className="truncate">{item.status}</span>
                      </div>
                    </div>
                  ))}
                </div>

                <div className="p-4 rounded-xl border border-[var(--aura-border)] bg-[var(--aura-off-white)] text-xs text-[var(--aura-body)] flex items-start gap-2.5">
                  <Info className="h-4 w-4 text-[var(--aura-purple)] shrink-0 mt-0.5" />
                  <span>
                    <strong>Audit Guarantee:</strong> Every price adjustment, inventory recipe deduction, and commission slice carries cryptographic audit timestamps linked back to the original client booking ID.
                  </span>
                </div>
              </div>
            )}

            {/* TAB CONTENT 2: OWNER CRM */}
            {activeTab === "owner" && (
              <div className="grid md:grid-cols-3 gap-5">
                <div className="md:col-span-2 space-y-4">
                  <div className="p-4 rounded-2xl border border-[var(--aura-border)] bg-[var(--aura-off-white)]">
                    <div className="flex items-center justify-between mb-3">
                      <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] flex items-center gap-2">
                        <Calendar className="h-4 w-4 text-[var(--aura-purple)]" />
                        Today&apos;s Floor Schedule (18 Appointments)
                      </h4>
                      <span className="text-xs text-purple-700 font-bold">₹42,800 Est. Revenue</span>
                    </div>

                    <div className="space-y-2">
                      {[
                        { time: "11:00 AM", client: "Sneha Kapoor (VIP)", svc: "Global Hair Highlights + Spa", staff: "Ananya M.", status: "In Chair", bill: "₹4,800" },
                        { time: "11:30 AM", client: "Vikram Mehta", svc: "Stylist Haircut & Beard Craft", staff: "Rahul S.", status: "Waiting in Lounge", bill: "₹1,200" },
                        { time: "12:15 PM", client: "Priya Sharma", svc: "Hydra-Radiance Facial", staff: "Deepa K.", status: "Confirmed via WhatsApp", bill: "₹2,800" },
                      ].map((row, i) => (
                        <div key={i} className="flex items-center justify-between p-3 rounded-xl bg-white border border-[var(--aura-border)] text-xs">
                          <div className="flex items-center gap-3">
                            <span className="font-mono font-bold text-[var(--aura-purple)]">{row.time}</span>
                            <div>
                              <p className="font-bold text-[var(--aura-heading)]">{row.client}</p>
                              <p className="text-[11px] text-[var(--aura-muted)]">{row.svc} · Stylist: {row.staff}</p>
                            </div>
                          </div>
                          <div className="text-right">
                            <span className="font-bold text-[var(--aura-heading)]">{row.bill}</span>
                            <p className="text-[10px] text-emerald-600 font-medium">{row.status}</p>
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>

                  <div className="grid grid-cols-3 gap-3">
                    <div className="p-3 rounded-xl bg-purple-50/70 border border-purple-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-purple-700">Cash Drawer</span>
                      <p className="text-lg font-bold text-[var(--aura-heading)] mt-0.5">₹14,250</p>
                    </div>
                    <div className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-emerald-700">UPI & Cards</span>
                      <p className="text-lg font-bold text-[var(--aura-heading)] mt-0.5">₹28,550</p>
                    </div>
                    <div className="p-3 rounded-xl bg-amber-50/70 border border-amber-100 text-center">
                      <span className="text-[10px] uppercase font-bold text-amber-700">Stock Alerts</span>
                      <p className="text-lg font-bold text-[var(--aura-heading)] mt-0.5">2 Low Batch</p>
                    </div>
                  </div>
                </div>

                <div className="p-4 rounded-2xl border border-[var(--aura-border)] bg-gradient-to-br from-white to-purple-50/40 flex flex-col justify-between">
                  <div>
                    <span className="text-[10px] font-bold uppercase tracking-wider text-[var(--aura-purple)]">Express POS Billing</span>
                    <h4 className="text-sm font-bold text-[var(--aura-heading)] mt-1">Ready Invoice #INV-902</h4>

                    <div className="mt-3 space-y-2 text-xs border-y border-[var(--aura-border)] py-3">
                      <div className="flex justify-between"><span>Global Highlights</span><span className="font-bold">₹3,500</span></div>
                      <div className="flex justify-between"><span>Moroccan Argan Serum (Retail)</span><span className="font-bold">₹1,200</span></div>
                      <div className="flex justify-between text-[var(--aura-muted)]"><span>GST @ 18%</span><span>₹846</span></div>
                      <div className="flex justify-between text-sm font-bold pt-1 border-t border-[var(--aura-border)]"><span>Total Amount</span><span className="text-purple-700">₹5,546</span></div>
                    </div>
                  </div>

                  <div className="mt-4 space-y-2">
                    <Link
                      href="/owner-crm"
                      className="w-full py-2.5 rounded-xl bg-[var(--aura-purple)] text-white text-xs font-bold text-center block shadow-xs hover:bg-[var(--aura-purple-hover)]"
                    >
                      Explore Owner CRM & POS
                    </Link>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 3: CUSTOMER APP */}
            {activeTab === "customer" && (
              <div className="grid md:grid-cols-3 gap-6 items-center">
                <div className="md:col-span-2 space-y-4">
                  <div className="space-y-2">
                    <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                      Client Self-Service Experience
                    </span>
                    <h3 className="text-xl font-bold text-[var(--aura-heading)]">Zero-friction booking with no advance payment barriers</h3>
                    <p className="text-xs text-[var(--aura-body)] leading-relaxed">
                      Customers browse salon menus, pick their preferred stylist, select available time slots, and receive instant WhatsApp confirmations without getting stuck on third-party aggregator commissions.
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-3 pt-2">
                    {[
                      { title: "Direct Salon Profile", desc: "No aggregator ads or competing salon suggestions" },
                      { title: "Pay-at-Salon Flexibility", desc: "Reduces booking drop-offs by up to 68%" },
                      { title: "Read-only Digital Passbook", desc: "View loyalty points, past bills, and package credits" },
                      { title: "1-Tap Rebooking", desc: "Repeat previous haircut & treatment with saved stylist" },
                    ].map((feat, i) => (
                      <div key={i} className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/30 text-xs">
                        <p className="font-bold text-[var(--aura-heading)] flex items-center gap-1.5">
                          <CheckCircle2 className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                          {feat.title}
                        </p>
                        <p className="text-[11px] text-[var(--aura-muted)] mt-1">{feat.desc}</p>
                      </div>
                    ))}
                  </div>

                  <div className="pt-2">
                    <Link
                      href="/customer-app"
                      className="inline-flex items-center gap-2 px-5 py-2.5 rounded-xl bg-emerald-700 text-white text-xs font-bold hover:bg-emerald-800"
                    >
                      <span>Explore Customer App Details</span>
                      <ArrowRight className="h-3.5 w-3.5" />
                    </Link>
                  </div>
                </div>

                {/* Smartphone Mockup */}
                <div className="rounded-3xl border-4 border-slate-800 bg-slate-900 p-2 shadow-xl max-w-[260px] mx-auto text-white text-xs">
                  <div className="rounded-2xl bg-white text-slate-900 p-3.5 space-y-3">
                    <div className="flex items-center justify-between border-b pb-2">
                      <span className="font-bold text-xs">Aura Salon & Spa</span>
                      <span className="text-[10px] bg-emerald-100 text-emerald-800 font-bold px-1.5 py-0.5 rounded">Jubilee Hills</span>
                    </div>
                    <div className="p-2.5 rounded-xl bg-purple-50 border border-purple-100">
                      <span className="text-[10px] font-bold text-purple-700 block">Upcoming Appointment</span>
                      <p className="font-bold text-xs mt-0.5">Keratin Hair Spa</p>
                      <p className="text-[10px] text-slate-500">Sat, 24 Aug · 4:00 PM with Rahul</p>
                    </div>
                    <div className="flex justify-between text-[11px] font-semibold pt-1">
                      <span>Wallet Balance:</span>
                      <span className="text-purple-700">₹850 (850 pts)</span>
                    </div>
                    <button type="button" className="w-full py-1.5 rounded-lg bg-emerald-600 text-white text-[11px] font-bold">
                      Rebook Previous Service
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* TAB CONTENT 4: STAFF OS */}
            {activeTab === "staff" && (
              <div className="grid md:grid-cols-3 gap-5">
                <div className="p-4 rounded-2xl border border-[var(--aura-border)] bg-amber-50/40 space-y-3">
                  <div className="flex items-center gap-3">
                    <div className="h-10 w-10 rounded-full bg-amber-200 text-amber-900 font-bold flex items-center justify-center text-sm">
                      RK
                    </div>
                    <div>
                      <h4 className="text-sm font-bold text-[var(--aura-heading)]">Rahul Kumar</h4>
                      <p className="text-xs text-[var(--aura-muted)]">Senior Hair Stylist · Shift: 10:00–19:00</p>
                    </div>
                  </div>

                  <div className="p-3 rounded-xl bg-white border border-amber-200/60 text-xs space-y-1.5">
                    <div className="flex justify-between text-[var(--aura-body)]"><span>Attendance Status:</span><span className="font-bold text-emerald-700">Punched In (10:02 AM)</span></div>
                    <div className="flex justify-between text-[var(--aura-body)]"><span>Today&apos;s Target:</span><span className="font-bold">₹8,000 / ₹10,000</span></div>
                    <div className="flex justify-between text-[var(--aura-body)]"><span>Attributed Commission:</span><span className="font-bold text-purple-700">₹940 (Est.)</span></div>
                  </div>

                  <Link
                    href="/staff-app"
                    className="w-full py-2 rounded-xl bg-amber-700 text-white text-xs font-bold text-center block hover:bg-amber-800"
                  >
                    View Staff App Capabilities
                  </Link>
                </div>

                <div className="md:col-span-2 space-y-3">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-[var(--aura-heading)] flex items-center gap-2">
                    <Clock className="h-4 w-4 text-amber-600" />
                    Assigned Appointments & Shift Task List
                  </h4>

                  <div className="space-y-2">
                    {[
                      { time: "11:15 AM", client: "Vikram Mehta", svc: "Stylist Haircut & Beard Craft", notes: "Prefers low fade, allergic to eucalyptus oil", status: "Active Now" },
                      { time: "02:00 PM", client: "Rohan Varma", svc: "Botox Hair Treatment", notes: "Needs 45 min developer time", status: "Upcoming" },
                      { time: "04:30 PM", client: "Arjun Reddy", svc: "Scalp Scrub & Head Massage", notes: "VIP Loyalty Member", status: "Upcoming" },
                    ].map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-[var(--aura-border)] bg-white text-xs flex items-start justify-between">
                        <div>
                          <div className="flex items-center gap-2">
                            <span className="font-mono font-bold text-amber-700">{item.time}</span>
                            <span className="font-bold text-[var(--aura-heading)]">{item.client}</span>
                            <span className="text-[10px] text-purple-700 bg-purple-50 px-2 py-0.5 rounded font-medium">{item.svc}</span>
                          </div>
                          <p className="text-[11px] text-[var(--aura-muted)] mt-1">{item.notes}</p>
                        </div>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.status === "Active Now" ? "bg-emerald-100 text-emerald-800" : "bg-slate-100 text-slate-700"}`}>
                          {item.status}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* ═══ 3. THREE CORE SURFACES (Rich Detailed Cards) ═══ */}
      <section className="py-16 md:py-24 bg-white border-b border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/20 bg-[var(--aura-lavender)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--aura-purple)] shadow-xs mb-4">
              <Zap className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.ecosystem.eyebrow}
            </span>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance">
              {copy.ecosystem.title}
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">
              {copy.ecosystem.body}
            </p>
          </div>

          <div className="grid gap-6 lg:grid-cols-3 max-w-6xl mx-auto">
            {EXPERIENCES.map(({ route, role, href, icon: Icon, color, badge, tagline }) => {
              const exp = copy.route[route];
              const tour = copy.tour.roles[role];
              return (
                <Link
                  key={route}
                  href={href}
                  className="feature-card-hover group flex flex-col rounded-3xl border border-[var(--aura-border)] bg-white p-7 md:p-8 cursor-pointer transition-all duration-300 hover:shadow-[0_20px_50px_rgba(111,79,216,0.12)] hover:border-[var(--aura-purple)]/30"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center transition-all duration-300 group-hover:scale-110 group-hover:rotate-2 shadow-xs"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <Icon className="w-6 h-6 transition-transform" style={{ color }} aria-hidden="true" />
                    </div>
                    <span className="text-[10px] font-bold uppercase tracking-wider px-2.5 py-1 rounded-full bg-[var(--aura-lavender)] text-[var(--aura-purple)]">
                      {exp.eyebrow}
                    </span>
                  </div>

                  <span className="text-xs font-semibold text-[var(--aura-muted)] mb-1">{badge}</span>
                  <h3 className="text-xl font-bold text-[var(--aura-heading)] mb-2 group-hover:text-[var(--aura-purple)] transition-colors flex items-center justify-between">
                    <span>{tour.title}</span>
                    <ArrowUpRight className="h-4 w-4 text-[var(--aura-muted)] opacity-0 -translate-x-1 group-hover:opacity-100 group-hover:translate-x-0 group-hover:text-[var(--aura-purple)] transition-all duration-200" aria-hidden="true" />
                  </h3>
                  <p className="text-xs text-[var(--aura-body)] leading-relaxed mb-6">{tagline}</p>

                  <div className="space-y-2.5 mb-6 pt-4 border-t border-[var(--aura-border)]/60">
                    {tour.points.slice(0, 4).map((point) => (
                      <div key={point} className="flex items-start gap-2.5 text-xs text-[var(--aura-body)] font-medium">
                        <Check className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" aria-hidden="true" />
                        <span>{point}</span>
                      </div>
                    ))}
                  </div>

                  <div className="mt-auto pt-4 border-t border-[var(--aura-border)]/60 flex items-center justify-between text-xs font-bold text-[var(--aura-purple)]">
                    <span>{copy.common.explore}</span>
                    <ArrowRight className="h-4 w-4 transition-transform duration-300 group-hover:translate-x-1.5" aria-hidden="true" />
                  </div>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ 4. END-TO-END OPERATIONAL PIPELINE (Interactive Timeline) ═══ */}
      <section className="relative overflow-hidden py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-14">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/20 bg-[var(--aura-lavender)] px-4 py-1.5 text-[11px] font-bold uppercase tracking-[.14em] text-[var(--aura-purple)] shadow-xs mb-4">
              <Workflow className="h-3.5 w-3.5" aria-hidden="true" />
              {copy.workflow.eyebrow}
            </span>
            <h2 className="text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance">
              {copy.workflow.title}
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">
              {copy.workflow.body}
            </p>
          </div>

          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4 max-w-6xl mx-auto">
            {copy.workflow.steps.map((step, index) => {
              const Icon = STEP_ICONS[index % STEP_ICONS.length];
              const isSelected = activeTimelineStep === index;
              return (
                <div
                  key={step.title}
                  onClick={() => setActiveTimelineStep(index)}
                  className={`group relative rounded-2xl border p-5 transition-all duration-300 cursor-pointer ${
                    isSelected
                      ? "border-[var(--aura-purple)] bg-white shadow-[0_16px_40px_rgba(111,79,216,0.14)] -translate-y-1"
                      : "border-[var(--aura-border)] bg-white/70 hover:bg-white hover:border-[var(--aura-purple)]/30 hover:-translate-y-0.5"
                  }`}
                >
                  <div className="flex items-center justify-between mb-3">
                    <span className="grid h-10 w-10 place-items-center rounded-xl bg-[var(--aura-lavender)] text-[var(--aura-purple)] font-bold text-xs transition-transform group-hover:scale-105">
                      <Icon className="h-5 w-5" />
                    </span>
                    <span className="font-display text-2xl font-bold italic text-[var(--aura-purple)]/25">
                      {String(index + 1).padStart(2, "0")}
                    </span>
                  </div>

                  <span className="inline-block px-2 py-0.5 rounded-md bg-[var(--aura-lavender)] text-[10px] font-bold uppercase tracking-wider text-[var(--aura-purple)] mb-2">
                    {step.tag}
                  </span>
                  <h3 className="text-sm font-bold text-[var(--aura-heading)] group-hover:text-[var(--aura-purple)] transition-colors">
                    {step.title}
                  </h3>
                  <p className="text-xs text-[var(--aura-body)] mt-1.5 leading-relaxed">{step.body}</p>
                </div>
              );
            })}
          </div>

          <p className="mx-auto mt-10 flex max-w-3xl items-start justify-center gap-2 text-center text-xs leading-5 text-aura-text-muted">
            <Info className="mt-0.5 h-4 w-4 shrink-0 text-[var(--aura-purple)]" aria-hidden="true" />
            <span>{copy.workflow.note}</span>
          </p>
        </Container>
      </section>

      {/* ═══ 5. ARCHITECTURE COMPARISON TABLE (Why Unified Wins) ═══ */}
      <section className="py-16 md:py-24 bg-white border-y border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-3xl text-center mb-14">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--aura-purple)]">
              Architecture Analysis
            </span>
            <h2 className="mt-3 text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Fragmented Salon Tools vs. Aura Connected OS
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed">
              Why running 3 separate apps on disjointed databases drains salon profits, creates booking leaks, and ruins customer loyalty.
            </p>
          </div>

          <div className="max-w-5xl mx-auto overflow-hidden rounded-3xl border border-[var(--aura-border)] shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-12 bg-slate-50 border-b border-[var(--aura-border)] text-xs font-bold uppercase tracking-wider text-slate-600 p-4">
              <div className="md:col-span-4">Operational Capability</div>
              <div className="md:col-span-4 text-rose-700">Fragmented Salon Stacks</div>
              <div className="md:col-span-4 text-[var(--aura-purple)]">Aura Connected Architecture</div>
            </div>

            <div className="divide-y divide-[var(--aura-border)]">
              {ARCHITECTURE_COMPARISON.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 p-4.5 text-xs gap-3 md:gap-4 items-center hover:bg-slate-50/50 transition-colors">
                  <div className="md:col-span-4 font-bold text-[var(--aura-heading)]">
                    {row.feature}
                  </div>
                  <div className="md:col-span-4 text-slate-600 flex items-start gap-2 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-rose-600 font-bold">✕</span>
                    <span>{row.fragmented}</span>
                  </div>
                  <div className="md:col-span-4 text-purple-950 font-medium flex items-start gap-2 bg-purple-50/70 p-2.5 rounded-xl border border-purple-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{row.aura}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ 6. FREQUENTLY ASKED QUESTIONS (FAQ) ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--aura-purple)]">
              Platform FAQ
            </span>
            <h2 className="mt-2 text-[clamp(1.85rem,3.5vw,2.5rem)] font-extrabold text-[var(--aura-heading)]">
              Frequently Asked Questions
            </h2>
            <p className="mt-3 text-sm text-[var(--aura-body)]">
              Everything salon owners ask about migrating to Aura&apos;s connected architecture.
            </p>
          </div>

          <div className="max-w-3xl mx-auto space-y-3">
            {FAQ_ITEMS.map((item, idx) => {
              const isOpen = activeFaq === idx;
              return (
                <div
                  key={idx}
                  className="rounded-2xl border border-[var(--aura-border)] bg-white overflow-hidden transition-all duration-200"
                >
                  <button
                    type="button"
                    onClick={() => setActiveFaq(isOpen ? null : idx)}
                    className="w-full p-5 text-left flex items-center justify-between gap-4 font-bold text-sm text-[var(--aura-heading)] hover:text-[var(--aura-purple)]"
                  >
                    <span>{item.q}</span>
                    <ChevronRight className={`h-4 w-4 shrink-0 transition-transform duration-200 ${isOpen ? "rotate-90 text-[var(--aura-purple)]" : "text-slate-400"}`} />
                  </button>
                  {isOpen && (
                    <div className="px-5 pb-5 text-xs md:text-sm text-[var(--aura-body)] leading-relaxed border-t border-slate-100 pt-3">
                      {item.a}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ 7. PLATFORM FAMILY NAVIGATION ═══ */}
      <section className="border-y border-[var(--aura-border)] bg-white py-14">
        <Container>
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--aura-muted)]">
              Explore the Complete Aura Ecosystem
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 max-w-6xl mx-auto">
            {FAMILY_LINKS.map(({ route, href, icon: Icon, desc }) => {
              const linkedPage = copy.route[route];
              const active = route === "platform";
              return (
                <Link
                  key={route}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-24 items-center gap-3.5 rounded-2xl border p-4 transition-all duration-300 ${
                    active
                      ? "border-[var(--aura-purple)]/50 bg-[var(--aura-lavender)] shadow-[0_8px_24px_rgba(111,79,216,0.12)]"
                      : "border-[var(--aura-border)] bg-white hover:border-[var(--aura-purple)]/30 hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all ${
                      active
                        ? "bg-[var(--aura-purple)] text-white shadow-sm"
                        : "bg-[var(--aura-lavender)] text-[var(--aura-purple)] group-hover:bg-[var(--aura-lavender-strong)]"
                    }`}
                  >
                    <Icon className="h-5 w-5" aria-hidden="true" />
                  </span>
                  <span className="min-w-0">
                    <strong className="block text-xs md:text-sm text-[var(--aura-heading)] truncate">
                      {linkedPage.eyebrow}
                    </strong>
                    <span className="block text-[11px] text-[var(--aura-muted)] truncate">{desc}</span>
                  </span>
                </Link>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ 8. FINAL HIGH-IMPACT CONVERSION CTA ═══ */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
        <Container className="relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div
              className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-[var(--aura-purple)]/25 bg-white shadow-md"
              aria-hidden="true"
            >
              <Workflow className="h-8 w-8 text-[var(--aura-purple)]" />
            </div>
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance leading-tight">
              Ready to unify your entire salon floor?
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">
              {copy.hero.body}
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
              <Link
                href={CTA_LINKS.demo}
                className="btn-aura-glow group inline-flex items-center gap-2 rounded-full bg-[var(--aura-purple)] px-8 py-3.5 text-sm font-bold text-white shadow-xl hover:bg-[var(--aura-purple-hover)] transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <span>{copy.common.demo}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="btn-white-glow inline-flex items-center gap-2 rounded-full border border-[var(--aura-border-strong)] bg-white px-7 py-3.5 text-sm font-semibold text-[var(--aura-heading)] shadow-md hover:border-[var(--aura-purple)]/40 transition-all hover:-translate-y-0.5"
              >
                <span>{language === "hi" ? "कीमत देखें" : "View Pricing Plans"}</span>
              </Link>
            </div>
          </div>
        </Container>
      </section>
    </>
  );
}
