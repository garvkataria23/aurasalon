"use client";

import { useState } from "react";
import Link from "next/link";
import {
  ArrowRight,
  BarChart3,
  Calendar,
  CheckCircle2,
  ChevronRight,
  Clock,
  Cpu,
  Info,
  Layers,
  Monitor,
  Receipt,
  Smartphone,
  UsersRound,
  Workflow,
} from "lucide-react";
import { Container } from "@/components/ui/Container";
import { CTA_LINKS } from "@/lib/constants";
import { useLanguage } from "@/components/providers/LanguageProvider";
import { ECOSYSTEM_CONTENT, type EcosystemRoute } from "@/lib/ecosystem-content";
import { LandingDecor } from "@/components/landing/LandingDecor";

type WorkflowStep = {
  id: number;
  stage: string;
  actor: "Customer" | "Front Desk" | "Stylist" | "POS & Inventory" | "Owner";
  actorBadgeColor: string;
  title: string;
  shortDesc: string;
  details: string;
  triggerEvent: string;
  downstreamImpact: string;
  livePayload: {
    title: string;
    items: Array<{ label: string; value: string }>;
  };
};

const WORKFLOW_STEPS: WorkflowStep[] = [
  {
    id: 1,
    stage: "01 · Discovery & Slot Reservation",
    actor: "Customer",
    actorBadgeColor: "bg-emerald-100 text-emerald-800 border-emerald-200",
    title: "Client Books Hair Highlights & Spa",
    shortDesc: "Customer chooses stylist Rahul, picks 11:15 AM slot with 0% prepayment.",
    details:
      "Customer browses salon profile, selects senior stylist Rahul, and books a 11:15 AM slot. No advance fee or aggregator commission charged.",
    triggerEvent: "Client triggers pay-at-salon booking via Mobile App / Web Widget",
    downstreamImpact: "Blocks Chair #3 on Owner calendar; stages inventory recipe requirements automatically.",
    livePayload: {
      title: "Booking Intent Payload",
      items: [
        { label: "Client Name", value: "Priya S. (VIP Tier)" },
        { label: "Service", value: "Balayage Highlights + Keratin" },
        { label: "Preferred Stylist", value: "Rahul Kumar (Sr. Colorist)" },
        { label: "Scheduled Slot", value: "Today, 11:15 AM (120 min)" },
        { label: "Payment Mode", value: "Pay at Salon (Due ₹4,800)" },
      ],
    },
  },
  {
    id: 2,
    stage: "02 · Real-Time Floor Dispatch",
    actor: "Front Desk",
    actorBadgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    title: "Appointment Enters Calendar & Station Schedule",
    shortDesc: "Reception calendar marks chair occupied, prepares client color history.",
    details:
      "Reception team sees incoming booking instantly. Client history (previous formula #K92) and allergy alerts load onto the station tablet without paper slips.",
    triggerEvent: "Tenant database syncs new booking event across local devices",
    downstreamImpact: "Sends 2-way WhatsApp reminder & pre-visit consultation questionnaire to client.",
    livePayload: {
      title: "Floor Dispatch Context",
      items: [
        { label: "Station Assigned", value: "Color Bay #2 / Chair 3" },
        { label: "Client History", value: "Last visit: 38 days ago" },
        { label: "Color Formula", value: "Majirel 6.1 + 20vol (45ml)" },
        { label: "WhatsApp Status", value: "Confirmation Sent (Read ✓✓)" },
        { label: "Buffer Time", value: "15 min sanitize buffer auto-added" },
      ],
    },
  },
  {
    id: 3,
    stage: "03 · Stylist Workday Notification",
    actor: "Stylist",
    actorBadgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    title: "Assigned to Rahul's Mobile Workday Feed",
    shortDesc: "Stylist app notifies Rahul, displays client notes and recipe instructions.",
    details:
      "Rahul sees the assignment on his phone app. He reviews client preferences and confirms preparation of developer supplies.",
    triggerEvent: "Stylist shift roster receives appointment link",
    downstreamImpact: "Updates salon capacity dashboard and live waitlist token displays in the lounge.",
    livePayload: {
      title: "Stylist Feed Payload",
      items: [
        { label: "Stylist Roster", value: "Rahul Kumar (Shift: 10–19)" },
        { label: "Today's Target", value: "₹8,000 / ₹10,000 (80%)" },
        { label: "Estimated Commission", value: "₹720 on completion" },
        { label: "Client Preference", value: "Warm honey undertones" },
        { label: "Special Note", value: "Allergic to strong fragrances" },
      ],
    },
  },
  {
    id: 4,
    stage: "04 · Chair Service & Recipe Consumption",
    actor: "Stylist",
    actorBadgeColor: "bg-amber-100 text-amber-800 border-amber-200",
    title: "Service Execution & Batch Dispensing",
    shortDesc: "Rahul records 45ml color tube + 10ml Argan serum usage.",
    details:
      "As the service completes, Rahul adds an extra deep-conditioning treatment requested during consultation. The recipe engine stages stock deductions.",
    triggerEvent: "Add-on treatment approved by client at the wash basin",
    downstreamImpact: "Prepares invoice line items on Front Desk POS ready for 1-click closing.",
    livePayload: {
      title: "Consumption & Add-on Log",
      items: [
        { label: "Primary Service", value: "Balayage Highlights (₹3,800)" },
        { label: "Add-on Service", value: "Olaplex Bond Multiplier (+₹1,000)" },
        { label: "Color Dispensed", value: "45ml (Batch #BL-2026)" },
        { label: "Serum Dispensed", value: "10ml (Batch #AR-990)" },
        { label: "Service Duration", value: "115 min (Finished on time)" },
      ],
    },
  },
  {
    id: 5,
    stage: "05 · 3-Click GST POS Checkout",
    actor: "POS & Inventory",
    actorBadgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    title: "Express Billing with Split Tender",
    shortDesc: "Bill calculated with 18% GST, split payment (UPI + Loyalty Points) & Tip.",
    details:
      "Front desk opens the pre-populated bill. Client redeems 500 loyalty points and pays balance ₹4,300 via UPI QR code with a ₹200 stylist tip.",
    triggerEvent: "Receptionist clicks 'Pay & Print / WhatsApp Bill'",
    downstreamImpact: "Auto-deducts inventory levels, sends PDF invoice to WhatsApp, and triggers staff commission ledger.",
    livePayload: {
      title: "GST Invoice #INV-88219",
      items: [
        { label: "Taxable Value", value: "₹4,067.80 (SAC 9997)" },
        { label: "CGST (9%) + SGST (9%)", value: "₹732.20" },
        { label: "Loyalty Redemption", value: "-₹500.00 (500 pts)" },
        { label: "Net Paid via UPI", value: "₹4,300.00 (Auth #UP9812)" },
        { label: "Stylist Tip Added", value: "₹200.00 (Direct to Rahul)" },
      ],
    },
  },
  {
    id: 6,
    stage: "06 · Inventory Autopilot Deduction",
    actor: "POS & Inventory",
    actorBadgeColor: "bg-blue-100 text-blue-800 border-blue-200",
    title: "Batch & Expiry Aware Stock Reduction",
    shortDesc: "45ml color cream & 10ml serum decremented from stock room ledger.",
    details:
      "Aura's backend deducts exact measured usage from the specific batch. If reorder thresholds are reached, an automatic PO draft is prepared for the owner.",
    triggerEvent: "Invoice status updated to 'PAID'",
    downstreamImpact: "Updates inventory valuation report and cost-of-goods-sold (COGS) metric.",
    livePayload: {
      title: "Stock Movement Journal",
      items: [
        { label: "Stock Room", value: "Color Dispensary #1" },
        { label: "Product 1", value: "L'Oreal Majirel 6.1 (Remain: 4.2 tubes)" },
        { label: "Product 2", value: "Moroccanoil Serum (Remain: 820ml)" },
        { label: "Reorder Trigger", value: "Normal (No PO needed)" },
        { label: "COGS Logged", value: "₹385.00 for this appointment" },
      ],
    },
  },
  {
    id: 7,
    stage: "07 · Automated Staff Attribution",
    actor: "Owner",
    actorBadgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    title: "Commission Calculated Without Disputes",
    shortDesc: "Rahul credited 15% tier commission + 100% of ₹200 digital tip.",
    details:
      "System logs Rahul's payout: 15% service cut (post-tax deduction) + tip. Rahul can verify his earnings immediately on his phone without waiting for monthly payroll sheets.",
    triggerEvent: "Service completion attributed to primary stylist ID",
    downstreamImpact: "Feeds monthly biometric payroll compliance export & daily staff sales performance leaderboard.",
    livePayload: {
      title: "Attribution Ledger Entry",
      items: [
        { label: "Stylist", value: "Rahul Kumar" },
        { label: "Commission Rate", value: "15% (Tier 2 Target Met)" },
        { label: "Commission Amount", value: "₹610.17" },
        { label: "Tip Share", value: "₹200.00 (100% Staff Retained)" },
        { label: "Total Shift Earnings", value: "₹810.17 credited" },
      ],
    },
  },
  {
    id: 8,
    stage: "08 · Daily Closing & Profit Intelligence",
    actor: "Owner",
    actorBadgeColor: "bg-purple-100 text-purple-800 border-purple-200",
    title: "Financial Journal & Multi-Branch Review",
    shortDesc: "End-of-day cash drawer reconciliation, GST report & profit margin summary.",
    details:
      "At 9:00 PM, the owner reviews the daily closing summary. Cash in drawer matches digital count to the rupee, revenue is categorized by service and retail.",
    triggerEvent: "Manager completes 4-point Daily Closing Checklist",
    downstreamImpact: "Locks tenant audit ledger; delivers executive briefing digest to owner's phone.",
    livePayload: {
      title: "Daily Closing Digest",
      items: [
        { label: "Day Revenue", value: "₹54,800 (18 visits)" },
        { label: "Gross Margin", value: "78.4% (COGS ₹11,840)" },
        { label: "Cash Discrepancy", value: "₹0.00 (100% Balanced)" },
        { label: "New VIP Retained", value: "+3 Clients joined loyalty" },
        { label: "Branch Comparison", value: "Jubilee Hills: #1 in Chain" },
      ],
    },
  },
];

const FAMILY_LINKS: Array<{ route: EcosystemRoute; href: string; icon: typeof Workflow; desc: string }> = [
  { route: "platform", href: "/platform", icon: Workflow, desc: "Unified Architecture" },
  { route: "owner", href: "/owner-crm", icon: Monitor, desc: "Reception & Owner POS" },
  { route: "customer", href: "/customer-app", icon: Smartphone, desc: "Self-Service Booking" },
  { route: "staff", href: "/staff-app", icon: UsersRound, desc: "Stylist Daily Workspace" },
  { route: "workflows", href: "/workflows", icon: ArrowRight, desc: "Full Operational Chain" },
];

export function WorkflowsClient() {
  const { language } = useLanguage();
  const copy = ECOSYSTEM_CONTENT[language as "en" | "hi"] ?? ECOSYSTEM_CONTENT.en;
  const page = copy.route.workflows;

  const [activeStepId, setActiveStepId] = useState<number>(1);
  const activeStep = WORKFLOW_STEPS.find((s) => s.id === activeStepId) || WORKFLOW_STEPS[0];

  return (
    <>
      {/* ═══ 1. HERO ═══ */}
      <section className="relative overflow-hidden bg-gradient-to-b from-[#190C30] via-[#2D1357] to-[#FCFBF8] text-white pt-28 pb-20 md:pt-36 md:pb-28">
        <LandingDecor variant="hero" />

        <div className="pointer-events-none absolute inset-0" aria-hidden="true">
          <div className="absolute -top-24 -left-20 h-[460px] w-[460px] rounded-full bg-purple-600/20 blur-[110px] animate-pulse" />
          <div className="absolute -right-20 top-1/3 h-96 w-96 rounded-full bg-indigo-500/20 blur-[100px]" />
          <div className="absolute left-1/2 bottom-0 -translate-x-1/2 h-64 w-[600px] rounded-full bg-fuchsia-500/15 blur-[120px]" />
        </div>

        <Container className="relative z-10 max-w-5xl mx-auto px-4 text-center">
          <div className="inline-flex items-center gap-2 rounded-full border border-white/25 bg-white/10 px-4 py-1.5 text-xs font-bold uppercase tracking-[.16em] text-white/95 backdrop-blur-md mb-6 shadow-md transition-all hover:border-white/40 hover:bg-white/15">
            <Workflow className="h-3.5 w-3.5 text-amber-300 animate-spin" style={{ animationDuration: "12s" }} />
            <span>{page.eyebrow} · Traceable Salon Operating Chain</span>
          </div>

          <h1 className="text-[clamp(2.4rem,5.5vw,4.5rem)] font-extrabold tracking-[-0.04em] leading-[1.08] text-balance drop-shadow-sm">
            {page.title}
          </h1>

          <p className="mt-5 text-base md:text-xl text-white/80 leading-relaxed max-w-3xl mx-auto text-pretty">
            {page.body}
          </p>

          <div className="mt-8 flex flex-wrap items-center justify-center gap-4">
            <Link
              href={CTA_LINKS.demo}
              className="group inline-flex items-center gap-2.5 rounded-full bg-white px-8 py-4 text-sm font-bold text-[#4B1E8A] shadow-[0_16px_36px_rgba(0,0,0,0.25)] transition-all hover:-translate-y-0.5 hover:shadow-[0_20px_48px_rgba(0,0,0,0.32)] active:scale-[0.98]"
            >
              <span>{copy.common.demo}</span>
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
            </Link>
            <Link
              href="/platform"
              className="inline-flex items-center gap-2 rounded-full border border-white/30 bg-white/10 px-7 py-4 text-sm font-semibold text-white backdrop-blur-md transition-all hover:-translate-y-0.5 hover:bg-white/20 hover:border-white/50"
            >
              <Layers className="h-4 w-4 text-purple-300" />
              <span>Inspect Platform Architecture</span>
            </Link>
          </div>

          <div className="mt-14 grid grid-cols-2 md:grid-cols-4 gap-3.5 sm:gap-4 max-w-4xl mx-auto text-left">
            {[
              { label: "Handoff Latency", value: "< 100ms", desc: "Instant sync across Front Desk & App" },
              { label: "Double Data Entry", value: "0 times", desc: "1 booking record feeds POS & Payroll" },
              { label: "Recipe Accuracy", value: "100%", desc: "Batch & gram usage tracked per ticket" },
              { label: "Dispute Reduction", value: "98%", desc: "Cryptographic attribution ledger" },
            ].map((stat, i) => (
              <div
                key={i}
                className="rounded-2xl border border-white/15 bg-white/[0.08] p-4.5 backdrop-blur-md transition-all duration-300 hover:bg-white/[0.14] hover:-translate-y-1"
              >
                <span className="text-2xl md:text-3xl font-extrabold text-white">{stat.value}</span>
                <p className="text-xs font-bold text-white/90 mt-1">{stat.label}</p>
                <p className="text-[11px] text-white/60 mt-0.5">{stat.desc}</p>
              </div>
            ))}
          </div>
        </Container>
      </section>

      {/* ═══ 2. INTERACTIVE 8-STEP WORKFLOW INSPECTOR ═══ */}
      <section className="py-16 md:py-24 bg-[var(--aura-off-white)] border-b border-[var(--aura-border)]">
        <Container size="wide">
          <div className="max-w-3xl mx-auto text-center mb-12">
            <span className="inline-flex items-center gap-2 rounded-full border border-[var(--aura-purple)]/20 bg-[var(--aura-lavender)] px-4 py-1 text-xs font-bold uppercase tracking-[.14em] text-[var(--aura-purple)] mb-3">
              <Cpu className="h-3.5 w-3.5" />
              Interactive Step Simulator
            </span>
            <h2 className="text-[clamp(1.85rem,3.5vw,2.75rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Click any stage to inspect the operational data trail
            </h2>
            <p className="mt-3 text-sm md:text-base text-[var(--aura-body)]">
              Follow how an appointment converts into chair allocation, inventory consumption, GST invoice, and owner financial reports.
            </p>
          </div>

          <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-12 gap-6 items-start">
            <div className="lg:col-span-5 space-y-2.5">
              {WORKFLOW_STEPS.map((step) => {
                const isActive = step.id === activeStepId;
                return (
                  <button
                    key={step.id}
                    type="button"
                    onClick={() => setActiveStepId(step.id)}
                    className={`w-full text-left p-4 rounded-2xl border transition-all flex items-start justify-between gap-3 ${
                      isActive
                        ? "border-[var(--aura-purple)] bg-white shadow-[0_12px_32px_rgba(111,79,216,0.12)] ring-1 ring-[var(--aura-purple)]/30 -translate-y-0.5"
                        : "border-[var(--aura-border)] bg-white/70 hover:bg-white hover:border-[var(--aura-purple)]/30"
                    }`}
                  >
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded-md border ${step.actorBadgeColor}`}>
                          {step.actor}
                        </span>
                        <span className="text-[11px] font-mono text-[var(--aura-muted)]">
                          Stage {String(step.id).padStart(2, "0")}
                        </span>
                      </div>
                      <h3 className="text-xs md:text-sm font-bold text-[var(--aura-heading)] truncate">
                        {step.title}
                      </h3>
                      <p className="text-[11px] text-[var(--aura-body)] mt-0.5 line-clamp-1">
                        {step.shortDesc}
                      </p>
                    </div>
                    <ChevronRight
                      className={`h-4 w-4 shrink-0 mt-2 transition-transform duration-200 ${
                        isActive ? "text-[var(--aura-purple)] translate-x-1" : "text-slate-400"
                      }`}
                    />
                  </button>
                );
              })}
            </div>

            <div className="lg:col-span-7 sticky top-24 rounded-3xl border border-[var(--aura-border)] bg-white p-6 sm:p-8 shadow-[0_24px_70px_rgba(72,45,151,0.08)]">
              <div className="flex items-center justify-between border-b border-[var(--aura-border)] pb-4 mb-6">
                <div>
                  <span className={`inline-block text-[11px] font-bold px-2.5 py-0.5 rounded-full border ${activeStep.actorBadgeColor} mb-1.5`}>
                    Active Actor: {activeStep.actor}
                  </span>
                  <h3 className="text-xl font-extrabold text-[var(--aura-heading)]">
                    {activeStep.title}
                  </h3>
                </div>
                <div className="text-right">
                  <span className="text-2xl font-display font-bold italic text-[var(--aura-purple)]">
                    #{String(activeStep.id).padStart(2, "0")}
                  </span>
                </div>
              </div>

              <p className="text-sm text-[var(--aura-body)] leading-relaxed mb-6">
                {activeStep.details}
              </p>

              <div className="grid sm:grid-cols-2 gap-3 mb-6">
                <div className="p-3.5 rounded-xl border border-purple-100 bg-purple-50/50 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-purple-700 block mb-1">
                    ⚡ Trigger Event
                  </span>
                  <p className="text-[var(--aura-heading)] font-medium leading-snug">
                    {activeStep.triggerEvent}
                  </p>
                </div>
                <div className="p-3.5 rounded-xl border border-emerald-100 bg-emerald-50/50 text-xs">
                  <span className="text-[10px] font-bold uppercase tracking-wider text-emerald-700 block mb-1">
                    🎯 Downstream Impact
                  </span>
                  <p className="text-[var(--aura-heading)] font-medium leading-snug">
                    {activeStep.downstreamImpact}
                  </p>
                </div>
              </div>

              <div className="rounded-2xl border border-[var(--aura-border)] bg-slate-900 text-slate-100 p-4 font-mono text-xs shadow-inner">
                <div className="flex items-center justify-between border-b border-slate-800 pb-2 mb-3">
                  <div className="flex items-center gap-2">
                    <span className="h-2 w-2 rounded-full bg-emerald-400 animate-pulse" />
                    <span className="text-[11px] font-bold text-slate-300">{activeStep.livePayload.title}</span>
                  </div>
                  <span className="text-[10px] text-slate-500">tenant: aura_jubilee_main</span>
                </div>

                <div className="space-y-2 text-[11px]">
                  {activeStep.livePayload.items.map((item, idx) => (
                    <div key={idx} className="flex justify-between items-center py-1 border-b border-slate-800/60 last:border-0">
                      <span className="text-slate-400">{item.label}:</span>
                      <span className="font-bold text-purple-300">{item.value}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="mt-6 pt-4 border-t border-[var(--aura-border)] flex items-center justify-between text-xs">
                <button
                  type="button"
                  disabled={activeStepId <= 1}
                  onClick={() => setActiveStepId((prev) => Math.max(1, prev - 1))}
                  className="px-4 py-2 rounded-xl border border-[var(--aura-border)] font-bold text-[var(--aura-heading)] disabled:opacity-30 disabled:cursor-not-allowed hover:bg-slate-50"
                >
                  ← Previous Stage
                </button>
                <span className="text-slate-400 font-semibold">
                  Stage {activeStepId} of {WORKFLOW_STEPS.length}
                </span>
                <button
                  type="button"
                  disabled={activeStepId >= WORKFLOW_STEPS.length}
                  onClick={() => setActiveStepId((prev) => Math.min(WORKFLOW_STEPS.length, prev + 1))}
                  className="px-4 py-2 rounded-xl bg-[var(--aura-purple)] text-white font-bold disabled:opacity-30 disabled:cursor-not-allowed hover:bg-[var(--aura-purple-hover)] shadow-xs"
                >
                  Next Stage →
                </button>
              </div>
            </div>
          </div>
        </Container>
      </section>

      {/* ═══ 3. THREE OPERATIONAL PILLARS ═══ */}
      <section className="py-16 md:py-24 bg-white border-b border-[var(--aura-border)]">
        <Container>
          <div className="mx-auto max-w-2xl text-center mb-14">
            <span className="text-[11px] font-bold uppercase tracking-[.2em] text-[var(--aura-purple)]">
              Core Ecosystem Pillars
            </span>
            <h2 className="mt-2 text-[clamp(2rem,4vw,3rem)] font-extrabold text-[var(--aura-heading)] tracking-tight">
              Three pillars that keep the salon day unbroken
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed">
              Why separating booking, floor operations, and closing into disconnected tools causes irreversible data leaks.
            </p>
          </div>

          <div className="grid gap-6 md:grid-cols-3 max-w-6xl mx-auto">
            {page.sections.map((section, idx) => {
              const icons = [Calendar, Receipt, BarChart3];
              const SectionIcon = icons[idx % icons.length];
              const colors = ["#6F4FD8", "#059669", "#D97706"];
              const color = colors[idx % colors.length];

              return (
                <div
                  key={section.title}
                  className="flex flex-col rounded-3xl border border-[var(--aura-border)] bg-white p-7 md:p-8 shadow-xs hover:shadow-[0_20px_50px_rgba(111,79,216,0.1)] hover:border-[var(--aura-purple)]/30 transition-all duration-300"
                >
                  <div className="flex items-center justify-between mb-5">
                    <div
                      className="w-12 h-12 rounded-2xl flex items-center justify-center shadow-xs"
                      style={{ backgroundColor: `${color}15` }}
                    >
                      <SectionIcon className="w-6 h-6" style={{ color }} />
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

      {/* ═══ 4. PLATFORM FAMILY NAVIGATION ═══ */}
      <section className="border-y border-[var(--aura-border)] bg-[var(--aura-off-white)] py-14">
        <Container>
          <div className="text-center mb-8">
            <span className="text-[10px] font-bold uppercase tracking-[.2em] text-[var(--aura-muted)]">
              Explore Connected Experiences
            </span>
          </div>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-5 max-w-6xl mx-auto">
            {FAMILY_LINKS.map(({ route, href, icon: Icon, desc }) => {
              const linkedPage = copy.route[route];
              const active = route === "workflows";
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

      {/* ═══ 5. FINAL CALL TO ACTION ═══ */}
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
              Test your salon workflow on Aura
            </h2>
            <p className="mt-4 text-base text-[var(--aura-body)] leading-relaxed max-w-xl mx-auto">
              Schedule a personalized walkthrough with your specific branch count, service menu, and staff commission rules.
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