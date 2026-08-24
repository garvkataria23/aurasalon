"use client";

import { useState } from "react";
import Link from "next/link";
import {
  AlertCircle,
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Coins,
  Cpu,
  CreditCard,
  DollarSign,
  FileSpreadsheet,
  FileText,
  Info,
  Layers,
  LayoutGrid,
  Lock,
  Monitor,
  Package,
  Plus,
  Printer,
  Receipt,
  RotateCcw,
  Scissors,
  ShieldAlert,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Store,
  Trash2,
  TrendingUp,
  UserCheck,
  UsersRound,
  Wallet,
  Workflow,
  Zap,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRoute } from "@/lib/ecosystem-content";
import { LandingDecor } from "@/components/landing/LandingDecor";

/* ─────────────────────────────────────────────────────────────────────────────
   CONSTANTS & CONFIG
   ───────────────────────────────────────────────────────────────────────────── */

type OwnerTab = "billing" | "calendar" | "inventory" | "closing";

const FAMILY_LINKS: Array<{ route: EcosystemRoute; href: string; icon: typeof Workflow; desc: string }> = [
  { route: "platform", href: "/platform", icon: Workflow, desc: "Unified Architecture" },
  { route: "owner", href: "/owner-crm", icon: Monitor, desc: "Reception & Owner POS" },
  { route: "customer", href: "/customer-app", icon: Smartphone, desc: "Self-Service Booking" },
  { route: "staff", href: "/staff-app", icon: UsersRound, desc: "Stylist Daily Workspace" },
  { route: "workflows", href: "/workflows", icon: ArrowRight, desc: "Full Operational Chain" },
];

const COMPARISON_STACKS = [
  {
    capability: "GST Calculation & HSN/SAC",
    generic: "Manual tax rate typing; error-prone 18% vs 5% mixed retail mistakes",
    aura: "Auto-split SAC 9997 (services @ 18%) and HSN 3305 (retail @ 18%/28%) on 1 bill",
  },
  {
    capability: "Multi-Branch Owner Visibility",
    generic: "Separate logins per branch; no live consolidated cash or staff utilization",
    aura: "Single master owner dashboard with real-time revenue rankings and cash drawers",
  },
  {
    capability: "Inventory & Recipe Consumption",
    generic: "Stock tracked only at retail sale; back-bar salon dispensary usage unrecorded",
    aura: "Service recipe engine automatically deducts color tubes, developers & serums per ticket",
  },
  {
    capability: "Staff Commission & Payouts",
    generic: "End-of-month Excel arguments over discounts, GST deductions & tip splits",
    aura: "Cryptographic attribution ledger calculated in realtime post-tax with tiered targets",
  },
];

/* ─────────────────────────────────────────────────────────────────────────────
   COMPONENT
   ───────────────────────────────────────────────────────────────────────────── */

export function OwnerCrmClient() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language as "en" | "hi"] ?? ECOSYSTEM_CONTENT.en;
  const page = copy.route.owner;

  // Active Interactive Simulator Tab
  const [activeTab, setActiveTab] = useState<OwnerTab>("billing");

  // POS Sandbox State
  const [cartItems, setCartItems] = useState([
    { name: "Balayage Highlights (Service)", price: 3800, type: "service", sac: "9997" },
    { name: "Moroccanoil Treatment 100ml (Retail)", price: 3150, type: "product", hsn: "3305" },
  ]);
  const [paymentMode, setPaymentMode] = useState<"UPI" | "Cash" | "Split">("UPI");
  const [loyaltyDiscount, setLoyaltyDiscount] = useState(true);

  const subtotal = cartItems.reduce((acc, item) => acc + item.price, 0);
  const discountAmount = loyaltyDiscount ? 500 : 0;
  const taxable = Math.max(0, subtotal - discountAmount);
  const gst = Math.round(taxable * 0.18);
  const total = taxable + gst;

  return (
    <>
      {/* ═══ 1. HERO — Royal Purple Executive View ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#1E0E38] via-[#351863] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        {/* Ambient Glows */}
        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 -left-20 h-[460px] w-[460px] rounded-full bg-purple-600/25 blur-[110px] animate-pulse" />
          <div className="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 h-64 w-[600px] rounded-full bg-fuchsia-500/15 blur-[120px]" />
        </div>

        <Container className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          {/* Eyebrow */}
          <div className="inline-flex items-center gap-2 rounded-full border border-purple-400/30 bg-purple-950/40 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-purple-200 backdrop-blur-md mb-6 shadow-md">
            <Monitor className="h-3.5 w-3.5 text-purple-300" />
            <span>{page.eyebrow} · Front Desk Command & Owner Intelligence</span>
          </div>

          <h1 className="text-[clamp(2.4rem,5.5vw,4.5rem)] font-extrabold tracking-[-0.04em] leading-[1.08] text-balance drop-shadow-sm">
            {page.title}
          </h1>

          <p className="mt-5 text-base md:text-xl text-purple-100/80 leading-relaxed max-w-3xl mx-auto text-pretty">
            {page.body}
          </p>

          {/* Action CTAs */}
          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={CTA_LINKS.demo}
              className="group inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-sm font-bold text-[#3B1473] shadow-[0_16px_36px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.32)] active:scale-[0.98]"
            >
              <span>{copy.common.demo}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/workflows"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-4 text-sm font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:border-white/50"
            >
              <Workflow className="h-4 w-4 text-purple-300" />
              <span>Inspect Booking-to-Ledger Chain</span>
            </Link>
          </div>

          {/* Value Props Bar */}
          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 max-w-4xl mx-auto text-left">
            {[
              { label: "Checkout Speed", value: "3 Clicks", desc: "GST billing with WhatsApp receipts" },
              { label: "Stock Leakage", value: "-85%", desc: "Batch & service recipe deduction" },
              { label: "Daily Closing", value: "< 2 Minutes", desc: "Cash drawer & UPI reconciliation" },
              { label: "Payroll Prep", value: "Instant", desc: "Automated staff commission ledger" },
            ].map((stat, i) => (
              <div
                key={i}
                className="rounded-2xl border border-purple-400/20 bg-purple-950/40 p-4.5 backdrop-blur-md transition-all duration-300 hover:bg-purple-900/40 hover:-translate-y-1"
              >
                <span className="text-2xl md:text-3xl font-extrabold text-white">{stat.value}</span>
                <p className="text-xs font-bold text-purple-200 mt-1">{stat.label}</p>
                <p className="text-[11px] text-purple-100/60 mt-0.5">{stat.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ 2. INTERACTIVE OWNER COMMAND CENTER SIMULATOR ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)] border-b border-[var(--aura-border)]">
        <Container size="wide">
          <div className="max-w-3xl mx-auto text-center mb-8">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/20 bg-[var(--aura-lavender)] px-4 py-1 text-xs font-bold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              <Cpu className="h-3.5 w-3.5" />
              Interactive Front Desk & Owner Terminal
            </span>
            <h2 className="text-[clamp(1.85rem,3.5vw,2.75rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Test Express Billing, Floor Schedule & Stock Control
            </h2>
            <p className="mt-3 text-sm md:text-base text-[var(--aura-body)]">
              Interact with the live modules below to test 3-click POS billing, floor appointments, batch inventory deductions, and daily closing.
            </p>
          </div>

          {/* Mode Switcher - 1 Single Flat Pill on all screens >= 640px */}
          <div className="mb-12 flex justify-center">
            <div className="inline-flex flex-wrap sm:flex-nowrap items-center justify-center gap-1.5 p-1.5 rounded-2xl bg-white border border-[var(--aura-border)] shadow-sm">
              {[
                { id: "billing", label: "1. Express GST POS", icon: Receipt },
                { id: "calendar", label: "2. Live Floor Schedule", icon: Calendar },
                { id: "inventory", label: "3. Service Recipes & Stock", icon: Package },
                { id: "closing", label: "4. End-of-Day Closing", icon: BarChart3 },
              ].map((tab) => {
                const Icon = tab.icon;
                const active = activeTab === tab.id;
                return (
                  <button
                    key={tab.id}
                    type="button"
                    onClick={() => setActiveTab(tab.id as OwnerTab)}
                    className={`flex items-center justify-center gap-2 px-3.5 sm:px-4 py-2.5 rounded-xl text-xs sm:text-sm font-bold transition-all whitespace-nowrap ${
                      active
                        ? "bg-[var(--aura-purple)] text-white shadow-sm"
                        : "text-[var(--aura-body)] hover:text-[var(--aura-heading)] hover:bg-[var(--aura-lavender)]"
                    }`}
                  >
                    <Icon className="h-4 w-4 shrink-0" />
                    <span>{tab.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Interactive Screen Display */}
          <div className="max-w-5xl mx-auto rounded-3xl border border-[var(--aura-border)] bg-white p-5 sm:p-8 shadow-[0_24px_70px_rgba(72,45,151,0.08)]">
            {/* Top Toolbar */}
            <div className="flex items-center justify-between border-b border-[var(--aura-border)] pb-4 mb-6">
              <div className="flex items-center gap-2 text-xs">
                <span className="h-3 w-3 rounded-full bg-emerald-500" />
                <span className="font-bold text-[var(--aura-heading)]">Jubilee Hills Main (Branch #1)</span>
                <span className="text-slate-400">· Terminal #04 · Cashier: Swati P.</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-mono font-bold text-purple-700 bg-purple-50 border border-purple-200 px-2.5 py-0.5 rounded-full">
                  Day Total: ₹54,800 (18 Invoices)
                </span>
              </div>
            </div>

            {/* TAB 1: EXPRESS POS BILLING */}
            {activeTab === "billing" && (
              <div className="grid md:grid-cols-12 gap-6 items-start">
                <div className="md:col-span-7 space-y-4">
                  <div className="flex justify-between items-center">
                    <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                      Invoice Items (Appointment #AUR-88219)
                    </h4>
                    <span className="text-xs text-emerald-700 font-semibold">Client: Priya S. (VIP)</span>
                  </div>

                  <div className="space-y-2">
                    {cartItems.map((item, idx) => (
                      <div key={idx} className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 flex items-center justify-between text-xs">
                        <div>
                          <p className="font-bold text-slate-900">{item.name}</p>
                          <span className="text-[10px] text-slate-500 font-mono">
                            {item.type === "service" ? `SAC: ${item.sac} · GST 18%` : `HSN: ${item.hsn} · Retail`}
                          </span>
                        </div>
                        <span className="font-mono font-bold text-slate-900">₹{item.price.toLocaleString("en-IN")}</span>
                      </div>
                    ))}
                  </div>

                  {/* Add On Buttons */}
                  <div className="pt-2">
                    <span className="text-[10px] font-bold text-slate-400 uppercase block mb-1.5">Quick Add Service Add-ons</span>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setCartItems((prev) => [...prev, { name: "Olaplex Bond Repair Add-on", price: 1200, type: "service", sac: "9997" }])}
                        className="px-3 py-1.5 rounded-lg border border-purple-200 bg-purple-50 text-purple-700 text-xs font-semibold hover:bg-purple-100"
                      >
                        + Olaplex Add-on (₹1,200)
                      </button>
                      <button
                        type="button"
                        onClick={() => setCartItems((prev) => [...prev, { name: "Scalp Detox Scrub", price: 800, type: "service", sac: "9997" }])}
                        className="px-3 py-1.5 rounded-lg border border-slate-200 text-slate-700 text-xs font-semibold hover:bg-slate-100"
                      >
                        + Scalp Scrub (₹800)
                      </button>
                    </div>
                  </div>
                </div>

                {/* Right: Payment & Split Tender */}
                <div className="md:col-span-5 p-4.5 rounded-2xl border border-purple-100 bg-gradient-to-br from-purple-50/50 to-white space-y-3.5">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">Payment Summary</span>

                  <div className="space-y-1.5 text-xs">
                    <div className="flex justify-between text-slate-600"><span>Subtotal:</span><span>₹{subtotal.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between items-center text-emerald-700">
                      <span>Redeem 500 Loyalty Points:</span>
                      <button
                        type="button"
                        onClick={() => setLoyaltyDiscount(!loyaltyDiscount)}
                        className="font-bold underline text-xs"
                      >
                        {loyaltyDiscount ? "-₹500.00 [Remove]" : "+ Redeem"}
                      </button>
                    </div>
                    <div className="flex justify-between text-slate-500"><span>GST @ 18% (SAC/HSN Auto-Calculated):</span><span>₹{gst.toLocaleString("en-IN")}</span></div>
                    <div className="flex justify-between text-base font-extrabold text-slate-900 pt-2 border-t">
                      <span>Total Amount:</span>
                      <span className="text-purple-700">₹{total.toLocaleString("en-IN")}</span>
                    </div>
                  </div>

                  {/* Payment Mode */}
                  <div>
                    <span className="text-[10px] font-bold text-slate-500 uppercase block mb-1">Select Tender Mode</span>
                    <div className="grid grid-cols-3 gap-1.5 text-xs">
                      {(["UPI", "Cash", "Split"] as const).map((mode) => (
                        <button
                          key={mode}
                          type="button"
                          onClick={() => setPaymentMode(mode)}
                          className={`py-1.5 rounded-lg font-bold border transition-all ${
                            paymentMode === mode ? "bg-[var(--aura-purple)] text-white border-[var(--aura-purple)]" : "border-slate-200 text-slate-700"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  <button
                    type="button"
                    className="w-full py-2.5 rounded-xl bg-[var(--aura-purple)] text-white font-bold text-xs shadow-md hover:bg-[var(--aura-purple-hover)] flex items-center justify-center gap-1.5"
                  >
                    <Printer className="h-3.5 w-3.5" />
                    <span>Generate Bill & Send WhatsApp</span>
                  </button>
                </div>
              </div>
            )}

            {/* TAB 2: LIVE FLOOR SCHEDULE */}
            {activeTab === "calendar" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Station & Chair Allocation (18 Bookings)
                  </h4>
                  <span className="text-xs text-purple-700 font-bold">4 Stylists Active on Floor</span>
                </div>

                <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
                  {[
                    { chair: "Chair 1 (Haircut)", stylist: "Rahul K.", client: "Vikram M.", svc: "Beard Craft & Fade", status: "Occupied (25 min left)", color: "border-purple-200 bg-purple-50/50" },
                    { chair: "Chair 2 (Haircut)", stylist: "Deepa K.", client: "Arjun R.", svc: "Haircut & Blowdry", status: "Occupied (10 min left)", color: "border-purple-200 bg-purple-50/50" },
                    { chair: "Bay 1 (Chemical)", stylist: "Ananya M.", client: "Sneha K. (VIP)", svc: "Global Highlights + Spa", status: "Developer Time (35 min)", color: "border-amber-200 bg-amber-50/50" },
                    { chair: "Spa Room 1", stylist: "Ritu S.", client: "Priya S.", svc: "Hydra Radiance Facial", status: "Reserved for 12:15 PM", color: "border-emerald-200 bg-emerald-50/50" },
                  ].map((station, i) => (
                    <div key={i} className={`p-4 rounded-2xl border ${station.color} space-y-2 text-xs`}>
                      <div className="flex justify-between items-center">
                        <span className="font-bold text-slate-900">{station.chair}</span>
                        <span className="text-[10px] font-mono text-slate-500">{station.stylist}</span>
                      </div>
                      <div>
                        <p className="font-bold text-[var(--aura-heading)]">{station.client}</p>
                        <p className="text-[11px] text-slate-600">{station.svc}</p>
                      </div>
                      <span className="inline-block text-[10px] font-semibold text-purple-900 bg-white/80 px-2 py-0.5 rounded border border-black/5">
                        {station.status}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 3: SERVICE RECIPES & STOCK */}
            {activeTab === "inventory" && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500">
                    Back-Bar Dispensary & Recipe Autopilot
                  </h4>
                  <span className="text-xs text-amber-700 font-bold">1 Low-Stock Reorder Draft Ready</span>
                </div>

                <div className="grid md:grid-cols-3 gap-3">
                  {[
                    { name: "L'Oreal Majirel 6.1 Color Tube", batch: "Batch #BL-2026", stock: "4.2 Tubes Remaining", used: "45ml deducted on ticket #88219", status: "Optimal" },
                    { name: "L'Oreal 20 Vol Oxydant Developer", batch: "Batch #OX-991", stock: "1.8 Liters Remaining", used: "60ml deducted on ticket #88219", status: "Optimal" },
                    { name: "Moroccanoil Treatment Argan Oil", batch: "Batch #AR-340", stock: "1 Bottle (Low Stock)", used: "10ml deducted on ticket #88219", status: "PO Draft Created" },
                  ].map((item, i) => (
                    <div key={i} className="p-4 rounded-2xl border border-slate-200 bg-slate-50/50 space-y-2 text-xs">
                      <div className="flex justify-between items-start">
                        <h5 className="font-bold text-slate-900">{item.name}</h5>
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${item.status === "Optimal" ? "bg-emerald-100 text-emerald-800" : "bg-amber-100 text-amber-800"}`}>
                          {item.status}
                        </span>
                      </div>
                      <p className="text-[11px] font-mono text-slate-500">{item.batch}</p>
                      <p className="text-[11px] font-bold text-slate-700">{item.stock}</p>
                      <p className="text-[10px] text-purple-700 bg-purple-50 p-1.5 rounded font-medium">⚡ {item.used}</p>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* TAB 4: END-OF-DAY CLOSING */}
            {activeTab === "closing" && (
              <div className="grid md:grid-cols-2 gap-5 items-center">
                <div className="space-y-3 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block">4-Point Closing Checklist</span>
                  <div className="space-y-2">
                    {[
                      { title: "Cash Drawer Reconciliation", desc: "Physical Cash (₹14,250) matches system count with ₹0.00 discrepancy." },
                      { title: "UPI & Card Settlement", desc: "₹40,550 verified with bank payment terminal auth logs." },
                      { title: "Stylist Commission Attribution", desc: "₹4,120 total commissions credited to 4 stylists." },
                      { title: "GST Audit Summary", desc: "Daily GSTR-1 ready sales register generated." },
                    ].map((step, i) => (
                      <div key={i} className="p-3 rounded-xl border border-emerald-200 bg-emerald-50/40 flex items-start gap-2.5">
                        <CheckCircle2 className="h-4 w-4 text-emerald-600 shrink-0 mt-0.5" />
                        <div>
                          <p className="font-bold text-slate-900">{step.title}</p>
                          <p className="text-[11px] text-slate-600">{step.desc}</p>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="p-5 rounded-2xl bg-slate-900 text-white space-y-3 font-mono text-xs shadow-inner">
                  <div className="flex justify-between border-b border-slate-800 pb-2">
                    <span className="text-slate-400">DAILY CLOSING Z-REPORT</span>
                    <span className="text-emerald-400">BALANCED ✓</span>
                  </div>
                  <div className="space-y-1 text-[11px]">
                    <div className="flex justify-between"><span>Total Invoices:</span><span>18</span></div>
                    <div className="flex justify-between"><span>Service Revenue:</span><span>₹46,200.00</span></div>
                    <div className="flex justify-between"><span>Retail Sales:</span><span>₹8,600.00</span></div>
                    <div className="flex justify-between text-purple-300"><span>Gross Revenue:</span><span>₹54,800.00</span></div>
                    <div className="flex justify-between text-slate-400"><span>CGST + SGST (18%):</span><span>₹8,359.32</span></div>
                    <div className="flex justify-between text-emerald-300"><span>Owner Net Cash:</span><span>₹42,320.68</span></div>
                  </div>
                </div>
              </div>
            )}
          </div>
        </Container>
      </section>

      {/* ═══ 3. ARCHITECTURE COMPARISON ═══ */}
      <section className="py-16 md:py-24 bg-white border-b border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-3xl text-center mb-14">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--aura-purple)]">
              Operational Comparison
            </span>
            <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Generic Retail POS vs. Aura Salon CRM & POS
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed">
              Generic billing software was built for grocery stores and retail shelves — not chair schedules, color recipes, and stylist commissions.
            </p>
          </div>

          <div className="max-w-5xl mx-auto overflow-hidden rounded-3xl border border-[var(--aura-border)] shadow-sm bg-white">
            <div className="grid grid-cols-1 md:grid-cols-12 bg-slate-50 border-b border-[var(--aura-border)] text-xs font-bold uppercase tracking-wider text-slate-600 p-4">
              <div className="md:col-span-4">Feature & Workflow</div>
              <div className="md:col-span-4 text-rose-700">Generic Retail POS</div>
              <div className="md:col-span-4 text-[var(--aura-purple)]">Aura Salon CRM & POS</div>
            </div>

            <div className="divide-y divide-[var(--aura-border)]">
              {COMPARISON_STACKS.map((row, idx) => (
                <div key={idx} className="grid grid-cols-1 md:grid-cols-12 p-4.5 text-xs gap-3 md:gap-4 items-center hover:bg-slate-50/50 transition-colors">
                  <div className="md:col-span-4 font-bold text-[var(--aura-heading)]">
                    {row.capability}
                  </div>
                  <div className="md:col-span-4 text-slate-600 flex items-start gap-2 bg-rose-50/50 p-2.5 rounded-xl border border-rose-100">
                    <span className="text-rose-600 font-bold">✕</span>
                    <span>{row.generic}</span>
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

      {/* ═══ 4. THREE OWNER OPERATING PILLARS ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)] border-b border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-12">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--aura-purple)]">
              Core Capabilities
            </span>
            <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              {page.title}
            </h2>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            {page.sections.map((section, idx) => {
              const icons = [Calendar, Receipt, BarChart3];
              const SectionIcon = icons[idx % icons.length];
              return (
                <div
                  key={section.title}
                  className="flex flex-col rounded-3xl border border-[var(--aura-border)] bg-white p-7 md:p-8 shadow-xs hover:shadow-[0_20px_50px_rgba(111,79,216,0.1)] hover:border-[var(--aura-purple)]/30 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div className="w-12 h-12 rounded-2xl bg-purple-50 text-[var(--aura-purple)] flex items-center justify-center shadow-xs">
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
              const active = route === "owner";
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

      {/* ═══ 6. FINAL CALL TO ACTION ═══ */}
      <section className="py-20 md:py-28 bg-gradient-to-br from-[#F1E9FF] via-[#E5D8FF] to-[#D7C3FF]">
        <Container className="relative z-10">
          <div className="text-center max-w-3xl mx-auto">
            <div
              className="mx-auto mb-6 grid h-16 w-16 place-items-center rounded-2xl border border-[var(--aura-purple)]/25 bg-white shadow-md"
              aria-hidden="true"
            >
              <Monitor className="h-8 w-8 text-[var(--aura-purple)]" />
            </div>
            <h2 className="text-[clamp(2rem,4.5vw,3.5rem)] font-extrabold text-[var(--aura-heading)] tracking-tight text-balance leading-tight">
              Ready to streamline your salon floor?
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">
              Get an interactive demo customized for your salon chairs, inventory catalogs, and daily billing volume.
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
