"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  Calendar,
  CheckCircle2,
  RotateCcw,
  Scissors,
  Smartphone,
  User,
  UsersRound,
  Wallet,
  Workflow,
  Monitor,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRoute } from "@/lib/ecosystem-content";
import { LandingDecor } from "@/components/landing/LandingDecor";

type ScreenTab = "book" | "manage" | "passbook" | "consult";

const FAMILY_LINKS: Array<{ route: EcosystemRoute; href: string; icon: typeof Workflow; desc: string }> = [
  { route: "platform", href: "/platform", icon: Workflow, desc: "Unified Architecture" },
  { route: "owner", href: "/owner-crm", icon: Monitor, desc: "Reception & Owner POS" },
  { route: "customer", href: "/customer-app", icon: Smartphone, desc: "Self-Service Booking" },
  { route: "staff", href: "/staff-app", icon: UsersRound, desc: "Stylist Daily Workspace" },
  { route: "workflows", href: "/workflows", icon: ArrowRight, desc: "Full Operational Chain" },
];

const COMPARISON_POINTS = [
  {
    feature: "Booking Payment Model",
    aggregator: "Mandatory advance card/UPI payment; high refund failure rates",
    aura: "Zero-barrier Pay-at-Salon model with 0% platform surcharge",
  },
  {
    feature: "Customer Data Ownership",
    aggregator: "Aggregator owns your client data and markets nearby competitors",
    aura: "Your salon owns 100% of client profiles, formulas, and history",
  },
  {
    feature: "Loyalty & Passbook Balance",
    aggregator: "Points tied to aggregator wallet with strict expiration clauses",
    aura: "Direct salon passbook with realtime points, gift cards, and prepaid credits",
  },
  {
    feature: "Stylist Selection & Notes",
    aggregator: "Generic time picker without color formula or allergen preference notes",
    aura: "Pick specific senior stylist, add hair notes, and repeat past visits in 1-tap",
  },
];

export function CustomerAppClient() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language as "en" | "hi"] ?? ECOSYSTEM_CONTENT.en;
  const page = copy.route.customer;

  const [activeTab, setActiveTab] = useState<ScreenTab>("book");
  const [selectedStylist, setSelectedStylist] = useState("Rahul (Master Stylist)");
  const [selectedService, setSelectedService] = useState("Keratin Glow Spa (₹2,800)");
  const [selectedTime, setSelectedTime] = useState("4:00 PM");
  const [isBooked, setIsBooked] = useState(false);

  return (
    <>
      {/* ═══ 1. HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#062419] via-[#0D3828] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 -left-20 h-[460px] w-[460px] rounded-full bg-emerald-500/20 blur-[110px] animate-pulse" />
          <div className="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-teal-500/20 blur-[100px]" />
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 h-64 w-[600px] rounded-full bg-emerald-600/15 blur-[120px]" />
        </div>

        <Container className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-950/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-emerald-200 backdrop-blur-md mb-6 shadow-md">
            <Smartphone className="h-3.5 w-3.5 text-emerald-300" />
            <span>{page.eyebrow} · Direct Client Self-Service</span>
          </div>

          <h1 className="text-[clamp(2.4rem,5.5vw,4.5rem)] font-extrabold tracking-[-0.04em] leading-[1.08] text-balance drop-shadow-sm">
            {page.title}
          </h1>

          <p className="mt-5 text-base md:text-xl text-emerald-100/80 leading-relaxed max-w-3xl mx-auto text-pretty">
            {page.body}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={CTA_LINKS.demo}
              className="group inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-sm font-bold text-[#064e3b] shadow-[0_16px_36px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.32)] active:scale-[0.98]"
            >
              <span>{copy.common.demo}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/workflows"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-4 text-sm font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:border-white/50"
            >
              <Workflow className="h-4 w-4 text-emerald-300" />
              <span>See Full Booking Workflow</span>
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 max-w-4xl mx-auto text-left">
            {[
              { label: "Commission Fee", value: "0% Always", desc: "No middleman marketplace cut" },
              { label: "Booking Barrier", value: "Pay at Salon", desc: "No compulsory online payment" },
              { label: "1-Tap Rebooking", value: "< 5 Seconds", desc: "Repeat favorite stylist service" },
              { label: "Passbook Sync", value: "Real-time", desc: "Points, gift cards & package credits" },
            ].map((stat, i) => (
              <div
                key={i}
                className="rounded-2xl border border-emerald-400/20 bg-emerald-950/40 p-4.5 backdrop-blur-md transition-all duration-300 hover:bg-emerald-900/40 hover:-translate-y-1"
              >
                <span className="text-2xl md:text-3xl font-extrabold text-white">{stat.value}</span>
                <p className="text-xs font-bold text-emerald-200 mt-1">{stat.label}</p>
                <p className="text-[11px] text-emerald-100/60 mt-0.5">{stat.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ 2. INTERACTIVE PHONE SIMULATOR ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)] border-b border-[var(--aura-border)]">
        <Container size="wide">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-emerald-600/20 bg-emerald-50 px-4 py-1 text-xs font-bold uppercase tracking-[.14em] text-emerald-800 mb-3">
              <Smartphone className="h-3.5 w-3.5 text-emerald-600" />
              Live Interactive Client Simulator
            </span>
            <h2 className="text-[clamp(1.85rem,3.5vw,2.75rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Test how clients book & manage visits in seconds
            </h2>
            <p className="mt-3 text-sm md:text-base text-[var(--aura-body)]">
              Interact with the mobile screen below to experience seamless booking, digital passbook review, and 1-tap appointment reschedule.
            </p>

            {/* Screen View Mode Switcher - Single line pill layout */}
            <div className="mt-8 inline-grid grid-cols-2 md:grid-cols-4 gap-1.5 sm:gap-2 p-1.5 rounded-2xl bg-white border border-[var(--aura-border)] shadow-sm max-w-4xl mx-auto w-full md:w-auto">
              {[
                { id: "book", label: "1. Pay-at-Salon Booking", icon: Scissors },
                { id: "manage", label: "2. Manage & Reschedule", icon: Calendar },
                { id: "passbook", label: "3. Digital Passbook & Wallet", icon: Wallet },
                { id: "consult", label: "4. Hair & Skin Profile", icon: User },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as ScreenTab)}
                    className={`flex items-center justify-center gap-1.5 sm:gap-2 px-3 sm:px-4 py-2.5 rounded-xl text-xs sm:text-[13px] font-bold transition-all whitespace-nowrap ${
                      active
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "text-[var(--aura-body)] hover:text-[var(--aura-heading)] hover:bg-emerald-50"
                    }`}
                  >
                    <Icon className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          <div className="max-w-4xl mx-auto grid grid-cols-1 md:grid-cols-12 gap-8 items-center">
            <div className="md:col-span-6 space-y-4">
              {activeTab === "book" && (
                <>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    No Upfront Card Payments
                  </span>
                  <h3 className="text-2xl font-bold text-[var(--aura-heading)]">Direct Booking with Stylist Preferences</h3>
                  <p className="text-xs md:text-sm text-[var(--aura-body)] leading-relaxed">
                    Clients select specific services, choose their favorite stylist, and lock in a confirmed chair slot without entering credit card details or paying marketplace processing surcharges.
                  </p>
                  <div className="space-y-2.5 pt-2">
                    {[
                      "Zero checkout abandonment from failed OTPs or payment gateways",
                      "Instant sync with Salon Reception Calendar & Stylist Shift Feed",
                      "Automated 2-way WhatsApp appointment confirmation dispatch",
                    ].map((bullet, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[var(--aura-body)] font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "manage" && (
                <>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Self-Service Flexibility
                  </span>
                  <h3 className="text-2xl font-bold text-[var(--aura-heading)]">Reschedule or Cancel in 1 Tap</h3>
                  <p className="text-xs md:text-sm text-[var(--aura-body)] leading-relaxed">
                    Plans change. Instead of calling busy salon reception desks, clients can modify their appointment time or switch stylists up to 2 hours before the scheduled slot.
                  </p>
                  <div className="space-y-2.5 pt-2">
                    {[
                      "Prevents last-minute no-shows through interactive WhatsApp confirmations",
                      "Frees reception staff from handling routine rescheduling calls",
                      "Instantly reopens cancelled slots for walk-in lounge customers",
                    ].map((bullet, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[var(--aura-body)] font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "passbook" && (
                <>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Read-Only Digital Passbook
                  </span>
                  <h3 className="text-2xl font-bold text-[var(--aura-heading)]">Prepaid Packages, Wallet & Loyalty</h3>
                  <p className="text-xs md:text-sm text-[var(--aura-body)] leading-relaxed">
                    Clients can inspect remaining sessions on prepaid packages, check loyalty point balances, and download past GST tax invoices directly to their phones.
                  </p>
                  <div className="space-y-2.5 pt-2">
                    {[
                      "Full transparency on package validity and session redemption history",
                      "Download official GST tax invoices for expense reimbursements",
                      "Eliminates lost paper membership cards and coupon vouchers",
                    ].map((bullet, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[var(--aura-body)] font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}

              {activeTab === "consult" && (
                <>
                  <span className="text-xs font-bold uppercase tracking-wider text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-full border border-emerald-200">
                    Personalized Salon Profile
                  </span>
                  <h3 className="text-2xl font-bold text-[var(--aura-heading)]">Color Formulas & Skin Allergy Notes</h3>
                  <p className="text-xs md:text-sm text-[var(--aura-body)] leading-relaxed">
                    Stylists store exact color mix ratios and allergy disclosures under the client profile. The client can view their stylist history and notes before booking their next visit.
                  </p>
                  <div className="space-y-2.5 pt-2">
                    {[
                      "Consistent haircut and color results even when visiting other branches",
                      "Recorded patch test safety dates and allergic compound warnings",
                      "1-tap rebooking with the exact same service and stylist pairing",
                    ].map((bullet, i) => (
                      <div key={i} className="flex items-start gap-2 text-xs text-[var(--aura-body)] font-medium">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <span>{bullet}</span>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </div>

            <div className="md:col-span-6 flex justify-center">
              <div className="w-[300px] sm:w-[320px] rounded-[2.5rem] border-[6px] border-slate-900 bg-slate-900 p-2.5 shadow-[0_25px_60px_rgba(0,0,0,0.25)] ring-1 ring-slate-800">
                <div className="rounded-[2rem] bg-white text-slate-900 p-4 min-h-[480px] flex flex-col justify-between overflow-hidden relative">
                  <div className="flex items-center justify-between border-b pb-2.5 text-xs">
                    <div className="flex items-center gap-1.5">
                      <div className="h-6 w-6 rounded-full bg-emerald-700 text-white font-bold text-[10px] flex items-center justify-center">
                        A
                      </div>
                      <span className="font-bold text-xs">Aura Salon & Spa</span>
                    </div>
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-full">
                      Jubilee Hills
                    </span>
                  </div>

                  {activeTab === "book" && (
                    <div className="space-y-3 py-2 text-xs">
                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Select Service</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {["Keratin Glow Spa (₹2,800)", "Balayage Highlights (₹3,800)"].map((s) => (
                            <button
                              key={s}
                              type="button"
                              onClick={() => setSelectedService(s)}
                              className={`p-2 rounded-xl border text-[11px] font-semibold text-left transition-all ${
                                selectedService === s ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold" : "border-slate-200"
                              }`}
                            >
                              {s}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Select Stylist</span>
                        <div className="grid grid-cols-2 gap-1.5 mt-1">
                          {["Rahul (Master Stylist)", "Ananya (Sr. Colorist)"].map((st) => (
                            <button
                              key={st}
                              type="button"
                              onClick={() => setSelectedStylist(st)}
                              className={`p-2 rounded-xl border text-[11px] font-semibold text-left transition-all ${
                                selectedStylist === st ? "border-emerald-600 bg-emerald-50 text-emerald-900 font-bold" : "border-slate-200"
                              }`}
                            >
                              {st}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div>
                        <span className="text-[10px] font-bold text-slate-500 uppercase">Available Time Slot</span>
                        <div className="flex gap-1.5 mt-1">
                          {["11:15 AM", "2:30 PM", "4:00 PM"].map((t) => (
                            <button
                              key={t}
                              type="button"
                              onClick={() => setSelectedTime(t)}
                              className={`px-3 py-1.5 rounded-lg border text-[11px] font-semibold ${
                                selectedTime === t ? "bg-emerald-700 text-white border-emerald-700" : "border-slate-200"
                              }`}
                            >
                              {t}
                            </button>
                          ))}
                        </div>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 text-[11px] space-y-1">
                        <div className="flex justify-between text-slate-600"><span>Payment Method:</span><span className="font-bold text-emerald-700">Pay at Salon</span></div>
                        <div className="flex justify-between text-slate-600"><span>Advance Fee:</span><span className="font-bold text-emerald-700">₹0.00 (Zero)</span></div>
                      </div>

                      <button
                        type="button"
                        onClick={() => setIsBooked(true)}
                        className="w-full py-2.5 rounded-xl bg-emerald-700 text-white font-bold text-xs shadow-md hover:bg-emerald-800 transition-all"
                      >
                        {isBooked ? "✓ Confirmed (SMS Sent)" : "Confirm Pay-at-Salon Booking"}
                      </button>
                    </div>
                  )}

                  {activeTab === "manage" && (
                    <div className="space-y-3 py-2 text-xs">
                      <div className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/60 space-y-1.5">
                        <span className="text-[10px] font-bold text-emerald-800 uppercase block">Upcoming Appointment</span>
                        <h4 className="font-bold text-sm text-slate-900">Keratin Glow Spa & Haircut</h4>
                        <p className="text-[11px] text-slate-600">Sat, 24 Aug · 4:00 PM · Stylist: Rahul</p>
                        <span className="inline-block mt-1 text-[10px] font-bold px-2 py-0.5 rounded bg-emerald-200 text-emerald-900">
                          Confirmed (Pay at Salon: ₹2,800)
                        </span>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        <button
                          type="button"
                          className="py-2 px-3 rounded-xl border border-slate-300 font-bold text-[11px] text-slate-700 hover:bg-slate-50"
                        >
                          Reschedule Slot
                        </button>
                        <button
                          type="button"
                          className="py-2 px-3 rounded-xl border border-rose-200 bg-rose-50 font-bold text-[11px] text-rose-700 hover:bg-rose-100"
                        >
                          Cancel Visit
                        </button>
                      </div>

                      <div className="p-2.5 rounded-xl bg-slate-50 border border-slate-200 space-y-1 text-[11px]">
                        <span className="font-bold text-slate-700 block">Salon Contact & Location</span>
                        <p className="text-slate-500">Road No. 36, Jubilee Hills, Hyderabad</p>
                        <p className="text-emerald-700 font-semibold">+91 98490 12345</p>
                      </div>
                    </div>
                  )}

                  {activeTab === "passbook" && (
                    <div className="space-y-3 py-2 text-xs">
                      <div className="p-3.5 rounded-2xl bg-gradient-to-br from-emerald-800 to-teal-900 text-white space-y-2 shadow-sm">
                        <div className="flex justify-between items-center text-[10px] text-emerald-200">
                          <span>VIP Passbook</span>
                          <span>Aura Loyalty Club</span>
                        </div>
                        <p className="text-2xl font-bold font-mono">850 Points</p>
                        <p className="text-[10px] text-emerald-100/80">Worth ₹850 redeemable on your next visit</p>
                      </div>

                      <div className="space-y-1.5">
                        <span className="text-[10px] font-bold uppercase text-slate-500">Active Packages & Invoices</span>
                        <div className="p-2.5 rounded-xl border border-slate-200 text-[11px] flex justify-between items-center">
                          <div>
                            <p className="font-bold text-slate-800">Bridal Skin Radiance (5 Sessions)</p>
                            <p className="text-[10px] text-emerald-700 font-semibold">2 Sessions Remaining</p>
                          </div>
                          <span className="text-[10px] bg-slate-100 px-2 py-0.5 rounded font-mono">Valid 60d</span>
                        </div>
                        <div className="p-2.5 rounded-xl border border-slate-200 text-[11px] flex justify-between items-center">
                          <div>
                            <p className="font-bold text-slate-800">Invoice #INV-8102 (₹3,400)</p>
                            <p className="text-[10px] text-slate-500">Paid on 12 Aug via UPI</p>
                          </div>
                          <button type="button" className="text-emerald-700 font-bold text-[10px]">PDF ↓</button>
                        </div>
                      </div>
                    </div>
                  )}

                  {activeTab === "consult" && (
                    <div className="space-y-3 py-2 text-xs">
                      <div className="p-3 rounded-xl border border-purple-200 bg-purple-50/70 space-y-1">
                        <span className="text-[10px] font-bold text-purple-700 uppercase block">Saved Color Formula</span>
                        <h4 className="font-bold text-xs text-slate-900">Majirel 6.1 Ash Brown + 20vol</h4>
                        <p className="text-[10px] text-slate-600">Saved by Rahul on 12 Jul 2026</p>
                      </div>

                      <div className="p-3 rounded-xl border border-amber-200 bg-amber-50/70 space-y-1">
                        <span className="text-[10px] font-bold text-amber-800 uppercase block">Allergy & Scalp Notes</span>
                        <p className="text-[11px] text-slate-700">Sensitive scalp — use sulfate-free shampoo only.</p>
                      </div>

                      <button
                        type="button"
                        className="w-full py-2 rounded-xl bg-purple-700 text-white font-bold text-xs shadow-xs"
                      >
                        1-Tap Rebook This Exact Service
                      </button>
                    </div>
                  )}

                  <div className="border-t pt-2 flex justify-around text-[10px] font-bold text-slate-500">
                    <span className="text-emerald-700">Book</span>
                    <span>Visits</span>
                    <span>Passbook</span>
                    <span>Profile</span>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ 3. DIRECT CUSTOMER APP VS AGGREGATOR MARKETPLACES ═══ */}
      <section className="py-16 md:py-24 bg-white border-b border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-3xl text-center mb-14">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">
              Zero-Commission Advantage
            </span>
            <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Why Salon Owners & Clients Love Direct Aura Booking
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed">
              Stop losing 15–25% commission to 3rd-party aggregators who hijack your client base and promote competing salons.
            </p>
          </div>

          <div className="max-w-5xl mx-auto overflow-hidden rounded-3xl border border-[var(--aura-border)] shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-12 bg-slate-50 border-b border-[var(--aura-border)] text-xs font-bold uppercase tracking-wider text-slate-600 p-4">
              <div className="md:col-span-4">Booking Experience</div>
              <div className="md:col-span-4 text-rose-700">3rd-Party Marketplace Apps</div>
              <div className="md:col-span-4 text-emerald-800">Aura Direct Customer App</div>
            </div>

            <div className="divide-y divide-[var(--aura-border)]">
              {COMPARISON_POINTS.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 p-4.5 text-xs gap-3 md:gap-4 items-center hover:bg-slate-50/50 transition-colors">
                  <div className="md:col-span-4 font-bold text-[var(--aura-heading)]">
                    {row.feature}
                  </div>
                  <div className="md:col-span-4 text-slate-600 flex items-start gap-2 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-rose-600 font-bold">✕</span>
                    <span>{row.aggregator}</span>
                  </div>
                  <div className="md:col-span-4 text-emerald-950 font-medium flex items-start gap-2 bg-emerald-50/70 p-2.5 rounded-xl border border-emerald-100">
                    <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                    <span>{row.aura}</span>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ 4. CORE CAPABILITY PILLARS ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)] border-b border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-emerald-700">
              Customer Touchpoints
            </span>
            <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              {page.title}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            {page.sections.map((section, idx) => {
              const icons = [Calendar, RotateCcw, Wallet];
              const SectionIcon = icons[idx % icons.length];
              return (
                <div
                  key={section.title}
                  className="flex flex-col rounded-3xl border border-[var(--aura-border)] bg-white p-7 md:p-8 shadow-xs hover:shadow-[0_20px_50px_rgba(5,150,105,0.1)] hover:border-emerald-600/30 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-emerald-50 text-emerald-700 flex items-center justify-center shadow-xs">
                      <SectionIcon className="w-6 h-6" />
                    </div>
                    <span className="text-2xl font-display font-bold italic text-slate-300">
                      0{idx + 1}
                    </span>
                  </div>

                  <h3 className="text-xl font-bold text-[var(--aura-heading)] mb-2">
                    {section.title}
                  </h3>
                  <p className="text-xs text-[var(--aura-body)] leading-relaxed mb-6">
                    {section.body}
                  </p>

                  <div className="space-y-2.5 mb-6 pt-4 border-t border-[var(--aura-border)]/60">
                    {section.items.map((item) => (
                      <div key={item} className="flex items-start gap-2.5 text-xs text-[var(--aura-body)] font-medium">
                        <CheckCircle2 className="mt-0.5 h-3.5 w-3.5 shrink-0 text-emerald-600" />
                        <span>{item}</span>
                      </div>
                    ))}
                  </div>

                  {section.note && (
                    <div className="mt-auto rounded-xl bg-amber-50/70 border border-amber-200/60 p-3 text-[11px] text-amber-900 leading-snug">
                      <strong>Note: </strong>
                      {section.note}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </Container>
      </section>

      {/* ═══ 5. PLATFORM FAMILY NAVIGATION ═══ */}
      <section className="border-y border-[var(--aura-border)] bg-white py-14">
        <Container>
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--aura-muted)]">
              Explore Connected Experiences
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 max-w-6xl mx-auto">
            {FAMILY_LINKS.map(({ route, href, icon: Icon, desc }) => {
              const linkedPage = copy.route[route];
              const active = route === "customer";
              return (
                <Link
                  key={route}
                  href={href}
                  aria-current={active ? "page" : undefined}
                  className={`group flex min-h-24 items-center gap-3.5 rounded-2xl border p-4 transition-all duration-300 ${
                    active
                      ? "border-emerald-600/50 bg-emerald-50 shadow-[0_8px_24px_rgba(5,150,105,0.12)]"
                      : "border-[var(--aura-border)] bg-white hover:border-emerald-600/30 hover:-translate-y-0.5 hover:shadow-md"
                  }`}
                >
                  <span
                    className={`grid h-10 w-10 shrink-0 place-items-center rounded-xl transition-all ${
                      active
                        ? "bg-emerald-700 text-white shadow-sm"
                        : "bg-emerald-50 text-emerald-700 group-hover:bg-emerald-100"
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

      {/* ═══ 6. FINAL CALL TO ACTION ═══ */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#E6F4EA] via-[#D1E7DD] to-[#BFE3D4]">
        <Container className="relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div
              className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-emerald-600/25 bg-white shadow-md"
              aria-hidden="true"
            >
              <Smartphone className="h-8 w-8 text-emerald-700" />
            </div>
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance leading-tight">
              Give your clients an effortless booking experience
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">
              Launch your direct booking widget and customer app with zero commission and instant WhatsApp notifications.
            </p>
            <div className="flex flex-wrap items-center justify-center gap-3.5 mt-8">
              <Link
                href={CTA_LINKS.demo}
                className="group inline-flex items-center gap-2 rounded-full bg-emerald-700 px-8 py-3.5 text-sm font-bold text-white shadow-xl hover:bg-emerald-800 transition-all hover:-translate-y-0.5 active:scale-[0.98]"
              >
                <span>{copy.common.demo}</span>
                <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
              </Link>
              <Link
                href="/pricing"
                className="btn-white-glow inline-flex items-center gap-2 rounded-full border border-[var(--aura-border-strong)] bg-white px-7 py-3.5 text-sm font-semibold text-[var(--aura-heading)] shadow-md hover:border-emerald-600/40 transition-all hover:-translate-y-0.5"
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
